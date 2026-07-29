"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import Header from "@/components/Header";
import { BetaTitleStatus, DEFAULT_BETA_TITLE_STATUS } from "@/lib/beta-titles";
import {
    BETA_TESTER_TITLE_DESCRIPTION,
    BETA_TESTER_TITLE_LABEL,
    PLAYZIEN_TITLE_DESCRIPTION,
    PLAYZIEN_TITLE_LABEL,
} from "@/lib/titles";

export default function ProfileTitlesPage() {
    const router = useRouter();
    const [betaTitleStatus, setBetaTitleStatus] = useState<BetaTitleStatus>(DEFAULT_BETA_TITLE_STATUS);

    useEffect(() => {
        let cancelled = false;
        const loadTitles = async () => {
            try {
                const res = await fetch(`/api/profile/titles?t=${Date.now()}`, { cache: "no-store" });
                if (!res.ok) return;
                const body = await res.json().catch(() => null);
                if (!cancelled && body?.data?.beta_title) {
                    setBetaTitleStatus(body.data.beta_title as BetaTitleStatus);
                }
            } catch {
                // Keep default titles state.
            }
        };
        void loadTitles();
        return () => { cancelled = true; };
    }, []);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => router.back()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Titres</h1>
                    <p className="text-[11px] font-semibold text-gray-500">Bêta Playzi</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="space-y-3">
                    <article className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3.5 py-2 text-[12px] font-black text-gray-600">
                            <Trophy className="h-3.5 w-3.5" />
                            {PLAYZIEN_TITLE_LABEL}
                        </div>
                        <p className="mt-4 text-[13px] font-semibold text-gray-500">{PLAYZIEN_TITLE_DESCRIPTION}</p>
                    </article>

                    {betaTitleStatus.isBetaTester && (
                        <article className="rounded-[24px] border border-amber-100 bg-white p-5 shadow-sm">
                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] font-black text-amber-800">
                                <Trophy className="h-3.5 w-3.5" />
                                {BETA_TESTER_TITLE_LABEL}
                            </div>
                            <p className="mt-4 text-[13px] font-semibold text-gray-500">{BETA_TESTER_TITLE_DESCRIPTION}</p>
                        </article>
                    )}
                </section>
            </div>
        </main>
    );
}
