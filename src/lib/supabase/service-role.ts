import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceRoleClient: SupabaseClient | null = null;

export function createServiceRoleClient() {
    if (serviceRoleClient) return serviceRoleClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error("Configuration Supabase service role manquante.");
    }

    serviceRoleClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    return serviceRoleClient;
}
