import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: users, error: uErr } = await supabase.from('profiles').select('id').limit(1);
    if (uErr || !users.length) {
        console.error("No users found", uErr);
        return;
    }

    const userId = users[0].id;

    const { data, error } = await supabase.from('activities').insert({
        creator_id: userId,
        title: "Session Super Beach Volley",
        sport: "beach-volley",
        location: "Lausanne",
        address: "46.519,6.632",
        level: "intermediaire",
        max_attendees: 4,
        gender_filter: "mixte",
        is_unlimited: false,
        start_time: new Date(Date.now() + 86400000 * 2).toISOString(),
        status: "en_attente",
        variant: "2v2",
        session_type: "Match",
        tags: ["Soleil"],
        description: "Ceci a été généré via le test Backend"
    }).select();

    if (error) console.error("DB Insert Error:", error.message, error.details);
    else console.log("Success! Activity created:", data[0].id);
}

run();
