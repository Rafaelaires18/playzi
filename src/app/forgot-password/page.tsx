"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setMessage(null);

        try {
            const res = await fetch("/api/auth/password/forgot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const json = await res.json().catch(() => null);

            if (!res.ok) {
                setError(json?.error || "Impossible d'envoyer le lien pour le moment.");
                return;
            }

            setMessage(
                "Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."
            );
        } catch {
            setError("Impossible d'envoyer le lien pour le moment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-gray-50 px-6 sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.04),_transparent_40%)]" />

            <div className="relative z-10 w-full max-w-[400px]">
                <div className="mb-6 flex flex-col items-center text-center">
                    <PlayziLogo />
                </div>

                <div className="w-full rounded-[32px] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-8">
                    <h1 className="mb-1 text-[26px] font-black tracking-tight text-gray-dark">Mot de passe oublié</h1>
                    <p className="mb-6 text-[15px] font-medium text-gray-400">
                        Entre ton email pour recevoir un lien de réinitialisation sécurisé.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="ml-2 text-[13px] font-bold text-gray-500">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="hello@exemple.com"
                                className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                inputMode="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="mt-2 h-[50px] w-full rounded-[16px] bg-playzi-green text-[15px] font-bold text-white disabled:opacity-70"
                        >
                            {isSubmitting ? "Envoi..." : "Envoyer le lien"}
                        </button>
                    </form>

                    {message && (
                        <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700">
                            {message}
                        </p>
                    )}
                    {error && <p className="mt-4 text-[13px] font-semibold text-rose-600">{error}</p>}

                    <button
                        type="button"
                        onClick={() => router.push("/login")}
                        className="mt-6 mx-auto block text-[13px] font-semibold text-gray-500 underline-offset-2 transition hover:text-gray-700 hover:underline"
                    >
                        Retour à la connexion
                    </button>
                </div>
            </div>
        </main>
    );
}
