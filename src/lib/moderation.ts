import { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/pulse";
import { resolveChatReportReason } from "@/lib/chat-report-reasons";
import { buildPlayziSystemEmailHtml, getPlayziEmailBaseUrl, sendPlayziSystemEmail } from "@/lib/email/system";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ModerationStage = "incident_logged" | "warning" | "chat_restriction" | "temporary_suspension";
export type ModerationEmailStage = Exclude<ModerationStage, "incident_logged"> | "sanction_lifted";
type ModerationEmailOptions = {
    durationDays?: number;
    context?: "feedback";
    reasonLabel?: string;
};
type ModeratorAccessDebug = {
    user_id: string;
    user_email: string | null;
    allowed: boolean;
    matched_by_email: boolean;
    matched_by_user_id: boolean;
    matched_by_grade: boolean;
    matched_by_auth_role: boolean;
    profile_grade: string | null;
    expected_grade_values: string[];
};

type ModerationNotificationLevel = "info" | "warning" | "restriction" | "suspension";

export function getCurrentSeasonId(date = new Date()) {
    const year = date.getUTCFullYear();
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
}

export function getChatReportThreshold(chatParticipantsCount: number) {
    return Math.max(Math.ceil(chatParticipantsCount * 0.5), 3);
}

export function getPulseFeedbackThreshold(activityParticipantsCount: number) {
    return Math.ceil(activityParticipantsCount * 0.5);
}

export function mapChatReasonCode(reason: string) {
    return resolveChatReportReason(reason);
}

export function deriveModerationStage(incidentCount: number): ModerationStage {
    if (incidentCount >= 4) return "temporary_suspension";
    if (incidentCount >= 3) return "chat_restriction";
    if (incidentCount >= 2) return "warning";
    return "incident_logged";
}

export async function isModeratorUser(supabase: SupabaseClient, user: User) {
    const details = await getModeratorAccessDebug(supabase, user);
    return details.allowed;
}

export async function getModeratorAccessDebug(supabase: SupabaseClient, user: User): Promise<ModeratorAccessDebug> {
    const adminEmailsRaw = process.env.MODERATION_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
    const adminEmails = new Set(
        adminEmailsRaw
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)
    );

    const adminUserIdsRaw = process.env.MODERATION_ADMIN_USER_IDS || "";
    const adminUserIds = new Set(
        adminUserIdsRaw
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
    );

    const { data: profile } = await supabase
        .from("profiles")
        .select("grade")
        .eq("id", user.id)
        .maybeSingle();

    const expectedGradeValues = ["admin", "moderator", "moderation", "mod"];
    const grade = String(profile?.grade || "").toLowerCase().trim();
    const userRecord = user as unknown as { app_metadata?: { role?: unknown }; user_metadata?: { role?: unknown } };
    const authRole = String(userRecord.app_metadata?.role || userRecord.user_metadata?.role || "").toLowerCase().trim();

    const matchedByEmail = !!(user.email && adminEmails.has(user.email.toLowerCase()));
    const matchedByUserId = adminUserIds.has(user.id);
    const matchedByGrade = expectedGradeValues.includes(grade);
    const matchedByAuthRole = expectedGradeValues.includes(authRole);

    return {
        user_id: user.id,
        user_email: user.email || null,
        allowed: matchedByEmail || matchedByUserId || matchedByGrade || matchedByAuthRole,
        matched_by_email: matchedByEmail,
        matched_by_user_id: matchedByUserId,
        matched_by_grade: matchedByGrade,
        matched_by_auth_role: matchedByAuthRole,
        profile_grade: profile?.grade ? String(profile.grade) : null,
        expected_grade_values: expectedGradeValues,
    };
}

