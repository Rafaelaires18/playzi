import webpush from "web-push";

let configured = false;

function getEnv(name: string) {
    const value = process.env[name];
    return typeof value === "string" ? value.trim() : "";
}

export function getWebPushPublicKey() {
    return getEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || getEnv("VAPID_PUBLIC_KEY");
}

export function isWebPushConfigured() {
    const publicKey = getWebPushPublicKey();
    const privateKey = getEnv("VAPID_PRIVATE_KEY");
    return Boolean(publicKey && privateKey);
}

export function ensureWebPushConfigured() {
    if (configured) return;

    const publicKey = getWebPushPublicKey();
    const privateKey = getEnv("VAPID_PRIVATE_KEY");
    const contactEmail = getEnv("VAPID_CONTACT_EMAIL") || "support@playzi.app";

    if (!publicKey || !privateKey) {
        throw new Error("web_push_not_configured");
    }

    webpush.setVapidDetails(`mailto:${contactEmail}`, publicKey, privateKey);
    configured = true;
}

export async function sendWebPushNotification(
    subscription: webpush.PushSubscription,
    payload: Record<string, unknown>
) {
    ensureWebPushConfigured();
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 60,
        urgency: "normal",
    });
}

export type WebPushSubscriptionInput = {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
};

export function isValidWebPushSubscription(input: unknown): input is WebPushSubscriptionInput {
    if (!input || typeof input !== "object") return false;
    const candidate = input as Record<string, unknown>;
    if (typeof candidate.endpoint !== "string" || !candidate.endpoint.trim()) return false;
    const keys = candidate.keys;
    if (!keys || typeof keys !== "object") return false;
    const keysRecord = keys as Record<string, unknown>;
    return typeof keysRecord.p256dh === "string"
        && keysRecord.p256dh.length > 0
        && typeof keysRecord.auth === "string"
        && keysRecord.auth.length > 0;
}
