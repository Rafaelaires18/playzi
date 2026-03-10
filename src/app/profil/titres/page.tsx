"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import { getPermanentTitles, rarityLabel, rarityTone } from "@/lib/titles";

export default function ProfileTitlesPage() {
    const router = useRouter();
    const permanentTitles = getPermanentTitles();

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-[#F5F7F6]">
            <Header />

            <header className="fixed top-16 left-0 right-0 z-40 mx-auto flex h-16 w-full max-w-md items-center border-b border-gray-100 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <button onClick={() => router.back()} className="rounded-full p-3 text-gray-700 hover:bg-gray-100">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <div className="ml-1">
                    <h1 className="text-[17px] font-black text-[#242841]">Titres</h1>
                    <p className="text-[11px] font-semibold text-gray-500">Titres permanents Playzi</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-36">
                <section className="rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-[12px] font-semibold text-gray-500">
                        Les titres secrets et saisonniers n&apos;apparaissent pas ici.
                    </p>
                    <div className="mt-3 space-y-2.5">
                        {permanentTitles.map((title) => (
                            <article
                                key={title.id}
                                className={cn(
                                    "rounded-xl border px-3 py-3 transition",
                                    title.unlocked ? "border-gray-100 bg-white" : "border-gray-100 bg-gray-50/70 opacity-70"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className={cn("text-[13px] font-black", title.unlocked ? "text-[#242841]" : "text-gray-500")}>
                                            {title.label}
                                        </p>
                                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500">{title.unlockHint}</p>
                                    </div>
                                    <span
                                        className={cn(
                                            "inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase",
                                            title.unlocked ? rarityTone(title.rarity) : "border-gray-200 bg-gray-100 text-gray-500"
                                        )}
                                    >
                                        {title.unlocked ? rarityLabel(title.rarity) : "Non obtenu"}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
