import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";
import { sendPlayziSystemEmail } from "@/lib/email/system";

const REQUEST_TYPES = new Set(["age_verification", "account_access", "question"]);
const SUPPORT_ADMIN_EMAIL = "admin@playzi.ch";
const SUPPORT_REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function mapRequestTypeLabel(type: string | null) {
    if (type === "age_verification") return "Vérification d'âge";
    if (type === "account_access") return "Accès au compte";
    if (type === "question") return "Question";
    return "Question";
}

function escapeHtml(input: string) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function resolveSupabaseEditorUrl() {
    const explicitProjectId = String(process.env.SUPABASE_PROJECT_ID || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID || "").trim();
    if (explicitProjectId) {
        return `https://app.supabase.com/project/${explicitProjectId}/editor`;
    }

    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const match = /^https:\/\/([a-zA-Z0-9-]+)\.supabase\.co/.exec(supabaseUrl);
    if (match?.[1]) {
        return `https://app.supabase.com/project/${match[1]}/editor`;
    }

    return "https://app.supabase.com";
}

function buildSupportRequestAdminEmailHtml(input: {
    requestTypeLabel: string;
    email: string;
    userId: string;
    createdAt: string;
    message: string;
    supabaseEditorUrl: string;
}) {
    return `<!doctype html>
<html lang="fr">
  <body style="margin:0; padding:0; background:#ffffff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 12px; background:#ffffff;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#ffffff;">
            <tr>
              <td style="padding:8px 24px 8px 24px;">
                <h1 style="margin:0 0 16px 0; color:#1f2937; font-size:24px; line-height:1.3;">Nouvelle demande support</h1>
                <p style="margin:0 0 14px 0; color:#1f2937; font-size:16px; line-height:1.65;">Bonjour,</p>
                <p style="margin:0 0 12px 0; color:#1f2937; font-size:15px; line-height:1.6;"><strong>Type de demande :</strong> ${escapeHtml(input.requestTypeLabel)}</p>
                <p style="margin:0 0 12px 0; color:#1f2937; font-size:15px; line-height:1.6;"><strong>Email utilisateur :</strong> ${escapeHtml(input.email)}</p>
                <p style="margin:0 0 12px 0; color:#1f2937; font-size:15px; line-height:1.6;"><strong>User ID :</strong> ${escapeHtml(input.userId)}</p>
                <p style="margin:0 0 12px 0; color:#1f2937; font-size:15px; line-height:1.6;"><strong>Date de création :</strong> ${escapeHtml(input.createdAt)}</p>
                <p style="margin:0 0 10px 0; color:#1f2937; font-size:15px; line-height:1.6;"><strong>Message :</strong></p>
                <p style="margin:0 0 16px 0; color:#1f2937; font-size:15px; line-height:1.7; white-space:pre-wrap;">${escapeHtml(input.message)}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:6px 0 16px 0;">
                  <tr>
                    <td style="border-radius:12px; background:#1f2937;">
                      <a href="${escapeHtml(input.supabaseEditorUrl)}" style="display:inline-block; padding:13px 22px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                        Ouvrir Supabase
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0; color:#1f2937; font-size:16px; line-height:1.65;">L’équipe Playzi</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 20px 20px 20px; border-top:1px solid #f0f2f4;">
                <p style="margin:0; color:#1f2937; font-size:13px; font-weight:700;">Playzi.</p>
                <p style="margin:4px 0 0 0; color:#6b7280; font-size:12px;">@playzi</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "support:requests:create", user.id),
            { limit: 10, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const body = await req.json().catch(() => null);
        const emailInput = typeof body?.email === "string" ? body.email.trim() : "";
        const message = typeof body?.message === "string" ? body.message.trim() : "";
        const rawType = typeof body?.type === "string" ? body.type.trim() : "";

        const email = emailInput || user.email?.trim() || "";
        const requestType = rawType ? rawType : "question";

        if (!email || !isValidEmail(email)) {
            return createErrorResponse("Email invalide.", 400);
        }
        if (!message) {
            return createErrorResponse("Le message est obligatoire.", 400);
        }
        if (message.length > 2000) {
            return createErrorResponse("Le message est trop long (max 2000 caractères).", 400);
        }
        if (requestType && !REQUEST_TYPES.has(requestType)) {
            return createErrorResponse("Type de demande invalide.", 400);
        }

        const sinceIso = new Date(Date.now() - SUPPORT_REQUEST_COOLDOWN_MS).toISOString();
        const { data: recentRequest, error: recentRequestError } = await supabase
            .from("support_requests")
            .select("id,created_at")
            .eq("user_id", user.id)
            .eq("type", requestType)
            .gte("created_at", sinceIso)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recentRequestError) {
            return createErrorResponse("Impossible de vérifier vos demandes récentes.", 400, recentRequestError.message);
        }

        if (recentRequest?.created_at) {
            const nextAllowedAt = new Date(new Date(recentRequest.created_at).getTime() + SUPPORT_REQUEST_COOLDOWN_MS);
            const retryAfterMs = Math.max(nextAllowedAt.getTime() - Date.now(), 0);
            const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
            const retryAfterHours = Math.ceil(retryAfterSeconds / 3600);

            return createErrorResponse(
                "Tu as déjà envoyé une demande récemment pour ce sujet. Merci d’attendre avant d’en renvoyer une nouvelle.",
                429,
                {
                    code: "support_request_rate_limited",
                    retry_after_seconds: retryAfterSeconds,
                    retry_after_hours: retryAfterHours,
                    next_allowed_at: nextAllowedAt.toISOString(),
                }
            );
        }

        const { data: inserted, error: insertError } = await supabase
            .from("support_requests")
            .insert({
                user_id: user.id,
                email,
                message,
                type: requestType || null,
            })
            .select("id, created_at")
            .single();

        if (insertError || !inserted) {
            return createErrorResponse("Impossible d'envoyer la demande support.", 400, insertError?.message);
        }

        // Best effort: notify admin without breaking user flow if email sending fails.
        try {
            const requestTypeLabel = mapRequestTypeLabel(requestType);
            const createdAt = new Date(String(inserted.created_at || new Date().toISOString())).toLocaleString("fr-FR");
            const supabaseEditorUrl = resolveSupabaseEditorUrl();
            const subject = `Nouvelle demande support Playzi - ${requestTypeLabel}`;
            const text = [
                `Type de demande: ${requestTypeLabel}`,
                `Email utilisateur: ${email}`,
                `User ID: ${user.id}`,
                `Date de création: ${createdAt}`,
                `Message: ${message}`,
                `Supabase: ${supabaseEditorUrl}`,
            ].join("\n");
            const html = buildSupportRequestAdminEmailHtml({
                requestTypeLabel,
                email,
                userId: user.id,
                createdAt,
                message,
                supabaseEditorUrl,
            });
            await sendPlayziSystemEmail({
                to: SUPPORT_ADMIN_EMAIL,
                subject,
                text,
                html,
            });
        } catch {
            // Ignore admin email failures here to keep support submission reliable.
        }

        return createSuccessResponse(
            {
                request: inserted,
                message: "Votre demande a bien été envoyée.",
            },
            201
        );
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors de l'envoi de la demande support.",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
