import type { SupabaseClient } from "@supabase/supabase-js";
import {
    BETA_TESTER_TITLE_LABEL,
    BETA_TESTER_TITLE_LIMIT,
    BETA_TITLE_PLACEHOLDER_LABEL,
} from "@/lib/titles";

export type BetaTitleStatus = {
    isBetaTester: boolean;
    label: string | null;
    limit: number;
};

export const DEFAULT_BETA_TITLE_STATUS: BetaTitleStatus = {
    isBetaTester: false,
    label: BETA_TITLE_PLACEHOLDER_LABEL,
    limit: BETA_TESTER_TITLE_LIMIT,
};

export function buildBetaTitleStatus(isBetaTester: boolean): BetaTitleStatus {
    return {
        isBetaTester,
        label: isBetaTester ? BETA_TESTER_TITLE_LABEL : BETA_TITLE_PLACEHOLDER_LABEL,
        limit: BETA_TESTER_TITLE_LIMIT,
    };
}

export async function getBetaTitleStatusForUser(
    supabase: SupabaseClient,
    userId: string | null | undefined
): Promise<BetaTitleStatus> {
    if (!userId) return DEFAULT_BETA_TITLE_STATUS;

    const persistedResult = await supabase
        .from("profiles")
        .select("beta_tester_title")
        .eq("id", userId)
        .maybeSingle();

    if (!persistedResult.error && persistedResult.data) {
        return buildBetaTitleStatus(persistedResult.data.beta_tester_title === true);
    }

    const missingColumn = persistedResult.error
        && (
            persistedResult.error.code === "42703"
            || persistedResult.error.code === "PGRST204"
            || String(persistedResult.error.message || "").toLowerCase().includes("beta_tester_title")
        );

    if (!missingColumn && persistedResult.error) {
        return DEFAULT_BETA_TITLE_STATUS;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(BETA_TESTER_TITLE_LIMIT);

    if (error) return DEFAULT_BETA_TITLE_STATUS;

    const isBetaTester = (data || []).some((profile) => profile.id === userId);
    return buildBetaTitleStatus(isBetaTester);
}
