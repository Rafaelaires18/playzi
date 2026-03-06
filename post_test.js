const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    // Attempting to manually insert what the backend would insert
    // Act ID: 8a7c8881-0191-4cbb-b9ec-18eed1efb115
    // User ID: 6f75baa0-66b1-428e-91ff-8cd4fddcd475 (test2)
    const { error } = await supabase.from('activity_feedback').insert([{
        activity_id: "8a7c8881-0191-4cbb-b9ec-18eed1efb115",
        reviewer_id: "6f75baa0-66b1-428e-91ff-8cd4fddcd475",
        reviewed_user_id: null,
        rating: 5,
        tags: null,
        comment: "Test API JS",
        no_show: false
    }]);
    
    if(error){
       console.log("Insert failed:", error);
    } else {
       console.log("Insert succeeded!");
    }
}
run();
