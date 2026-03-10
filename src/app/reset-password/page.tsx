"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";
import { createClient } from "@/lib/supabase/client";

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ResetPasswordPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const bootstrapRan = useRef(false);

    useEffect(() => {
        if (bootstrapRan.current) return;
        bootstrapRan.current = true;
        let mounted = true;

        const bootstrapRecoverySession = async () => {
            try {
                const url = new URL(window.location.href);
                const hasRecoveryFlag = url.searchParams.get("recovery") === "1";
                const code = url.searchParams.get("code");
                const tokenHash = url.searchParams.get("token_hash");
                const otpType = url.searchParams.get("type") || "recovery";
                const hash = window.location.hash;
                let hasRecoveryContext = hasRecoveryFlag;
                let recoverySessionEstablished = false;

                // Never clear session here, as it destroys the PKCE code_verifier cookie
                // which is required for exchangeCodeForSession below.

                if (hash.includes("access_token") || hash.includes("refresh_token")) {
                    const params = new URLSearchParams(hash.replace(/^#/, ""));
                    const accessToken = params.get("access_token");
                    const refreshToken = params.get("refresh_token");
                    if (accessToken && refreshToken) {
                        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                        if (!error) {
                            recoverySessionEstablished = true;
                        }
                        hasRecoveryContext = true;
                    }
                }

                if (!recoverySessionEstablished && code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (!error) {
                        recoverySessionEstablished = true;
                        hasRecoveryContext = true;
                    }
                }

                if (!recoverySessionEstablished && tokenHash) {
                    const { error } = await supabase.auth.verifyOtp({
                        type: otpType as "recovery",
                        token_hash: tokenHash,
                    });
                    if (!error) {
                        recoverySessionEstablished = true;
                        hasRecoveryContext = true;
                    }
                }

                window.history.replaceState({}, "", "/reset-password?recovery=1");

                if (!hasRecoveryContext) {
                    if (!mounted) return;
                    setError("Lien de réinitialisation invalide ou expiré.");
                    setIsReady(true);
                    return;
                }

                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (!mounted) return;

                if (sessionError) {
                    console.error("Session error:", sessionError);
                    setError("Erreur Auth: " + sessionError.message);
                } else if (!session) {
                    console.error("No session found after bootstrap.");
                    setError("Aucune session trouvée. Le lien est peut-être expiré ou a déjà été utilisé.");
                }

                setIsReady(true);
            } catch (err: any) {
                if (!mounted) return;
                console.error("Catch error:", err);
                setError("Erreur Auth: " + (err?.message || "Erreur de connexion"));
                setIsReady(true);
            }
        };

        void bootstrapRecoverySession();

        return () => {
            mounted = false;
        };
    }, [supabase]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
            setError("Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("La confirmation du mot de passe ne correspond pas.");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/password/recover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    new_password: newPassword,
                    confirm_password: confirmPassword,
                }),
            });
            const json = await res.json().catch(() => null);

            if (!res.ok) {
                if (json?.details) {
                    const messages = Object.values(json.details).flatMap((value) => value as string[]);
                    setError(messages[0] || json?.error || "Impossible de réinitialiser le mot de passe.");
                    return;
                }
                setError(json?.error || "Impossible de réinitialiser le mot de passe.");
                return;
            }

            await supabase.auth.signOut();
            setMessage("Mot de passe réinitialisé. Tu peux te connecter avec ton nouveau mot de passe.");
            setIsSuccess(true);
        } catch {
            setError("Impossible de réinitialiser le mot de passe.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoToLogin = async () => {
        try {
            await supabase.auth.signOut();
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            router.push("/login?force_login=1");
        }
    };

    return (
        <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-gray-50 px-6 sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.04),_transparent_40%)]" />

            <div className="relative z-10 w-full max-w-[400px]">
                <div className="mb-6 flex flex-col items-center text-center">
                    <PlayziLogo />
                    <p className="mt-2 max-w-[280px] text-[15px] font-medium leading-relaxed text-gray-400">
                        Choisis un nouveau mot de passe sécurisé.
                    </p>
                </div>

                <div className="w-full rounded-[32px] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-8">
                    <h1 className="mb-1 text-[26px] font-black tracking-tight text-gray-dark">Créer un nouveau mot de passe</h1>
                    <p className="mb-6 text-[15px] font-medium text-gray-400">
                        Ce mot de passe sera utilisé pour tes prochaines connexions.
                    </p>

                    {!isReady ? (
                        <p className="text-[13px] font-medium text-gray-500">Vérification du lien…</p>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="ml-2 text-[13px] font-bold text-gray-500">Nouveau mot de passe</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder="••••••••"
                                    className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                    required
                                />
                            </div>
                            <p className="ml-2 text-[11px] font-medium text-gray-400">
                                Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.
                            </p>

                            <div className="space-y-1.5">
                                <label className="ml-2 text-[13px] font-bold text-gray-500">Confirmer le mot de passe</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder="••••••••"
                                    className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="mt-2 h-[50px] w-full rounded-[16px] bg-playzi-green text-[15px] font-bold text-white disabled:opacity-70"
                            >
                                {isSubmitting ? "Mise à jour..." : "Valider le nouveau mot de passe"}
                            </button>
                        </form>
                    )}

                    {message && <p className="mt-4 text-[13px] font-semibold text-emerald-600">{message}</p>}
                    {error && <p className="mt-4 text-[13px] font-semibold text-rose-600">{error}</p>}
                    {isSuccess && (
                        <button
                            type="button"
                            onClick={handleGoToLogin}
                            className="mt-5 h-[46px] w-full rounded-[14px] border border-gray-200 bg-white text-[14px] font-bold text-[#2D2E3B] transition hover:bg-gray-50"
                        >
                            Se connecter
                        </button>
                    )}
                </div>
            </div>
        </main>
    );
}
