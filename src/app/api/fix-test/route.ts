import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response("Not logged in");
    }

    const { error } = await supabase
        .from('activities')
        .update({ creator_id: user.id })
        .eq('title', 'Match Amical Dimanche')
        .eq('status', 'passé');

    if (error) {
        return new Response("Failed: " + error.message);
    }

    return new Response("Success! The test activity is now linked to your account. You can test the feedback!");
}
