"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";
import { createClient } from "@/lib/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function CompleteProfilePage() {
    const router = useRouter();
    const supabase = createClient();
    const [gender, setGender] = useState<"male" | "female" | "">("");
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const checkProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                if (mounted) router.push("/login");
                return;
            }

            const { data: profile } = await supabase
                .from("profiles")
                .select("gender")
                .eq("id", user.id)
                .single();

            if (profile?.gender) {
                // Already completed
                if (mounted) router.push("/");
            } else {
                if (mounted) setIsChecking(false);
            }
        };

        void checkProfile();
        return () => { mounted = false; };
    }, [router, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gender) {
            setError("Merci de choisir une option pour continuer.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Non autorisé, veuillez vous reconnecter.");

            const { error: updateError } = await supabase
                .from("profiles")
                .update({ gender })
                .eq("id", user.id);

            if (updateError) throw updateError;

            // Success, force refresh to update server components context
            router.push("/");
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Impossible de mettre à jour le profil. Réessaie.");
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-playzi-green" />
            </main>
        );
    }

    return (
        <main className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center bg-gray-50 px-6 sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.06),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.04),_transparent_40%)]" />

            <div className="relative z-10 w-full max-w-[400px]">
                <div className="mb-6 flex flex-col items-center text-center">
                    <PlayziLogo />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full rounded-[32px] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-8"
                >
                    <h1 className="mb-1 text-[24px] font-black tracking-tight text-gray-dark">
                        Dernière étape 🎯
                    </h1>
                    <p className="mb-6 text-[15px] font-medium text-gray-400">
                        Pour des raisons d&apos;équilibrage des matchs, le genre est requis sur Playzi.
                    </p>

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

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="ml-2 text-[14px] font-bold text-gray-500">
                                Choisis ton genre
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setGender("male")}
                                    className={`flex h-14 items-center justify-center rounded-2xl text-[15px] font-bold transition-all ${gender === "male"
                                            ? "bg-playzi-green text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                                            : "bg-gray-50 text-gray-500 border border-transparent hover:border-gray-200"
                                        }`}
                                >
                                    Homme
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGender("female")}
                                    className={`flex h-14 items-center justify-center rounded-2xl text-[15px] font-bold transition-all ${gender === "female"
                                            ? "bg-playzi-green text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                                            : "bg-gray-50 text-gray-500 border border-transparent hover:border-gray-200"
                                        }`}
                                >
                                    Femme
                                </button>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-orange-50 p-4">
                            <p className="text-[13px] font-medium leading-relaxed text-orange-800">
                                <span className="font-bold">Info :</span> Un pseudo dynamique t&apos;a été attribué. Tu pourras le personnaliser à tout moment depuis tes paramètres.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !gender}
                            className="group relative mt-2 flex h-[52px] w-full items-center justify-center overflow-hidden rounded-[16px] bg-playzi-green font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all duration-150 active:scale-[0.98] active:shadow-none disabled:opacity-70 disabled:active:scale-100 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                <span className="text-[16px]">Commencer à jouer</span>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </main>
    );
}
