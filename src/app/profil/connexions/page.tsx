"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Users, Sparkles } from "lucide-react";
import Header from "@/components/Header";

const frequentPartners = [
    { pseudo: "Lina M.", activities: 4 },
    { pseudo: "Noah T.", activities: 3 },
    { pseudo: "Eva R.", activities: 2 },
    { pseudo: "Hugo B.", activities: 2 }
];

export default function ProfileConnectionsPage() {
    const router = useRouter();

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => router.back()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Connexions</h1>
                    <p className="text-[11px] font-semibold text-gray-500">Dimension sociale Playzi</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-[16px] font-black text-[#242841]">Partenaires fréquents</h2>
                    <div className="mt-3 space-y-2.5">
                        {frequentPartners.map((person) => (
                            <article
                                key={person.pseudo}
                                className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                            >
                                <p className="text-[13px] font-black text-[#242841]">{person.pseudo}</p>
                                <p className="text-[11px] font-semibold text-gray-600">{person.activities} activités</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="mt-4 rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h3 className="text-[16px] font-black text-[#242841]">Nouvelles connexions ce mois</h3>
                    <p className="mt-1 text-[28px] font-black text-emerald-600">12</p>
                    <p className="text-[12px] font-semibold text-gray-500">nouvelles connexions</p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-600">
                        <Users className="h-3.5 w-3.5 text-gray-500" />
                        Connexions totales: 63
                    </div>
                </section>
            </div>
        </main>
    );
}
