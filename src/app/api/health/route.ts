import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    try {
        // Test basic connection to Supabase
        const supabase = await createClient();
        const { error } = await supabase.from('profiles').select('id').limit(1);

        // Standard JSON API representation
        return NextResponse.json({
            status: "online",
            timestamp: new Date().toISOString(),
            database: error ? "disconnected" : "connected",
            version: "0.1.0"
        }, { status: 200 });

    } catch (e) {
        return NextResponse.json({
            error: "Health check failed",
            details: e instanceof Error ? e.message : "Unknown error"
        }, { status: 500 });
    }
}
