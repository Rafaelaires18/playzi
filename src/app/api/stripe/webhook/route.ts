import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";
import { getStripeObjectId } from "@/lib/billing/subscriptions";
import { syncStripeCustomerForUser, syncStripeSubscription } from "@/lib/billing/stripe-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function POST(req: NextRequest) {
    const stripe = getStripe();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
        return Response.json({ error: "Signature Stripe manquante." }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            await req.text(),
            signature,
            getStripeWebhookSecret()
        );
    } catch (e) {
        return Response.json(
            { error: "Signature webhook Stripe invalide.", details: e instanceof Error ? e.message : "Erreur inconnue" },
            { status: 400 }
        );
    }

    const db = createServiceRoleClient();
    const { error: insertError } = await db
        .from("stripe_webhook_events")
        .insert({
            stripe_event_id: event.id,
            type: event.type,
            livemode: event.livemode,
            processing_started_at: new Date().toISOString(),
        });

    if (insertError) {
        if (insertError.code === "23505") {
            const { data } = await db
                .from("stripe_webhook_events")
                .select("processed_at")
                .eq("stripe_event_id", event.id)
                .maybeSingle();

            if (data?.processed_at) {
                return Response.json({ received: true, duplicate: true }, { status: 200 });
            }

            return Response.json({ error: "Event Stripe déjà reçu, traitement non terminé." }, { status: 409 });
        }

        return Response.json(
            { error: "Impossible d'enregistrer l'event Stripe.", details: insertError.message },
            { status: 500 }
        );
    }

    try {
        await handleStripeEvent(stripe, db, event);

        const { error: updateError } = await db
            .from("stripe_webhook_events")
            .update({
                processed_at: new Date().toISOString(),
                processing_error: null,
            })
            .eq("stripe_event_id", event.id);

        if (updateError) {
            throw new Error(updateError.message);
        }

        return Response.json({ received: true }, { status: 200 });
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Erreur inconnue";
        await db
            .from("stripe_webhook_events")
            .update({
                processing_error: errorMessage,
            })
            .eq("stripe_event_id", event.id);

        return Response.json({ error: "Erreur de traitement webhook Stripe.", details: errorMessage }, { status: 500 });
    }
}

async function handleStripeEvent(stripe: Stripe, db: ReturnType<typeof createServiceRoleClient>, event: Stripe.Event) {
    switch (event.type) {
        case "checkout.session.completed":
            await handleCheckoutSessionCompleted(stripe, db, event.data.object as Stripe.Checkout.Session);
            return;
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
            await syncStripeSubscription(db, event.data.object as Stripe.Subscription);
            return;
        case "invoice.payment_failed":
        case "invoice.paid":
            await handleInvoiceSubscriptionEvent(stripe, db, event.data.object as Stripe.Invoice);
            return;
        default:
            return;
    }
}

async function handleCheckoutSessionCompleted(
    stripe: Stripe,
    db: ReturnType<typeof createServiceRoleClient>,
    session: Stripe.Checkout.Session
) {
    if (session.mode !== "subscription") return;

    const userId = session.metadata?.playzi_user_id || session.client_reference_id;
    const customerId = getStripeObjectId(session.customer);
    if (userId && customerId) {
        await syncStripeCustomerForUser(db, { userId, stripeCustomerId: customerId });
    }

    const subscriptionId = getStripeObjectId(session.subscription);
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(db, subscription);
}

async function handleInvoiceSubscriptionEvent(
    stripe: Stripe,
    db: ReturnType<typeof createServiceRoleClient>,
    invoice: Stripe.Invoice
) {
    const subscriptionId = getInvoiceSubscriptionId(invoice);
    if (!subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(db, subscription);
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
    const candidate = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
        parent?: {
            subscription_details?: {
                subscription?: string | Stripe.Subscription | null;
            } | null;
        } | null;
    };

    return getStripeObjectId(candidate.subscription)
        || getStripeObjectId(candidate.parent?.subscription_details?.subscription);
}
