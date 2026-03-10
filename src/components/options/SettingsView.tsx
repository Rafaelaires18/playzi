import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SettingsViewProps {
    onBack: () => void;
}

export default function SettingsView({ onBack }: SettingsViewProps) {
    const [pseudo, setPseudo] = useState("");
    const [email, setEmail] = useState("");
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [language, setLanguage] = useState<"FR" | "EN">("FR");
    const [units, setUnits] = useState<"km" | "miles">("km");

    useEffect(() => {
        const loadAccount = async () => {
            try {
                const res = await fetch("/api/auth/me");
                if (!res.ok) return;
                const json = await res.json();
                const user = json?.data?.user;
                if (typeof user?.pseudo === "string") setPseudo(user.pseudo);
                if (typeof user?.email === "string") setEmail(user.email);
            } catch {
                // Keep silent in sheet mode.
            }
        };
        void loadAccount();
    }, []);

    return (
        <div className="flex h-full flex-col bg-gray-50/50 animate-in slide-in-from-right-8 duration-300 ease-out">
            <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-3 flex items-center">
                <button
                    onClick={onBack}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
                >
                    <ChevronLeft className="h-6 w-6 text-gray-700" strokeWidth={2.5} />
                </button>
                <h2 className="ml-2 text-[18px] font-black text-[#2D2E3B]">Paramètres</h2>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 pb-safe">
                <section>
                    <h2 className="mb-3 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Compte</h2>
                    <div className="overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-50 p-4">
                            <label className="text-[12px] font-bold text-gray-400">Pseudo</label>
                            <p className="mt-1 text-[15px] font-bold text-[#2D2E3B]">{pseudo || "-"}</p>
                        </div>
                        <div className="border-b border-gray-50 bg-gray-50/50 p-4">
                            <label className="text-[12px] font-bold text-gray-400">Email</label>
                            <p className="mt-1 text-[15px] font-medium text-gray-500">{email || "-"}</p>
                        </div>
                        <button
                            type="button"
                            className="group flex w-full items-center justify-between p-4 transition-colors active:bg-gray-50"
                            onClick={() => {
                                window.location.href = "/settings";
                            }}
                        >
                            <span className="text-[15px] font-bold text-[#2D2E3B]">Gérer le compte</span>
                            <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-gray-400" strokeWidth={2.5} />
                        </button>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Notifications</h2>
                    <div className="flex items-center justify-between rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
                        <span className="text-[15px] font-bold text-[#2D2E3B]">Notifications sportives</span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            className={`relative h-7 w-12 rounded-full transition-colors ${notificationsEnabled ? "bg-playzi-green" : "bg-gray-200"}`}
                        >
                            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${notificationsEnabled ? "left-6" : "left-1"}`} />
                        </button>
                    </div>
                </section>

                <section>
                    <h2 className="mb-3 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Préférences</h2>
                    <div className="flex flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-50 p-4">
                            <span className="text-[15px] font-bold text-[#2D2E3B]">Langue</span>
                            <div className="flex items-center rounded-full bg-gray-100 p-1">
                                <button
                                    className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${language === "FR" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setLanguage("FR")}
                                >FR</button>
                                <button
                                    className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${language === "EN" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setLanguage("EN")}
                                >EN</button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <span className="text-[15px] font-bold text-[#2D2E3B]">Unités</span>
                            <div className="flex items-center rounded-full bg-gray-100 p-1">
                                <button
                                    className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${units === "km" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setUnits("km")}
                                >km</button>
                                <button
                                    className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${units === "miles" ? "bg-white text-[#2D2E3B] shadow-sm" : "text-gray-500"}`}
                                    onClick={() => setUnits("miles")}
                                >miles</button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
