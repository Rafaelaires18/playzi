"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";
import type { GenderInput } from "@/lib/validations/auth";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { hardResetClientAuthState } from "@/lib/auth";

type AuthMode = "login" | "register";
const INVITE_PENDING_PATH_KEY = "playzi_pending_invitation_path";
const INVITE_PENDING_TOKEN_KEY = "playzi_pending_invitation_token";
const KNOWN_USER_FLAG_KEY = "playzi_known_user";
const PENDING_INVITE_KEY = "pending_invite";

function sanitizeNextPath(rawValue: string | null): string | null {
    if (!rawValue) return null;
    const value = rawValue.trim();
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
}

function isInvitationPath(value: string | null): boolean {
    return !!value && /^\/invitation\/[^/]+$/i.test(value);
}

function extractInvitationToken(value: string | null): string | null {
    if (!isInvitationPath(value)) return null;
    const token = String(value || "").replace(/^\/invitation\//i, "").trim();
    return token || null;
}

function persistInvitationIntent(nextPath: string | null) {
    if (typeof window === "undefined" || !isInvitationPath(nextPath)) return;
    const token = extractInvitationToken(nextPath);
    if (!token) return;
    window.localStorage.setItem(INVITE_PENDING_PATH_KEY, nextPath!);
    window.localStorage.setItem(INVITE_PENDING_TOKEN_KEY, token);
    window.sessionStorage.setItem(INVITE_PENDING_PATH_KEY, nextPath!);
    window.sessionStorage.setItem(INVITE_PENDING_TOKEN_KEY, token);
}

function consumeInvitationIntent(): string | null {
    if (typeof window === "undefined") return null;
    const sessionPath = sanitizeNextPath(window.sessionStorage.getItem(INVITE_PENDING_PATH_KEY));
    const localPath = sanitizeNextPath(window.localStorage.getItem(INVITE_PENDING_PATH_KEY));
    return sessionPath || localPath;
}

function clearInvitationIntent() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(INVITE_PENDING_PATH_KEY);
    window.localStorage.removeItem(INVITE_PENDING_TOKEN_KEY);
    window.sessionStorage.removeItem(INVITE_PENDING_PATH_KEY);
    window.sessionStorage.removeItem(INVITE_PENDING_TOKEN_KEY);
}

