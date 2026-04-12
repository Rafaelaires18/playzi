import { SupabaseClient } from "@supabase/supabase-js";
import { buildPulseEventKey, PULSE_REASONS, recordPulseTransaction } from "@/lib/pulse";
import {
    applyChatModerationIncident,
    getChatParticipantContext,
    getChatReportThreshold,
    getCurrentSeasonId,
    getModerationServiceClient,
    getPulseFeedbackThreshold,
    sendAdminModerationEmail,
} from "@/lib/moderation";
import { resolveChatReportReason } from "@/lib/chat-report-reasons";

export class ReportingError extends Error {
    status: number;
    details?: unknown;

    constructor(message: string, status = 400, details?: unknown) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

export function normalizeReason(raw: string) {
    return raw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

type ReportChannel = "chat" | "feedback";
type ReportType = "absence" | "problem";

type SubmitReportsInput = {
    supabase: SupabaseClient;
    activityId: string;
    reporterId: string;
    type: ReportType;
    reason: string;
    description?: string;
    reportedUserIds: string[];
    channel?: ReportChannel;
};

function mapFeedbackReasonToPulse(reason: string, type: ReportType) {
    const normalized = normalizeReason(reason);

    if (type === "absence" || normalized.includes("no-show") || normalized.includes("absence") || normalized.includes("faux plan")) {
        return {
            reasonCode: PULSE_REASONS.NO_SHOW.code,
            reasonLabel: PULSE_REASONS.NO_SHOW.label,
            penalty: PULSE_REASONS.NO_SHOW.points,
        };
    }

    if (normalized.includes("retard")) {
        return {
            reasonCode: PULSE_REASONS.LATE_30M.code,
            reasonLabel: PULSE_REASONS.LATE_30M.label,
            penalty: PULSE_REASONS.LATE_30M.points,
        };
    }

    return {
        reasonCode: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.code,
        reasonLabel: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.label,
        penalty: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.points,
    };
}

function isChatReasonForbidden(reason: string) {
    const normalized = normalizeReason(reason);
    return normalized.includes("absence")
        || normalized.includes("no-show")
        || normalized.includes("faux plan")
        || normalized.includes("retard");
}

function matchFeedbackTag(tag: unknown, reason: string) {
    if (typeof tag !== "string") return false;
    return normalizeReason(tag) === normalizeReason(reason);
}

async function fetchPseudoById(supabase: SupabaseClient, userId: string) {
    const { data } = await supabase
        .from("profiles")
        .select("pseudo")
        .eq("id", userId)
        .maybeSingle();
    return String(data?.pseudo || "utilisateur");
}

export async function submitActivityReports(input: SubmitReportsInput) {
    const {
        supabase,
        activityId,
        reporterId,
        type,
        reason,
        description,
        reportedUserIds,
        channel = "chat",
    } = input;

    const uniqueTargets = Array.from(new Set(reportedUserIds.filter((id) => id && id !== reporterId)));
    if (uniqueTargets.length === 0) {
        throw new ReportingError("Sélectionnez au moins une personne concernée.", 400);
    }

    const seasonId = getCurrentSeasonId();
    const context = await getChatParticipantContext(supabase, activityId);

    if (!context.participants.includes(reporterId)) {
        throw new ReportingError("Vous n'avez pas accès à cette activité.", 403);
    }

    const participantsCount = context.participantsCount;

    if (channel === "feedback") {
        const threshold = getPulseFeedbackThreshold(participantsCount);
        const mapping = mapFeedbackReasonToPulse(reason, type);

        let sanctionsApplied = 0;
        for (const targetId of uniqueTargets) {
            const { data: feedbackRows, error: feedbackErr } = await supabase
                .from("activity_feedback")
                .select("reviewer_id,tags")
                .eq("activity_id", activityId)
                .eq("reviewed_user_id", targetId);

            if (feedbackErr) {
                throw new ReportingError("Impossible d'évaluer le consensus feedback.", 500, feedbackErr.message);
            }

            const distinctReporters = new Set(
                (feedbackRows || [])
                    .filter((row: any) => Array.isArray(row.tags) && row.tags.some((tag: unknown) => matchFeedbackTag(tag, reason)))
                    .map((row: any) => row.reviewer_id)
                    .filter(Boolean)
            );

            if (distinctReporters.size < threshold) continue;

            await recordPulseTransaction(supabase, {
                userId: targetId,
                activityId,
                sourceType: "feedback_report",
                points: mapping.penalty,
                reasonCode: mapping.reasonCode,
                reasonLabel: mapping.reasonLabel,
                uniqueEventKey: buildPulseEventKey(["feedback", activityId, targetId, mapping.reasonCode, "sanction"]),
                metadata: {
                    threshold,
                    distinct_reporters: distinctReporters.size,
                    reason,
                },
            });
            sanctionsApplied += 1;
        }

        return {
            count: uniqueTargets.length,
            threshold,
            sanctionsApplied,
            moderationIncidentsValidated: 0,
            moderationActions: [] as Array<{ reported_id: string; validated_incidents: number; stage: string }>,
            reasonCode: mapping.reasonCode,
            requiresManualReview: false,
        };
    }

    // Chat moderation channel
    if (isChatReasonForbidden(reason)) {
        throw new ReportingError("Ce motif n'est pas disponible dans le chat. Utilisez le feedback post-activité.", 400);
    }

    const reasonMap = resolveChatReportReason(reason);
    const isOther = reasonMap.code === "other";
    if (isOther && !description?.trim()) {
        throw new ReportingError("Une explication est obligatoire pour le motif « Autre ».", 400);
    }

    const threshold = getChatReportThreshold(participantsCount);
    const serviceRoleDb = getModerationServiceClient();
    const moderationDb = serviceRoleDb ?? supabase;
    const debugEnvelope: {
        channel: ReportChannel;
        storage_table: string;
        activity_id: string;
        reporter_id: string;
        reason_code: string;
        participants_count: number;
        threshold: number;
        db_mode: "service_role" | "session_rls";
        insert: {
            attempted: boolean;
            success: boolean;
            inserted_count: number;
            inserted_ids: string[];
            error: string | null;
        };
        per_target: Array<{
            reported_id: string;
            grouped_count: number;
            grouped_reporter_ids?: string[];
            grouped_statuses?: string[];
            threshold: number;
            was_already_validated: boolean;
            should_be_validated: boolean;
            became_validated_now: boolean;
            validation_update_error: string | null;
            admin_email: { attempted: boolean; sent: boolean; error: string | null } | null;
        }>;
    } = {
        channel,
        storage_table: "moderation_chat_reports",
        activity_id: activityId,
        reporter_id: reporterId,
        reason_code: reasonMap.code,
        participants_count: participantsCount,
        threshold,
        db_mode: serviceRoleDb ? "service_role" : "session_rls",
        insert: {
            attempted: false,
            success: false,
            inserted_count: 0,
            inserted_ids: [],
            error: null,
        },
        per_target: [],
    };

    const { data: existingRows, error: existingError } = await supabase
        .from("moderation_chat_reports")
        .select("reported_user_id")
        .eq("activity_id", activityId)
        .eq("reporter_user_id", reporterId);

    if (existingError) {
        throw new ReportingError("Impossible de vérifier les signalements existants.", 500, existingError.message);
    }

    const existingCount = (existingRows || []).length;
    const alreadyReportedTargets = new Set((existingRows || []).map((row: any) => row.reported_user_id));

    if (uniqueTargets.some((id) => alreadyReportedTargets.has(id))) {
        throw new ReportingError("Vous avez déjà signalé cette personne pour cette activité.", 409);
    }
    if (existingCount + uniqueTargets.length > 3) {
        throw new ReportingError("Maximum 3 signalements par activité.", 400);
    }

    const normalizedDescription = description?.trim() || null;
    const rowsToInsert = uniqueTargets.map((targetId) => ({
        activity_id: activityId,
        reporter_user_id: reporterId,
        reported_user_id: targetId,
        report_type: "chat",
        // Keep reporter context for every reason, not only "Autre".
        report_text: normalizedDescription,
        report_reason_code: reasonMap.code,
        report_reason_label: reasonMap.label,
        season_id: seasonId,
        status: "pending",
    }));
    console.info("[CHAT_REPORT_DEBUG][reporting][insert_payload]", {
        activity_id: activityId,
        reporter_user_id: reporterId,
        reason_input: reason,
        reason_code: reasonMap.code,
        reason_label: reasonMap.label,
        has_report_text: !!normalizedDescription,
        target_count: rowsToInsert.length,
        targets: uniqueTargets,
    });

    debugEnvelope.insert.attempted = true;
    const { data: insertedRows, error: insertError } = await supabase
        .from("moderation_chat_reports")
        .insert(rowsToInsert)
        .select("id,reported_user_id");

    if (insertError) {
        debugEnvelope.insert.error = insertError.message || "insert_failed";
        if (insertError.code === "23505") {
            throw new ReportingError("Vous avez déjà signalé cette personne pour cette activité.", 409, { debug: debugEnvelope });
        }
        throw new ReportingError("Erreur lors de l'enregistrement du signalement.", 500, { error: insertError.message, debug: debugEnvelope });
    }
    debugEnvelope.insert.success = true;
    debugEnvelope.insert.inserted_count = (insertedRows || []).length;
    debugEnvelope.insert.inserted_ids = (insertedRows || []).map((row: any) => String(row.id)).filter(Boolean);
    console.info("[CHAT_REPORT_DEBUG][reporting][insert_result]", {
        activity_id: activityId,
        reporter_user_id: reporterId,
        reason_code: reasonMap.code,
        inserted_count: debugEnvelope.insert.inserted_count,
        inserted_ids: debugEnvelope.insert.inserted_ids,
    });

    const reporterPseudo = await fetchPseudoById(supabase, reporterId);
    const moderationActions: Array<{ reported_id: string; validated_incidents: number; stage: string }> = [];
    let moderationIncidentsValidated = 0;
    const moderationDebug: Array<{
        reported_id: string;
        distinct_reporters: number;
        threshold: number;
        was_already_validated: boolean;
        became_validated_now: boolean;
        should_be_validated: boolean;
        admin_email: { attempted: boolean; sent: boolean; error: string | null } | null;
    }> = [];

    for (const targetId of uniqueTargets) {
        const { data: alreadyValidatedRows, error: alreadyValidatedError } = await moderationDb
            .from("moderation_chat_reports")
            .select("id")
            .eq("activity_id", activityId)
            .eq("reported_user_id", targetId)
            .eq("report_reason_code", reasonMap.code)
            .eq("status", "validated")
            .limit(1);

        if (alreadyValidatedError) {
            throw new ReportingError("Impossible de vérifier l'état de validation actuel.", 500, alreadyValidatedError.message);
        }
        const wasAlreadyValidated = !!(alreadyValidatedRows && alreadyValidatedRows.length > 0);

        const { data: groupedRows, error: groupedError } = await moderationDb
            .from("moderation_chat_reports")
            .select("reporter_user_id,status,season_id")
            .eq("activity_id", activityId)
            .eq("reported_user_id", targetId)
            .eq("report_reason_code", reasonMap.code)
            .in("status", ["pending", "validated"]);

        if (groupedError) {
            throw new ReportingError("Impossible d'évaluer le consensus de signalement.", 500, groupedError.message);
        }

        const distinctReporters = new Set((groupedRows || []).map((row: any) => row.reporter_user_id).filter(Boolean));
        const groupedReporterIds = Array.from(distinctReporters);
        const groupedStatuses = Array.from(new Set((groupedRows || []).map((row: any) => String(row.status || "")).filter(Boolean)));
        const shouldBeValidated = distinctReporters.size >= threshold;
        const becameValidatedNow = !wasAlreadyValidated && shouldBeValidated;

        let adminEmailResult: { attempted: boolean; sent: boolean; error: string | null } | null = null;

        if (shouldBeValidated) {
            const groupKey = buildPulseEventKey(["chat", activityId, seasonId, targetId, reasonMap.code]);
            const { error: updateValidationError } = await moderationDb
                .from("moderation_chat_reports")
                .update({
                    status: "validated",
                    validated_at: new Date().toISOString(),
                    validated_group_key: groupKey,
                })
                .eq("activity_id", activityId)
                .eq("reported_user_id", targetId)
                .eq("report_reason_code", reasonMap.code)
                .in("status", ["pending", "validated"]);
            if (updateValidationError) {
                debugEnvelope.per_target.push({
                    reported_id: targetId,
                    grouped_count: distinctReporters.size,
                    grouped_reporter_ids: groupedReporterIds,
                    grouped_statuses: groupedStatuses,
                    threshold,
                    was_already_validated: wasAlreadyValidated,
                    should_be_validated: shouldBeValidated,
                    became_validated_now: becameValidatedNow,
                    validation_update_error: updateValidationError.message || "validation_update_failed",
                    admin_email: adminEmailResult,
                });
                throw new ReportingError("Impossible de passer le report en statut validé.", 500, {
                    error: updateValidationError.message,
                    debug: debugEnvelope,
                });
            }

            const applied = await applyChatModerationIncident(moderationDb, {
                userId: targetId,
                seasonId,
                relatedActivityId: activityId,
                reasonCode: reasonMap.code,
                reportGroupKey: groupKey,
            });

            moderationActions.push({
                reported_id: targetId,
                validated_incidents: applied.incidentCount,
                stage: applied.stage,
            });
            moderationIncidentsValidated += 1;

            if (becameValidatedNow) {
                const targetPseudo = await fetchPseudoById(supabase, targetId);
                const reportRowId = (insertedRows || []).find((row: any) => row.reported_user_id === targetId)?.id;
                if (reportRowId) {
                    const activityLabel = `${context.activity.sport || "Activité"} – ${context.activity.location || "Lieu"}`;
                    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://playzi.app";
                    adminEmailResult = await sendAdminModerationEmail(moderationDb, {
                        moderationReportId: reportRowId,
                        reporterPseudo,
                        reportedPseudo: targetPseudo,
                        activityLabel,
                        reasonLabel: reasonMap.label,
                        reportText: normalizedDescription,
                        participantsCount,
                        threshold,
                        status: "validated",
                        backofficeUrl: `${siteUrl}/admin/moderation`,
                    });
                }
            }
        }

        moderationDebug.push({
            reported_id: targetId,
            distinct_reporters: distinctReporters.size,
            threshold,
            was_already_validated: wasAlreadyValidated,
            became_validated_now: becameValidatedNow,
            should_be_validated: shouldBeValidated,
            admin_email: adminEmailResult,
        });
        debugEnvelope.per_target.push({
            reported_id: targetId,
            grouped_count: distinctReporters.size,
            grouped_reporter_ids: groupedReporterIds,
            grouped_statuses: groupedStatuses,
            threshold,
            was_already_validated: wasAlreadyValidated,
            should_be_validated: shouldBeValidated,
            became_validated_now: becameValidatedNow,
            validation_update_error: null,
            admin_email: adminEmailResult,
        });
    }

    return {
        count: uniqueTargets.length,
        threshold,
        sanctionsApplied: 0,
        moderationIncidentsValidated,
        moderationActions,
        moderationDebug,
        reportDebug: debugEnvelope,
        reasonCode: reasonMap.code,
        requiresManualReview: isOther,
    };
}
