"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";
import { motion } from "framer-motion";
import { ChevronRight, ArrowRight, Apple, Loader2, AlertCircle } from "lucide-react";

type AuthMode = "login" | "register";

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<AuthMode>("login");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form inputs
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pseudo, setPseudo] = useState("");
    const [gender, setGender] = useState<"male" | "female" | "">("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

        try {
            const body = mode === "login"
                ? { email, password }
                : { email, password, pseudo, gender };

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

            // Success! Redirect to home feed
            router.push("/");
            // Force a hard refresh if needed to trigger server-side layout re-evaluation,
            // but router.push('/') usually suffices with App Router
            router.refresh();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(prev => prev === "login" ? "register" : "login");
        setError(null);
    };

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
                            {mode === "login" ? "Heureux de te revoir" : "Bienvenue sur Playzi"}
                        </h1>
                        <p className="mb-7 text-[15px] text-gray-400 font-medium">
                            {mode === "login" ? "Ta prochaine session t'attend." : "Rejoins des joueurs motivés autour de toi."}
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

                        <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
                            {mode === "register" && (
                                <div className="space-y-1.5">
                                    <label className="text-[13px] font-bold text-gray-500 ml-2">Pseudo</label>
                                    <input
                                        type="text"
                                        value={pseudo}
                                        onChange={(e) => setPseudo(e.target.value)}
                                        placeholder="Choisis ton pseudo"
                                        className="h-14 w-full rounded-2xl border-none bg-gray-50 px-5 text-[15px] font-medium text-gray-dark shadow-inner outline-none transition-all focus:bg-white focus:ring-2 focus:ring-playzi-green/20"
                                        required
                                    />
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
                            </div>

                            {mode === "register" && (
                                <div className="space-y-1.5 mt-2">
                                    <label className="text-[13px] font-semibold text-gray-400 ml-2">Type de profil</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setGender("male")}
                                            className={`px-4 py-1.5 rounded-[10px] text-[13px] font-semibold outline-none transition-all ${gender === "male"
                                                ? "bg-playzi-green text-white shadow-sm border border-playzi-green"
                                                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                }`}
                                        >
                                            Homme
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGender("female")}
                                            className={`px-4 py-1.5 rounded-[10px] text-[13px] font-semibold outline-none transition-all ${gender === "female"
                                                ? "bg-playzi-green text-white shadow-sm border border-playzi-green"
                                                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:shadow-sm"
                                                }`}
                                        >
                                            Femme
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative mt-5 flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-playzi-green font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all duration-150 active:scale-[0.98] active:shadow-none disabled:opacity-70 disabled:active:scale-100"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <span className="text-[16px]">{mode === "login" ? "Se connecter" : "S'inscrire"}</span>
                                )}
                            </button>

                            <p className="mt-1 text-center text-[13px] font-medium text-gray-400">
                                {mode === "login" ? "Des joueurs motivés t'attendent près de toi." : "Ta première session commence ici."}
                            </p>
                        </form>
                    </motion.div>

                    {/* Divider */}
                    <div className="relative my-7 flex items-center justify-center">
                        <div className="absolute inset-x-0 h-[1px] bg-gray-100" />
                        <span className="relative bg-white px-4 text-[12px] font-bold text-gray-300 tracking-wide">
                            OU
                        </span>
                    </div>

                    {/* Social Auth */}
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => alert("Bientôt disponible")}
                            className="flex h-[50px] w-full items-center justify-center gap-3 rounded-[16px] border border-gray-200 bg-white font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                            <svg className="h-[20px] w-[20px]" viewBox="0 0 384 512" fill="currentColor">
                                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                            </svg>
                            Continuer avec Apple
                        </button>
                        <button
                            type="button"
                            onClick={() => alert("Bientôt disponible")}
                            className="flex h-[50px] w-full items-center justify-center gap-3 rounded-[16px] border border-gray-200 bg-white font-semibold text-gray-800 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                            <svg className="h-[18px] w-[18px]" aria-hidden="true" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continuer avec Google
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