export async function getChatParticipantContext(supabase: SupabaseClient, activityId: string) {
    const { data: activity, error: activityError } = await supabase
        .from("activities")
        .select("id,creator_id,sport,start_time,location")
        .eq("id", activityId)
        .single();

    if (activityError || !activity) {
        throw new Error(activityError?.message || "Activity introuvable");
    }

    const { data: participations, error: pError } = await supabase
        .from("participations")
        .select("user_id,status")
        .eq("activity_id", activityId)
        .eq("status", "confirmé");

    if (pError) {
        throw new Error(pError.message);
    }

    const participantsSet = new Set<string>();
    if (activity.creator_id) participantsSet.add(activity.creator_id);
    for (const row of participations || []) {
        if (row.user_id) participantsSet.add(row.user_id);
    }

    return {
        activity,
        participants: Array.from(participantsSet),
        participantsCount: participantsSet.size,
    };
}

export async function getUserModerationAccessStatus(
    supabase: SupabaseClient,
    userId: string,
    seasonId = getCurrentSeasonId(),
) {
    const { data } = await supabase
        .from("moderation_user_status")
        .select("incident_count,moderation_level,chat_restricted_until,suspended_until,season_id")
        .eq("user_id", userId);

    const now = Date.now();
    const rows = Array.isArray(data) ? data : [];
    const seasonRow = rows.find((row) => row.season_id === seasonId) || rows[0] || null;

    const maxChatRestrictedUntil = rows.reduce<string | null>((acc, row) => {
        const iso = row?.chat_restricted_until || null;
        if (!iso) return acc;
        if (!acc) return iso;
        return new Date(iso).getTime() > new Date(acc).getTime() ? iso : acc;
    }, null);

    const maxSuspendedUntil = rows.reduce<string | null>((acc, row) => {
        const iso = row?.suspended_until || null;
        if (!iso) return acc;
        if (!acc) return iso;
        return new Date(iso).getTime() > new Date(acc).getTime() ? iso : acc;
    }, null);

    const chatRestricted = !!maxChatRestrictedUntil && new Date(maxChatRestrictedUntil).getTime() > now;
    const suspended = !!maxSuspendedUntil && new Date(maxSuspendedUntil).getTime() > now;

    return {
        incident_count: Number(seasonRow?.incident_count || 0),
        moderation_level: (seasonRow?.moderation_level as string) || "none",
        chat_restricted_until: maxChatRestrictedUntil,
        suspended_until: maxSuspendedUntil,
        chatRestricted,
        suspended,
    };
}

async function sendEmailViaResend(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
}) {
    return sendPlayziSystemEmail(input);
}

function buildModerationEmailHtml(input: { title: string; paragraphs: string[]; bullets?: string[]; showGuidelinesLink?: boolean }) {
    const guidelinesUrl = `${getPlayziEmailBaseUrl()}/community-guidelines`;
    const bulletParagraphs = (input.bullets || []).map((b) => `• ${b}`);
    const paragraphs = [
        ...input.paragraphs.filter((p) => p.toLowerCase() !== "bonjour,"),
        ...bulletParagraphs,
    ];
    return buildPlayziSystemEmailHtml({
        title: input.title,
        paragraphs,
        ctaLabel: input.showGuidelinesLink ? "Consulter les règles de la communauté Playzi" : undefined,
        ctaHref: input.showGuidelinesLink ? guidelinesUrl : undefined,
    });
}

