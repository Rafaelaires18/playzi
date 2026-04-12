import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const { data, error } = await supabase
            .from("moderation_notifications")
            .select("id,title,body,level,metadata,created_at,read_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(30);

        if (error) {
            return createErrorResponse("Impossible de charger les notifications de modération", 400, error.message);
        }

        const rows = Array.isArray(data) ? data : [];
        const dedupedByEvent = new Map<string, (typeof rows)[number]>();
        for (const row of rows) {
            const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
            const eventKey = String(metadata.notification_event_key || `${row.level}:${row.title}:${row.body}`);
            const existing = dedupedByEvent.get(eventKey);
            if (!existing) {
                dedupedByEvent.set(eventKey, row);
                continue;
            }
            const existingTime = new Date(existing.created_at || 0).getTime();
            const currentTime = new Date(row.created_at || 0).getTime();
            if (currentTime > existingTime) {
                dedupedByEvent.set(eventKey, row);
            }
        }
        const deduped = Array.from(dedupedByEvent.values())
            .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        return createSuccessResponse({ notifications: deduped }, 200);
    } catch (error) {
        return createErrorResponse("Erreur interne", 500, error instanceof Error ? error.message : "Erreur inconnue");
    }
}
