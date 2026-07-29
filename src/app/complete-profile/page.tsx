"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlayziLogo from "@/components/PlayziLogo";
import { createClient } from "@/lib/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import PlayziLoader from "@/components/PlayziLoader";

const INVITE_PENDING_PATH_KEY = "playzi_pending_invitation_path";

function isMissingIdentity(firstName: string | null | undefined, lastName: string | null | undefined) {
    const normalizedFirstName = (firstName || "").trim().toLowerCase();
    return !normalizedFirstName || normalizedFirstName === "utilisateur" || !(lastName || "").trim();
}

function getGoogleIdentityFallback(metadata: Record<string, unknown> | undefined) {
    const firstFromMetadata = typeof metadata?.first_name === "string" ? metadata.first_name.trim() : "";
    const lastFromMetadata = typeof metadata?.last_name === "string" ? metadata.last_name.trim() : "";
    const givenName = typeof metadata?.given_name === "string" ? metadata.given_name.trim() : "";
    const familyName = typeof metadata?.family_name === "string" ? metadata.family_name.trim() : "";
    const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : typeof metadata?.name === "string" ? metadata.name.trim() : "";

    if (firstFromMetadata || lastFromMetadata) {
        return { firstName: firstFromMetadata, lastName: lastFromMetadata };
    }
    if (givenName || familyName) {
        return { firstName: givenName, lastName: familyName };
    }
    if (fullName) {
        const [firstName, ...lastNameParts] = fullName.split(/\s+/);
        return { firstName: firstName || "", lastName: lastNameParts.join(" ") };
    }
    return { firstName: "", lastName: "" };
}

function sanitizeNextPath(rawValue: string | null): string | null {
    if (!rawValue) return null;
    const value = rawValue.trim();
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    return value;
}

export default function CompleteProfilePage() {
    const router = useRouter();
    const supabase = createClient();
    const [step, setStep] = useState<"gender" | "identity">("gender");
    const [gender, setGender] = useState<"male" | "female" | "">("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [nextPath, setNextPath] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const query = new URLSearchParams(window.location.search);
        const queryNextPath = sanitizeNextPath(query.get("next"));
        const storedInvitationPath = sanitizeNextPath(window.localStorage.getItem(INVITE_PENDING_PATH_KEY));
        setNextPath(queryNextPath || storedInvitationPath);
    }, []);

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
                .select("gender, first_name, last_name")
                .eq("id", user.id)
                .single();

            const profileGender = profile?.gender === "male" || profile?.gender === "female" ? profile.gender : "";
            const hasMissingIdentity = isMissingIdentity(profile?.first_name, profile?.last_name);

            if (profileGender && !hasMissingIdentity) {
                if (mounted) router.push(nextPath || "/");
            } else {
                const identityFallback = getGoogleIdentityFallback(user.user_metadata);
                if (mounted) {
                    setGender(profileGender);
                    setFirstName(
                        profile?.first_name && profile.first_name.trim().toLowerCase() !== "utilisateur"
                            ? profile.first_name
                            : identityFallback.firstName
                    );
                    setLastName(profile?.last_name || identityFallback.lastName);
                    setStep(profileGender ? "identity" : "gender");
                    setIsChecking(false);
                }
            }
        };

        void checkProfile();
        return () => { mounted = false; };
    }, [nextPath, router, supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!gender) {
            setError("Merci de choisir une option pour continuer.");
            return;
        }

        if (step === "gender") {
            setError(null);
            setStep("identity");
            return;
        }

        const nextFirstName = firstName.trim();
        const nextLastName = lastName.trim();

        if (nextFirstName.length < 2) {
            setError("Ton prénom doit contenir au moins 2 caractères.");
            return;
        }
        if (nextLastName.length < 2) {
            setError("Ton nom doit contenir au moins 2 caractères.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Non autorisé, veuillez vous reconnecter.");

            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    gender,
                    first_name: nextFirstName,
                    last_name: nextLastName,
                })
                .eq("id", user.id);

            if (updateError) throw updateError;

            await supabase.auth.updateUser({
                data: {
                    gender,
                    first_name: nextFirstName,
                    last_name: nextLastName,
                },
            });

            router.push(nextPath || "/");
            router.refresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Impossible de mettre à jour le profil. Réessaie.");
            setIsLoading(false);
        }
    };

    if (isChecking) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
                <PlayziLoader compact message="Chargement..." />
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
                        {step === "gender" ? "Dernière étape 🎯" : "Comment tu t’appelles ?"}
                    </h1>
                    <p className="mb-6 text-[15px] font-medium text-gray-400">
                        {step === "gender"
                            ? "Cette information est utilisée uniquement pour améliorer l'expérience Playzi et l'organisation des activités."
                            : "Ajoute ton prénom et ton nom"}
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
                        {step === "gender" ? (
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
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="first_name" className="mb-2 ml-2 block text-[14px] font-bold text-gray-500">
                                        Prénom
                                    </label>
                                    <input
                                        id="first_name"
                                        type="text"
                                        value={firstName}
                                        onChange={(event) => setFirstName(event.target.value)}
                                        autoComplete="given-name"
                                        className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] font-bold text-gray-dark outline-none transition-all focus:border-playzi-green focus:bg-white focus:ring-4 focus:ring-playzi-green/10"
                                        placeholder="Ton prénom"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="last_name" className="mb-2 ml-2 block text-[14px] font-bold text-gray-500">
                                        Nom
                                    </label>
                                    <input
                                        id="last_name"
                                        type="text"
                                        value={lastName}
                                        onChange={(event) => setLastName(event.target.value)}
                                        autoComplete="family-name"
                                        className="h-14 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-[15px] font-bold text-gray-dark outline-none transition-all focus:border-playzi-green focus:bg-white focus:ring-4 focus:ring-playzi-green/10"
                                        placeholder="Ton nom"
                                    />
                                </div>
                            </div>
                        )}

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
                                <span className="text-[16px]">{step === "gender" ? "Continuer" : "Commencer à jouer"}</span>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </main>
    );
}
