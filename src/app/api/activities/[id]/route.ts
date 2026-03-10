import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateActivitySchema } from "@/lib/validations/activities";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { sanitizeActivityLocationForViewer } from "@/lib/security/activity-location";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('activities')
            .select(`
                *,
                creator:profiles(id, pseudo, grade),
                participations(id, user_id, status, profiles(pseudo))
            `)
            .eq('id', id)
            .single();

        if (error || !data) {
            return createErrorResponse("Activité introuvable", 404);
        }

        if (user) {
            const isAuthorizedForExactLocation =
                data.creator_id === user.id
                || (data.participations || []).some((p: { user_id?: string; status?: string }) => p.user_id === user.id && p.status === "confirmé");

            if (isAuthorizedForExactLocation) {
                const { data: privateLocation } = await supabase
                    .from("activity_private_locations")
                    .select("exact_address, exact_lat, exact_lng")
                    .eq("activity_id", id)
                    .maybeSingle();

                if (privateLocation) {
                    (data as Record<string, unknown>).exact_address = privateLocation.exact_address;
                    (data as Record<string, unknown>).exact_lat = privateLocation.exact_lat;
                    (data as Record<string, unknown>).exact_lng = privateLocation.exact_lng;
                }
            }
        }

        return createSuccessResponse(sanitizeActivityLocationForViewer(data, user?.id), 200);
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

        const approximateCoordinate = (value?: number) =>
            typeof value === "number" && !Number.isNaN(value) ? Number(value.toFixed(2)) : null;
        const hasLocationPrecisionUpdate =
            typeof validation.data.address === "string"
            || typeof validation.data.lat === "number"
            || typeof validation.data.lng === "number";

        const updatePayload: Record<string, unknown> = {
            ...validation.data,
            updated_at: new Date().toISOString()
        };

        if (typeof validation.data.location === "string" && validation.data.location.trim().length > 0) {
            updatePayload.public_location = validation.data.location;
        }
        if (typeof validation.data.address === "string") {
            updatePayload.address = null;
        }
        if (typeof validation.data.lat === "number") {
            updatePayload.lat = approximateCoordinate(validation.data.lat);
            updatePayload.public_lat = approximateCoordinate(validation.data.lat);
        }
        if (typeof validation.data.lng === "number") {
            updatePayload.lng = approximateCoordinate(validation.data.lng);
            updatePayload.public_lng = approximateCoordinate(validation.data.lng);
        }

        // Modification avec protection supplémentaire en plus du RLS
        const { error } = await supabase
            .from('activities')
            .update(updatePayload)
            .eq('id', id)
            .eq('creator_id', user.id);

        if (error) {
            return createErrorResponse("Erreur lors de la modification ou autorisation refusée (RLS)", 403, error.message);
        }

        if (hasLocationPrecisionUpdate) {
            const { data: existingPrivateLocation } = await supabase
                .from("activity_private_locations")
                .select("exact_address, exact_lat, exact_lng")
                .eq("activity_id", id)
                .maybeSingle();

            const { error: privateLocationError } = await supabase
                .from("activity_private_locations")
                .upsert({
                    activity_id: id,
                    exact_address: typeof validation.data.address === "string"
                        ? validation.data.address
                        : (existingPrivateLocation?.exact_address ?? null),
                    exact_lat: typeof validation.data.lat === "number"
                        ? validation.data.lat
                        : (existingPrivateLocation?.exact_lat ?? null),
                    exact_lng: typeof validation.data.lng === "number"
                        ? validation.data.lng
                        : (existingPrivateLocation?.exact_lng ?? null),
                    updated_at: new Date().toISOString(),
                }, { onConflict: "activity_id" });

            if (privateLocationError) {
                return createErrorResponse("Erreur lors de la mise à jour de la localisation exacte", 403, privateLocationError.message);
            }
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
