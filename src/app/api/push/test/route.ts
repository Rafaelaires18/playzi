import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { isWebPushConfigured, sendWebPushNotification } from "@/lib/web-push";

type PushRow = {
    endpoint: string;
    p256dh: string;
    auth: string;
};

export async function POST() {
    try {
        if (!isWebPushConfigured()) {
            return createErrorResponse("Web push non configuré côté serveur", 400);
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const { data, error } = await supabase
            .from("web_push_subscriptions")
            .select("endpoint,p256dh,auth")
            .eq("user_id", user.id)
            .is("disabled_at", null)
            .order("updated_at", { ascending: false })
            .limit(10);

        if (error) {
            return createErrorResponse("Impossible de charger les abonnements push", 400, error.message);
        }

        const rows = (data || []) as PushRow[];
        if (rows.length === 0) {
            return createErrorResponse("Aucun abonnement push actif", 400);
        }

        const payload = {
            title: "Playzi",
            body: "Notification de test reçue.",
            url: "/notifications",
            tag: `playzi-test-${Date.now()}`,
        };

        let sent = 0;
        for (const row of rows) {
            try {
                await sendWebPushNotification(
                    {
                        endpoint: row.endpoint,
                        keys: { p256dh: row.p256dh, auth: row.auth },
                    },
                    payload
                );
                sent += 1;
            } catch (pushError) {
                const statusCode = typeof pushError === "object" && pushError && "statusCode" in pushError
                    ? Number((pushError as { statusCode?: number }).statusCode || 0)
                    : 0;

                if (statusCode === 404 || statusCode === 410) {
                    await supabase
                        .from("web_push_subscriptions")
                        .update({ disabled_at: new Date().toISOString() })
                        .eq("user_id", user.id)
                        .eq("endpoint", row.endpoint);
                }
            }
        }

        if (sent === 0) {
            return createErrorResponse("Échec d'envoi push (abonnements expirés ou invalides)", 400);
        }

        return createSuccessResponse({ ok: true, sent }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
