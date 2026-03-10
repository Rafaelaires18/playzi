import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function resolveSafeNextPath(rawNext: string | null) {
    const candidate = rawNext ?? "/reset-password";
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/reset-password";
    const parsed = new URL(candidate, "https://playzi.local");
    if (parsed.pathname !== "/reset-password") return "/reset-password";
    return `${parsed.pathname}${parsed.search}`;
}

function withRecoveryFlag(path: string) {
    const parsed = new URL(path, "https://playzi.local");
    parsed.searchParams.set("recovery", "1");
    return `${parsed.pathname}${parsed.search}`;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const code = searchParams.get("code");
    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");
    const next = withRecoveryFlag(resolveSafeNextPath(searchParams.get("next")));
    const recoveryType = type === "recovery";
    const hasRecoveryPayload = Boolean(tokenHash || code || (accessToken && refreshToken));

    if (!hasRecoveryPayload && !recoveryType) {
        return NextResponse.redirect(new URL("/forgot-password", request.url));
    }

    const supabase = await createClient();

    if (tokenHash) {
        const otpType = type ?? "recovery";
        const { error } = await supabase.auth.verifyOtp({ type: otpType as EmailOtpType, token_hash: tokenHash });
        if (!error) {
            return NextResponse.redirect(new URL(next, request.url));
        }
    }

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            return NextResponse.redirect(new URL(next, request.url));
        }
    }

    if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        if (!error) {
            return NextResponse.redirect(new URL(next, request.url));
        }
    }

    const failed = new URL(next, request.url);
    failed.searchParams.set("error", "invalid_or_expired");
    return NextResponse.redirect(failed);
}