export function buildUserModerationEmail(stage: ModerationEmailStage, options?: ModerationEmailOptions) {
    if (stage === "warning") {
        if (options?.context === "feedback") {
            const reasonLine = options.reasonLabel ? `Motif relevé : ${options.reasonLabel}.` : "";
            const subject = "Avertissement concernant votre comportement";
            const text = [
                "Bonjour,",
                "",
                "Un avertissement a été enregistré suite à un incident remonté dans les feedbacks d’activité.",
                reasonLine,
                "Merci de veiller au respect des autres participants lors de vos prochaines activités.",
                "",
                "L’équipe Playzi",
            ].filter(Boolean).join("\n");
            const html = buildModerationEmailHtml({
                title: "Avertissement concernant votre comportement",
                paragraphs: [
                    "Bonjour,",
                    "Un avertissement a été enregistré suite à un incident remonté dans les feedbacks d’activité.",
                    reasonLine,
                    "Merci de veiller au respect des autres participants lors de vos prochaines activités.",
                ].filter(Boolean),
                showGuidelinesLink: true,
            });
            return { subject, text, html };
        }

        const subject = "Avertissement – Rappel des règles";
        const text = [
            "Bonjour,",
            "",
            "Suite à un signalement validé concernant votre comportement sur la plateforme, un deuxième avertissement a été enregistré sur votre compte.",
            "",
            "Nous vous rappelons que Playzi est une plateforme basée sur le respect et la convivialité entre participants.",
            "",
            "En cas de nouveaux signalements validés, des restrictions temporaires (chat ou suspension du compte) pourront être appliquées.",
            "",
            "Nous vous invitons à respecter les règles de la communauté afin d’éviter toute sanction supplémentaire.",
            "",
            "L’équipe Playzi",
        ].join("\n");
        const html = buildModerationEmailHtml({
            title: "Avertissement – Rappel des règles",
            paragraphs: [
                "Bonjour,",
                "Suite à un signalement validé concernant votre comportement sur la plateforme, un deuxième avertissement a été enregistré sur votre compte.",
                "Nous vous rappelons que Playzi est une plateforme basée sur le respect et la convivialité entre participants.",
                "En cas de nouveaux signalements validés, des restrictions temporaires (chat ou suspension du compte) pourront être appliquées.",
                "Nous vous invitons à respecter les règles de la communauté afin d’éviter toute sanction supplémentaire.",
            ],
            showGuidelinesLink: true,
        });
        return { subject, text, html };
    }

    if (stage === "chat_restriction") {
        const days = Math.max(1, Number(options?.durationDays || 7));
        const subject = "Restriction temporaire du chat – Playzi";
        const text = [
            "Bonjour,",
            "",
            `Suite à plusieurs signalements validés, votre accès au chat est temporairement restreint pendant ${days} jours.`,
            "",
            "Pendant cette période :",
            "- vous pouvez toujours consulter les activités",
            "- vous pouvez lire les messages dans les chats",
            "- mais vous ne pouvez plus envoyer de nouveaux messages",
            "",
            "Cette restriction prendra fin automatiquement à l’issue de la période.",
            "",
            "Nous vous remercions de respecter les règles de la communauté Playzi.",
            "",
            "L’équipe Playzi",
        ].join("\n");
        const html = buildModerationEmailHtml({
            title: "Restriction temporaire du chat",
            paragraphs: [
                "Bonjour,",
                `Suite à plusieurs signalements validés, votre accès au chat est temporairement restreint pendant ${days} jours.`,
                "Cette restriction prendra fin automatiquement à l’issue de la période.",
                "Nous vous remercions de respecter les règles de la communauté Playzi.",
            ],
            bullets: [
                "vous pouvez toujours consulter les activités",
                "vous pouvez lire les messages dans les chats",
                "mais vous ne pouvez plus envoyer de nouveaux messages",
            ],
            showGuidelinesLink: true,
        });
        return { subject, text, html };
    }

    if (stage === "temporary_suspension") {
        const days = Math.max(1, Number(options?.durationDays || 7));
        const subject = "Suspension temporaire du compte – Playzi";
        const text = [
            "Bonjour,",
            "",
            `Suite à plusieurs signalements validés ou à une décision de modération, votre compte Playzi est temporairement suspendu pendant ${days} jours.`,
            "",
            "Pendant cette période :",
            "- vous pouvez consulter l’application",
            "- mais vous ne pouvez pas :",
            "  - créer d’activités",
            "  - rejoindre des activités",
            "  - envoyer de messages",
            "",
            "Votre accès normal sera automatiquement rétabli à la fin de la période de suspension.",
            "",
            "Nous vous remercions de respecter les règles de la communauté Playzi.",
            "",
            "L’équipe Playzi",
        ].join("\n");
        const html = buildModerationEmailHtml({
            title: "Suspension temporaire du compte",
            paragraphs: [
                "Bonjour,",
                `Suite à plusieurs signalements validés ou à une décision de modération, votre compte Playzi est temporairement suspendu pendant ${days} jours.`,
                "Votre accès normal sera automatiquement rétabli à la fin de la période de suspension.",
                "Nous vous remercions de respecter les règles de la communauté Playzi.",
            ],
            bullets: [
                "vous pouvez consulter l’application",
                "mais vous ne pouvez pas créer d’activités",
                "vous ne pouvez pas rejoindre des activités",
                "vous ne pouvez pas envoyer de messages",
            ],
            showGuidelinesLink: true,
        });
        return { subject, text, html };
    }

    const subject = "Sanction levée – Playzi";
    const text = [
        "Bonjour,",
        "",
        "La restriction appliquée à votre compte Playzi a été levée.",
        "",
        "Vous pouvez désormais utiliser normalement toutes les fonctionnalités de la plateforme.",
        "",
        "Nous vous remercions de continuer à respecter les règles de la communauté afin de garantir une expérience agréable pour tous les participants.",
        "",
        "L’équipe Playzi",
    ].join("\n");
    const html = buildModerationEmailHtml({
        title: "Sanction levée",
        paragraphs: [
            "Bonjour,",
            "La restriction appliquée à votre compte Playzi a été levée.",
            "Vous pouvez désormais utiliser normalement toutes les fonctionnalités de la plateforme.",
            "Nous vous remercions de continuer à respecter les règles de la communauté afin de garantir une expérience agréable pour tous les participants.",
        ],
    });
    return { subject, text, html };
}

