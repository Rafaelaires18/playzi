"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import OptionsSheet from "@/components/options/OptionsSheet";
import { ChevronRight, ArrowLeft } from "lucide-react";

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PSEUDO_REGEX = /^[a-zA-Z0-9_]+$/;

export default function SettingsPage() {
    const router = useRouter();
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);

    const [pseudo, setPseudo] = useState("");
    const [email, setEmail] = useState("");
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [language, setLanguage] = useState<"FR" | "EN">("FR");
    const [units, setUnits] = useState<"km" | "miles">("km");

    const [isLoadingAccount, setIsLoadingAccount] = useState(true);
    const [isSavingAccount, setIsSavingAccount] = useState(false);
    const [accountMessage, setAccountMessage] = useState<string | null>(null);
    const [accountError, setAccountError] = useState<string | null>(null);

    const [isPasswordOpen, setIsPasswordOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);

    useEffect(() => {
        const loadAccount = async () => {
            try {
                setIsLoadingAccount(true);
                const res = await fetch("/api/auth/me");
                if (!res.ok) {
                    setAccountError("Impossible de charger les informations du compte.");
                    return;
                }
                const json = await res.json();
                const user = json?.data?.user;
                setPseudo(typeof user?.pseudo === "string" ? user.pseudo : "");
                setEmail(typeof user?.email === "string" ? user.email : "");
            } catch {
                setAccountError("Impossible de charger les informations du compte.");
            } finally {
                setIsLoadingAccount(false);
            }
        };

        void loadAccount();
    }, []);

    const handleSaveAccount = async () => {
        setAccountMessage(null);
        setAccountError(null);

        if (!PSEUDO_REGEX.test(pseudo)) {
            setAccountError("Le pseudo doit contenir uniquement des lettres, chiffres et underscores.");
            return;
        }

        setIsSavingAccount(true);
        try {
            const res = await fetch("/api/auth/account", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pseudo, email }),
            });
            const json = await res.json().catch(() => null);

            if (!res.ok) {
                if (json?.details) {
                    const messages = Object.values(json.details).flatMap((value) => value as string[]);
                    setAccountError(messages[0] || json?.error || "Impossible de mettre à jour le compte.");
                    return;
                }
                setAccountError(json?.error || "Impossible de mettre à jour le compte.");
                return;
            }

            const nextPseudo = json?.data?.user?.pseudo;
            const nextEmail = json?.data?.user?.email;
            if (typeof nextPseudo === "string") setPseudo(nextPseudo);
            if (typeof nextEmail === "string") setEmail(nextEmail);
            setAccountMessage(json?.data?.message || "Compte mis à jour.");
        } catch {
            setAccountError("Impossible de mettre à jour le compte.");
        } finally {
            setIsSavingAccount(false);
        }
    };

    const handleUpdatePassword = async () => {
        setPasswordMessage(null);
        setPasswordError(null);

        if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
            setPasswordError("Le nouveau mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("La confirmation du nouveau mot de passe ne correspond pas.");
            return;
        }

        setIsUpdatingPassword(true);
        try {
            const res = await fetch("/api/auth/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword,
                }),
            });
            const json = await res.json().catch(() => null);

            if (!res.ok) {
                if (json?.details) {
                    const messages = Object.values(json.details).flatMap((value) => value as string[]);
                    setPasswordError(messages[0] || json?.error || "Impossible de modifier le mot de passe.");
                    return;
                }
                setPasswordError(json?.error || "Impossible de modifier le mot de passe.");
                return;
            }

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordMessage("Mot de passe mis à jour avec succès.");
            setIsPasswordOpen(false);
        } catch {
            setPasswordError("Impossible de modifier le mot de passe.");
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleBack = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/");
    };

    return (
        <main className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white">
            <Header onOpenOptions={() => setIsOptionsOpen(true)} />
            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

            <div className="flex-1 space-y-8 overflow-y-auto bg-gray-50/50 px-6 pb-12 pt-[74px]">
                <div className="mb-3">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600 transition hover:text-gray-800"
                        aria-label="Retour"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                    </button>
                </div>
                <div className="-mt-1">
                    <h1 className="text-[32px] font-black tracking-tight text-[#2D2E3B]">Paramètres</h1>
                </div>

                <section>
                    <h2 className="mb-4 px-1 text-[14px] font-black uppercase tracking-wider text-gray-400">Compte</h2>
                    <div className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
                        <div className="flex flex-col gap-1.5 border-b border-gray-50 p-4">
                            <label className="text-[13px] font-bold text-gray-400">Pseudo</label>
                            <input
                                value={pseudo}
                                onChange={(e) => setPseudo(e.target.value)}
                                className="w-full text-[16px] font-bold text-[#2D2E3B] placeholder-gray-300 focus:outline-none"
                                placeholder="Ton pseudo"
                                disabled={isLoadingAccount || isSavingAccount}
                            />
                            <p className="text-[11px] font-medium text-gray-400">Lettres, chiffres et underscore uniquement.</p>
                        </div>
                        <div className="flex flex-col gap-1.5 border-b border-gray-50 bg-gray-50/50 p-4">
                            <label className="text-[13px] font-bold text-gray-400">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-transparent text-[16px] font-medium text-gray-600 placeholder-gray-300 focus:outline-none"
                                placeholder="email@playzi.app"
                                disabled={isLoadingAccount || isSavingAccount}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsPasswordOpen((prev) => !prev)}
                            className="group flex w-full items-center justify-between p-4 transition-colors active:bg-gray-50"
                            disabled={isLoadingAccount}
                        >
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Modifier le mot de passe</span>
                            <ChevronRight className={`h-5 w-5 text-gray-300 transition-transform group-hover:text-gray-400 ${isPasswordOpen ? "rotate-90" : ""}`} strokeWidth={2.5} />
                        </button>

                        {isPasswordOpen && (
                            <div className="space-y-3 border-t border-gray-50 bg-gray-50/50 p-4">
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Mot de passe actuel"
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                                    disabled={isUpdatingPassword}
                                />
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Nouveau mot de passe"
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                                    disabled={isUpdatingPassword}
                                />
                                <p className="text-[11px] font-medium text-gray-400">
                                    Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial.
                                </p>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirmer le nouveau mot de passe"
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                                    disabled={isUpdatingPassword}
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleUpdatePassword()}
                                    className="h-10 w-full rounded-xl bg-[#2D2E3B] text-[13px] font-bold text-white disabled:opacity-60"
                                    disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                                >
                                    {isUpdatingPassword ? "Mise à jour..." : "Enregistrer le nouveau mot de passe"}
                                </button>
                            </div>
                        )}

                        <div className="border-t border-gray-50 p-4">
                            <button
                                type="button"
                                onClick={() => void handleSaveAccount()}
                                className="h-10 w-full rounded-xl bg-playzi-green text-[14px] font-bold text-white disabled:opacity-60"
                                disabled={isLoadingAccount || isSavingAccount || !pseudo || !email}
                            >
                                {isSavingAccount ? "Enregistrement..." : "Enregistrer les changements"}
                            </button>
                            {accountMessage && <p className="mt-2 text-[12px] font-semibold text-emerald-600">{accountMessage}</p>}
                            {accountError && <p className="mt-2 text-[12px] font-semibold text-rose-600">{accountError}</p>}
                            {passwordMessage && <p className="mt-2 text-[12px] font-semibold text-emerald-600">{passwordMessage}</p>}
                            {passwordError && <p className="mt-2 text-[12px] font-semibold text-rose-600">{passwordError}</p>}
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-4 px-1 text-[14px] font-black uppercase tracking-wider text-gray-400">Notifications</h2>
                    <div className="flex items-center justify-between rounded-[24px] border border-gray-100 bg-white p-4 shadow-sm">
                        <span className="text-[16px] font-bold text-[#2D2E3B]">Notifications sportives</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            className={`relative h-8 w-14 rounded-full transition-colors ${notificationsEnabled ? "bg-playzi-green" : "bg-gray-200"}`}
                        >
                            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all ${notificationsEnabled ? "left-7" : "left-1"}`} />
                        </button>
                    </div>
                    {!notificationsEnabled && (
                        <p className="mt-3 px-2 text-[13px] font-medium leading-relaxed text-gray-400">
                            Si vous désactivez les notifications, vous ne serez pas informé(e) des nouvelles activités, confirmations et messages.
                        </p>
                    )}
                </section>

                <section>
                    <h2 className="mb-4 px-1 text-[14px] font-black uppercase tracking-wider text-gray-400">Préférences</h2>
                    <div className="flex flex-col overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-50 p-4">
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Langue</span>
                            <div className="flex items-center rounded-full bg-gray-100 p-1">
                                <button
                                    className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-all ${language === "FR" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setLanguage("FR")}
                                >FR</button>
                                <button
                                    className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-all ${language === "EN" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setLanguage("EN")}
                                >EN</button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <span className="text-[16px] font-bold text-[#2D2E3B]">Unités</span>
                            <div className="flex items-center rounded-full bg-gray-100 p-1">
                                <button
                                    className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-all ${units === "km" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setUnits("km")}
                                >km</button>
                                <button
                                    className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-all ${units === "miles" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setUnits("miles")}
                                >miles</button>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="mb-4 px-1 text-[14px] font-black uppercase tracking-wider text-gray-400">Sécurité</h2>
                    <div className="flex flex-col overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-50 p-5">
                            <h3 className="mb-2 text-[16px] font-bold text-[#2D2E3B]">Utilisateurs bloqués</h3>
                            <div className="rounded-xl bg-gray-50 p-4 text-center">
                                <span className="text-[14px] font-medium text-gray-400">
                                    Vous pourrez bloquer des utilisateurs prochainement.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            disabled
                            className="w-full bg-gray-50/50 p-4 text-[15px] font-bold text-gray-400"
                        >
                            Gérer les blocages
                        </button>
                    </div>
                </section>
            </div>
        </main>
    );
}
