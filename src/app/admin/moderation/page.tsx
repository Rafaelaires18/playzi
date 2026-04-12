"use client";

import { useEffect, useMemo, useState } from "react";

type ModerationRow = {
    id: string;
    created_at: string;
    season_id?: string;
    status: string;
    reason_code: string;
    reason_label: string;
    report_text: string | null;
    all_group_comments?: Array<{ reporter_id: string; reporter_pseudo: string; text: string }>;
    validated_at: string | null;
    reporter: { id: string; pseudo: string };
    reported: { id: string; pseudo: string };
    activity: { id: string; sport: string; start_time: string | null; location: string | null; participants_count?: number };
    moderation_status: {
        incident_count: number;
        moderation_level: string;
        chat_restricted_until?: string | null;
        suspended_until?: string | null;
    } | null;
    warns_count?: number;
};

type ModerationChatMessage = {
    id: string;
    activity_id: string;
    sender_id: string;
    sender_name: string;
    content: string;
    created_at: string;
};

type SanctionRow = {
    user_id: string;
    pseudo: string;
    type: "restrict_chat" | "suspend";
    start_at: string | null;
    end_at: string | null;
    season_id: string;
    activity?: { id: string; sport: string; start_time: string | null; location: string | null; participants_count?: number } | null;
};

type WarningRow = {
    id: string;
    user_id: string;
    pseudo: string;
    type: "warn1" | "warn2";
    created_at: string;
    season_id: string;
    activity?: { id: string; sport: string; start_time: string | null; location: string | null; participants_count?: number } | null;
};

type UserSeasonHistory = {
    season_id: string;
    summary: {
        warn1: number;
        warn2: number;
        restrict: number;
        suspend: number;
    };
};

type FeedbackIncidentRow = {
    id: string;
    activity_id: string;
    reported_user_id: string;
    reported_pseudo: string;
    sport: string;
    location: string | null;
    activity_start_time: string | null;
    reason_code: string;
    reason_label: string;
    votes_count: number;
    participants_count: number;
    threshold: number | null;
    status: "validated" | "informative";
    season_id: string;
    last_scored_at: string | null;
    other_texts: Array<{ reporter_id: string; reporter_pseudo: string; text: string }>;
    moderation_status: {
        incident_count: number;
        moderation_level: string;
        chat_restricted_until?: string | null;
        suspended_until?: string | null;
    } | null;
};

type SupportReportRow = {
    id: string;
    user_id: string;
    user_pseudo: string;
    user_email: string | null;
    category_code: "bug" | "abuse" | "payment" | "other" | string;
    category_label: string;
    description: string;
    image_url: string | null;
    status: "new" | "in_progress" | "resolved" | string;
    created_at: string;
    updated_at: string;
};

type SupportRequestRow = {
    id: string;
    user_id: string;
    user_pseudo: string;
    user_email: string | null;
    request_email: string | null;
    type_code: "age_verification" | "account_access" | "question" | string;
    type_label: string;
    message: string;
    status: "new" | "in_progress" | "resolved" | string;
    created_at: string;
    birth_date: string | null;
    age_verification_status: "verified_adult" | "blocked_minor" | "non_verified" | string;
};

type ManualActionKey = "warn1" | "warn2" | "restrict_chat" | "suspend" | "ignore";
type IgnoreScope = "single" | "group";

function statusBadgeClass(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === "validated") return "border-amber-300 bg-amber-50 text-amber-700";
    if (normalized === "resolved") return "border-emerald-300 bg-emerald-50 text-emerald-700";
    if (normalized === "ignored") return "border-slate-200 bg-slate-50 text-slate-500";
    if (normalized === "dismissed") return "border-slate-200 bg-slate-50 text-slate-500";
    return "border-gray-200 bg-gray-50 text-gray-700";
}

function supportStatusBadgeClass(status: string) {
    if (status === "new") return "border-sky-300 bg-sky-50 text-sky-700";
    if (status === "in_progress") return "border-amber-300 bg-amber-50 text-amber-700";
    if (status === "resolved") return "border-gray-300 bg-gray-100 text-gray-700";
    return "border-gray-200 bg-gray-50 text-gray-700";
}

function supportStatusLabel(status: string) {
    if (status === "new") return "Nouveau";
    if (status === "in_progress") return "En cours";
    if (status === "resolved") return "Traité";
    return status;
}

function ageStatusLabel(status: string) {
    if (status === "verified_adult") return "Majeur vérifié";
    if (status === "blocked_minor") return "Bloqué mineur";
    return "Non vérifié";
}

function formatDaysRemaining(untilIso?: string | null): number | null {
    if (!untilIso) return null;
    const until = new Date(untilIso);
    if (Number.isNaN(until.getTime())) return null;
    const msLeft = until.getTime() - Date.now();
    if (msLeft <= 0) return 0;
    return Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
}

function formatCurrentModerationStatus(status: ModerationRow["moderation_status"]): string {
    const level = String(status?.moderation_level || "normal").toLowerCase();
    if (level === "chat_restricted") {
        const days = formatDaysRemaining(status?.chat_restricted_until);
        if (days === null) return "Chat restreint";
        if (days === 0) return "Chat restreint (arrive à échéance)";
        return `Chat restreint (${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""})`;
    }
    if (level === "suspended") {
        const days = formatDaysRemaining(status?.suspended_until);
        if (days === null) return "Suspension";
        if (days === 0) return "Suspension (arrive à échéance)";
        return `Suspension (${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""})`;
    }
    if (level === "warned") return "Averti";
    if (level === "flagged") return "Signalé";
    return "Normal";
}

