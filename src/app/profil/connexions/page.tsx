"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Users, CalendarDays, Handshake, Sparkles } from "lucide-react";
import Header from "@/components/Header";

const monthSummary = [
    { label: "Nouvelles connexions", value: "12", icon: UserPlus },
    { label: "Partenaires actifs", value: "28", icon: Users },
    { label: "Activités partagées", value: "19", icon: CalendarDays },
    { label: "Demandes en attente", value: "4", icon: Handshake }
];

const recentConnections = [
    { pseudo: "Lina M.", sport: "Beach-volley", activities: 4 },
    { pseudo: "Noah T.", sport: "Running", activities: 3 },
    { pseudo: "Eva R.", sport: "Vélo", activities: 2 },
    { pseudo: "Hugo B.", sport: "Football", activities: 2 }
];

export default function ProfileConnectionsPage() {
    const router = useRouter();

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button
                    onClick={() => router.back()}
                    className="rounded-full p-3 text-gray-700 transition hover:bg-gray-100"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Connexions</h1>
                    <p className="text-[11px] font-semibold text-gray-500">Résumé mensuel et réseau Playzi</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <p className="text-[11px] font-black uppercase tracking-wider text-gray-400">Ce mois-ci</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                        {monthSummary.map((item) => (
                            <article key={item.label} className="rounded-xl bg-gray-50 p-3">
                                <item.icon className="h-4 w-4 text-emerald-600" />
                                <p className="mt-2 text-[18px] font-black text-[#242841]">{item.value}</p>
                                <p className="text-[11px] font-semibold text-gray-500">{item.label}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-[16px] font-black text-[#242841]">Connexions récentes</h2>
                    <div className="mt-3 space-y-2">
                        {recentConnections.map((person) => (
                            <article
                                key={person.pseudo}
                                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                            >
                                <div>
                                    <p className="text-[13px] font-black text-[#242841]">{person.pseudo}</p>
                                    <p className="text-[11px] font-semibold text-gray-500">{person.sport}</p>
                                </div>
                                <p className="text-[11px] font-bold text-gray-600">{person.activities} activités</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-4 rounded-[24px] border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                    <h3 className="text-[15px] font-black text-emerald-700">Demandes de connexion</h3>
                    <p className="mt-1 text-[12px] font-semibold text-emerald-700/80">
                        Fonction réseau social Playzi en préparation: envoi de demandes, acceptation, suivi des partenaires favoris.
                    </p>
                </section>
            </div>
        </main>
    );
}
