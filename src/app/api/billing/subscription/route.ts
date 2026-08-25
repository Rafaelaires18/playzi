import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { mapStripeSubscriptionToPlayziPlus } from "@/lib/billing/subscriptions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { data, error } = await supabase
            .from("playzi_subscriptions")
            .select("status,stripe_price_id,current_period_start,current_period_end,cancel_at_period_end,canceled_at,ended_at,trial_start,trial_end,updated_at")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            return createErrorResponse("Impossible de charger l'abonnement.", 500, error.message);
        }

        if (!data) {
            return createSuccessResponse(
                {
                    subscription: null,
                    playzi_plus: { status: "none", is_active: false },
                },
                200
            );
        }

        return createSuccessResponse(
            {
                subscription: data,
                playzi_plus: mapStripeSubscriptionToPlayziPlus({ status: data.status }),
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors du chargement de l'abonnement.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
