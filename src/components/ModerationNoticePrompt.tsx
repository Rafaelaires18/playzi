"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";

type ModerationNotification = {
    id: string;
    title: string;
    body: string;
    level: "info" | "warning" | "restriction" | "suspension";
    metadata?: Record<string, unknown> | null;
    created_at: string;
    read_at?: string | null;
};

export default function ModerationNoticePrompt() {
    const [queue, setQueue] = useState<ModerationNotification[]>([]);
    const notification = queue[0] || null;
    const NOTIFICATIONS_CHANGED_EVENT = "playzi:notifications-changed";

    const isLiftNotice = (n: ModerationNotification | null) => {
        if (!n) return false;
        const title = String(n.title || "").toLowerCase();
        const body = String(n.body || "").toLowerCase();
        return title.includes("levée") || body.includes("levée") || body.includes("rétabli");
    };

    const notificationKey = (n: ModerationNotification) => {
        const metadata = n?.metadata && typeof n.metadata === "object" ? n.metadata : {};
        const eventKey = typeof metadata?.notification_event_key === "string" ? metadata.notification_event_key : "";
        if (eventKey) return `event:${eventKey}`;
        return `fallback:${n.level}:${n.title}:${n.body}`;
    };

    const tone = useMemo(() => {
        if (!notification) return "border-orange-300 bg-orange-50 text-orange-800";
        return isLiftNotice(notification)
            ? "border-blue-300 bg-blue-50 text-blue-800"
            : "border-orange-300 bg-orange-50 text-orange-800";
    }, [notification]);

    useEffect(() => {
        let mounted = true;
        let stopped = false;
        const fetchLatest = async () => {
            if (stopped) return;
            try {
                const res = await fetch(`/api/moderation/notifications?t=${Date.now()}`, { cache: "no-store" });
                if (res.status === 401) {
                    stopped = true;
                    return;
                }
                if (!res.ok) return;
                const body = await res.json().catch(() => null);
                const notifications = Array.isArray(body?.data?.notifications) ? body.data.notifications : [];
                const unread = notifications.filter((n: ModerationNotification) => !n.read_at);
                if (mounted) {
                    setQueue((prev) => {
                        const map = new Map<string, ModerationNotification>();
                        for (const item of prev) map.set(notificationKey(item), item);
                        for (const item of unread) {
                            const key = notificationKey(item);
                            const existing = map.get(key);
                            if (!existing) {
                                map.set(key, item);
                                continue;
                            }
                            const existingTime = new Date(existing.created_at).getTime();
                            const currentTime = new Date(item.created_at).getTime();
                            if (currentTime > existingTime) {
                                map.set(key, item);
                            }
                        }
                        return Array.from(map.values()).sort(
                            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        );
                    });
                }
            } catch {
                // silent
            }
        };

        void fetchLatest();
        const id = window.setInterval(fetchLatest, 30000);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchLatest);
        return () => {
            mounted = false;
            stopped = true;
            window.clearInterval(id);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchLatest);
        };
    }, []);

    const dismiss = async () => {
        if (!notification) return;
        setQueue((prev) => prev.slice(1));
        try {
            await fetch("/api/moderation/notifications/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: [notification.id] }),
            });
        } catch {
            // silent
        }
    };

    if (!notification) return null;

    return (
        <div className="fixed inset-0 z-[140] flex items-center justify-center px-3 pointer-events-none">
            <div className={`w-full max-w-md rounded-2xl border px-4 py-3 shadow-lg pointer-events-auto ${tone}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                        {isLiftNotice(notification)
                            ? <Info className="mt-0.5 h-4 w-4" />
                            : <AlertTriangle className="mt-0.5 h-4 w-4" />}
                        <div>
                            <p className="text-[13px] font-black">{notification.title}</p>
                            <p className="mt-0.5 text-[12px] font-medium">{notification.body}</p>
                        </div>
                    </div>
                    <button type="button" onClick={dismiss} className="rounded-full bg-white/70 p-1.5">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
