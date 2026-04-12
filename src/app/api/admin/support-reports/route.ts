import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModerationServiceClient, getModeratorAccessDebug, isModeratorUser, resolveUserEmailsForAdmin } from "@/lib/moderation";

const statusSchema = z.enum(["new", "in_progress", "resolved"]);

const patchSchema = z.object({
    report_id: z.string().uuid(),
    status: statusSchema,
});

const categoryLabelByCode: Record<string, string> = {
    bug: "Bug",
    abuse: "Abus",
    payment: "Paiement",
    other: "Autre",
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
        const category = searchParams.get("category")?.trim();
        const search = searchParams.get("search")?.trim().toLowerCase();

        let query = db
            .from("support_reports")
            .select("id,user_id,category,description,image_url,status,created_at,updated_at")
            .order("created_at", { ascending: false })
            .limit(500);

        if (status && ["new", "in_progress", "resolved"].includes(status)) {
            query = query.eq("status", status);
        }
        if (category && ["bug", "abuse", "payment", "other"].includes(category)) {
            query = query.eq("category", category);
        }

        const { data: rows, error } = await query;
        if (error) return createErrorResponse("Impossible de charger les signalements", 400, error.message);

        const reportRows = Array.isArray(rows) ? rows : [];
        const userIds = Array.from(new Set(reportRows.map((row) => String(row.user_id || "")).filter(Boolean)));

        const [profilesRes] = await Promise.all([
            userIds.length > 0
                ? db.from("profiles").select("id,pseudo").in("id", userIds)
                : Promise.resolve({ data: [] as Array<{ id: string; pseudo: string | null }> }),
        ]);

        const profileById = new Map((profilesRes.data || []).map((profile) => [String(profile.id), profile]));
        const emailById = await resolveUserEmailsForAdmin(db as never, userIds);

        const normalizedRows = reportRows.map((row) => {
            const userId = String(row.user_id || "");
            const profile = profileById.get(userId);
            return {
                id: row.id,
                user_id: userId,
                user_pseudo: profile?.pseudo || "Utilisateur",
                user_email: emailById.get(userId) || null,
                category_code: row.category,
                category_label: categoryLabelByCode[String(row.category)] || "Autre",
                description: row.description,
                image_url: row.image_url || null,
                status: row.status,
                created_at: row.created_at,
                updated_at: row.updated_at,
            };
        });

        const filteredRows = search
            ? normalizedRows.filter((row) =>
                row.user_pseudo.toLowerCase().includes(search)
                || (row.user_email || "").toLowerCase().includes(search)
            )
            : normalizedRows;

        return createSuccessResponse({ rows: filteredRows }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors du chargement des signalements",
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

        const { report_id, status } = parsed.data;

        const { data: updated, error } = await db
            .from("support_reports")
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", report_id)
            .select("id,status,updated_at")
            .single();

        if (error || !updated) {
            return createErrorResponse("Impossible de mettre à jour le statut", 400, error?.message);
        }

        return createSuccessResponse({ report: updated }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors de la mise à jour",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
