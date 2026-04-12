import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { updateConsentsSchema } from "@/lib/validations/auth";
import { forbiddenOriginResponse } from "@/lib/security/response";
import { isSameOriginRequest } from "@/lib/security/request";
import { CURRENT_LEGAL_VERSION, hasAcceptedCurrentLegalVersion } from "@/lib/legal-consents";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("accepted_terms,accepted_terms_at,marketing_opt_in,accepted_legal_version")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            return createErrorResponse("Impossible de charger les consentements", 400, profileError.message);
        }

        const consentAccepted = hasAcceptedCurrentLegalVersion(profile);
        return createSuccessResponse(
            {
                accepted_terms: consentAccepted,
                accepted_terms_at: profile?.accepted_terms_at || null,
                marketing_opt_in: profile?.marketing_opt_in === true,
                accepted_legal_version: Number(profile?.accepted_legal_version || 0),
                current_legal_version: CURRENT_LEGAL_VERSION,
                requires_update: !consentAccepted,
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function PATCH(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) return forbiddenOriginResponse();

        const body = await req.json().catch(() => null);
        const validation = updateConsentsSchema.safeParse(body);
        if (!validation.success) {
            return createErrorResponse("Données invalides", 400, validation.error.flatten().fieldErrors);
        }

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const acceptedTermsAt = new Date().toISOString();
        const marketingOptIn = validation.data.marketing_opt_in === true;

        const { error: updateProfileError } = await supabase
            .from("profiles")
            .update({
                accepted_terms: true,
                accepted_terms_at: acceptedTermsAt,
                marketing_opt_in: marketingOptIn,
                accepted_legal_version: CURRENT_LEGAL_VERSION,
            })
            .eq("id", user.id);

        if (updateProfileError) {
            return createErrorResponse("Impossible d'enregistrer les consentements", 400, updateProfileError.message);
        }

        const metadata = {
            ...(user.user_metadata || {}),
            accepted_terms: true,
            accepted_terms_at: acceptedTermsAt,
            marketing_opt_in: marketingOptIn,
            accepted_legal_version: CURRENT_LEGAL_VERSION,
        };

        await supabase.auth.updateUser({ data: metadata });

        return createSuccessResponse(
            {
                accepted_terms: true,
                accepted_terms_at: acceptedTermsAt,
                marketing_opt_in: marketingOptIn,
                accepted_legal_version: CURRENT_LEGAL_VERSION,
                current_legal_version: CURRENT_LEGAL_VERSION,
                requires_update: false,
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
