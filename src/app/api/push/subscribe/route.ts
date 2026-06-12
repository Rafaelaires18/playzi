import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { isValidWebPushSubscription } from "@/lib/web-push";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const body = await req.json().catch(() => ({}));
        const subscription = body?.subscription;
        if (!isValidWebPushSubscription(subscription)) {
            return createErrorResponse("Abonnement push invalide", 400);
        }

        const userAgent = req.headers.get("user-agent") || "";
        const now = new Date().toISOString();

        const { error } = await supabase
            .from("web_push_subscriptions")
            .upsert(
                {
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth,
                    user_agent: userAgent,
                    updated_at: now,
                    last_seen_at: now,
                    disabled_at: null,
                },
                { onConflict: "endpoint" }
            );

        if (error) {
            return createErrorResponse("Impossible d'enregistrer l'abonnement push", 400, error.message);
        }

        return createSuccessResponse({ ok: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const body = await req.json().catch(() => ({}));
        const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
        if (!endpoint) return createErrorResponse("Endpoint manquant", 400);

        const { error } = await supabase
            .from("web_push_subscriptions")
            .update({ disabled_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);

        if (error) {
            return createErrorResponse("Impossible de désactiver l'abonnement push", 400, error.message);
        }

        return createSuccessResponse({ ok: true }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
