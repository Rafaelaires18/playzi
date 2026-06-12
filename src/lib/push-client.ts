const PUBLIC_KEY_ENDPOINT = "/api/push/public-key";
const SUBSCRIBE_ENDPOINT = "/api/push/subscribe";

function base64UrlToUint8Array(base64Url: string) {
    const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function isPushSupported() {
    if (typeof window === "undefined") return false;
    return (
        "serviceWorker" in navigator
        && "PushManager" in window
        && "Notification" in window
    );
}

export async function registerPushServiceWorker() {
    if (!isPushSupported()) return null;
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
    if (!isPushSupported()) return "unsupported";
    return Notification.permission;
}

export async function requestPushPermission() {
    if (!isPushSupported()) return "unsupported" as const;
    const result = await Notification.requestPermission();
    return result;
}

async function getPublicVapidKey() {
    const res = await fetch(`${PUBLIC_KEY_ENDPOINT}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return "";
    const body = await res.json().catch(() => null);
    const key = body?.data?.publicKey;
    return typeof key === "string" ? key : "";
}

export async function subscribeCurrentBrowser() {
    if (!isPushSupported()) {
        return { ok: false as const, reason: "unsupported" };
    }
    if (Notification.permission !== "granted") {
        return { ok: false as const, reason: "permission_not_granted" };
    }

    const registration = await registerPushServiceWorker();
    if (!registration) {
        return { ok: false as const, reason: "sw_registration_failed" };
    }

    const publicKey = await getPublicVapidKey();
    if (!publicKey) {
        return { ok: false as const, reason: "missing_vapid_public_key" };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(publicKey),
        });
    }

    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) {
        return { ok: false as const, reason: "invalid_subscription" };
    }

    const syncRes = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            subscription: {
                endpoint: serialized.endpoint,
                keys: {
                    p256dh: serialized.keys.p256dh,
                    auth: serialized.keys.auth,
                },
            },
        }),
    });

    if (!syncRes.ok) {
        return { ok: false as const, reason: "server_sync_failed" };
    }

    return { ok: true as const, endpoint: serialized.endpoint };
}

export async function unsubscribeCurrentBrowser() {
    if (!isPushSupported()) return { ok: false as const, reason: "unsupported" };

    const registration = await navigator.serviceWorker.getRegistration("/");
    if (!registration) return { ok: true as const };

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true as const };

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => null);

    await fetch(SUBSCRIBE_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
    }).catch(() => null);

    return { ok: true as const };
}
