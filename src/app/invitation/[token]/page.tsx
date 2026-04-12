"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PlayziLoader from "@/components/PlayziLoader";

export default function InvitationRedirectPage() {
    const router = useRouter();
    const params = useParams<{ token: string }>();
    const token = useMemo(() => String(params?.token || "").trim(), [params]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setError("Lien d'invitation invalide.");
            return;
        }
        let cancelled = false;
        const resolve = async () => {
            try {
                const res = await fetch(`/api/activity-invite-links/${encodeURIComponent(token)}?t=${Date.now()}`, {
                    cache: "no-store",
                });
                const body = await res.json().catch(() => null);
                if (res.status === 401) {
                    const next = `/invitation/${encodeURIComponent(token)}`;
                    router.replace(`/login?mode=register&next=${encodeURIComponent(next)}`);
                    return;
                }
                if (!res.ok) throw new Error(body?.error || "Lien introuvable");
                const activityId = String(body?.data?.activity_id || "");
                if (!activityId) throw new Error("Lien introuvable");
                if (cancelled) return;
                router.replace(`/invite?activity_id=${encodeURIComponent(activityId)}`);
            } catch (e) {
                if (cancelled) return;
                setError(e instanceof Error ? e.message : "Lien invalide");
            }
        };
        void resolve();
        return () => {
            cancelled = true;
        };
    }, [router, token]);

    if (error) {
        return (
            <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F8FA] px-6">
                <div className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                    <h1 className="text-[18px] font-black text-[#242841]">Lien indisponible</h1>
                    <p className="mt-2 text-[13px] font-medium text-gray-500">{error}</p>
                    <button
                        type="button"
                        onClick={() => router.replace("/discover")}
                        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-[#242841] px-4 text-[13px] font-semibold text-white"
                    >
                        Retourner à Découvrir
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#F7F8FA]">
            <PlayziLoader compact message="Ouverture de l’activité..." />
        </main>
    );
}
