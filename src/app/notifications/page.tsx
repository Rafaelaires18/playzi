"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Bell, CheckCheck, ChevronDown, History } from "lucide-react";

type UserNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    activity_id?: string | null;
    read_at?: string | null;
    created_at: string;
};

const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function formatNotificationDate(value: string) {
    return new Date(value).toLocaleString("fr-FR");
}

function isOlderThanAWeek(value: string | null | undefined) {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp >= SEVEN_DAYS_MS;
}

export default function NotificationsPage() {
    const [items, setItems] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const load = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/notifications?t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) return;
            const body = await res.json().catch(() => null);
            setItems(Array.isArray(body?.data?.notifications) ? body.data.notifications : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const unreadCount = items.filter((item) => !item.read_at).length;
    const unreadItems = items.filter((item) => !item.read_at);
    const recentReadItems = items.filter((item) => item.read_at && !isOlderThanAWeek(item.read_at));
    const archivedItems = items.filter((item) => item.read_at && isOlderThanAWeek(item.read_at));

    const markAllRead = async () => {
        if (markingAll || unreadCount === 0) return;
        try {
            setMarkingAll(true);
            const res = await fetch("/api/notifications/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true }),
            });
            if (!res.ok) return;
            setItems((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
            window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
        } finally {
            setMarkingAll(false);
        }
    };

    return (
        <main className="min-h-screen bg-[#F7FAF9]">
            <Header />
            <div className="mx-auto w-full max-w-md px-5 pb-28 pt-24">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-[#2D2E3B]" />
                        <h1 className="text-[28px] font-black text-[#2D2E3B]">Notifications</h1>
                    </div>
                    <button
                        type="button"
                        onClick={() => void markAllRead()}
                        disabled={markingAll || unreadCount === 0}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-bold text-[#2D2E3B] disabled:opacity-50"
                    >
                        <span className="inline-flex items-center gap-1">
                            <CheckCheck className="h-3.5 w-3.5" />
                            Tout lire
                        </span>
                    </button>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                        Chargement...
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                        Aucune notification pour le moment.
                    </div>
                ) : unreadItems.length === 0 && recentReadItems.length === 0 && archivedItems.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                        Aucune notification récente.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {unreadItems.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="px-2 text-[14px] font-bold uppercase tracking-wider text-gray-400">Nouvelles</h2>
                                {unreadItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-playzi-green/30 bg-emerald-50/60 p-4"
                                    >
                                        <p className="text-[14px] font-black text-[#2D2E3B]">{item.title}</p>
                                        <p className="mt-1 text-[13px] font-medium text-gray-600">{item.message}</p>
                                        <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                            {formatNotificationDate(item.created_at)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {recentReadItems.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="px-2 text-[14px] font-bold uppercase tracking-wider text-gray-400">Récentes</h2>
                                {recentReadItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-gray-100 bg-white p-4 opacity-80"
                                    >
                                        <p className="text-[14px] font-black text-[#2D2E3B]">{item.title}</p>
                                        <p className="mt-1 text-[13px] font-medium text-gray-600">{item.message}</p>
                                        <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                            {formatNotificationDate(item.created_at)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {archivedItems.length > 0 && (
                            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
                                <button
                                    type="button"
                                    onClick={() => setShowArchived((prev) => !prev)}
                                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                                >
                                    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[#2D2E3B]">
                                        <History className="h-4 w-4 text-gray-400" />
                                        Notifications passées
                                    </span>
                                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-gray-400">
                                        {archivedItems.length}
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showArchived ? "rotate-180" : ""}`} />
                                    </span>
                                </button>

                                {showArchived && (
                                    <div className="space-y-3 border-t border-gray-100 px-4 py-4">
                                        {archivedItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="rounded-2xl border border-gray-100 bg-[#FAFAFA] p-4 opacity-70"
                                            >
                                                <p className="text-[14px] font-black text-[#2D2E3B]">{item.title}</p>
                                                <p className="mt-1 text-[13px] font-medium text-gray-600">{item.message}</p>
                                                <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                                    {formatNotificationDate(item.created_at)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}
            </div>
            <BottomNavigation activeTab="profile" />
        </main>
    );
}
