"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlayziLoader from "@/components/PlayziLoader";

const PENDING_INVITE_KEY = "pending_invite";

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default function InvitePage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const params = new URLSearchParams(window.location.search);
            const activityId = String(params.get("activity_id") || "").trim();
            if (!activityId || !isUuid(activityId)) {
                setError("Lien d'invitation invalide.");
                return;
            }

            window.localStorage.setItem(PENDING_INVITE_KEY, activityId);

            const next = `/activities?invite_activity_id=${encodeURIComponent(activityId)}&invite_prompt=1`;
            const loginHref = `/login?mode=register&next=${encodeURIComponent(next)}`;

            try {
                const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) {
                    if (!cancelled) router.replace(loginHref);
                    return;
                }
                if (!cancelled) router.replace(next);
            } catch {
                if (!cancelled) router.replace(loginHref);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [router]);

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
            <PlayziLoader compact message="Préparation de ton invitation..." />
        </main>
    );
}
