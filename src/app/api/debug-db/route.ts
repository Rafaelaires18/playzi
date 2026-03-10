import { createClient } from "@/lib/supabase/server";
import { createErrorResponse } from "@/lib/types/api";

export async function GET() {
    if (process.env.NODE_ENV === "production") {
        return createErrorResponse("Not found", 404);
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return createErrorResponse("Non authentifié", 401);

    // Get ALL feedback rows for the test activity
    const { data: feedbackRows, error } = await supabase
        .from('activity_feedback')
        .select('*')
        .eq('activity_id', '8a7c8881-0191-4cbb-b9ec-18eed1efb115');

    // Also get the activity to check status and creator
    const { data: activity } = await supabase
        .from('activities')
        .select('id, title, status, creator_id, start_time')
        .eq('id', '8a7c8881-0191-4cbb-b9ec-18eed1efb115')
        .single();

    // Get participations
    const { data: parts } = await supabase
        .from('participations')
        .select('user_id, status')
        .eq('activity_id', '8a7c8881-0191-4cbb-b9ec-18eed1efb115');

    return Response.json({
        currentUser: user?.id || 'NOT LOGGED IN',
        activity,
        participations: parts,
        feedbackRows: feedbackRows || [],
        feedbackError: error?.message
    });
}