export async function createModerationNotification(
    supabase: SupabaseClient,
    userId: string,
    stage: ModerationStage,
    metadata: Record<string, unknown>
) {
    const payloadByStage: Record<ModerationStage, { title: string; body: string; level: ModerationNotificationLevel }> = {
        incident_logged: {
            title: "Incident enregistré",
            body: "Un signalement validé lié au chat a été enregistré sur votre compte.",
            level: "warning",
        },
        warning: {
            title: "Avertissement",
            body: "Plusieurs signalements validés ont été enregistrés sur votre compte.",
            level: "warning",
        },
        chat_restriction: {
            title: "Restriction chat",
            body: "Votre accès au chat est temporairement restreint pendant 7 jours.",
            level: "restriction",
        },
        temporary_suspension: {
            title: "Suspension temporaire",
            body: "Certaines fonctionnalités de votre compte sont suspendues pendant 7 jours.",
            level: "suspension",
        },
    };

    const payload = payloadByStage[stage];
    const defaultEventKey = [
        "stage",
        stage,
        String(metadata.related_activity_id || "na"),
        String(metadata.reason_code || "na"),
        String(metadata.incident_count || "na"),
    ].join(":");

    await createModerationNotificationMessage(supabase, userId, {
        title: payload.title,
        body: payload.body,
        level: payload.level,
        metadata,
        eventKey: defaultEventKey,
    });
}

export async function createModerationNotificationMessage(
    supabase: SupabaseClient,
    userId: string,
    input: {
        title: string;
        body: string;
        level: ModerationNotificationLevel;
        metadata?: Record<string, unknown>;
        eventKey?: string;
    }
) {
    const providedMetadata = input.metadata || {};
    const eventKey = String(
        input.eventKey
        || providedMetadata.notification_event_key
        || [input.level, input.title, input.body].join(":")
    ).trim();

    const metadata = {
        ...providedMetadata,
        notification_event_key: eventKey,
    };

    const { data: existing } = await supabase
        .from("moderation_notifications")
        .select("id")
        .eq("user_id", userId)
        .contains("metadata", { notification_event_key: eventKey })
        .limit(1);

    if ((existing || []).length > 0) {
        return { created: false as const };
    }

    const { error } = await supabase
        .from("moderation_notifications")
        .insert({
            user_id: userId,
            title: input.title,
            body: input.body,
            level: input.level,
            metadata,
        });
    if (error) {
        throw new Error(`moderation_notifications_insert_failed: ${error.message}`);
    }
    return { created: true as const };
}

