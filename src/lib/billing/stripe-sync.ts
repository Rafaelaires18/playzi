import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeStripeSubscription } from "@/lib/billing/subscriptions";

export async function syncStripeCustomerForUser(
    db: SupabaseClient,
    input: { userId: string; stripeCustomerId: string }
) {
    const { error } = await db
        .from("stripe_customers")
        .upsert(
            {
                user_id: input.userId,
                stripe_customer_id: input.stripeCustomerId,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

    if (error) {
        throw new Error(`Impossible de synchroniser le customer Stripe: ${error.message}`);
    }
}

export async function syncStripeSubscription(
    db: SupabaseClient,
    subscription: Stripe.Subscription
) {
    const normalized = normalizeStripeSubscription(subscription);
    if (!normalized.stripe_customer_id) {
        throw new Error("Subscription Stripe sans customer.");
    }

    const userId = typeof subscription.metadata?.playzi_user_id === "string"
        ? subscription.metadata.playzi_user_id
        : null;

    const resolvedUserId = userId || await findUserIdForStripeCustomer(db, normalized.stripe_customer_id);
    if (!resolvedUserId) {
        throw new Error(`Aucun utilisateur Playzi trouvé pour le customer Stripe ${normalized.stripe_customer_id}.`);
    }

    await syncStripeCustomerForUser(db, {
        userId: resolvedUserId,
        stripeCustomerId: normalized.stripe_customer_id,
    });

    const { error } = await db
        .from("playzi_subscriptions")
        .upsert(
            {
                user_id: resolvedUserId,
                stripe_customer_id: normalized.stripe_customer_id,
                stripe_subscription_id: normalized.stripe_subscription_id,
                stripe_price_id: normalized.stripe_price_id,
                status: normalized.status,
                current_period_start: normalized.current_period_start,
                current_period_end: normalized.current_period_end,
                cancel_at_period_end: normalized.cancel_at_period_end,
                canceled_at: normalized.canceled_at,
                ended_at: normalized.ended_at,
                trial_start: normalized.trial_start,
                trial_end: normalized.trial_end,
                latest_invoice_id: normalized.latest_invoice_id,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
        );

    if (error) {
        throw new Error(`Impossible de synchroniser la subscription Stripe: ${error.message}`);
    }

    return { userId: resolvedUserId, subscription: normalized };
}

async function findUserIdForStripeCustomer(db: SupabaseClient, stripeCustomerId: string) {
    const { data, error } = await db
        .from("stripe_customers")
        .select("user_id")
        .eq("stripe_customer_id", stripeCustomerId)
        .maybeSingle();

    if (error) {
        throw new Error(`Impossible de retrouver le customer Stripe: ${error.message}`);
    }

    return typeof data?.user_id === "string" ? data.user_id : null;
}
