import { SupabaseClient } from "@supabase/supabase-js";
import { buildPulseEventKey, computeReportThreshold, PULSE_REASONS, recordPulseTransaction } from "@/lib/pulse";

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

export function mapReportReason(type: "absence" | "problem", reason: string) {
    const normalized = normalizeReason(reason);
    if (type === "absence") {
        return {
            reasonCode: PULSE_REASONS.NO_SHOW.code,
            reasonLabel: PULSE_REASONS.NO_SHOW.label,
            penalty: PULSE_REASONS.NO_SHOW.points,
            requiresManualReview: false,
            auto: true,
        };
    }
    if (normalized.includes("retard")) {
        return {
            reasonCode: PULSE_REASONS.LATE_30M.code,
            reasonLabel: PULSE_REASONS.LATE_30M.label,
            penalty: PULSE_REASONS.LATE_30M.points,
            requiresManualReview: false,
            auto: true,
        };
    }
    if (normalized.includes("spam")) {
        return {
            reasonCode: PULSE_REASONS.CHAT_SPAM.code,
            reasonLabel: PULSE_REASONS.CHAT_SPAM.label,
            penalty: PULSE_REASONS.CHAT_SPAM.points,
            requiresManualReview: false,
            auto: true,
        };
    }
    if (normalized.includes("insulte") || normalized.includes("harcelement") || normalized.includes("propos deplace")) {
        return {
            reasonCode: PULSE_REASONS.HARASSMENT_INSULTS.code,
            reasonLabel: PULSE_REASONS.HARASSMENT_INSULTS.label,
            penalty: PULSE_REASONS.HARASSMENT_INSULTS.points,
            requiresManualReview: false,
            auto: true,
        };
    }
    if (normalized.includes("autre")) {
        return {
            reasonCode: "other_manual_review",
            reasonLabel: "Autre (revue manuelle)",
            penalty: 0,
            requiresManualReview: true,
            auto: false,
        };
    }
    return {
        reasonCode: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.code,
        reasonLabel: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.label,
        penalty: PULSE_REASONS.INAPPROPRIATE_BEHAVIOR.points,
        requiresManualReview: false,
        auto: true,
    };
}

type SubmitReportsInput = {
    supabase: SupabaseClient;
    activityId: string;
    reporterId: string;
    type: "absence" | "problem";
    reason: string;
    description?: string;
    reportedUserIds: string[];
};

export async function submitActivityReports(input: SubmitReportsInput) {
    const { supabase, activityId, reporterId, type, reason, description, reportedUserIds } = input;
    const reasonMapping = mapReportReason(type, reason);

    if (reasonMapping.requiresManualReview && !description?.trim()) {
        throw new ReportingError("Une description est obligatoire pour le motif « Autre ».", 400);
    }

    if (!reportedUserIds.length) {
        throw new ReportingError("Sélectionnez au moins une personne concernée.", 400);
    }

    const uniqueTargets = Array.from(new Set(reportedUserIds.filter((id) => id !== reporterId)));
    if (!uniqueTargets.length) {
        throw new ReportingError("Aucun utilisateur valide à signaler.", 400);
    }

    const { data: existingRows, error: existingError } = await supabase
        .from("reports")
        .select("reported_id")
        .eq("activity_id", activityId)
        .eq("reporter_id", reporterId);

    if (existingError) {
        throw new ReportingError("Impossible de vérifier les signalements existants.", 500, existingError.message);
    }

    const alreadyReportedTargets = new Set((existingRows || []).map((r: any) => r.reported_id));
    if (uniqueTargets.some((id) => alreadyReportedTargets.has(id))) {
        throw new ReportingError("Vous avez déjà signalé cette personne pour cette activité.", 409);
    }

    const inserts = uniqueTargets.map((targetId) => ({
        activity_id: activityId,
        reporter_id: reporterId,
        reported_id: targetId,
        type,
        reason,
        description: description?.trim() ? description.trim() : null,
        status: "pending",
        reason_code: reasonMapping.reasonCode,
        requires_manual_review: reasonMapping.requiresManualReview,
    }));

    const { error: insertError } = await supabase.from("reports").insert(inserts);
    if (insertError) {
        if (insertError.code === "23505") {
            throw new ReportingError("Un seul report par personne signalée et par activité est autorisé.", 409);
        }
        throw new ReportingError("Erreur lors de l'enregistrement du signalement.", 500, insertError.message);
    }

    const { data: activityRows, error: activityError } = await supabase
        .from("activities")
        .select("creator_id, participations(user_id,status)")
        .eq("id", activityId);

    if (activityError || !activityRows?.length) {
        throw new ReportingError("Impossible de charger les participants pour appliquer les sanctions.", 500, activityError?.message);
    }

    const activity = activityRows[0] as any;
    const confirmedParticipants = (activity.participations || [])
        .filter((p: any) => p.status === "confirmé")
        .map((p: any) => p.user_id);
    const participantsSet = new Set<string>(confirmedParticipants);
    if (activity.creator_id) participantsSet.add(activity.creator_id);
    const threshold = computeReportThreshold(participantsSet.size);

    let sanctionsApplied = 0;
    if (reasonMapping.auto && reasonMapping.penalty < 0) {
        for (const targetId of uniqueTargets) {
            const { data: groupedRows, error: groupedError } = await supabase
                .from("reports")
                .select("reporter_id")
                .eq("activity_id", activityId)
                .eq("reported_id", targetId)
                .eq("reason_code", reasonMapping.reasonCode);

            if (groupedError) {
                throw new ReportingError("Impossible d'évaluer le consensus de signalement.", 500, groupedError.message);
            }

            const distinctReporters = new Set((groupedRows || []).map((row: any) => row.reporter_id));
            if (distinctReporters.size < threshold) continue;

            await recordPulseTransaction(supabase, {
                userId: targetId,
                activityId,
                sourceType: "report",
                points: reasonMapping.penalty,
                reasonCode: reasonMapping.reasonCode,
                reasonLabel: reasonMapping.reasonLabel,
                uniqueEventKey: buildPulseEventKey(["report", activityId, targetId, reasonMapping.reasonCode, "sanction"]),
                metadata: {
                    threshold,
                    distinct_reporters: distinctReporters.size,
                    report_type: type,
                },
            });
            sanctionsApplied += 1;
        }
    }

    return {
        count: inserts.length,
        threshold,
        sanctionsApplied,
        reasonCode: reasonMapping.reasonCode,
        requiresManualReview: reasonMapping.requiresManualReview,
    };
}
