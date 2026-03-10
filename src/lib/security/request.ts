import { NextRequest } from "next/server";

export function getClientIp(req: NextRequest) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() || "unknown";
    return req.headers.get("x-real-ip") || "unknown";
}

export function buildRateLimitKey(req: NextRequest, scope: string, identity?: string) {
    const ip = getClientIp(req);
    return `${scope}:${identity || ip}`;
}

export function isSameOriginRequest(req: NextRequest) {
    const origin = req.headers.get("origin");
    if (!origin) return true;

    const requestOrigin = req.nextUrl.origin;
    if (origin === requestOrigin) return true;

    const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    if (allowedOrigin && origin === allowedOrigin) return true;

    return false;
}

export function getSafeRedirectBase(req: NextRequest) {
    const sanitize = (value: string) => value.replace(/\/$/, "");
    const isLocalhost = (value: string) => /localhost|127\.0\.0\.1/i.test(value);

    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (configured) {
        const cleanConfigured = sanitize(configured);
        if (!(process.env.NODE_ENV === "production" && isLocalhost(cleanConfigured))) {
            return cleanConfigured;
        }
    }

    const vercelProdHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (vercelProdHost) {
        const host = vercelProdHost.startsWith("http") ? vercelProdHost : `https://${vercelProdHost}`;
        return sanitize(host);
    }

    const requestOrigin = sanitize(req.nextUrl.origin);
    if (!(process.env.NODE_ENV === "production" && isLocalhost(requestOrigin))) {
        return requestOrigin;
    }

    // Last-resort safety fallback to avoid broken reset links in production.
    return "https://playzi-rosy.vercel.app";
}

export function getRequestUserAgent(req: NextRequest) {
    return req.headers.get("user-agent") || "unknown";
}
