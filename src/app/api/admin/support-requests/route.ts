import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, resolveUserEmailsForAdmin } from "@/lib/moderation";

const statusSchema = z.enum(["new", "in_progress", "resolved"]);

const patchSchema = z.object({
    request_id: z.string().uuid(),
    status: statusSchema,
});

const requestTypeLabel: Record<string, string> = {
    age_verification: "Vérification d'âge",
    account_access: "Accès au compte",
    question: "Question",
};

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status")?.trim();
        const search = searchParams.get("search")?.trim().toLowerCase();

        let query = db
            .from("support_requests")
            .select("id,user_id,email,message,type,status,created_at")
            .order("created_at", { ascending: false })
            .limit(500);

        if (status && ["new", "in_progress", "resolved"].includes(status)) {
            query = query.eq("status", status);
        }

        const { data: rows, error } = await query;
        if (error) return createErrorResponse("Impossible de charger les demandes support", 400, error.message);

        const requestRows = Array.isArray(rows) ? rows : [];
        const userIds = Array.from(new Set(requestRows.map((row) => String(row.user_id || "")).filter(Boolean)));

        const [profilesRes] = await Promise.all([
            userIds.length > 0
                ? db.from("profiles").select("id,pseudo,birth_date,age_verification_status").in("id", userIds)
                : Promise.resolve({ data: [] as Array<{ id: string; pseudo: string | null; birth_date: string | null; age_verification_status: string | null }> }),
        ]);

        const profileById = new Map((profilesRes.data || []).map((profile) => [String(profile.id), profile]));
        const emailById = await resolveUserEmailsForAdmin(db as never, userIds);

        const normalizedRows = requestRows.map((row) => {
            const userId = String(row.user_id || "");
            const profile = profileById.get(userId);
            const authEmail = emailById.get(userId) || null;

            return {
                id: row.id,
                user_id: userId,
                user_pseudo: profile?.pseudo || "Utilisateur",
                user_email: authEmail || row.email || null,
                request_email: row.email || null,
                type_code: row.type || "question",
                type_label: requestTypeLabel[String(row.type)] || "Question",
                message: row.message,
                status: row.status,
                created_at: row.created_at,
                birth_date: profile?.birth_date || null,
                age_verification_status: profile?.age_verification_status || "pending",
            };
        });

        const filteredRows = search
            ? normalizedRows.filter((row) =>
                row.user_pseudo.toLowerCase().includes(search)
                || (row.user_email || "").toLowerCase().includes(search)
                || row.user_id.toLowerCase().includes(search)
            )
            : normalizedRows;

        return createSuccessResponse({ rows: filteredRows }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors du chargement des demandes support",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const payload = await req.json().catch(() => null);
        const parsed = patchSchema.safeParse(payload);
        if (!parsed.success) {
            return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const { request_id, status } = parsed.data;

        const { data: updated, error } = await db
            .from("support_requests")
            .update({ status })
            .eq("id", request_id)
            .select("id,status,created_at")
            .single();

        if (error || !updated) {
            return createErrorResponse("Impossible de mettre à jour le statut", 400, error?.message);
        }

        return createSuccessResponse({ request: updated }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors de la mise à jour",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
