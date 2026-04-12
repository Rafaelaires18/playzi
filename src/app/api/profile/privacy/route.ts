import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { updatePrivacySchema } from "@/lib/validations/auth";
import { forbiddenOriginResponse } from "@/lib/security/response";
import { isSameOriginRequest } from "@/lib/security/request";

function parseApproximateLocation(value: unknown): boolean {
    return value !== false;
}

export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const metadata = (user.user_metadata || {}) as Record<string, unknown>;
        return createSuccessResponse(
            {
                privacy: {
                    approximate_location: parseApproximateLocation(metadata.approximate_location),
                },
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors du chargement de la confidentialité.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const body = await req.json();
        const validation = updatePrivacySchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse(
                "Données invalides",
                400,
                validation.error.flatten().fieldErrors
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const metadata = {
            ...(user.user_metadata || {}),
            approximate_location: validation.data.approximate_location,
        };

        const { error: updateError } = await supabase.auth.updateUser({ data: metadata });
        if (updateError) {
            return createErrorResponse("Impossible de mettre à jour la confidentialité", 400, updateError.message);
        }

        return createSuccessResponse(
            {
                privacy: {
                    approximate_location: parseApproximateLocation(metadata.approximate_location),
                },
                message: "Confidentialité mise à jour",
            },
            200
        );
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la mise à jour de la confidentialité.",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
