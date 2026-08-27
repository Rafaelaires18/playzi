import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { isNotificationActivityPast } from "@/lib/notification-activity-state";

type NotificationRow = {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    activity_id?: string | null;
    read_at?: string | null;
    created_at: string;
    activities?: {
        status?: string | null;
        start_time?: string | null;
    } | null;
};

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return createErrorResponse("Non authentifié", 401);

        const limitParam = Number(req.nextUrl.searchParams.get("limit") || 30);
        const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;

        const { data, error } = await supabase
            .from("user_notifications")
            .select("id,user_id,type,title,message,activity_id,read_at,created_at,activities(status,start_time)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) return createErrorResponse("Impossible de charger les notifications", 400, error.message);
        const nowMs = Date.now();
        const notifications = ((data || []) as NotificationRow[]).map((row) => {
            const { activities, ...notification } = row;
            return {
                ...notification,
                activity_is_past: isNotificationActivityPast(activities, nowMs),
                activity_status: activities?.status || null,
                activity_start_time: activities?.start_time || null,
            };
        });
        return createSuccessResponse({ notifications }, 200);
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
