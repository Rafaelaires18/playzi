"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldAlert } from "lucide-react";
import PlayziLogo from "@/components/PlayziLogo";
import PlayziLoader from "@/components/PlayziLoader";

function sanitizeNextPath(rawValue: string | null): string | null {
    if (!rawValue) return null;
    const value = rawValue.trim();
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
}

type AgeStatus = "loading" | "pending" | "verified_adult" | "blocked_minor";
type DesktopDob = { day: string; month: string; year: string };
type SupportType = "" | "age_verification" | "account_access" | "question";

const MONTH_OPTIONS = [
    { value: "01", label: "Janvier" },
    { value: "02", label: "Février" },
    { value: "03", label: "Mars" },
    { value: "04", label: "Avril" },
    { value: "05", label: "Mai" },
    { value: "06", label: "Juin" },
    { value: "07", label: "Juillet" },
    { value: "08", label: "Août" },
    { value: "09", label: "Septembre" },
    { value: "10", label: "Octobre" },
    { value: "11", label: "Novembre" },
    { value: "12", label: "Décembre" },
];

function parseIsoDateToDesktopDob(value: string): DesktopDob {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return { day: "", month: "", year: "" };
    return { year: match[1], month: match[2], day: match[3] };
}

function daysInMonth(year: number, month: number): number {
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return 31;
    return new Date(year, month, 0).getDate();
}

function buildSupportRateLimitMessage(details: {
    retry_after_seconds?: number;
    retry_after_hours?: number;
    next_allowed_at?: string;
} | null | undefined) {
    const nextAllowedAtRaw = typeof details?.next_allowed_at === "string" ? details.next_allowed_at : "";
    if (nextAllowedAtRaw) {
        const nextDate = new Date(nextAllowedAtRaw);
        if (!Number.isNaN(nextDate.getTime())) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetDay = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
            const dayDiff = Math.round((targetDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            const time = nextDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

            if (dayDiff === 0) {
                return `Tu as déjà envoyé une demande récemment pour ce sujet. Prochaine demande possible aujourd'hui à ${time}.`;
            }
            if (dayDiff === 1) {
                return `Tu as déjà envoyé une demande récemment pour ce sujet. Prochaine demande possible demain à ${time}.`;
            }
            return `Tu as déjà envoyé une demande récemment pour ce sujet. Prochaine demande possible le ${nextDate.toLocaleDateString("fr-FR")} à ${time}.`;
        }
    }

    const retryAfterHours = Number(details?.retry_after_hours || 0);
    if (Number.isFinite(retryAfterHours) && retryAfterHours > 0) {
        return `Tu as déjà envoyé une demande récemment pour ce sujet. Tu pourras en renvoyer une nouvelle dans ${retryAfterHours}h.`;
    }

    const retryAfterSeconds = Number(details?.retry_after_seconds || 0);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
        return `Tu as déjà envoyé une demande récemment pour ce sujet. Merci d'attendre ${retryAfterMinutes} min avant un nouvel envoi.`;
    }

    return "Tu as déjà envoyé une demande récemment pour ce sujet. Merci d’attendre avant d’en renvoyer une nouvelle.";
}

