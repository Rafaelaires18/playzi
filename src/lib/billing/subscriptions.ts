import type Stripe from "stripe";

export const PLAYZI_PLUS_ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

export function isPlayziPlusActive(status: string | null | undefined) {
    return PLAYZI_PLUS_ACTIVE_STRIPE_STATUSES.has(String(status || "").toLowerCase());
}

export function mapStripeSubscriptionToPlayziPlus(input: { status?: string | null }) {
    const status = input.status || "unknown";
    return {
        status,
        is_active: isPlayziPlusActive(status),
    };
}

export function stripeTimestampToIso(timestamp: number | null | undefined) {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toISOString();
}

export function getStripeObjectId(value: string | { id?: string } | null | undefined) {
    if (!value) return null;
    if (typeof value === "string") return value;
    return typeof value.id === "string" ? value.id : null;
}

type SubscriptionWithPeriodFields = Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
};

export function normalizeStripeSubscription(subscription: Stripe.Subscription) {
    const withPeriods = subscription as SubscriptionWithPeriodFields;
    const firstItem = subscription.items.data[0];
    const priceId = getStripeObjectId(firstItem?.price || null);
    const customerId = getStripeObjectId(subscription.customer);

    return {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status,
        is_active: isPlayziPlusActive(subscription.status),
        current_period_start: stripeTimestampToIso(withPeriods.current_period_start),
        current_period_end: stripeTimestampToIso(withPeriods.current_period_end),
        cancel_at_period_end: subscription.cancel_at_period_end === true,
        canceled_at: stripeTimestampToIso(subscription.canceled_at),
        ended_at: stripeTimestampToIso(subscription.ended_at),
        trial_start: stripeTimestampToIso(subscription.trial_start),
        trial_end: stripeTimestampToIso(subscription.trial_end),
        latest_invoice_id: getStripeObjectId(subscription.latest_invoice),
    };
}