export async function notifyModerationStageByEmail(
    supabase: SupabaseClient,
    userId: string,
    stage: ModerationEmailStage,
    options?: ModerationEmailOptions
) {
    let email = "";
    try {
        const { data: adminUser } = await supabase.auth.admin.getUserById(userId);
        email = String(adminUser?.user?.email || "").trim();
    } catch {
        email = "";
    }
    if (!email) {
        return { attempted: false, sent: false, error: "missing_user_email" as string | null };
    }

    const template = buildUserModerationEmail(stage, options);
    const sent = await sendEmailViaResend({
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
    });
    if (!sent.sent) {
        return { attempted: true, sent: false, error: sent.reason || "send_failed" };
    }
    return { attempted: true, sent: true, error: null as string | null };
}

export async function logAdminModerationEmail(
    supabase: SupabaseClient,
    input: {
        moderationReportId: string;
        status: "pending" | "sent" | "failed";
        errorMessage?: string | null;
    }
) {
    await supabase
        .from("admin_notifications_log")
        .insert({
            moderation_report_id: input.moderationReportId,
            target: "moderation_admin",
            channel: "email",
            status: input.status,
            error_message: input.errorMessage || null,
            sent_at: input.status === "sent" ? new Date().toISOString() : null,
        });
}

export async function sendAdminModerationEmail(
    supabase: SupabaseClient,
    input: {
        moderationReportId: string;
        reporterPseudo: string;
        reportedPseudo: string;
        activityLabel: string;
        reasonLabel: string;
        reportText: string | null;
        participantsCount: number;
        threshold: number;
        status: "pending" | "validated";
        backofficeUrl: string;
    }
) {
    const toRaw = process.env.MODERATION_ADMIN_EMAILS || process.env.ADMIN_EMAILS || "";
    const recipients = toRaw.split(",").map((v) => v.trim()).filter(Boolean);
    if (recipients.length === 0) {
        await logAdminModerationEmail(supabase, {
            moderationReportId: input.moderationReportId,
            status: "failed",
            errorMessage: "missing_moderation_admin_emails",
        });
        return { attempted: true, sent: false, error: "missing_moderation_admin_emails" as string | null };
    }

    const subject = `Nouveau report Playzi – ${input.reasonLabel}`;
    const text = `Utilisateur reporté : @${input.reportedPseudo}\nUtilisateur reporteur : @${input.reporterPseudo}\nActivité : ${input.activityLabel}\nMotif : ${input.reasonLabel}\nTexte report : ${input.reportText || "-"}\nParticipants dans le chat : ${input.participantsCount}\nSeuil de validation : ${input.threshold}\nStatut : ${input.status}\nBack-office : ${input.backofficeUrl}`;
    const html = buildPlayziSystemEmailHtml({
        title: "Nouveau report Playzi",
        paragraphs: [
            `Utilisateur reporté : @${input.reportedPseudo}`,
            `Utilisateur reporteur : @${input.reporterPseudo}`,
            `Activité : ${input.activityLabel}`,
            `Motif : ${input.reasonLabel}`,
            `Texte report : ${input.reportText || "-"}`,
            `Participants dans le chat : ${input.participantsCount}`,
            `Seuil de validation : ${input.threshold}`,
            `Statut : ${input.status}`,
        ],
        ctaLabel: "Ouvrir le panel de modération",
        ctaHref: input.backofficeUrl,
    });

    let failed = false;
    let lastError: string | null = null;
    for (const to of recipients) {
        const sent = await sendEmailViaResend({ to, subject, text, html });
        if (!sent.sent) {
            failed = true;
            lastError = sent.reason;
        }
    }

    await logAdminModerationEmail(supabase, {
        moderationReportId: input.moderationReportId,
        status: failed ? "failed" : "sent",
        errorMessage: failed ? lastError : null,
    });
    return { attempted: true, sent: !failed, error: failed ? lastError : null };
}

