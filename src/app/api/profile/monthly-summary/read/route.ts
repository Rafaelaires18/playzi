import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

function isMonthKey(value: string) {
    return /^[0-9]{4}-[0-9]{2}$/.test(value);
}

function previousMonthKey(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const body = await req.json().catch(() => ({}));
        const monthKeyRaw = typeof body?.month_key === "string" ? body.month_key.trim() : "";
        const monthKey = monthKeyRaw || previousMonthKey();

        if (!isMonthKey(monthKey)) {
            return createErrorResponse("month_key invalide (format attendu: YYYY-MM)", 400);
        }

        const { error } = await supabase
            .from("monthly_summary_reads")
            .upsert(
                {
                    user_id: user.id,
                    month_key: monthKey,
                    read_at: new Date().toISOString(),
                },
                { onConflict: "user_id,month_key" }
            );

        if (error) {
            return createErrorResponse("Impossible d'enregistrer l'état du résumé mensuel", 400, error.message);
        }

        return createSuccessResponse({ month_key: monthKey, read: true }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
