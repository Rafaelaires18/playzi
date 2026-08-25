import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, getStripePlusMonthlyPriceId } from "@/lib/stripe/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { forbiddenOriginResponse } from "@/lib/security/response";
import { getSafeRedirectBase, isSameOriginRequest } from "@/lib/security/request";
import { isPlayziPlusActive } from "@/lib/billing/subscriptions";

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
        const { data: currentSubscription, error: subscriptionError } = await db
            .from("playzi_subscriptions")
            .select("status")
            .eq("user_id", user.id)
            .maybeSingle();

        if (subscriptionError) {
            return createErrorResponse("Impossible de vérifier l'abonnement", 500, subscriptionError.message);
        }

        if (isPlayziPlusActive(currentSubscription?.status)) {
            return createErrorResponse("Playzi+ est déjà actif pour ce compte.", 409);
        }

        const stripe = getStripe();
        const priceId = getStripePlusMonthlyPriceId();
        const customerId = await getOrCreateStripeCustomer({
            db,
            stripe,
            userId: user.id,
            email: user.email || null,
        });

        const baseUrl = getSafeRedirectBase(req);
        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            client_reference_id: user.id,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${baseUrl}/pricing?checkout=success`,
            cancel_url: `${baseUrl}/pricing?checkout=cancel`,
            metadata: {
                playzi_user_id: user.id,
                playzi_plan: "plus_monthly",
            },
            subscription_data: {
                metadata: {
                    playzi_user_id: user.id,
                    playzi_plan: "plus_monthly",
                },
            },
        });

        if (!session.url) {
            return createErrorResponse("Impossible de créer la session Checkout.", 500);
        }

        return createSuccessResponse({ url: session.url, session_id: session.id }, 200);
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la création du Checkout Stripe.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}

async function getOrCreateStripeCustomer(input: {
    db: ReturnType<typeof createServiceRoleClient>;
    stripe: Stripe;
    userId: string;
    email: string | null;
}) {
    const { data, error } = await input.db
        .from("stripe_customers")
        .select("stripe_customer_id")
        .eq("user_id", input.userId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (data?.stripe_customer_id) {
        const existingCustomer = await input.stripe.customers.retrieve(data.stripe_customer_id);
        if (!("deleted" in existingCustomer && existingCustomer.deleted)) {
            return data.stripe_customer_id;
        }
    }

    const customer = await input.stripe.customers.create({
        ...(input.email ? { email: input.email } : {}),
        metadata: { playzi_user_id: input.userId },
    });

    const { error: upsertError } = await input.db
        .from("stripe_customers")
        .upsert(
            {
                user_id: input.userId,
                stripe_customer_id: customer.id,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

    if (upsertError) {
        throw new Error(upsertError.message);
    }

    return customer.id;
}