export async function applyChatModerationIncident(
    supabase: SupabaseClient,
    input: {
        userId: string;
        seasonId: string;
        relatedActivityId: string;
        reasonCode: string;
        reportGroupKey: string;
    }
) {
    const { userId, seasonId, relatedActivityId, reasonCode, reportGroupKey } = input;

    const { data: alreadyLogged } = await supabase
        .from("moderation_actions_log")
        .select("id")
        .eq("user_id", userId)
        .eq("season_id", seasonId)
        .eq("action_type", "incident_validated")
        .contains("metadata", { report_group_key: reportGroupKey })
        .limit(1);

    if (alreadyLogged && alreadyLogged.length > 0) {
        const current = await getUserModerationAccessStatus(supabase, userId, seasonId);
        return {
            incidentCount: current.incident_count,
            stage: deriveModerationStage(current.incident_count),
        };
    }

    const { data: currentRow } = await supabase
        .from("moderation_user_status")
        .select("incident_count,chat_restricted_until,suspended_until")
        .eq("user_id", userId)
        .eq("season_id", seasonId)
        .maybeSingle();

    const nextIncidentCount = Number(currentRow?.incident_count || 0) + 1;
    const stage = deriveModerationStage(nextIncidentCount);
    const now = Date.now();
    const sevenDaysIso = new Date(now + 7 * DAY_MS).toISOString();

    const updatePayload: Record<string, unknown> = {
        user_id: userId,
        season_id: seasonId,
        incident_count: nextIncidentCount,
        moderation_level:
            stage === "temporary_suspension"
                ? "suspended"
                : stage === "chat_restriction"
                    ? "chat_restricted"
                    : stage === "warning"
                        ? "warning"
                        : "incident",
    };

    if (stage === "warning") {
        updatePayload.warning_sent_at = new Date().toISOString();
    }

    if (stage === "chat_restriction") {
        const existing = currentRow?.chat_restricted_until ? new Date(currentRow.chat_restricted_until).getTime() : 0;
        updatePayload.chat_restricted_until = new Date(Math.max(existing, now + 7 * DAY_MS)).toISOString();
    }

    if (stage === "temporary_suspension") {
        const existingSuspend = currentRow?.suspended_until ? new Date(currentRow.suspended_until).getTime() : 0;
        const existingChat = currentRow?.chat_restricted_until ? new Date(currentRow.chat_restricted_until).getTime() : 0;
        updatePayload.suspended_until = new Date(Math.max(existingSuspend, now + 7 * DAY_MS)).toISOString();
        updatePayload.chat_restricted_until = new Date(Math.max(existingChat, now + 7 * DAY_MS)).toISOString();
    }

    const { error: upsertStatusError } = await supabase
        .from("moderation_user_status")
        .upsert(updatePayload, { onConflict: "user_id,season_id" });
    if (upsertStatusError) {
        throw new Error(`moderation_user_status_upsert_failed: ${upsertStatusError.message}`);
    }

    const { error: insertActionError } = await supabase
        .from("moderation_actions_log")
        .insert({
            user_id: userId,
            action_type: "incident_validated",
            reason: reasonCode,
            related_activity_id: relatedActivityId,
            season_id: seasonId,
            metadata: {
                report_group_key: reportGroupKey,
                incident_count: nextIncidentCount,
                stage,
            },
        });
    if (insertActionError) {
        throw new Error(`moderation_actions_log_insert_failed: ${insertActionError.message}`);
    }

    await createModerationNotification(supabase, userId, stage, {
        related_activity_id: relatedActivityId,
        reason_code: reasonCode,
        incident_count: nextIncidentCount,
    });
    if (stage === "warning") {
        await notifyModerationStageByEmail(supabase, userId, "warning");
    } else if (stage === "chat_restriction") {
        await notifyModerationStageByEmail(supabase, userId, "chat_restriction", { durationDays: 7 });
    } else if (stage === "temporary_suspension") {
        await notifyModerationStageByEmail(supabase, userId, "temporary_suspension", { durationDays: 7 });
    }

    return {
        incidentCount: nextIncidentCount,
        stage,
        suspensionUntil: stage === "temporary_suspension" ? sevenDaysIso : null,
    };
}

