import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ activity_id: string }> }) {
    try {
        const { activity_id } = await params;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const { error } = await supabase
            .from('participations')
            .delete()
            .eq('activity_id', activity_id)
            .eq('user_id', user.id);

        if (error) {
            return createErrorResponse("Erreur lors de la désinscription", 500, error.message);
        }

        return createSuccessResponse({ message: "Vous n'êtes plus inscrit à cette activité" }, 200);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
