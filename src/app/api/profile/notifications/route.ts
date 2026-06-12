import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

function parseSportsEnabled(value: unknown) {
    return value !== false;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return createErrorResponse("Non authentifié", 401);

        const { data, error: prefError } = await supabase
            .from("user_notification_preferences")
            .select("sports_enabled")
            .eq("user_id", user.id)
            .maybeSingle();

        if (prefError) return createErrorResponse("Impossible de charger les préférences de notifications", 400, prefError.message);

        return createSuccessResponse(
            { notifications: { sports_enabled: parseSportsEnabled(data?.sports_enabled) } },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return createErrorResponse("Non authentifié", 401);

        const body = await req.json().catch(() => ({}));
        const sportsEnabled = body?.sports_enabled !== false;

        const { error: upsertError } = await supabase
            .from("user_notification_preferences")
            .upsert({
                user_id: user.id,
                sports_enabled: sportsEnabled,
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
        if (upsertError) return createErrorResponse("Impossible de mettre à jour les préférences", 400, upsertError.message);

        return createSuccessResponse(
            { notifications: { sports_enabled: sportsEnabled }, message: "Préférences notifications mises à jour" },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

