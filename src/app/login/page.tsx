"use client";

import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    return (
        <main className="relative mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-background px-6 py-8">
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_65%)]" />

            <div className="relative mt-auto rounded-[32px] border border-white/70 bg-white/90 p-7 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-playzi-green/10 text-playzi-green">
                    <ShieldCheck className="h-7 w-7" strokeWidth={2.2} />
                </div>

                <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Session</p>
                    <h1 className="text-3xl font-black tracking-tight text-gray-dark">Connexion</h1>
                    <p className="text-[15px] font-medium leading-relaxed text-gray-500">
                        Votre session a ete fermee. Reconnectez-vous pour reprendre vos activites Playzi.
                    </p>
                </div>

                <Link
                    href="/"
                    className="mt-8 flex h-14 items-center justify-center gap-2 rounded-2xl bg-playzi-green font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)] transition-all active:translate-y-0.5 active:shadow-[0_6px_18px_rgba(16,185,129,0.18)]"
                >
                    <LogIn className="h-5 w-5" strokeWidth={2.3} />
                    Retour a Playzi
                </Link>
            </div>
        </main>
    );
}
