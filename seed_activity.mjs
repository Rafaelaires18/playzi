import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: users, error: uErr } = await supabase.from('profiles').select('id').limit(1);
  if (uErr || !users.length) return console.error("No users found");

  const userId = users[0].id;

  const { data, error } = await supabase.from('activities').insert({
    creator_id: userId,
    title: "Test Beach Volley BD Direct",
    sport: "beach-volley",
    location: "Lausanne",
    address: "46.519,6.632",
    level: "intermediaire",
    max_attendees: 4,
    gender_filter: "mixte",
    is_unlimited: false,
    start_time: new Date(Date.now() + 86400000).toISOString(),
    status: "en_attente",
    variant: "2v2",
    session_type: "Match",
    tags: ["Soleil"],
    description: "Seed direct db."
  }).select();

  if (error) console.error("DB Insert Error:", error);
  else console.log("Success:", data);
}

run();
