"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";

type ConnectionItem = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    pseudo: string;
    rank_label: string;
    activities_together: number;
};

function displayName(item: ConnectionItem) {
    const full = `${item.first_name || ""} ${item.last_name || ""}`.trim();
    return full || item.pseudo;
}

export default function PublicConnectionsPage() {
    const params = useParams();
    const router = useRouter();
    const profileId = params.id as string;
    const [connections, setConnections] = useState<ConnectionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/profiles/${profileId}/connections`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                if (!res.ok) throw new Error(body?.error || "Impossible de charger les connexions");
                if (!isCancelled) {
                    setConnections(Array.isArray(body?.data?.connections) ? body.data.connections : []);
                }
            } catch (e) {
                if (!isCancelled) setError(e instanceof Error ? e.message : "Erreur inconnue");
            } finally {
                if (!isCancelled) setIsLoading(false);
            }
        };
        void load();
        return () => { isCancelled = true; };
    }, [profileId]);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <div className="flex-1 overflow-y-auto px-4 pb-8 pt-20">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                </button>

                <section className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm">
                    <h1 className="text-[17px] font-black text-[#242841]">Connexions</h1>
                    <p className="mt-0.5 text-[12px] font-semibold text-gray-500">{connections.length} personnes</p>

                    {isLoading && <p className="mt-4 text-[12px] font-semibold text-gray-500">Chargement...</p>}
                    {!isLoading && error && <p className="mt-4 text-[12px] font-semibold text-rose-600">{error}</p>}
                    {!isLoading && !error && connections.length === 0 && (
                        <p className="mt-4 text-[12px] font-semibold text-gray-500">Aucune connexion.</p>
                    )}

                    {!isLoading && !error && connections.length > 0 && (
                        <div className="mt-3 space-y-2">
                            {connections.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => router.push(`/profil/${item.id}`)}
                                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-left hover:bg-white"
                                >
                                    <p className="truncate text-[13px] font-black text-[#242841]">{displayName(item)}</p>
                                    <p className="truncate text-[11px] font-semibold text-gray-500">@{item.pseudo}</p>
                                    <p className="truncate text-[11px] font-semibold text-gray-400">{item.rank_label}</p>
                                    <p className="truncate text-[11px] font-semibold text-gray-500">
                                        {item.activities_together} activité{item.activities_together > 1 ? "s" : ""} ensemble
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