export default function AgeCheckPage() {
    const router = useRouter();
    const [status, setStatus] = useState<AgeStatus>("loading");
    const [birthDate, setBirthDate] = useState("");
    const [isDesktop, setIsDesktop] = useState(false);
    const [desktopDob, setDesktopDob] = useState<DesktopDob>({ day: "", month: "", year: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [supportEmail, setSupportEmail] = useState("");
    const [supportType, setSupportType] = useState<SupportType>("age_verification");
    const [supportMessage, setSupportMessage] = useState("");
    const [supportError, setSupportError] = useState<string | null>(null);
    const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
    const [isSupportSubmitting, setIsSupportSubmitting] = useState(false);

    const nextPath = useMemo(() => {
        if (typeof window === "undefined") return "/discover";
        const query = new URLSearchParams(window.location.search);
        return sanitizeNextPath(query.get("next")) || "/discover";
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const media = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
        const apply = () => setIsDesktop(media.matches);
        apply();
        media.addEventListener("change", apply);
        return () => media.removeEventListener("change", apply);
    }, []);

    useEffect(() => {
        if (!birthDate) return;
        setDesktopDob(parseIsoDateToDesktopDob(birthDate));
    }, [birthDate]);

    useEffect(() => {
        if (!isDesktop) return;
        const { day, month, year } = desktopDob;
        if (!day || !month || !year) {
            setBirthDate("");
            return;
        }
        const yearNum = Number(year);
        const monthNum = Number(month);
        const dayNum = Number(day);
        const maxDay = daysInMonth(yearNum, monthNum);
        if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > maxDay) {
            setBirthDate("");
            return;
        }
        setBirthDate(`${year}-${month}-${day.padStart(2, "0")}`);
    }, [desktopDob, isDesktop]);

    const currentYear = useMemo(() => new Date().getFullYear(), []);
    const yearOptions = useMemo(
        () => Array.from({ length: 100 }, (_, i) => String(currentYear - i)),
        [currentYear]
    );
    const maxDayForSelection = useMemo(() => {
        const yearNum = Number(desktopDob.year);
        const monthNum = Number(desktopDob.month);
        return daysInMonth(yearNum, monthNum);
    }, [desktopDob.month, desktopDob.year]);
    const dayOptions = useMemo(
        () => Array.from({ length: maxDayForSelection }, (_, i) => String(i + 1).padStart(2, "0")),
        [maxDayForSelection]
    );

    useEffect(() => {
        let cancelled = false;
        const loadStatus = async () => {
            try {
                const res = await fetch(`/api/profile/age-verification?t=${Date.now()}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                if (!res.ok) throw new Error(body?.error || "Impossible de vérifier votre âge.");
                if (cancelled) return;
                const apiStatus = String(body?.data?.status || "pending") as AgeStatus;
                setBirthDate(typeof body?.data?.birth_date === "string" ? body.data.birth_date : "");
                if (apiStatus === "verified_adult") {
                    setStatus("verified_adult");
                    router.replace(nextPath);
                    return;
                }
                if (apiStatus === "blocked_minor") {
                    setStatus("blocked_minor");
                    return;
                }
                setStatus("pending");
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : "Impossible de vérifier votre âge.");
                    setStatus("pending");
                }
            }
        };
        void loadStatus();
        return () => { cancelled = true; };
    }, [nextPath, router]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!birthDate) {
            setError("Merci de renseigner votre date de naissance.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            const res = await fetch("/api/profile/age-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ birth_date: birthDate }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 403) {
                    setStatus("blocked_minor");
                    return;
                }
                throw new Error(body?.error || "Impossible de valider votre âge.");
            }
            setStatus("verified_adult");
            router.replace(nextPath);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Impossible de valider votre âge.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.replace("/login?force_login=1");
    };

    const handleUseAnotherAccount = async () => {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        router.replace(`/login?force_login=1&mode=register&next=${encodeURIComponent(nextPath)}`);
    };

    useEffect(() => {
        if (status !== "blocked_minor") return;
        let cancelled = false;

        const preloadSupportEmail = async () => {
            try {
                const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                const email = typeof body?.data?.user?.email === "string" ? body.data.user.email.trim() : "";
                if (!cancelled && email) setSupportEmail(email);
            } catch {
                // Best effort prefill only.
            }
        };

        void preloadSupportEmail();
        return () => {
            cancelled = true;
        };
    }, [status]);

    const handleSubmitSupportRequest = async (event: FormEvent) => {
        event.preventDefault();
        setSupportError(null);
        setSupportSuccess(null);

        const trimmedEmail = supportEmail.trim();
        const trimmedMessage = supportMessage.trim();
        if (!trimmedEmail) {
            setSupportError("Merci d'indiquer un email de contact.");
            return;
        }
        if (!trimmedMessage) {
            setSupportError("Merci de décrire votre demande.");
            return;
        }

        setIsSupportSubmitting(true);
        try {
            const res = await fetch("/api/support/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    message: trimmedMessage,
                    type: supportType || null,
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                if (res.status === 429 && body?.details?.code === "support_request_rate_limited") {
                    throw new Error(buildSupportRateLimitMessage(body?.details || null));
                }
                throw new Error(body?.error || "Impossible d'envoyer votre demande.");
            }

            setSupportSuccess("Demande envoyée. L'équipe support vous répondra rapidement.");
            setSupportMessage("");
            setSupportType("age_verification");
        } catch (e) {
            setSupportError(e instanceof Error ? e.message : "Impossible d'envoyer votre demande.");
        } finally {
            setIsSupportSubmitting(false);
        }
    };

    if (status === "loading") {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-[#F5F7F6]">
                <PlayziLoader compact message="Chargement..." />
            </main>
        );
    }

    if (status === "blocked_minor") {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-[#F5F7F6] px-6">
                <div className="w-full max-w-md rounded-[28px] border border-rose-200 bg-white p-7 shadow-sm">
                    <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50">
                        <ShieldAlert className="h-6 w-6 text-rose-600" />
                    </div>
                    <h1 className="text-center text-[20px] font-black text-[#242841]">Accès non disponible</h1>
                    <p className="mt-2 text-center text-[14px] font-medium text-gray-600">
                        Playzi est réservé aux personnes de 18 ans et plus.
                    </p>
                    <p className="mt-2 text-center text-[14px] font-medium text-gray-600">
                        Tu pourras rejoindre l&apos;app dès que tu auras l&apos;âge requis.
                    </p>
                    <p className="mt-3 text-center text-[12px] font-medium text-gray-500">
                        Si tu penses qu&apos;il s&apos;agit d&apos;une erreur, contacte le{" "}
                        <button
                            type="button"
                            onClick={() => {
                                setSupportError(null);
                                setSupportSuccess(null);
                                setIsSupportModalOpen(true);
                            }}
                            className="font-bold text-emerald-600 underline decoration-emerald-300 underline-offset-2"
                        >
                            support
                        </button>
                        .
                    </p>
                    <div className="mt-5 flex justify-center overflow-hidden">
                        <PlayziLogo className="origin-center scale-[0.48]" />
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="mt-6 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-700"
                    >
                        Se déconnecter
                    </button>
                </div>
                {isSupportModalOpen && (
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/50 px-4">
                        <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-xl">
                            <h2 className="text-[18px] font-black text-[#242841]">Contacter le support</h2>
                            <p className="mt-1 text-[13px] font-medium text-gray-500">
                                Décrivez votre situation, notre équipe reviendra vers vous rapidement.
                            </p>

                            {supportError && (
                                <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                                    {supportError}
                                </div>
                            )}
                            {supportSuccess && (
                                <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
                                    {supportSuccess}
                                </div>
                            )}
                            {supportSuccess && (
                                <button
                                    type="button"
                                    onClick={() => void handleLogout()}
                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] font-semibold text-gray-700"
                                >
                                    Se déconnecter
                                </button>
                            )}

                            <form onSubmit={handleSubmitSupportRequest} className="mt-4 space-y-3">
                                <div>
                                    <label className="mb-1 ml-1 block text-[12px] font-bold text-gray-500">Email</label>
                                    <input
                                        type="email"
                                        value={supportEmail}
                                        onChange={(e) => setSupportEmail(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                        placeholder="vous@email.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 ml-1 block text-[12px] font-bold text-gray-500">Type de demande</label>
                                    <select
                                        value={supportType}
                                        onChange={(e) => setSupportType(e.target.value as SupportType)}
                                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    >
                                        <option value="age_verification">Vérification d&apos;âge</option>
                                        <option value="account_access">Accès au compte</option>
                                        <option value="question">Question</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 ml-1 block text-[12px] font-bold text-gray-500">Message</label>
                                    <textarea
                                        value={supportMessage}
                                        onChange={(e) => setSupportMessage(e.target.value)}
                                        className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                        placeholder="Expliquez votre demande..."
                                        maxLength={2000}
                                        required
                                    />
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSupportModalOpen(false)}
                                        className="h-11 flex-1 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-700"
                                    >
                                        Fermer
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSupportSubmitting}
                                        className="h-11 flex-1 rounded-xl bg-emerald-500 text-[13px] font-black text-white disabled:opacity-70"
                                    >
                                        {isSupportSubmitting ? "Envoi..." : "Envoyer"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        );
    }

    return (
        <main className="relative flex min-h-[100dvh] items-center justify-center bg-[#F5F7F6] px-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08),_transparent_42%),radial-gradient(circle_at_bottom_left,_rgba(36,40,65,0.05),_transparent_46%)]" />
            <div className="relative z-10 w-full max-w-md rounded-[28px] border border-gray-100 bg-white p-7 shadow-sm">
                <div className="mb-4 flex justify-center">
                    <PlayziLogo />
                </div>
                <h1 className="text-center text-[20px] font-black text-[#242841]">Vérification d’âge</h1>
                <p className="mt-2 text-center text-[14px] font-medium text-gray-600">
                    Avant de continuer, indiquez votre date de naissance.
                </p>

                {error && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-[13px] font-medium text-rose-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {!isDesktop && (
                        <div className="space-y-1.5">
                            <label className="ml-1 text-[12px] font-bold text-gray-500">Date de naissance</label>
                            <input
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                max={new Date().toISOString().slice(0, 10)}
                                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                required
                            />
                        </div>
                    )}
                    {isDesktop && (
                        <div className="space-y-1.5">
                            <label className="ml-1 text-[12px] font-bold text-gray-500">Date de naissance</label>
                            <div className="grid grid-cols-3 gap-2">
                                <select
                                    value={desktopDob.day}
                                    onChange={(e) => setDesktopDob((prev) => ({ ...prev, day: e.target.value }))}
                                    className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    required
                                >
                                    <option value="">Jour</option>
                                    {dayOptions.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                                <select
                                    value={desktopDob.month}
                                    onChange={(e) => setDesktopDob((prev) => ({ ...prev, month: e.target.value }))}
                                    className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    required
                                >
                                    <option value="">Mois</option>
                                    {MONTH_OPTIONS.map((month) => (
                                        <option key={month.value} value={month.value}>{month.label}</option>
                                    ))}
                                </select>
                                <select
                                    value={desktopDob.year}
                                    onChange={(e) => setDesktopDob((prev) => ({ ...prev, year: e.target.value }))}
                                    className="h-12 rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    required
                                >
                                    <option value="">Année</option>
                                    {yearOptions.map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 w-full rounded-xl bg-emerald-500 text-[14px] font-black text-white disabled:opacity-70"
                    >
                        {isSubmitting ? "Vérification..." : "Continuer"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleUseAnotherAccount()}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-700"
                    >
                        Utiliser un autre compte
                    </button>
                </form>
            </div>
        </main>
    );
}