function consumePendingInviteActivityId(): string | null {
    if (typeof window === "undefined") return null;
    const raw = String(window.localStorage.getItem(PENDING_INVITE_KEY) || "").trim();
    if (!raw) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
    return isUuid ? raw : null;
}

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();
    const [mode, setMode] = useState<AuthMode>("login");
    const [isLoading, setIsLoading] = useState(false);
    const [isBootstrappingAuthState, setIsBootstrappingAuthState] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [isInvitationFlow, setIsInvitationFlow] = useState(false);

    // Form inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [pseudo, setPseudo] = useState("");
    const [gender, setGender] = useState<GenderInput | "">("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [marketingOptIn, setMarketingOptIn] = useState(false);
    const [consentError, setConsentError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const bootstrapAuthState = async () => {
            try {
                await hardResetClientAuthState();
                const query = new URLSearchParams(window.location.search);
                if (query.get("force_login") === "1") {
                    await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);
                }
                if (query.get("session_mismatch") === "1") {
                    setError("Session incohérente détectée. Reconnecte-toi pour continuer.");
                }
                if (query.get("email_updated") === "1") {
                    setInfoMessage("Email mis à jour avec succès. Veuillez vous reconnecter.");
                }
                const emailChangeState = query.get("email_change");
                if (emailChangeState === "confirm_expired") {
                    setError("Le lien de confirmation a expiré. Refais la demande depuis Paramètres.");
                } else if (emailChangeState === "invalid") {
                    setError("Lien invalide ou déjà utilisé.");
                } else if (emailChangeState === "cancel_expired") {
                    setError("Le lien d'annulation a expiré.");
                } else if (emailChangeState === "canceled") {
                    setInfoMessage("La modification d'email a été annulée.");
                } else if (emailChangeState === "canceled_and_reset") {
                    setInfoMessage("Modification annulée. Un email de réinitialisation du mot de passe a été envoyé.");
                } else if (emailChangeState === "already_canceled") {
                    setInfoMessage("Cette demande de changement d'email est déjà annulée.");
                } else if (emailChangeState === "confirm_failed" || emailChangeState === "cancel_failed") {
                    setError("Impossible de finaliser l'opération pour le moment.");
                } else if (emailChangeState === "server_error") {
                    setError("Erreur serveur temporaire. Réessaie dans quelques minutes.");
                }

                const nextPath = sanitizeNextPath(query.get("next"));
                const requestedMode = query.get("mode");
                if (requestedMode === "register" || requestedMode === "login") {
                    setMode(requestedMode);
                }
                const acceptedTermsFromQuery = query.get("accepted_terms");
                if (acceptedTermsFromQuery === "1" || acceptedTermsFromQuery === "0") {
                    setAcceptedTerms(acceptedTermsFromQuery === "1");
                }
                const marketingFromQuery = query.get("marketing_opt_in");
                if (marketingFromQuery === "1" || marketingFromQuery === "0") {
                    setMarketingOptIn(marketingFromQuery === "1");
                }
                const invitationFlow = isInvitationPath(nextPath);
                setIsInvitationFlow(invitationFlow);
                if (invitationFlow) {
                    persistInvitationIntent(nextPath);
                    const knownUser = window.localStorage.getItem(KNOWN_USER_FLAG_KEY) === "1";
                    setMode(knownUser ? "login" : "register");
                }
            } finally {
                if (mounted) setIsBootstrappingAuthState(false);
            }
        };
        void bootstrapAuthState();
        return () => {
            mounted = false;
        };
    }, []);

    const handleOAuthLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await hardResetClientAuthState();
            await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);
            if (typeof window !== "undefined") {
                // Allow guard to tolerate OAuth cookie/session propagation after callback.
                window.sessionStorage.setItem("playzi_auth_guard_grace_until", String(Date.now() + 20000));
                window.sessionStorage.setItem("playzi_oauth_started_at", String(Date.now()));
            }
            const nextPath = sanitizeNextPath(new URLSearchParams(window.location.search).get("next"));
            persistInvitationIntent(nextPath);
            const callbackUrl = nextPath
                ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
                : `${window.location.origin}/auth/callback`;
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: callbackUrl,
                },
            });
            if (error) throw error;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Impossible de se connecter");
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setConsentError(null);

        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

        try {
            await hardResetClientAuthState();
            if (mode === "register" && !acceptedTerms) {
                setConsentError("Tu dois accepter les conditions pour continuer.");
                setIsLoading(false);
                return;
            }
            const body = mode === "login"
                ? { email, password }
                : {
                    first_name: firstName,
                    last_name: lastName,
                    pseudo,
                    email,
                    password,
                    gender,
                    accepted_terms: acceptedTerms,
                    marketing_opt_in: marketingOptIn,
                };

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                // Formatting Zod errors if available
                if (data.details) {
                    const messages = Object.values(data.details).flatMap(err => err as string[]);
                    throw new Error(messages[0] || data.error);
                }
                throw new Error(data.error || "Une erreur est survenue");
            }

            const sessionRes = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
            const sessionBody = await sessionRes.json().catch(() => null);
            const activeUser = sessionBody?.data?.user;
            const activeId = typeof activeUser?.id === "string" ? activeUser.id : "";
            const activeEmail = typeof activeUser?.email === "string" ? activeUser.email.trim().toLowerCase() : "";
            const expectedEmail = email.trim().toLowerCase();
            if (!activeId || activeEmail !== expectedEmail) {
                await hardResetClientAuthState();
                await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);
                throw new Error("Session invalide détectée. Réessaie la connexion.");
            }

            const queryNextPath = sanitizeNextPath(typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("next")
                : null);
            const fallbackInvitationPath = consumeInvitationIntent();
            const pendingInviteActivityId = consumePendingInviteActivityId();
            const pendingInviteNextPath = pendingInviteActivityId
                ? `/activities?invite_activity_id=${encodeURIComponent(pendingInviteActivityId)}&invite_prompt=1`
                : null;
            const nextPath = queryNextPath || fallbackInvitationPath || pendingInviteNextPath;
            if (typeof window !== "undefined") {
                window.localStorage.setItem(KNOWN_USER_FLAG_KEY, "1");
            }
            if (isInvitationPath(nextPath)) {
                clearInvitationIntent();
            }
            // Success! Redirect to home feed
            router.replace(nextPath || "/discover");
            // Force a hard refresh if needed to trigger server-side layout re-evaluation,
            // but router.push('/') usually suffices with App Router
            router.refresh();

        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Une erreur est survenue");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(prev => prev === "login" ? "register" : "login");
        setError(null);
        setConsentError(null);
    };

    const heroTitle = isInvitationFlow
        ? (mode === "register" ? "Bienvenue sur Playzi" : "Rejoins cette activité sur Playzi")
        : (mode === "login" ? "Heureux de te revoir" : "Bienvenue sur Playzi");
    const heroSubtitle = isInvitationFlow
        ? (mode === "register" ? "Crée ton compte pour rejoindre l’invitation." : "Connecte-toi pour accéder directement à l’invitation.")
        : (mode === "login" ? "Ta prochaine session t'attend." : "Rejoins des joueurs motivés autour de toi.");
    const isRegisterSubmitDisabled = isLoading || isBootstrappingAuthState || (mode === "register" && !acceptedTerms);
    const legalHref = `/login/consents?mode=register&accepted_terms=${acceptedTerms ? "1" : "0"}&marketing_opt_in=${marketingOptIn ? "1" : "0"}`;

    return (
        <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-gray-50 px-6 sm:px-8">
            {/* Minimalist Background pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.04),_transparent_40%)]" />

            <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center">

                {/* Logo Section */}
                <div className="mb-6 flex flex-col items-center text-center">
                    <PlayziLogo />
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="mt-2 text-[15px] font-medium text-gray-400 max-w-[280px] leading-relaxed"
                    >
                        Trouve ton équipe. Lance ta session.
                    </motion.p>
                </div>

                {/* Main Auth Card */}
                <motion.div
                    layout
                    transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                    className="w-full rounded-[32px] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-8"
                >
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <h1 className="text-[26px] font-black tracking-tight text-gray-dark mb-1">
                            {heroTitle}
                        </h1>
                        <p className="mb-7 text-[15px] text-gray-400 font-medium">
                            {heroSubtitle}
                        </p>

                        {/* Error Alert */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mb-6 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-600"
                            >
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p className="font-medium leading-relaxed">{error}</p>
                            </motion.div>
                        )}
                        {infoMessage && !error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mb-6 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700"
                            >
                                <p className="font-medium leading-relaxed">{infoMessage}</p>
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                            {mode === "register" && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-500 ml-2">Prénom</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            placeholder="Valérie"
                                            className="h-14 w-full rounded-2xl border-none bg-gray-50 px-4 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-500 ml-2">Nom</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            placeholder="Detierre"
                                            className="h-14 w-full rounded-2xl border-none bg-gray-50 px-4 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[13px] font-bold text-gray-500 ml-2">Pseudo</label>
                                        <input
                                            type="text"
                                            value={pseudo}
                                            onChange={(e) => setPseudo(e.target.value)}
                                            placeholder="Choisis ton pseudo"
                                            className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                            required
                                        />
                                        <p className="ml-2 text-[11px] font-medium text-gray-400">
                                            Lettres, chiffres et underscore uniquement.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-500 ml-2">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="hello@exemple.com"
                                    className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[13px] font-bold text-gray-500 ml-2">Mot de passe</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                    required
                                />
                                {mode === "register" && (
                                    <p className="ml-2 text-[11px] font-medium text-gray-400">
                                        Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.
                                    </p>
                                )}
                            </div>

                            {mode === "login" && (
                                <button
                                    type="button"
                                    onClick={() => router.push("/forgot-password")}
                                    className="self-end text-[12px] font-semibold text-gray-400 transition hover:text-gray-500"
                                >
                                    Mot de passe oublié ?
                                </button>
                            )}

                            {mode === "register" && (
                                <div className="space-y-1.5 mt-2">
                                    <label className="text-[13px] font-semibold text-gray-400 ml-2">Type de profil</label>
                                    <div className="flex flex-wrap gap-2">
                                        {([
                                            { value: "male", label: "Homme" },
                                            { value: "female", label: "Femme" },
                                            { value: "other", label: "Autre" },
                                        ] as const).map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setGender(option.value)}
                                                className={`min-w-[82px] px-4 py-1.5 rounded-[10px] text-[13px] font-semibold outline-none transition-all ${gender === option.value
                                                    ? "bg-playzi-green text-white shadow-sm border border-playzi-green"
                                                    : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {mode === "register" && (
                                <div className="mt-1 space-y-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => {
                                            setAcceptedTerms((prev) => !prev);
                                            setConsentError(null);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setAcceptedTerms((prev) => !prev);
                                                setConsentError(null);
                                            }
                                        }}
                                        className="group flex cursor-pointer items-start gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${acceptedTerms ? "border-playzi-green bg-playzi-green text-white scale-100" : "border-gray-300 bg-white text-transparent scale-[0.96]"}`}>
                                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                        </span>
                                        <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                                            J&apos;accepte les{" "}
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    router.push(`${legalHref}#conditions`);
                                                }}
                                                className="font-semibold text-[#2D2E3B] underline decoration-gray-300 underline-offset-2"
                                            >
                                                Conditions d&apos;utilisation
                                            </button>{" "}
                                            et la{" "}
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    router.push(`${legalHref}#privacy`);
                                                }}
                                                className="font-semibold text-[#2D2E3B] underline decoration-gray-300 underline-offset-2"
                                            >
                                                Politique de confidentialité
                                            </button>
                                        </p>
                                    </div>

                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setMarketingOptIn((prev) => !prev)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                setMarketingOptIn((prev) => !prev);
                                            }
                                        }}
                                        className="group flex cursor-pointer items-start gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
                                    >
                                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${marketingOptIn ? "border-playzi-green bg-playzi-green text-white scale-100" : "border-gray-300 bg-white text-transparent scale-[0.96]"}`}>
                                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                        </span>
                                        <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                                            Je souhaite recevoir des nouveautés, conseils et offres de Playzi
                                        </p>
                                    </div>

                                    <p className="pt-1 text-[11px] font-medium text-gray-400">
                                        Tu pourras modifier ce choix plus tard dans Paramètres &gt; Notifications.
                                    </p>
                                    {consentError && (
                                        <p className="text-[12px] font-semibold text-rose-600">
                                            {consentError}
                                        </p>
                                    )}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isRegisterSubmitDisabled}
                                className="group relative mt-5 flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-playzi-green font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all duration-150 active:scale-[0.98] active:shadow-none disabled:opacity-70 disabled:active:scale-100"
                            >
                                {(isLoading || isBootstrappingAuthState) ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <span className="text-[16px]">{mode === "login" ? "Se connecter" : "Créer mon compte"}</span>
                                )}
                            </button>

                            <p className="mt-1 text-center text-[13px] font-medium text-gray-400">
                                {mode === "login" ? "Des joueurs motivés t'attendent près de toi." : "Ta première session commence ici."}
                            </p>
                        </form>
                    </motion.div>

                    {/* Divider */}
                    <div className="relative my-6 flex items-center justify-center">
                        <div className="absolute inset-x-0 h-[1px] bg-gray-100" />
                        <span className="relative bg-white px-4 text-[15px] font-medium text-gray-400">
                            ou
                        </span>
                    </div>

                    {/* Social Auth */}
                    <div className="w-full">
                        <button
                            type="button"
                            disabled={isLoading || isBootstrappingAuthState}
                            onClick={handleOAuthLogin}
                            aria-label="Continuer avec Google"
                            className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-gray-200 bg-white px-4 font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="h-[20px] w-[20px]" aria-hidden="true" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            <span className="text-[15px] tracking-tight">Continuer avec Google</span>
                        </button>
                    </div>

                    {/* Toggle Mode */}
                    <div className="mt-8 text-center">
                        <p className="text-[14px] text-gray-500 font-medium">
                            {mode === "login" ? "Nouveau sur Playzi ?" : "Déjà membre ?"}
                        </p>
                        <button
                            onClick={toggleMode}
                            className="mt-1 flex items-center justify-center mx-auto text-[15px] font-bold text-playzi-green transition-opacity hover:opacity-80 active:opacity-60"
                        >
                            {mode === "login" ? "Trouve ton équipe dès maintenant" : "Se connecter"}
                        </button>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
