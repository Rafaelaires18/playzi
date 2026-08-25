import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/stripe/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { forbiddenOriginResponse } from "@/lib/security/response";
import { getSafeRedirectBase, isSameOriginRequest } from "@/lib/security/request";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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

        const db = createServiceRoleClient();
        const { data, error } = await db
            .from("stripe_customers")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) {
            return createErrorResponse("Impossible de charger le customer Stripe.", 500, error.message);
        }

        if (!data?.stripe_customer_id) {
            return createErrorResponse("Aucun abonnement Stripe trouvé pour ce compte.", 404);
        }

        const baseUrl = getSafeRedirectBase(req);
        const portalSession = await getStripe().billingPortal.sessions.create({
            customer: data.stripe_customer_id,
            return_url: `${baseUrl}/pricing`,
        });

        return createSuccessResponse({ url: portalSession.url }, 200);
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la création du portail Stripe.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
