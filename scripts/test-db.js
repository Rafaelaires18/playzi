const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing environment variables", process.env.NEXT_PUBLIC_SUPABASE_URL);
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function testDiscover() {
  const { data: activities, error } = await db
    .from('activities')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error("Error fetching", error);
    return;
  }
  
  console.log("Found", activities.length, "activities");
  
  for (const a of activities) {
     const hasStarted = new Date(a.start_time).getTime() <= Date.now();
     const startStr = new Date(a.start_time).toLocaleString();
     console.log(`- ${a.sport} (${a.status}) [${startStr}] Gender: ${a.gender_filter} ID: ${a.id}`);
  }
}

testDiscover();
