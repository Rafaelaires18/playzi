import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPlayziPlusActive } from "@/lib/billing/subscriptions";

export const PLAYZI_PLUS_FEATURES = [
    "unlimited_activity_creation",
    "advanced_filters",
    "advanced_stats",
    "pulse_evolution",
    "participant_profiles",
    "ad_free",
    "premium_customization",
] as const;

export type PlayziPlusFeature = (typeof PLAYZI_PLUS_FEATURES)[number];
export type PlayziPlusAccessSource = "stripe" | "manual" | "launch" | "none";
export type PlayziPlusGrantType = "beta_tester" | "founder" | "partner" | "gift" | "manual";

export type PlayziPlusSubscriptionEntitlement = {
    status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    ended_at: string | null;
};

export type UserEntitlements = {
    has_playzi_plus: boolean;
    access_source: PlayziPlusAccessSource;
    launch_free_access: boolean;
    stripe_active: boolean;
    manual_grant_active: boolean;
    manual_grant_type: PlayziPlusGrantType | null;
    expires_at: string | null;
    subscription: PlayziPlusSubscriptionEntitlement | null;
    features: Record<PlayziPlusFeature, boolean>;
};

type AppSettingRow = {
    bool_value: boolean | null;
};

type SubscriptionRow = {
    status: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    ended_at: string | null;
};

type GrantRow = {
    grant_type: PlayziPlusGrantType;
    expires_at: string | null;
};

const LAUNCH_FREE_ACCESS_KEY = "playzi_plus_launch_free_access";

function buildFeatureEntitlements(hasPlayziPlus: boolean) {
    return PLAYZI_PLUS_FEATURES.reduce(
        (features, feature) => ({
            ...features,
            [feature]: hasPlayziPlus,
        }),
        {} as Record<PlayziPlusFeature, boolean>
    );
}

function resolveAccessSource(input: {
    stripeActive: boolean;
    manualGrantActive: boolean;
    launchFreeAccess: boolean;
}): PlayziPlusAccessSource {
    if (input.stripeActive) return "stripe";
    if (input.manualGrantActive) return "manual";
    if (input.launchFreeAccess) return "launch";
    return "none";
}

export function canUsePlayziPlusFeature(entitlements: Pick<UserEntitlements, "features">, feature: PlayziPlusFeature) {
    return entitlements.features[feature] === true;
}

export async function getUserEntitlements(
    userId: string,
    client: SupabaseClient = createServiceRoleClient()
): Promise<UserEntitlements> {
    const nowIso = new Date().toISOString();

    const [{ data: setting }, { data: subscription }, { data: grants }] = await Promise.all([
        client
            .from("playzi_app_settings")
            .select("bool_value")
            .eq("key", LAUNCH_FREE_ACCESS_KEY)
            .maybeSingle<AppSettingRow>(),
        client
            .from("playzi_subscriptions")
            .select("status,current_period_end,cancel_at_period_end,ended_at")
            .eq("user_id", userId)
            .maybeSingle<SubscriptionRow>(),
        client
            .from("playzi_plus_grants")
            .select("grant_type,expires_at")
            .eq("user_id", userId)
            .eq("active", true)
            .is("revoked_at", null)
            .lte("starts_at", nowIso)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("expires_at", { ascending: true, nullsFirst: false })
            .limit(1)
            .returns<GrantRow[]>(),
    ]);

    const launchFreeAccess = setting?.bool_value === true;
    const stripeActive = isPlayziPlusActive(subscription?.status);
    const manualGrant = grants?.[0] || null;
    const manualGrantActive = !!manualGrant;
    const hasPlayziPlus = launchFreeAccess || stripeActive || manualGrantActive;
    const accessSource = resolveAccessSource({
        stripeActive,
        manualGrantActive,
        launchFreeAccess,
    });

    return {
        has_playzi_plus: hasPlayziPlus,
        access_source: accessSource,
        launch_free_access: launchFreeAccess,
        stripe_active: stripeActive,
        manual_grant_active: manualGrantActive,
        manual_grant_type: manualGrant?.grant_type || null,
        expires_at: manualGrant?.expires_at || null,
        subscription: subscription
            ? {
                status: subscription.status,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: subscription.cancel_at_period_end === true,
                ended_at: subscription.ended_at,
            }
            : null,
        features: buildFeatureEntitlements(hasPlayziPlus),
    };
}
