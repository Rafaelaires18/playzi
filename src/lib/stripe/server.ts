import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe() {
    if (stripeClient) return stripeClient;

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
        throw new Error("STRIPE_SECRET_KEY manquante.");
    }

    stripeClient = new Stripe(secretKey);
    return stripeClient;
}

export function getStripeWebhookSecret() {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
        throw new Error("STRIPE_WEBHOOK_SECRET manquante.");
    }
    return secret;
}

export function getStripePlusMonthlyPriceId() {
    const priceId = process.env.STRIPE_PRICE_PLUS_MONTHLY;
    if (!priceId) {
        throw new Error("STRIPE_PRICE_PLUS_MONTHLY manquante.");
    }
    return priceId;
}
