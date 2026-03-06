const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    console.log("Checking profiles...");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
    if (pErr) { console.error("Error fetching profiles", pErr); }
    console.log("Profiles in DB:", profiles?.map(p => ({ id: p.id, pseudo: p.pseudo })));

    console.log("\nChecking activities...");
    const { data: activities, error: aErr } = await supabase.from('activities').select('id, title, status, creator_id').eq('title', 'Match Amical Dimanche').eq('status', 'passé');
    if (aErr) { console.error(aErr); return; }

    if (!activities || activities.length === 0) {
        console.log("No dummy activities found.");
        return;
    }
    const act = activities[0];
    console.log("Found activity:", act);

    console.log("\nChecking participations...");
    const { data: parts, error: partErr } = await supabase.from('participations').select('*').eq('activity_id', act.id);
    if (partErr) console.error(partErr);
    console.log("Participations:", parts);

    console.log("\nChecking feedback...");
    const { data: feedback, error: fErr } = await supabase.from('activity_feedback').select('*').eq('activity_id', act.id);
    if (fErr) console.error(fErr);
    console.log("Feedback items:", feedback);
}

checkUser();
