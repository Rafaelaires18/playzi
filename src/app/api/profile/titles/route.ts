import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { normalizeProfileTitleSelection, toProfileSelectionColumns } from "@/lib/profile-title-selection";
import { isSameOriginRequest } from "@/lib/security/request";
import { forbiddenOriginResponse } from "@/lib/security/response";

const PROFILE_TITLES_DEBUG_ENABLED = process.env.NODE_ENV !== "production";

function profileTitlesDebug(...args: unknown[]) {
    if (!PROFILE_TITLES_DEBUG_ENABLED) return;
    console.log(...args);
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const { data: profile, error } = await supabase
            .from("profiles")
            .select("primary_title_id,secondary_title_ids,seasonal_title_id")
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            const missingColumns = error.code === "42703"
                || error.code === "PGRST204"
                || String(error.message || "").toLowerCase().includes("primary_title_id")
                || String(error.message || "").toLowerCase().includes("secondary_title_ids")
                || String(error.message || "").toLowerCase().includes("seasonal_title_id");
            if (missingColumns) {
                return createSuccessResponse({ selection: normalizeProfileTitleSelection(null) }, 200);
            }
            return createErrorResponse("Impossible de charger les titres du profil", 400, error.message);
        }

        const selection = normalizeProfileTitleSelection({
            primaryId: profile?.primary_title_id || undefined,
            secondaryIds: profile?.secondary_title_ids || undefined,
            seasonalId: profile?.seasonal_title_id || undefined,
        });
        profileTitlesDebug("[PROFILE_DEBUG] profile/titles GET", {
            user_id: user.id,
            selection,
        });

        return createSuccessResponse({ selection }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function PATCH(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const body = await req.json().catch(() => null);
        const selection = normalizeProfileTitleSelection({
            primaryId: body?.selection?.primaryId,
            secondaryIds: body?.selection?.secondaryIds,
            seasonalId: body?.selection?.seasonalId,
        });
        profileTitlesDebug("[PROFILE_DEBUG] profile/titles PATCH payload", {
            user_id: user.id,
            selection,
        });

        const { error } = await supabase
            .from("profiles")
            .update(toProfileSelectionColumns(selection))
            .eq("id", user.id);

        if (error) {
            const missingColumns = error.code === "42703"
                || error.code === "PGRST204"
                || String(error.message || "").toLowerCase().includes("primary_title_id")
                || String(error.message || "").toLowerCase().includes("secondary_title_ids")
                || String(error.message || "").toLowerCase().includes("seasonal_title_id");
            if (missingColumns) {
                return createErrorResponse("Migration profile titles manquante (phase 34)", 409);
            }
            return createErrorResponse("Impossible d'enregistrer les titres", 400, error.message);
        }
        profileTitlesDebug("[PROFILE_DEBUG] profile/titles PATCH stored", {
            user_id: user.id,
            selection,
        });

        return createSuccessResponse({ selection }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
