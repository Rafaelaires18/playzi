import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/pulse";
import { getSafeRedirectBase } from "@/lib/security/request";
import { buildPlayziSystemEmailHtml, sendPlayziSystemEmail } from "@/lib/email/system";

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

function loginRedirect(request: NextRequest, params: Record<string, string>) {
    const base = getSafeRedirectBase(request);
    const url = new URL("/login", base);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return NextResponse.redirect(url);
}

async function invalidateUserSessions(serviceRoleClient: NonNullable<ReturnType<typeof createServiceRoleClient>>, userId: string) {
    // Best-effort hard logout of all sessions.
    await serviceRoleClient
        .schema("auth")
        .from("sessions")
        .delete()
        .eq("user_id", userId);
}

export async function GET(request: NextRequest) {
    const action = request.nextUrl.searchParams.get("action");
    const token = request.nextUrl.searchParams.get("token") || "";

    if ((action !== "confirm" && action !== "cancel") || !token || token.length < 16) {
        return loginRedirect(request, { email_change: "invalid" });
    }

    const serviceRoleClient = createServiceRoleClient();
    if (!serviceRoleClient) {
        return loginRedirect(request, { email_change: "server_error" });
    }

    const tokenHash = hashToken(token);
    const tokenColumn = action === "confirm" ? "confirm_token_hash" : "cancel_token_hash";

    const { data: row, error: fetchError } = await serviceRoleClient
        .from("email_change_requests")
        .select("id,user_id,current_email,pending_email,confirm_expires_at,cancel_expires_at,confirmed_at,canceled_at")
        .eq(tokenColumn, tokenHash)
        .maybeSingle();

    if (fetchError || !row) {
        return loginRedirect(request, { email_change: "invalid" });
    }

    const now = Date.now();
    const confirmExpiresAt = new Date(row.confirm_expires_at).getTime();
    const cancelExpiresAt = new Date(row.cancel_expires_at).getTime();

    if (row.canceled_at) {
        return loginRedirect(request, { email_change: "already_canceled" });
    }

    if (action === "confirm") {
        if (row.confirmed_at) {
            return loginRedirect(request, { email_updated: "1", force_login: "1" });
        }

        if (Number.isNaN(confirmExpiresAt) || now > confirmExpiresAt) {
            return loginRedirect(request, { email_change: "confirm_expired" });
        }

        if (!row.pending_email) {
            return loginRedirect(request, { email_change: "invalid" });
        }

        const { error: updateUserError } = await serviceRoleClient.auth.admin.updateUserById(row.user_id, {
            email: row.pending_email,
            email_confirm: true,
        });

        if (updateUserError) {
            return loginRedirect(request, { email_change: "confirm_failed" });
        }

        await serviceRoleClient
            .from("email_change_requests")
            .update({
                confirmed_at: new Date(now).toISOString(),
                pending_email: null,
            })
            .eq("id", row.id);

        await invalidateUserSessions(serviceRoleClient, row.user_id);

        return loginRedirect(request, { email_updated: "1", force_login: "1" });
    }

    if (Number.isNaN(cancelExpiresAt) || now > cancelExpiresAt) {
        return loginRedirect(request, { email_change: "cancel_expired" });
    }

    if (row.confirmed_at) {
        const forcedPassword = `${randomBytes(24).toString("base64url")}A1!`;

        const { error: restoreError } = await serviceRoleClient.auth.admin.updateUserById(row.user_id, {
            email: row.current_email,
            email_confirm: true,
            password: forcedPassword,
        });

        if (restoreError) {
            return loginRedirect(request, { email_change: "cancel_failed" });
        }

        await invalidateUserSessions(serviceRoleClient, row.user_id);

        const resetRedirectTo = `${getSafeRedirectBase(request)}/reset-password?recovery=1`;
        const { data: linkData } = await serviceRoleClient.auth.admin.generateLink({
            type: "recovery",
            email: row.current_email,
            options: { redirectTo: resetRedirectTo },
        });

        const resetActionLink = linkData?.properties?.action_link;
        if (resetActionLink) {
            await sendPlayziSystemEmail({
                to: row.current_email,
                subject: "Réinitialisez votre mot de passe",
                text: `Pour sécuriser votre compte Playzi, réinitialisez votre mot de passe.\n\nRéinitialiser maintenant: ${resetActionLink}`,
                html: buildPlayziSystemEmailHtml({
                    title: "Réinitialisez votre mot de passe",
                    paragraphs: [
                        "Pour sécuriser votre compte Playzi après l’annulation de modification d’email, réinitialisez votre mot de passe.",
                    ],
                    ctaLabel: "Réinitialiser mon mot de passe",
                    ctaHref: resetActionLink,
                    secondaryText: "Ce lien est à usage unique.",
                }),
            });
        }

        await serviceRoleClient
            .from("email_change_requests")
            .update({
                canceled_at: new Date(now).toISOString(),
                pending_email: null,
            })
            .eq("id", row.id);

        return loginRedirect(request, { email_change: "canceled_and_reset", force_login: "1" });
    }

    await serviceRoleClient
        .from("email_change_requests")
        .update({
            canceled_at: new Date(now).toISOString(),
            pending_email: null,
        })
        .eq("id", row.id);

    return loginRedirect(request, { email_change: "canceled", force_login: "1" });
}