function formatLongDateFr(iso?: string | null): string {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function getSanctionDurationDays(startIso?: string | null, endIso?: string | null): number | null {
    if (!startIso || !endIso) return null;
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 0;
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function activityToneClass(activityId: string) {
    let hash = 0;
    for (let i = 0; i < activityId.length; i += 1) hash = (hash * 31 + activityId.charCodeAt(i)) >>> 0;
    const palette = [
        "border-l-4 border-l-emerald-300",
        "border-l-4 border-l-sky-300",
        "border-l-4 border-l-amber-300",
        "border-l-4 border-l-rose-300",
        "border-l-4 border-l-violet-300",
    ];
    return palette[hash % palette.length];
}

export default function AdminModerationPage() {
    const [viewMode, setViewMode] = useState<"reports" | "sanctions" | "feedback_incidents" | "support_reports">("reports");
    const [rows, setRows] = useState<ModerationRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [reasonCode, setReasonCode] = useState("all");
    const [selectedRow, setSelectedRow] = useState<ModerationRow | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ModerationChatMessage[]>([]);
    const [hasChatLoaded, setHasChatLoaded] = useState(false);
    const [isApplyingAction, setIsApplyingAction] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);
    const [restrictDays, setRestrictDays] = useState(7);
    const [suspendDays, setSuspendDays] = useState(7);
    const [sanctions, setSanctions] = useState<SanctionRow[]>([]);
    const [warnings, setWarnings] = useState<WarningRow[]>([]);
    const [sanctionsFilter, setSanctionsFilter] = useState<"all" | "warn1" | "warn2" | "restrict" | "suspend">("all");
    const [isSanctionsLoading, setIsSanctionsLoading] = useState(false);
    const [userSeasonHistory, setUserSeasonHistory] = useState<UserSeasonHistory[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [pendingConfirmAction, setPendingConfirmAction] = useState<{
        action: ManualActionKey;
        title: string;
        message: string;
        ignoreScope?: IgnoreScope;
    } | null>(null);
    const [pendingLift, setPendingLift] = useState<{
        user_id: string;
        pseudo: string;
        kind: "restrict_chat" | "suspend";
    } | null>(null);
    const [pendingFeedbackConfirmAction, setPendingFeedbackConfirmAction] = useState<{
        action: "ignore" | "warning" | "suspend";
        title: string;
        message: string;
    } | null>(null);
    const [feedbackIncidents, setFeedbackIncidents] = useState<FeedbackIncidentRow[]>([]);
    const [isFeedbackIncidentsLoading, setIsFeedbackIncidentsLoading] = useState(false);
    const [feedbackIncidentStatus, setFeedbackIncidentStatus] = useState<"all" | "validated" | "informative">("all");
    const [feedbackIncidentReasonCode, setFeedbackIncidentReasonCode] = useState("all");
    const [hideInformativeIncidents, setHideInformativeIncidents] = useState(true);
    const [selectedFeedbackIncident, setSelectedFeedbackIncident] = useState<FeedbackIncidentRow | null>(null);
    const [feedbackIncidentSuspendDays, setFeedbackIncidentSuspendDays] = useState(7);
    const [supportReports, setSupportReports] = useState<SupportReportRow[]>([]);
    const [supportRequests, setSupportRequests] = useState<SupportRequestRow[]>([]);
    const [isSupportReportsLoading, setIsSupportReportsLoading] = useState(false);
    const [isSupportRequestsLoading, setIsSupportRequestsLoading] = useState(false);
    const [supportReportStatus, setSupportReportStatus] = useState<"all" | "new" | "in_progress" | "resolved">("all");
    const [supportReportCategory, setSupportReportCategory] = useState<"all" | "bug" | "abuse" | "payment" | "other">("all");
    const [isSupportReportActionLoading, setIsSupportReportActionLoading] = useState<string | null>(null);
    const [isSupportRequestActionLoading, setIsSupportRequestActionLoading] = useState<string | null>(null);
    const [openSupportReportMenuId, setOpenSupportReportMenuId] = useState<string | null>(null);
    const [openSupportRequestMenuId, setOpenSupportRequestMenuId] = useState<string | null>(null);
    const [ageEditTarget, setAgeEditTarget] = useState<{ userId: string; pseudo: string; email: string | null } | null>(null);
    const [ageEditBirthDate, setAgeEditBirthDate] = useState("");
    const [ageEditCurrentStatus, setAgeEditCurrentStatus] = useState<"verified_adult" | "blocked_minor" | "non_verified">("non_verified");
    const [isAgeEditLoading, setIsAgeEditLoading] = useState(false);
    const [isAgeEditSaving, setIsAgeEditSaving] = useState(false);
    const [ageEditFeedback, setAgeEditFeedback] = useState<string | null>(null);
    const [tabBadges, setTabBadges] = useState({
        reports: 0,
        sanctions: 0,
        feedback_incidents: 0,
        support_reports: 0,
    });

    const fetchTabBadges = async () => {
        try {
            const [reportsRes, sanctionsRes, feedbackRes, supportRes, supportRequestsRes] = await Promise.all([
                fetch(`/api/admin/moderation/reports?status=pending&t=${Date.now()}`, { cache: "no-store" }),
                fetch(`/api/admin/moderation/sanctions?type=all&t=${Date.now()}`, { cache: "no-store" }),
                fetch(`/api/admin/moderation/feedback-incidents?status=validated&t=${Date.now()}`, { cache: "no-store" }),
                fetch(`/api/admin/support-reports?status=new&t=${Date.now()}`, { cache: "no-store" }),
                fetch(`/api/admin/support-requests?status=new&t=${Date.now()}`, { cache: "no-store" }),
            ]);

            const [reportsBody, sanctionsBody, feedbackBody, supportBody, supportRequestsBody] = await Promise.all([
                reportsRes.json().catch(() => null),
                sanctionsRes.json().catch(() => null),
                feedbackRes.json().catch(() => null),
                supportRes.json().catch(() => null),
                supportRequestsRes.json().catch(() => null),
            ]);

            const nextBadges = {
                reports: reportsRes.ok ? (Array.isArray(reportsBody?.data?.rows) ? reportsBody.data.rows.length : 0) : 0,
                sanctions: sanctionsRes.ok ? (Array.isArray(sanctionsBody?.data?.active_sanctions) ? sanctionsBody.data.active_sanctions.length : 0) : 0,
                feedback_incidents: feedbackRes.ok ? (Array.isArray(feedbackBody?.data?.rows) ? feedbackBody.data.rows.length : 0) : 0,
                support_reports:
                    (supportRes.ok ? (Array.isArray(supportBody?.data?.rows) ? supportBody.data.rows.length : 0) : 0)
                    + (supportRequestsRes.ok ? (Array.isArray(supportRequestsBody?.data?.rows) ? supportRequestsBody.data.rows.length : 0) : 0),
            };
            setTabBadges(nextBadges);
        } catch {
            setTabBadges({
                reports: 0,
                sanctions: 0,
                feedback_incidents: 0,
                support_reports: 0,
            });
        }
    };

    const loadModerationChat = async (activityId: string) => {
        setIsChatLoading(true);
        setChatError(null);
        setHasChatLoaded(false);
        try {
            const res = await fetch(`/api/admin/moderation/chat?activity_id=${activityId}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error?.details || body?.error || "Impossible de charger le chat");
            }
            const rows = Array.isArray(body?.data?.messages) ? body.data.messages : [];
            setChatMessages(rows);
            setHasChatLoaded(true);
        } catch (error) {
            setChatMessages([]);
            setChatError(error instanceof Error ? error.message : "Impossible de charger le chat");
            setHasChatLoaded(true);
        } finally {
            setIsChatLoading(false);
        }
    };

    const loadUserSeasonHistory = async (userId: string) => {
        setIsHistoryLoading(true);
        try {
            const res = await fetch(`/api/admin/moderation/user-history?user_id=${userId}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error?.details || body?.error || "Historique indisponible");
            setUserSeasonHistory(Array.isArray(body?.data?.history) ? body.data.history : []);
        } catch {
            setUserSeasonHistory([]);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const fetchSanctions = async () => {
        setIsSanctionsLoading(true);
        try {
            const typeParam =
                sanctionsFilter === "restrict" ? "restrict"
                    : sanctionsFilter === "suspend" ? "suspend"
                        : sanctionsFilter === "warn1" ? "warn1"
                            : sanctionsFilter === "warn2" ? "warn2"
                                : "all";
            const res = await fetch(`/api/admin/moderation/sanctions?type=${typeParam}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de charger les sanctions");
            setSanctions(Array.isArray(body?.data?.active_sanctions) ? body.data.active_sanctions : []);
            setWarnings(Array.isArray(body?.data?.warnings) ? body.data.warnings : []);
        } catch {
            setSanctions([]);
            setWarnings([]);
        } finally {
            setIsSanctionsLoading(false);
        }
    };

    const fetchFeedbackIncidents = async () => {
        setIsFeedbackIncidentsLoading(true);
        try {
            const params = new URLSearchParams();
            const effectiveStatus = hideInformativeIncidents ? "validated" : feedbackIncidentStatus;
            if (effectiveStatus !== "all") params.set("status", effectiveStatus);
            if (feedbackIncidentReasonCode !== "all") params.set("reason_code", feedbackIncidentReasonCode);
            if (search.trim()) params.set("search", search.trim());
            const res = await fetch(`/api/admin/moderation/feedback-incidents?${params.toString()}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de charger les incidents feedback");
            setFeedbackIncidents(Array.isArray(body?.data?.rows) ? body.data.rows : []);
        } catch {
            setFeedbackIncidents([]);
        } finally {
            setIsFeedbackIncidentsLoading(false);
        }
    };

    const fetchSupportReports = async () => {
        setIsSupportReportsLoading(true);
        try {
            const params = new URLSearchParams();
            if (supportReportStatus !== "all") params.set("status", supportReportStatus);
            if (supportReportCategory !== "all") params.set("category", supportReportCategory);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/admin/support-reports?${params.toString()}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de charger les signalements support");
            setSupportReports(Array.isArray(body?.data?.rows) ? body.data.rows : []);
        } catch {
            setSupportReports([]);
        } finally {
            setIsSupportReportsLoading(false);
        }
    };

    const fetchSupportRequests = async () => {
        setIsSupportRequestsLoading(true);
        try {
            const params = new URLSearchParams();
            if (supportReportStatus !== "all") params.set("status", supportReportStatus);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/admin/support-requests?${params.toString()}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de charger les demandes support");
            setSupportRequests(Array.isArray(body?.data?.rows) ? body.data.rows : []);
        } catch {
            setSupportRequests([]);
        } finally {
            setIsSupportRequestsLoading(false);
        }
    };

    const updateSupportReportStatus = async (reportId: string, nextStatus: "new" | "in_progress" | "resolved") => {
        try {
            setIsSupportReportActionLoading(reportId);
            const res = await fetch("/api/admin/support-reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    status: nextStatus,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de mettre à jour le statut");
            setSupportReports((prev) => prev.map((row) => (
                row.id === reportId
                    ? { ...row, status: nextStatus, updated_at: String(body?.data?.report?.updated_at || row.updated_at) }
                    : row
            )));
            void fetchTabBadges();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible de mettre à jour le statut");
        } finally {
            setIsSupportReportActionLoading(null);
        }
    };

    const updateSupportRequestStatus = async (requestId: string, nextStatus: "new" | "in_progress" | "resolved") => {
        try {
            setIsSupportRequestActionLoading(requestId);
            const res = await fetch("/api/admin/support-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    request_id: requestId,
                    status: nextStatus,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de mettre à jour le statut");
            setSupportRequests((prev) => prev.map((row) => (
                row.id === requestId
                    ? { ...row, status: nextStatus }
                    : row
            )));
            void fetchTabBadges();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible de mettre à jour le statut");
        } finally {
            setIsSupportRequestActionLoading(null);
        }
    };

    const openAgeEditModal = async (target: { userId: string; pseudo: string; email: string | null }) => {
        setAgeEditTarget(target);
        setAgeEditBirthDate("");
        setAgeEditCurrentStatus("non_verified");
        setAgeEditFeedback(null);
        setIsAgeEditLoading(true);
        try {
            const params = new URLSearchParams({ user_id: target.userId });
            const res = await fetch(`/api/admin/users/age-verification?${params.toString()}&t=${Date.now()}`, { cache: "no-store" });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible de charger la vérification d'âge");
            const data = body?.data || {};
            setAgeEditBirthDate(typeof data.birth_date === "string" ? data.birth_date : "");
            const status = String(data.age_verification_status || "non_verified");
            if (status === "verified_adult" || status === "blocked_minor") {
                setAgeEditCurrentStatus(status);
            } else {
                setAgeEditCurrentStatus("non_verified");
            }
        } catch (error) {
            setAgeEditFeedback(error instanceof Error ? error.message : "Impossible de charger la vérification d'âge");
        } finally {
            setIsAgeEditLoading(false);
        }
    };

    const saveAgeCorrection = async () => {
        if (!ageEditTarget || !ageEditBirthDate || isAgeEditSaving) return;
        setIsAgeEditSaving(true);
        setAgeEditFeedback(null);
        try {
            const res = await fetch("/api/admin/users/age-verification", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: ageEditTarget.userId,
                    birth_date: ageEditBirthDate,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error || "Impossible d'enregistrer la correction");
            const status = String(body?.data?.age_verification_status || "non_verified");
            if (status === "verified_adult" || status === "blocked_minor") {
                setAgeEditCurrentStatus(status);
            } else {
                setAgeEditCurrentStatus("non_verified");
            }
            setSupportRequests((prev) => prev.map((row) => (
                row.user_id === ageEditTarget.userId
                    ? {
                        ...row,
                        birth_date: ageEditBirthDate,
                        age_verification_status: status,
                    }
                    : row
            )));
            setAgeEditFeedback(`Profil mis à jour: ${ageStatusLabel(status)}.`);
        } catch (error) {
            setAgeEditFeedback(error instanceof Error ? error.message : "Impossible d'enregistrer la correction");
        } finally {
            setIsAgeEditSaving(false);
        }
    };

    const applyFeedbackIncidentAction = async (action: "warning" | "suspend" | "ignore") => {
        if (!selectedFeedbackIncident || isApplyingAction) return;
        setIsApplyingAction(true);
        setActionFeedback(null);
        try {
            const payload: Record<string, unknown> = {
                activity_id: selectedFeedbackIncident.activity_id,
                user_id: selectedFeedbackIncident.reported_user_id,
                reason_code: selectedFeedbackIncident.reason_code,
                action,
            };
            if (action === "suspend") payload.duration_days = feedbackIncidentSuspendDays;

            const res = await fetch("/api/admin/moderation/feedback-incidents/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error?.details || body?.error || "Action impossible");
            setActionFeedback("Action de modération appliquée.");
            await Promise.all([fetchFeedbackIncidents(), fetchSanctions()]);
            void fetchTabBadges();
        } catch (error) {
            setActionFeedback(error instanceof Error ? error.message : "Action impossible");
        } finally {
            setIsApplyingAction(false);
        }
    };

    const confirmFeedbackIncidentAction = (action: "ignore" | "warning" | "suspend") => {
        if (!selectedFeedbackIncident) return;
        const pseudo = `@${selectedFeedbackIncident.reported_pseudo}`;
        if (action === "ignore") {
            setPendingFeedbackConfirmAction({
                action,
                title: "Confirmer l’ignorance de l’incident",
                message: `${pseudo} ne recevra aucune sanction. Cet incident sera considéré comme traité.`,
            });
            return;
        }
        if (action === "warning") {
            setPendingFeedbackConfirmAction({
                action,
                title: "Confirmer l’avertissement",
                message: `${pseudo} recevra un avertissement in-app et un email lié au feedback. Cette action sera enregistrée dans son historique.`,
            });
            return;
        }
        setPendingFeedbackConfirmAction({
            action,
            title: "Confirmer la suspension",
            message: `${pseudo} sera suspendu pendant ${feedbackIncidentSuspendDays} jours. Cette action sera enregistrée dans son historique.`,
        });
    };

    const confirmAction = (action: ManualActionKey, ignoreScope: IgnoreScope = "single") => {
        if (!selectedRow) return;
        const pseudo = `@${selectedRow.reported.pseudo}`;
        if (action === "warn1") {
            setPendingConfirmAction({
                action,
                title: "Confirmer Warn 1 ?",
                message: `${pseudo} recevra un premier avertissement avec une notification. Cette action sera enregistrée dans l’historique.`,
            });
            return;
        }
        if (action === "warn2") {
            setPendingConfirmAction({
                action,
                title: "Confirmer Warn 2 ?",
                message: `${pseudo} recevra un deuxième avertissement. Cette action peut envoyer une notification et un email, et sera enregistrée dans l’historique.`,
            });
            return;
        }
        if (action === "restrict_chat") {
            setPendingConfirmAction({
                action,
                title: "Confirmer la restriction chat ?",
                message: `${pseudo} ne pourra plus écrire dans les chats pendant ${restrictDays} jours. Cette action sera enregistrée dans l’historique.`,
            });
            return;
        }
        if (action === "suspend") {
            setPendingConfirmAction({
                action,
                title: "Confirmer la suspension ?",
                message: `${pseudo} sera suspendu pendant ${suspendDays} jours. Cette action sera enregistrée dans l’historique.`,
            });
            return;
        }
        setPendingConfirmAction({
            action,
            title: "Ignorer ce signalement ?",
            message: ignoreScope === "group"
                ? "Tous les reports pending liés à cet incident seront classés sans sanction."
                : "Le signalement sera classé sans sanction et l’action sera enregistrée dans l’historique.",
            ignoreScope,
        });
    };

    const confirmLiftSanction = (row: SanctionRow) => {
        setPendingLift({
            user_id: row.user_id,
            pseudo: row.pseudo,
            kind: row.type,
        });
    };

    const executeLiftSanction = async () => {
        if (!pendingLift || isApplyingAction) return;
        setIsApplyingAction(true);
        setActionFeedback(null);
        try {
            const res = await fetch("/api/admin/moderation/lift", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: pendingLift.user_id,
                    kind: pendingLift.kind,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error?.details || body?.error || "Impossible de lever la sanction");
            await fetchSanctions();
            setPendingLift(null);
            setActionFeedback("Sanction levée avec succès.");
        } catch (error) {
            setActionFeedback(error instanceof Error ? error.message : "Impossible de lever la sanction");
        } finally {
            setIsApplyingAction(false);
        }
    };

    const fetchRows = async () => {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (status !== "all") params.set("status", status);
        if (reasonCode !== "all") params.set("reason_code", reasonCode);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/admin/moderation/reports?${params.toString()}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (res.ok) {
            const nextRows = Array.isArray(body?.data?.rows) ? body.data.rows : [];
            console.info("[CHAT_REPORT_DEBUG][admin_panel][rows]", {
                count: nextRows.length,
                reason_codes: Array.from(new Set(nextRows.map((row: ModerationRow) => String(row.reason_code || "")).filter(Boolean))),
            });
            setRows(nextRows);
            setIsLoading(false);
            return nextRows as ModerationRow[];
        } else {
            setRows([]);
            alert(body?.error || "Impossible de charger les reports modération.");
            setIsLoading(false);
            return [] as ModerationRow[];
        }
    };

    const triggerSearch = () => {
        if (viewMode === "reports") {
            void fetchRows();
            return;
        }
        if (viewMode === "feedback_incidents") {
            void fetchFeedbackIncidents();
            return;
        }
        if (viewMode === "support_reports") {
            void fetchSupportReports();
            void fetchSupportRequests();
        }
    };

    const getRecommendedAction = (row: ModerationRow) => {
        const warns = Number(row.warns_count || 0);
        if (warns <= 0) return "warn1" as const;
        if (warns === 1) return "warn2" as const;
        return "restrict_chat" as const;
    };

    const applyModerationAction = async (action: "warn1" | "warn2" | "restrict_chat" | "suspend" | "ignore", ignoreScope: IgnoreScope = "single") => {
        if (!selectedRow || isApplyingAction) return;
        setIsApplyingAction(true);
        setActionFeedback(null);
        try {
            const payload: Record<string, unknown> = {
                report_id: selectedRow.id,
                action,
            };
            if (action === "restrict_chat") payload.duration_days = restrictDays;
            if (action === "suspend") payload.duration_days = suspendDays;
            if (action === "ignore") payload.ignore_scope = ignoreScope;

            const res = await fetch("/api/admin/moderation/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error?.details || body?.error || "Action modération impossible");
            }
            const refreshedRows = await fetchRows();
            const refreshed = (refreshedRows || []).find((row) => row.id === selectedRow.id) || null;
            if (action === "ignore") {
                setSelectedRow(null);
                setActionFeedback("Signalement ignoré. Aucune sanction appliquée.");
                void fetchSanctions();
            } else {
                if (refreshed) setSelectedRow(refreshed);
                setActionFeedback("Action de modération appliquée.");
            }
            void fetchTabBadges();
        } catch (error) {
            setActionFeedback(error instanceof Error ? error.message : "Action modération impossible");
        } finally {
            setIsApplyingAction(false);
        }
    };

    const quickIgnorePending = async (row: ModerationRow) => {
        try {
            const res = await fetch("/api/admin/moderation/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: row.id,
                    action: "ignore",
                    ignore_scope: "single",
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) throw new Error(body?.error?.details || body?.error || "Impossible d’ignorer le report");
            await fetchRows();
            void fetchSanctions();
            void fetchTabBadges();
        } catch (error) {
            alert(error instanceof Error ? error.message : "Impossible d’ignorer le report");
        }
    };

    useEffect(() => {
        void fetchRows();
        void fetchTabBadges();
    }, []);

    useEffect(() => {
        if (viewMode !== "sanctions") return;
        void fetchSanctions();
    }, [viewMode, sanctionsFilter]);

    useEffect(() => {
        if (viewMode !== "feedback_incidents") return;
        void fetchFeedbackIncidents();
    }, [viewMode, feedbackIncidentStatus, feedbackIncidentReasonCode, search, hideInformativeIncidents]);

    useEffect(() => {
        if (viewMode !== "support_reports") return;
        void fetchSupportReports();
        void fetchSupportRequests();
    }, [viewMode, supportReportStatus, supportReportCategory, search]);

    useEffect(() => {
        const targetId = selectedRow?.reported?.id || selectedFeedbackIncident?.reported_user_id || null;
        if (!targetId) {
            setUserSeasonHistory([]);
            return;
        }
        void loadUserSeasonHistory(targetId);
    }, [selectedRow?.reported?.id, selectedFeedbackIncident?.reported_user_id]);

    useEffect(() => {
        const isModalOpen = Boolean(
            selectedRow ||
            selectedFeedbackIncident ||
            pendingConfirmAction ||
            pendingFeedbackConfirmAction ||
            pendingLift ||
            showResetConfirm
        );
        if (!isModalOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [selectedRow, selectedFeedbackIncident, pendingConfirmAction, pendingFeedbackConfirmAction, pendingLift, showResetConfirm]);

    const reportReasonFilterOptions = [
        { value: "all", label: "Filtrer par motif" },
        { value: "insult", label: "Insultes ou propos déplacés" },
        { value: "inappropriate", label: "Comportement inapproprié" },
        { value: "spam", label: "Spam" },
        { value: "harassment", label: "Harcèlement" },
        { value: "other", label: "Autre" },
    ];

    const feedbackReasonFilterOptions = [
        { value: "all", label: "Filtrer par motif" },
        { value: "feedback_bad_behavior", label: "Mauvais comportement" },
        { value: "feedback_late", label: "Retard important" },
        { value: "feedback_no_show", label: "Absence / No show" },
        { value: "feedback_other", label: "Description (optionnel)" },
    ];

    const reportGroups = useMemo(() => {
        const byActivity = new Map<string, { activity: ModerationRow["activity"]; rows: ModerationRow[] }>();
        for (const row of rows) {
            const key = row.activity.id;
            const bucket = byActivity.get(key) || { activity: row.activity, rows: [] };
            bucket.rows.push(row);
            byActivity.set(key, bucket);
        }
        return Array.from(byActivity.values()).sort((a, b) => {
            const da = new Date(a.activity.start_time || 0).getTime();
            const db = new Date(b.activity.start_time || 0).getTime();
            return db - da;
        });
    }, [rows]);

    const feedbackIncidentGroups = useMemo(() => {
        const byActivity = new Map<string, { activity: { id: string; sport: string; location: string | null; start_time: string | null; participants_count: number }; rows: FeedbackIncidentRow[] }>();
        for (const row of feedbackIncidents) {
            const key = row.activity_id;
            const bucket = byActivity.get(key) || {
                activity: {
                    id: row.activity_id,
                    sport: row.sport,
                    location: row.location,
                    start_time: row.activity_start_time,
                    participants_count: row.participants_count,
                },
                rows: [],
            };
            bucket.rows.push(row);
            byActivity.set(key, bucket);
        }
        return Array.from(byActivity.values()).sort((a, b) => {
            const da = new Date(a.activity.start_time || 0).getTime();
            const db = new Date(b.activity.start_time || 0).getTime();
            return db - da;
        });
    }, [feedbackIncidents]);

    const pendingCount = useMemo(
        () => rows.filter((row) => row.status.toLowerCase() === "pending").length,
        [rows]
    );
    const validatedTodayCount = useMemo(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = today.getMonth();
        const dd = today.getDate();
        return rows.filter((row) => {
            const isValidated = row.status.toLowerCase() === "validated";
            const sourceDate = row.validated_at || row.created_at;
            const d = new Date(sourceDate);
            return isValidated && d.getFullYear() === yyyy && d.getMonth() === mm && d.getDate() === dd;
        }).length;
    }, [rows]);

    const handleSeasonReset = async () => {
        setIsResetting(true);
        const res = await fetch("/api/admin/moderation/season-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
            alert(body?.error || "Reset impossible");
            setIsResetting(false);
            return;
        }
        alert("Reset saison effectué.");
        setShowResetConfirm(false);
        setIsResetting(false);
        void fetchRows();
    };

    return (
        <main className="mx-auto min-h-screen max-w-6xl bg-[#F6F8F7] px-4 py-6 md:px-6">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Panel de modération Playzi</h1>
                    <p className="text-sm text-gray-500">Gestion des signalements utilisateurs.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"
                >
                    Reset saison
                </button>
            </header>

            <section className="mb-4 inline-flex rounded-xl border border-gray-200 bg-white p-1">
                <button
                    type="button"
                    onClick={() => setViewMode("reports")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ${viewMode === "reports" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                    Reports
                    {tabBadges.reports > 0 ? (
                        <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${viewMode === "reports" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                            {tabBadges.reports}
                        </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("sanctions")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ${viewMode === "sanctions" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                    Sanctions actives
                    {tabBadges.sanctions > 0 ? (
                        <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${viewMode === "sanctions" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                            {tabBadges.sanctions}
                        </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("feedback_incidents")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ${viewMode === "feedback_incidents" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                    Incidents feedback
                    {tabBadges.feedback_incidents > 0 ? (
                        <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${viewMode === "feedback_incidents" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                            {tabBadges.feedback_incidents}
                        </span>
                    ) : null}
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("support_reports")}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-bold ${viewMode === "support_reports" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                    Problèmes signalés
                    {tabBadges.support_reports > 0 ? (
                        <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-black ${viewMode === "support_reports" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                            {tabBadges.support_reports}
                        </span>
                    ) : null}
                </button>
            </section>

            {viewMode === "reports" && (
            <>
            <section className="mb-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">Reports en attente</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{pendingCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">Reports validés aujourd’hui</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{validatedTodayCount}</p>
                </div>
            </section>

            <section className="mb-4 grid gap-3 rounded-2xl border border-gray-200 bg-white p-3 md:grid-cols-5">
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            triggerSearch();
                        }
                    }}
                    placeholder="Rechercher par pseudo ou email"
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                    type="button"
                    onClick={triggerSearch}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                >
                    Rechercher
                </button>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <option value="all">Filtrer par statut</option>
                    <option value="pending">Pending</option>
                    <option value="validated">Validated</option>
                    <option value="dismissed">Dismissed</option>
                </select>
                <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    {reportReasonFilterOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <button
                    type="button"
                    onClick={() => void fetchRows()}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                >
                    Actualiser
                </button>
            </section>

            <section className="space-y-3">
                {isLoading ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Chargement…</div>
                ) : reportGroups.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                        <p className="text-lg font-black text-gray-800">🛡️ Aucun signalement actif</p>
                        <p className="mt-1 text-sm text-gray-500">Les signalements apparaîtront ici lorsqu’un utilisateur sera report.</p>
                    </div>
                ) : reportGroups.map((group) => (
                    <div key={group.activity.id} className={`rounded-2xl border border-gray-200 bg-white p-3 ${activityToneClass(group.activity.id)}`}>
                        <div className="mb-2 rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-sm font-black text-gray-900">{group.activity.sport} {group.activity.location ? `· ${group.activity.location}` : ""}</p>
                            <p className="text-xs text-gray-500">
                                {group.activity.start_time ? new Date(group.activity.start_time).toLocaleString("fr-FR") : "Date inconnue"}
                                {" · "}
                                {group.activity.participants_count || 0} participants
                            </p>
                        </div>
                        <div className="space-y-2">
                            {group.rows.map((row) => (
                                <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-2.5">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="text-sm text-gray-700">
                                            <p className="font-bold text-gray-900">@{row.reported.pseudo}</p>
                                            <p className="text-xs text-gray-500">
                                                Reporté par @{row.reporter.pseudo} · {new Date(row.created_at).toLocaleString("fr-FR")}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-700">{row.reason_label}</p>
                                            {row.report_text ? <p className="mt-1 text-xs text-gray-600">“{row.report_text}”</p> : null}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${statusBadgeClass(row.status)}`}>
                                                {row.status}
                                            </span>
                                            {row.status === "pending" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void quickIgnorePending(row)}
                                                    className="rounded-lg border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                                                >
                                                    Ignorer
                                                </button>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedRow(row);
                                                    setSelectedFeedbackIncident(null);
                                                    setChatMessages([]);
                                                    setChatError(null);
                                                    setHasChatLoaded(false);
                                                    setActionFeedback(null);
                                                    setPendingConfirmAction(null);
                                                }}
                                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                            >
                                                Examiner
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </section>
            </>
            )}

            {viewMode === "sanctions" && (
                <section className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: "all", label: "Tous" },
                                { key: "warn1", label: "Warn 1" },
                                { key: "warn2", label: "Warn 2" },
                                { key: "restrict", label: "Restrict chat" },
                                { key: "suspend", label: "Suspendre" },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => setSanctionsFilter(item.key as "all" | "warn1" | "warn2" | "restrict" | "suspend")}
                                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold ${sanctionsFilter === item.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-300 bg-white text-gray-700"}`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <h3 className="text-sm font-black text-gray-900">Sanctions actives</h3>
                        {isSanctionsLoading ? (
                            <p className="mt-2 text-sm text-gray-500">Chargement…</p>
                        ) : sanctions.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500">Aucune sanction active.</p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {sanctions.map((row, idx) => (
                                    <div key={`${row.user_id}-${row.type}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-sm">
                                        <div>
                                            <p className="font-bold text-gray-800">@{row.pseudo}</p>
                                            {row.activity ? (
                                                <p className="text-xs text-gray-500">
                                                    {row.activity.sport} {row.activity.location ? `· ${row.activity.location}` : ""} · {row.activity.participants_count || 0} participants
                                                </p>
                                            ) : (
                                                <p className="text-xs text-gray-500">Activité liée : non disponible</p>
                                            )}
                                            <p className="text-xs text-gray-600">
                                                {row.type === "restrict_chat" ? "Restrict chat" : "Suspension"}{" "}
                                                ({getSanctionDurationDays(row.start_at, row.end_at) ?? "-"} jours)
                                            </p>
                                            <p className="text-xs text-gray-500">Saison : {row.season_id}</p>
                                            <p className="text-xs text-gray-500">Expire le {formatLongDateFr(row.end_at)}</p>
                                            <p className="text-xs text-gray-500">
                                                Temps restant : {(() => {
                                                    const days = formatDaysRemaining(row.end_at);
                                                    if (days === null) return "-";
                                                    if (days <= 0) return "Expiré";
                                                    return `${days} jour${days > 1 ? "s" : ""}`;
                                                })()}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => confirmLiftSanction(row)}
                                            className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700"
                                        >
                                            Retirer la sanction
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {(sanctionsFilter === "all" || sanctionsFilter === "warn1" || sanctionsFilter === "warn2") && (
                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <h3 className="text-sm font-black text-gray-900">Warnings (saison courante)</h3>
                            {isSanctionsLoading ? (
                                <p className="mt-2 text-sm text-gray-500">Chargement…</p>
                            ) : warnings.length === 0 ? (
                                <p className="mt-2 text-sm text-gray-500">Aucun warning pour cette saison.</p>
                            ) : (
                                <div className="mt-3 space-y-2">
                                    {warnings.map((row) => (
                                        <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-sm">
                                            <p className="font-bold text-gray-800">@{row.pseudo}</p>
                                            <p className="text-xs font-semibold text-gray-600">{row.type === "warn1" ? "Warn 1" : "Warn 2"}</p>
                                            <p className="text-xs text-gray-500">{formatLongDateFr(row.created_at)}</p>
                                            {row.activity ? (
                                                <p className="text-xs text-gray-500">
                                                    {row.activity.sport} {row.activity.location ? `· ${row.activity.location}` : ""} · {row.activity.participants_count || 0} participants
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {viewMode === "feedback_incidents" && (
                <section className="space-y-4">
                    <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-3 md:grid-cols-5">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    triggerSearch();
                                }
                            }}
                            placeholder="Rechercher par pseudo ou email"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button
                            type="button"
                            onClick={triggerSearch}
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                            Rechercher
                        </button>
                        <select
                            value={feedbackIncidentStatus}
                            onChange={(e) => setFeedbackIncidentStatus(e.target.value as "all" | "validated" | "informative")}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                            <option value="all">Filtrer par statut</option>
                            <option value="validated">Validé</option>
                            <option value="informative">Informatif</option>
                        </select>
                        <select
                            value={feedbackIncidentReasonCode}
                            onChange={(e) => setFeedbackIncidentReasonCode(e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                            {feedbackReasonFilterOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => void fetchFeedbackIncidents()}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                            Actualiser
                        </button>
                    </section>

                    <section className="rounded-2xl border border-gray-200 bg-white px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <input
                                type="checkbox"
                                checked={hideInformativeIncidents}
                                onChange={(e) => setHideInformativeIncidents(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            Masquer les incidents informatifs
                        </label>
                    </section>

                    <section className="space-y-3">
                        {isFeedbackIncidentsLoading ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Chargement…</div>
                        ) : feedbackIncidentGroups.length === 0 ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                                <p className="text-lg font-black text-gray-800">Aucun incident feedback</p>
                                <p className="mt-1 text-sm text-gray-500">Les incidents issus des feedbacks post-activité apparaîtront ici.</p>
                            </div>
                        ) : feedbackIncidentGroups.map((group) => (
                            <div key={group.activity.id} className={`rounded-2xl border border-gray-200 bg-white p-3 ${activityToneClass(group.activity.id)}`}>
                                <div className="mb-2 rounded-xl bg-gray-50 px-3 py-2">
                                    <p className="text-sm font-black text-gray-900">{group.activity.sport} {group.activity.location ? `· ${group.activity.location}` : ""}</p>
                                    <p className="text-xs text-gray-500">
                                        {group.activity.start_time ? new Date(group.activity.start_time).toLocaleString("fr-FR") : "Date inconnue"}
                                        {" · "}
                                        {group.activity.participants_count} participants
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {group.rows.map((row) => (
                                        <div key={row.id} className="rounded-xl border border-gray-100 bg-white p-2.5">
                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                <div className="text-sm text-gray-700">
                                                    <p className="font-bold text-gray-900">@{row.reported_pseudo}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(row.last_scored_at || row.activity_start_time || Date.now()).toLocaleString("fr-FR")}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-700">{row.reason_label}</p>
                                                    <p className="text-xs text-gray-600">Votes: {row.votes_count}/{row.participants_count}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${statusBadgeClass(row.status)}`}>
                                                        {row.status}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedFeedbackIncident(row);
                                                            setSelectedRow(null);
                                                            setActionFeedback(null);
                                                        }}
                                                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                                    >
                                                        Examiner
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </section>
                </section>
            )}

            {viewMode === "support_reports" && (
                <section className="space-y-4">
                    <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-3 md:grid-cols-5">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    triggerSearch();
                                }
                            }}
                            placeholder="Rechercher par pseudo ou email"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        />
                        <button
                            type="button"
                            onClick={triggerSearch}
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100"
                        >
                            Rechercher
                        </button>
                        <select
                            value={supportReportStatus}
                            onChange={(e) => setSupportReportStatus(e.target.value as "all" | "new" | "in_progress" | "resolved")}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                            <option value="all">Filtrer par statut</option>
                            <option value="new">Nouveau</option>
                            <option value="in_progress">En cours</option>
                            <option value="resolved">Traité</option>
                        </select>
                        <select
                            value={supportReportCategory}
                            onChange={(e) => setSupportReportCategory(e.target.value as "all" | "bug" | "abuse" | "payment" | "other")}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                        >
                            <option value="all">Filtrer par catégorie</option>
                            <option value="bug">Bug</option>
                            <option value="abuse">Abus</option>
                            <option value="payment">Paiement</option>
                            <option value="other">Autre</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => void fetchSupportReports()}
                            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                            Actualiser
                        </button>
                    </section>

                    <section className="space-y-3">
                        {isSupportReportsLoading ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Chargement…</div>
                        ) : supportReports.length === 0 ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                                <p className="text-lg font-black text-gray-800">Aucun problème signalé</p>
                                <p className="mt-1 text-sm text-gray-500">Les tickets support créés depuis l’app apparaîtront ici.</p>
                            </div>
                        ) : supportReports.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-black text-gray-900">@{row.user_pseudo}</span>
                                            <span className="text-xs text-gray-500">{row.user_email || row.user_id}</span>
                                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${supportStatusBadgeClass(row.status)}`}>
                                                {supportStatusLabel(row.status)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-gray-600">{row.category_label}</p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{row.description}</p>
                                        <p className="mt-2 text-xs text-gray-500">
                                            {new Date(row.created_at).toLocaleString("fr-FR")}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="relative">
                                            <button
                                                type="button"
                                                disabled={isSupportReportActionLoading === row.id}
                                                onClick={() => setOpenSupportReportMenuId((prev) => prev === row.id ? null : row.id)}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${supportStatusBadgeClass(row.status)} disabled:opacity-60`}
                                            >
                                                {isSupportReportActionLoading === row.id ? "Mise à jour..." : supportStatusLabel(row.status)}
                                                <span className="text-[10px]">▼</span>
                                            </button>
                                            {openSupportReportMenuId === row.id ? (
                                                <div className="absolute right-0 z-10 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                                    {[
                                                        { value: "new", label: "Nouveau" },
                                                        { value: "in_progress", label: "En cours" },
                                                        { value: "resolved", label: "Traité" },
                                                    ].map((option) => {
                                                        const isCurrent = row.status === option.value;
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenSupportReportMenuId(null);
                                                                    if (!isCurrent) void updateSupportReportStatus(row.id, option.value as "new" | "in_progress" | "resolved");
                                                                }}
                                                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <span>{option.label}</span>
                                                                <span className={`text-xs ${isCurrent ? "text-emerald-600" : "text-transparent"}`}>✔</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void openAgeEditModal({
                                                userId: row.user_id,
                                                pseudo: row.user_pseudo,
                                                email: row.user_email,
                                            })}
                                            className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                                        >
                                            Corriger âge
                                        </button>
                                        {row.image_url ? (
                                            <a
                                                href={row.image_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                                            >
                                                Ouvrir la pièce jointe
                                            </a>
                                        ) : (
                                            <span className="text-xs text-gray-400">Aucune pièce jointe</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Demandes support internes (support_requests)</h3>
                        {isSupportRequestsLoading ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Chargement…</div>
                        ) : supportRequests.length === 0 ? (
                            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                                <p className="text-lg font-black text-gray-800">Aucune demande support</p>
                                <p className="mt-1 text-sm text-gray-500">Les demandes d&apos;âge, d&apos;accès et questions générales apparaîtront ici.</p>
                            </div>
                        ) : supportRequests.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-black text-gray-900">@{row.user_pseudo}</span>
                                            <span className="text-xs text-gray-500">{row.user_email || row.user_id}</span>
                                            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-bold ${supportStatusBadgeClass(row.status)}`}>
                                                {supportStatusLabel(row.status)}
                                            </span>
                                            <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">
                                                {ageStatusLabel(row.age_verification_status)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs font-semibold text-gray-600">{row.type_label}</p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{row.message}</p>
                                        <p className="mt-2 text-xs text-gray-500">
                                            {new Date(row.created_at).toLocaleString("fr-FR")}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="relative">
                                            <button
                                                type="button"
                                                disabled={isSupportRequestActionLoading === row.id}
                                                onClick={() => setOpenSupportRequestMenuId((prev) => prev === row.id ? null : row.id)}
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-bold ${supportStatusBadgeClass(row.status)} disabled:opacity-60`}
                                            >
                                                {isSupportRequestActionLoading === row.id ? "Mise à jour..." : supportStatusLabel(row.status)}
                                                <span className="text-[10px]">▼</span>
                                            </button>
                                            {openSupportRequestMenuId === row.id ? (
                                                <div className="absolute right-0 z-10 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                                                    {[
                                                        { value: "new", label: "Nouveau" },
                                                        { value: "in_progress", label: "En cours" },
                                                        { value: "resolved", label: "Traité" },
                                                    ].map((option) => {
                                                        const isCurrent = row.status === option.value;
                                                        return (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                onClick={() => {
                                                                    setOpenSupportRequestMenuId(null);
                                                                    if (!isCurrent) void updateSupportRequestStatus(row.id, option.value as "new" | "in_progress" | "resolved");
                                                                }}
                                                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                            >
                                                                <span>{option.label}</span>
                                                                <span className={`text-xs ${isCurrent ? "text-emerald-600" : "text-transparent"}`}>✔</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void openAgeEditModal({
                                                userId: row.user_id,
                                                pseudo: row.user_pseudo,
                                                email: row.user_email,
                                            })}
                                            className="rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                                        >
                                            Corriger âge
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                </section>
            )}

            {ageEditTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Corriger la date de naissance</h2>
                                <p className="text-xs text-gray-500">@{ageEditTarget.pseudo} · {ageEditTarget.email || ageEditTarget.userId}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAgeEditTarget(null)}
                                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Fermer
                            </button>
                        </div>

                        {isAgeEditLoading ? (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">Chargement…</div>
                        ) : (
                            <>
                                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs font-semibold text-violet-700">
                                    Statut actuel: {ageStatusLabel(ageEditCurrentStatus)}
                                </div>
                                <div className="mt-3">
                                    <label className="mb-1 ml-1 block text-xs font-bold text-gray-500">Date de naissance</label>
                                    <input
                                        type="date"
                                        value={ageEditBirthDate}
                                        onChange={(e) => setAgeEditBirthDate(e.target.value)}
                                        max={new Date().toISOString().slice(0, 10)}
                                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-violet-200"
                                    />
                                </div>
                                {ageEditFeedback ? (
                                    <div className={`mt-3 rounded-xl p-3 text-xs font-semibold ${ageEditFeedback.includes("mis à jour") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                                        {ageEditFeedback}
                                    </div>
                                ) : null}
                                <div className="mt-4 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAgeEditTarget(null)}
                                        className="h-11 flex-1 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void saveAgeCorrection()}
                                        disabled={!ageEditBirthDate || isAgeEditSaving}
                                        className="h-11 flex-1 rounded-xl bg-violet-600 text-sm font-black text-white disabled:opacity-60"
                                    >
                                        {isAgeEditSaving ? "Enregistrement..." : "Enregistrer"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {selectedRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xl flex flex-col">
                        <div className="flex items-start justify-between gap-3 shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Examen du signalement</h2>
                                <p className="text-sm text-gray-500">#{selectedRow.id}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedRow(null);
                                    setChatMessages([]);
                                    setChatError(null);
                                    setHasChatLoaded(false);
                                }}
                                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Fermer
                            </button>
                        </div>

                        <div className="mt-4 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                                <p><span className="font-bold">Utilisateur reporté :</span> @{selectedRow.reported.pseudo}</p>
                                <p><span className="font-bold">Reporteur :</span> @{selectedRow.reporter.pseudo}</p>
                                <p><span className="font-bold">Motif :</span> {selectedRow.reason_label}</p>
                                <p><span className="font-bold">Statut :</span> {selectedRow.status}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                                <p><span className="font-bold">Activité :</span> {selectedRow.activity.sport}</p>
                                <p><span className="font-bold">Lieu :</span> {selectedRow.activity.location || "-"}</p>
                                <p><span className="font-bold">Date :</span> {new Date(selectedRow.created_at).toLocaleString("fr-FR")}</p>
                                <p><span className="font-bold">Warnings :</span> {selectedRow.warns_count || 0}</p>
                                <p><span className="font-bold">Incidents validés :</span> {selectedRow.moderation_status?.incident_count ?? 0}</p>
                                <p><span className="font-bold">Statut actuel :</span> {formatCurrentModerationStatus(selectedRow.moderation_status)}</p>
                                <p><span className="font-bold">Saison actuelle :</span> {selectedRow.season_id || "-"}</p>
                            </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                            <p className="mb-1 font-bold">Historique par saison</p>
                            {isHistoryLoading ? (
                                <p className="text-sm text-gray-500">Chargement de l’historique…</p>
                            ) : userSeasonHistory.length === 0 ? (
                                <p className="text-sm text-gray-500">Aucun incident historique trouvé.</p>
                            ) : (
                                <div className="space-y-1">
                                    {userSeasonHistory.map((season) => (
                                        <p key={season.season_id} className="text-xs text-gray-600">
                                            {season.season_id} · Warn1: {season.summary.warn1} · Warn2: {season.summary.warn2} · Restrict: {season.summary.restrict} · Suspend: {season.summary.suspend}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                            <p className="mb-1 font-bold">Texte du report</p>
                            <p>{selectedRow.report_text || "Aucun texte fourni."}</p>
                            {Array.isArray(selectedRow.all_group_comments) && selectedRow.all_group_comments.length > 0 ? (
                                <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                                    <p className="text-xs font-bold text-gray-600">Commentaires du groupe (même activité / cible / motif)</p>
                                    {selectedRow.all_group_comments.map((comment, index) => (
                                        <p key={`${comment.reporter_id}-${index}`} className="text-xs text-gray-600">
                                            <span className="font-bold">@{comment.reporter_pseudo}</span> : {comment.text}
                                        </p>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-3">
                            <button
                                type="button"
                                onClick={() => void loadModerationChat(selectedRow.activity.id)}
                                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                disabled={isChatLoading}
                            >
                                {isChatLoading ? "Chargement du chat..." : "Voir le chat"}
                            </button>
                        </div>

                        {(isChatLoading || chatError || hasChatLoaded) && (
                            <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3">
                                <p className="mb-2 text-sm font-black text-gray-900">Historique du chat</p>
                                {isChatLoading ? (
                                    <p className="text-sm text-gray-500">Chargement des messages…</p>
                                ) : chatError ? (
                                    <p className="text-sm text-rose-600">{chatError}</p>
                                ) : chatMessages.length === 0 ? (
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-gray-700">Chat vide</p>
                                        <p className="text-sm text-gray-500">Aucun message n’a été envoyé dans cette activité.</p>
                                        <p className="text-sm text-gray-500">Le signalement ne peut pas être vérifié via l’historique du chat.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                                            Messages trouvés : {chatMessages.length}
                                        </p>
                                        <div className="max-h-[260px] space-y-2 overflow-y-auto">
                                        {chatMessages.map((message) => (
                                            <div key={message.id} className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
                                                <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
                                                    <span className="font-bold text-gray-700">@{message.sender_name}</span>
                                                    <span className="font-semibold text-gray-400">
                                                        {new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] text-gray-700">{message.content}</p>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(() => {
                            const warns = Number(selectedRow.warns_count || 0);
                            const recommended = getRecommendedAction(selectedRow);
                            const allActions = [
                                { key: "warn1", label: "Warn 1" },
                                { key: "warn2", label: "Warn 2" },
                                { key: "restrict_chat", label: "Restrict chat" },
                                { key: "suspend", label: "Suspendre" },
                                { key: "ignore", label: "Ignorer" },
                            ] as const;

                            const visibleActions = (warns >= 2
                                ? allActions.filter((a) => a.key !== "warn1" && a.key !== "warn2")
                                : allActions)
                                .filter((a) => !(a.key === "ignore" && selectedRow.status !== "pending"));

                            const primary = visibleActions.find((action) => action.key === recommended) || visibleActions[0];
                            const secondary = visibleActions.filter((action) => action.key !== primary.key);

                            return (
                                <div className="mt-4 space-y-2">
                                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-600">
                                        Recommandé : {primary.label}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => confirmAction(primary.key)}
                                        disabled={isApplyingAction}
                                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                    >
                                        Appliquer {primary.label}
                                    </button>

                                    <div className="flex flex-wrap gap-2">
                                        {secondary.map((action) => (
                                            <button
                                                key={action.key}
                                                type="button"
                                                onClick={() => confirmAction(action.key)}
                                                disabled={isApplyingAction}
                                                className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>

                                    {selectedRow.status === "pending" ? (
                                        <button
                                            type="button"
                                            onClick={() => confirmAction("ignore", "group")}
                                            disabled={isApplyingAction}
                                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                        >
                                            Ignorer tout l’incident pending
                                        </button>
                                    ) : null}

                                    <div className="flex flex-wrap gap-3 pt-1">
                                        <label className="text-xs font-semibold text-gray-600">
                                            Restrict (jours)
                                            <select
                                                value={restrictDays}
                                                onChange={(e) => setRestrictDays(Number(e.target.value))}
                                                className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                                            >
                                                <option value={3}>3</option>
                                                <option value={7}>7</option>
                                            </select>
                                        </label>
                                        <label className="text-xs font-semibold text-gray-600">
                                            Suspendre (jours)
                                            <select
                                                value={suspendDays}
                                                onChange={(e) => setSuspendDays(Number(e.target.value))}
                                                className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                                            >
                                                <option value={3}>3</option>
                                                <option value={7}>7</option>
                                                <option value={14}>14</option>
                                            </select>
                                        </label>
                                    </div>

                                    {actionFeedback && (
                                        <p className="text-xs font-semibold text-gray-600">{actionFeedback}</p>
                                    )}
                                </div>
                            );
                        })()}
                        </div>
                    </div>
                </div>
            )}

            {selectedFeedbackIncident && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xl flex flex-col">
                        <div className="flex items-start justify-between gap-3 shrink-0">
                            <div>
                                <h2 className="text-lg font-black text-gray-900">Examiner l’incident feedback</h2>
                                <p className="text-sm text-gray-500">#{selectedFeedbackIncident.id}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFeedbackIncident(null);
                                    setPendingFeedbackConfirmAction(null);
                                }}
                                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Fermer
                            </button>
                        </div>

                        <div className="mt-4 flex-1 overflow-y-auto pr-1">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                                <p><span className="font-bold">Utilisateur concerné :</span> @{selectedFeedbackIncident.reported_pseudo}</p>
                                <p><span className="font-bold">Motif :</span> {selectedFeedbackIncident.reason_label}</p>
                                <p><span className="font-bold">Votes :</span> {selectedFeedbackIncident.votes_count}/{selectedFeedbackIncident.participants_count}</p>
                                <p><span className="font-bold">Seuil :</span> {selectedFeedbackIncident.threshold ?? "N/A (groupe de 2)"}</p>
                                <p><span className="font-bold">Statut :</span> {selectedFeedbackIncident.status === "validated" ? "Validé" : "Informatif"}</p>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                                <p><span className="font-bold">Activité :</span> {selectedFeedbackIncident.sport}</p>
                                <p><span className="font-bold">Lieu :</span> {selectedFeedbackIncident.location || "-"}</p>
                                <p><span className="font-bold">Date activité :</span> {selectedFeedbackIncident.activity_start_time ? new Date(selectedFeedbackIncident.activity_start_time).toLocaleString("fr-FR") : "-"}</p>
                                <p><span className="font-bold">Saison :</span> {selectedFeedbackIncident.season_id}</p>
                                <p><span className="font-bold">Statut modération :</span> {formatCurrentModerationStatus(selectedFeedbackIncident.moderation_status)}</p>
                            </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                            <p className="mb-1 font-bold">Description (optionnel)</p>
                            {selectedFeedbackIncident.other_texts.length === 0 ? (
                                <p className="text-sm text-gray-500">Aucun texte libre associé.</p>
                            ) : (
                                <div className="space-y-1">
                                    {selectedFeedbackIncident.other_texts.map((row, index) => (
                                        <p key={`${row.reporter_id}-${index}`} className="text-xs text-gray-600">
                                            <span className="font-bold">@{row.reporter_pseudo}</span> : {row.text}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
                            <p className="mb-1 font-bold">Historique par saison</p>
                            {isHistoryLoading ? (
                                <p className="text-sm text-gray-500">Chargement de l’historique…</p>
                            ) : userSeasonHistory.length === 0 ? (
                                <p className="text-sm text-gray-500">Aucun incident historique trouvé.</p>
                            ) : (
                                <div className="space-y-1">
                                    {userSeasonHistory.map((season) => (
                                        <p key={season.season_id} className="text-xs text-gray-600">
                                            {season.season_id} · Warn1: {season.summary.warn1} · Warn2: {season.summary.warn2} · Restrict: {season.summary.restrict} · Suspend: {season.summary.suspend}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => confirmFeedbackIncidentAction("ignore")}
                                    disabled={isApplyingAction}
                                    className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-black text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                                >
                                    Ignorer
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmFeedbackIncidentAction("warning")}
                                    disabled={isApplyingAction}
                                    className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                                >
                                    Warning
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmFeedbackIncidentAction("suspend")}
                                    disabled={isApplyingAction}
                                    className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                >
                                    Suspendre
                                </button>
                            </div>

                            <label className="text-xs font-semibold text-gray-600">
                                Suspension (jours)
                                <select
                                    value={feedbackIncidentSuspendDays}
                                    onChange={(e) => setFeedbackIncidentSuspendDays(Number(e.target.value))}
                                    className="ml-2 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                                >
                                    <option value={3}>3</option>
                                    <option value={7}>7</option>
                                    <option value={14}>14</option>
                                </select>
                            </label>

                            {actionFeedback && (
                                <p className="text-xs font-semibold text-gray-600">{actionFeedback}</p>
                            )}
                        </div>
                        </div>
                    </div>
                </div>
            )}

            {pendingFeedbackConfirmAction && selectedFeedbackIncident && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-black text-gray-900">{pendingFeedbackConfirmAction.title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{pendingFeedbackConfirmAction.message}</p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingFeedbackConfirmAction(null)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                disabled={isApplyingAction}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const action = pendingFeedbackConfirmAction.action;
                                    setPendingFeedbackConfirmAction(null);
                                    await applyFeedbackIncidentAction(action);
                                }}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                disabled={isApplyingAction}
                            >
                                {isApplyingAction ? "Application..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingConfirmAction && selectedRow && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-black text-gray-900">{pendingConfirmAction.title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{pendingConfirmAction.message}</p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingConfirmAction(null)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                disabled={isApplyingAction}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const action = pendingConfirmAction.action;
                                    const ignoreScope = pendingConfirmAction.ignoreScope || "single";
                                    setPendingConfirmAction(null);
                                    await applyModerationAction(action, ignoreScope);
                                }}
                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                                disabled={isApplyingAction}
                            >
                                {isApplyingAction ? "Application..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingLift && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-black text-gray-900">Confirmer la levée de sanction ?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            @{pendingLift.pseudo} retrouvera immédiatement l’accès normal.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPendingLift(null)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                disabled={isApplyingAction}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => void executeLiftSanction()}
                                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                disabled={isApplyingAction}
                            >
                                {isApplyingAction ? "Application..." : "Lever"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResetConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                        <h2 className="text-lg font-black text-gray-900">Confirmer le reset de saison</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Cette action réinitialisera les statistiques de la saison pour tous les utilisateurs.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowResetConfirm(false)}
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                disabled={isResetting}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSeasonReset()}
                                className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                disabled={isResetting}
                            >
                                {isResetting ? "Confirmation..." : "Confirmer"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