export async function enforceUserCapability(
    supabase: SupabaseClient,
    userId: string,
    capability: "chat_send" | "create_activity" | "join_activity" | "connect_send" | "participation_validate"
) {
    const seasonId = getCurrentSeasonId();
    const status = await getUserModerationAccessStatus(supabase, userId, seasonId);
    const formatDaysFromUntil = (until: string | null) => {
        if (!until) return "quelques jours";
        const ms = new Date(until).getTime() - Date.now();
        if (Number.isNaN(ms) || ms <= 0) return "quelques jours";
        const days = Math.max(1, Math.ceil(ms / DAY_MS));
        return `${days} jour${days > 1 ? "s" : ""}`;
    };

    if (status.suspended) {
        const durationLabel = formatDaysFromUntil(status.suspended_until);
        return {
            allowed: false,
            code: "suspended",
            message: `Votre compte est temporairement suspendu pendant ${durationLabel}.`,
            until: status.suspended_until,
        } as const;
    }

    if (capability === "chat_send" && status.chatRestricted) {
        const durationLabel = formatDaysFromUntil(status.chat_restricted_until);
        return {
            allowed: false,
            code: "chat_restricted",
            message: `Votre accès au chat est temporairement restreint pendant ${durationLabel}.`,
            until: status.chat_restricted_until,
        } as const;
    }

    return { allowed: true } as const;
}

export function getModerationServiceClient() {
    return createServiceRoleClient();
}

const ADMIN_EMAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const adminEmailCache = new Map<string, { email: string | null; expiresAt: number }>();

async function fetchEmailsFromAuthUsers(
    supabase: SupabaseClient,
    userIds: string[]
): Promise<Map<string, string | null> | null> {
    if (userIds.length === 0) return new Map();
    const { data, error } = await supabase
        .schema("auth")
        .from("users")
        .select("id,email")
        .in("id", userIds);
    if (error) return null;
    const rows = Array.isArray(data) ? data as Array<{ id: string; email: string | null }> : [];
    return new Map(rows.map((row) => [String(row.id), row.email ? String(row.email).toLowerCase() : null]));
}

async function fetchEmailsFromAdminApi(
    supabase: SupabaseClient,
    userIds: string[],
): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();
    const concurrency = 10;
    for (let i = 0; i < userIds.length; i += concurrency) {
        const batch = userIds.slice(i, i + concurrency);
        const rows = await Promise.all(batch.map(async (id) => {
            try {
                const { data } = await supabase.auth.admin.getUserById(id);
                return [id, data?.user?.email ? String(data.user.email).toLowerCase() : null] as const;
            } catch {
                return [id, null] as const;
            }
        }));
        for (const [id, email] of rows) result.set(id, email);
    }
    return result;
}

export async function resolveUserEmailsForAdmin(
    supabase: SupabaseClient,
    userIds: string[]
): Promise<Map<string, string | null>> {
    const uniqueIds = Array.from(new Set(userIds.map((id) => String(id || "").trim()).filter(Boolean)));
    const now = Date.now();
    const emailById = new Map<string, string | null>();
    const missingIds: string[] = [];

    for (const id of uniqueIds) {
        const cached = adminEmailCache.get(id);
        if (cached && cached.expiresAt > now) {
            emailById.set(id, cached.email);
        } else {
            missingIds.push(id);
        }
    }

    if (missingIds.length === 0) return emailById;

    const authUsersMap = await fetchEmailsFromAuthUsers(supabase, missingIds);
    const stillMissing: string[] = [];

    if (authUsersMap) {
        for (const id of missingIds) {
            if (authUsersMap.has(id)) {
                const email = authUsersMap.get(id) ?? null;
                emailById.set(id, email);
                adminEmailCache.set(id, { email, expiresAt: now + ADMIN_EMAIL_CACHE_TTL_MS });
            } else {
                stillMissing.push(id);
            }
        }
    } else {
        stillMissing.push(...missingIds);
    }

    if (stillMissing.length > 0) {
        const fallbackMap = await fetchEmailsFromAdminApi(supabase, stillMissing);
        for (const id of stillMissing) {
            const email = fallbackMap.get(id) ?? null;
            emailById.set(id, email);
            adminEmailCache.set(id, { email, expiresAt: now + ADMIN_EMAIL_CACHE_TTL_MS });
        }
    }

    return emailById;
}
