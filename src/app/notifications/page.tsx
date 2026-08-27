"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Bell, CheckCheck } from "lucide-react";

type UserNotification = {
    id: string;
    type: string;
    title: string;
    message: string;
    activity_id?: string | null;
    activity_is_past?: boolean;
    read_at?: string | null;
    created_at: string;
};

const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";
type NotificationTab = "current" | "past";

function formatNotificationDate(value: string) {
    return new Date(value).toLocaleString("fr-FR");
}

export default function NotificationsPage() {
    const router = useRouter();
    const [items, setItems] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);
    const [activeTab, setActiveTab] = useState<NotificationTab>("current");

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
    const currentItems = items.filter((item) => !item.activity_is_past);
    const pastItems = items.filter((item) => item.activity_is_past);
    const visibleItems = activeTab === "current" ? currentItems : pastItems;
    const unreadItems = visibleItems.filter((item) => !item.read_at);
    const recentReadItems = visibleItems.filter((item) => item.read_at);

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

    const openNotification = async (item: UserNotification) => {
        if (!item.read_at) {
            const readAt = new Date().toISOString();
            setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, read_at: readAt } : entry));
            window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
            void fetch("/api/notifications/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [item.id] }),
            });
        }
        if (item.activity_id) {
            router.push(`/activities?focus=${encodeURIComponent(item.activity_id)}`);
        }
    };

    const renderNotificationCard = (item: UserNotification, variant: "unread" | "recent" | "archived") => (
        <button
            key={item.id}
            type="button"
            onClick={() => void openNotification(item)}
            className={`w-full rounded-2xl p-4 text-left transition active:scale-[0.99] ${variant === "unread"
                ? "border border-playzi-green/30 bg-emerald-50/60"
                : variant === "recent"
                    ? "border border-gray-100 bg-white opacity-80"
                    : "border border-gray-100 bg-[#FAFAFA] opacity-70"}`}
        >
            <p className="text-[14px] font-black text-[#2D2E3B]">{item.title}</p>
            <p className="mt-1 text-[13px] font-medium text-gray-600">{item.message}</p>
            <p className="mt-2 text-[11px] font-semibold text-gray-400">
                {formatNotificationDate(item.created_at)}
            </p>
        </button>
    );

    const renderNotificationGroup = () => {
        if (visibleItems.length === 0) {
            return (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                    {activeTab === "current"
                        ? "Aucune notification actuelle."
                        : "Aucune notification passée."}
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {unreadItems.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="px-2 text-[14px] font-bold uppercase tracking-wider text-gray-400">Nouvelles</h2>
                        {unreadItems.map((item) => renderNotificationCard(item, "unread"))}
                    </div>
                )}

                {recentReadItems.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="px-2 text-[14px] font-bold uppercase tracking-wider text-gray-400">Récentes</h2>
                        {recentReadItems.map((item) => renderNotificationCard(
                            item,
                            activeTab === "past" ? "archived" : "recent"
                        ))}
                    </div>
                )}
            </div>
        );
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

                <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab("current")}
                            className={`rounded-xl px-3 py-2 text-[13px] font-black transition ${activeTab === "current"
                                ? "bg-[#2D2E3B] text-white shadow-sm"
                                : "text-gray-500 hover:bg-gray-50"}`}
                        >
                            Actuelles
                            <span className="ml-1 text-[11px] opacity-70">({currentItems.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("past")}
                            className={`rounded-xl px-3 py-2 text-[13px] font-black transition ${activeTab === "past"
                                ? "bg-[#2D2E3B] text-white shadow-sm"
                                : "text-gray-500 hover:bg-gray-50"}`}
                        >
                            Passées
                            <span className="ml-1 text-[11px] opacity-70">({pastItems.length})</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                        Chargement...
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[14px] font-medium text-gray-500">
                        Aucune notification pour le moment.
                    </div>
                ) : (
                    renderNotificationGroup()
                )}
            </div>
            <BottomNavigation activeTab="profile" />
        </main>
    );
}
