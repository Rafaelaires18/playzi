"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users, Search, ArrowUpDown, Check, X, MoreHorizontal, UserMinus } from "lucide-react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";

type SortMode = "az" | "za" | "recent";
type Connection = { id: string; name: string; pseudo: string; activities: number; connectedAt: string };
type Request = { id: string; name: string; pseudo: string };

const sortOptions: { value: SortMode; label: string }[] = [
    { value: "az", label: "Ordre alphabétique (A → Z)" },
    { value: "za", label: "Ordre alphabétique (Z → A)" },
    { value: "recent", label: "Plus récent" }
];

export default function ProfileConnectionsPage() {
    const router = useRouter();
    const [requests, setRequests] = useState<Request[]>([]);
    const [connections, setConnections] = useState<Connection[]>([]);
    const [newThisMonth, setNewThisMonth] = useState(0);
    const [isLoadedFromApi, setIsLoadedFromApi] = useState(false);
    const [query, setQuery] = useState("");
    const [sortMode, setSortMode] = useState<SortMode>("az");
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [activeConnectionMenuId, setActiveConnectionMenuId] = useState<string | null>(null);

    const showSortControls = connections.length > 10;

    const filteredAndSortedConnections = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const filtered = connections.filter((person) => {
            if (!normalizedQuery) return true;
            return person.name.toLowerCase().includes(normalizedQuery) || person.pseudo.toLowerCase().includes(normalizedQuery);
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            if (sortMode === "az") return a.name.localeCompare(b.name, "fr");
            if (sortMode === "za") return b.name.localeCompare(a.name, "fr");
            return new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime();
        });
        return sorted;
    }, [connections, query, sortMode]);

    useEffect(() => {
        const loadConnections = async () => {
            try {
                const res = await fetch("/api/connections");
                if (!res.ok) return;
                const json = await res.json();
                const data = json?.data;
                if (!data) return;
                setConnections(Array.isArray(data.connections) ? data.connections : []);
                setRequests(Array.isArray(data.requests) ? data.requests : []);
                setNewThisMonth(typeof data.newThisMonth === "number" ? data.newThisMonth : 0);
                setIsLoadedFromApi(true);
            } catch {
                // Keep local fallback data.
            }
        };
        void loadConnections();
    }, []);

    const acceptRequest = async (id: string) => {
        if (isLoadedFromApi) {
            const res = await fetch(`/api/connections/requests/${id}`, { method: "POST" });
            if (res.ok) {
                const accepted = requests.find((item) => item.id === id);
                if (accepted) {
                    const today = new Date().toISOString().slice(0, 10);
                    setConnections((prev) => [
                        { id: `conn-${id}`, name: accepted.name, pseudo: accepted.pseudo, activities: 0, connectedAt: today },
                        ...prev
                    ]);
                    setNewThisMonth((prev) => prev + 1);
                }
                setRequests((prev) => prev.filter((item) => item.id !== id));
            }
            return;
        }
    };

    const refuseRequest = async (id: string) => {
        if (isLoadedFromApi) {
            const res = await fetch(`/api/connections/requests/${id}`, { method: "DELETE" });
            if (!res.ok) return;
        }
        setRequests((prev) => prev.filter((item) => item.id !== id));
    };

    const removeConnection = async (id: string) => {
        const confirmed = window.confirm("Supprimer cette connexion ?");
        if (!confirmed) return;
        if (isLoadedFromApi) {
            const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
            if (!res.ok) return;
        }
        setConnections((prev) => prev.filter((item) => item.id !== id));
        setActiveConnectionMenuId(null);
    };

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => router.back()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Connexions</h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-emerald-100 bg-white p-5 shadow-sm">
                    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                        <Users className="h-4 w-4 text-gray-500" />
                    </div>
                    <h3 className="text-[16px] font-black text-[#242841]">Nouvelles connexions ce mois</h3>
                    <p className="mt-1 text-[28px] font-black text-emerald-600">{newThisMonth}</p>
                    <p className="text-[12px] font-semibold text-gray-500">
                        {newThisMonth === 0 ? "0 nouvelle connexion ce mois" : `${newThisMonth} nouvelle${newThisMonth > 1 ? "s" : ""} connexion${newThisMonth > 1 ? "s" : ""} ce mois`}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5 text-[11px] font-bold text-gray-600">
                        <Users className="h-3.5 w-3.5 text-gray-500" />
                        Connexions totales: {connections.length}
                    </div>
                </section>

                <section className="mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-[16px] font-black text-[#242841]">Demandes de connexion</h2>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">
                            {requests.length} en attente
                        </span>
                    </div>
                    {requests.length === 0 ? (
                        <p className="text-[12px] font-semibold text-gray-500">Aucune demande pour le moment</p>
                    ) : (
                        <div className="space-y-2.5">
                            {requests.map((request) => (
                                <article key={request.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-black text-[#242841]">{request.name}</p>
                                            <p className="truncate text-[11px] font-semibold text-gray-500">@{request.pseudo}</p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <button
                                                onClick={() => acceptRequest(request.id)}
                                                className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                Accepter
                                            </button>
                                            <button
                                                onClick={() => refuseRequest(request.id)}
                                                className="inline-flex h-7 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 text-[10px] font-bold text-gray-600"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Refuser
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="mt-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <h2 className="text-[16px] font-black text-[#242841]">Mes connexions</h2>
                    <p className="mt-0.5 mb-3 text-[12px] font-semibold text-gray-500">{connections.length} personnes</p>

                    <div className="mb-3 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Rechercher une connexion..."
                                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 text-[12px] font-semibold text-gray-700 outline-none"
                            />
                        </div>
                        {showSortControls && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowSortMenu((open) => !open)}
                                    className="inline-flex h-10 items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 text-[11px] font-bold text-gray-600"
                                >
                                    <ArrowUpDown className="h-3.5 w-3.5" />
                                    Trier
                                </button>
                                {showSortMenu && (
                                    <div className="absolute top-11 right-0 z-20 w-[220px] rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                                        {sortOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setSortMode(option.value);
                                                    setShowSortMenu(false);
                                                }}
                                                className={cn(
                                                    "block w-full rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold",
                                                    sortMode === option.value ? "bg-emerald-50 text-emerald-700" : "text-gray-700 hover:bg-gray-50"
                                                )}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2.5">
                        {filteredAndSortedConnections.map((person) => (
                            <article key={person.id} className="relative rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <Link href="/profil" className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-black text-[#242841]">{person.name}</p>
                                        <p className="truncate text-[11px] font-semibold text-gray-500">@{person.pseudo}</p>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <p className="shrink-0 text-[11px] font-semibold text-gray-600">{person.activities} activités ensemble</p>
                                        <button
                                            onClick={() => setActiveConnectionMenuId((prev) => (prev === person.id ? null : person.id))}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500"
                                            aria-label="Options connexion"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                {activeConnectionMenuId === person.id && (
                                    <div className="absolute top-10 right-3 z-10 rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                                        <button
                                            onClick={() => void removeConnection(person.id)}
                                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-50"
                                        >
                                            <UserMinus className="h-3.5 w-3.5" />
                                            Supprimer la connexion
                                        </button>
                                    </div>
                                )}
                            </article>
                        ))}
                        {filteredAndSortedConnections.length === 0 && query.trim().length > 0 && (
                            <p className="text-[12px] font-semibold text-gray-500">Aucune connexion trouvée pour cette recherche.</p>
                        )}
                        {filteredAndSortedConnections.length === 0 && query.trim().length === 0 && (
                            <p className="text-[12px] font-semibold text-gray-500">Aucune connexion pour le moment</p>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
