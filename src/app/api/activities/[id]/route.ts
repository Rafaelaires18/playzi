import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('activities')
            .select(`
                *,
                creator:profiles(id, pseudo, grade),
                participations(id, user_id, status)
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            return createErrorResponse("Activité introuvable", 404);
        }

        return createSuccessResponse(data, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const body = await req.json();

        // Validation Zod pour la modification
        const validation = updateActivitySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        // Modification avec protection supplémentaire en plus du RLS
        const { error } = await supabase
            .from('activities')
            .update({
                ...validation.data,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('creator_id', user.id);

        if (error) {
            return createErrorResponse("Erreur lors de la modification ou autorisation refusée (RLS)", 403, error.message);
        }

        return createSuccessResponse({ message: "Activité modifiée avec succès" }, 200);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse("Non autorisé", 401);
        }

        const { error } = await supabase
            .from('activities')
            .delete()
            .eq('id', id)
            .eq('creator_id', user.id);

        if (error) {
            return createErrorResponse("Erreur lors de la suppression ou autorisation refusée", 403, error.message);
        }

        return createSuccessResponse({ message: "Activité supprimée avec succès" }, 200);

    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
