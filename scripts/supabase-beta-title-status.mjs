import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
    process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || "";
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_SERVICE_ROLE
    || "";

function requireEnv() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
            "Variables requises manquantes: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY."
        );
    }
}

function createServiceRoleClient() {
    requireEnv();
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

async function getCount(supabase, table, queryBuilder = (query) => query) {
    const query = queryBuilder(
        supabase
            .from(table)
            .select("*", { count: "exact", head: true })
    );
    const { count, error } = await query;

    if (error) {
        throw new Error(`${table}: ${error.message}`);
    }

    return count || 0;
}

async function main() {
    const supabase = createServiceRoleClient();

    const [profilesCount, betaProfilesCount, grantsCount] = await Promise.all([
        getCount(supabase, "profiles"),
        getCount(supabase, "profiles", (query) => query.eq("beta_tester_title", true)),
        getCount(supabase, "beta_tester_title_grants"),
    ]);

    const { data: firstProfiles, error: firstProfilesError } = await supabase
        .from("profiles")
        .select("id,pseudo,created_at,beta_tester_title,beta_tester_title_granted_at")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(35);

    if (firstProfilesError) {
        throw new Error(`profiles: ${firstProfilesError.message}`);
    }

    const { data: grants, error: grantsError } = await supabase
        .from("beta_tester_title_grants")
        .select("user_id,grant_number,granted_at")
        .order("grant_number", { ascending: true })
        .limit(35);

    if (grantsError) {
        throw new Error(`beta_tester_title_grants: ${grantsError.message}`);
    }

    const firstThirty = (firstProfiles || []).slice(0, 30);
    const firstThirtyWithoutTitle = firstThirty.filter((profile) => profile.beta_tester_title !== true);
    const profilesAfterThirtyWithTitle = (firstProfiles || []).slice(30).filter((profile) => profile.beta_tester_title === true);

    console.log("Statut titres beta testeur");
    console.log(`- Profils total: ${profilesCount}`);
    console.log(`- Profils avec titre: ${betaProfilesCount}`);
    console.log(`- Grants consommes: ${grantsCount}/30`);
    console.log("");

    if (profilesCount === 0) {
        console.log("Aucun profil actuel: les 30 prochains inscrits recevront le titre.");
        return;
    }

    if (firstThirtyWithoutTitle.length === 0 && profilesAfterThirtyWithTitle.length === 0 && betaProfilesCount <= 30) {
        console.log("OK: les profils beta correspondent aux 30 premiers profils actuels.");
    } else {
        console.log("Attention: incoherence detectee dans les titres beta.");
        if (firstThirtyWithoutTitle.length > 0) {
            console.log(`- Parmi les 30 premiers, sans titre: ${firstThirtyWithoutTitle.length}`);
        }
        if (profilesAfterThirtyWithTitle.length > 0) {
            console.log(`- Apres les 30 premiers, avec titre: ${profilesAfterThirtyWithTitle.length}`);
        }
        if (betaProfilesCount > 30) {
            console.log(`- Trop de profils avec titre: ${betaProfilesCount}`);
        }
    }

    console.log("");
    console.log("Premiers profils:");
    for (const [index, profile] of (firstProfiles || []).entries()) {
        const marker = profile.beta_tester_title ? "✅" : "—";
        console.log(`${String(index + 1).padStart(2, "0")}. ${marker} ${profile.pseudo || profile.id} ${profile.created_at}`);
    }

    console.log("");
    console.log("Grants:");
    for (const grant of grants || []) {
        console.log(`${String(grant.grant_number).padStart(2, "0")}. ${grant.user_id} ${grant.granted_at}`);
    }
}

main().catch((error) => {
    console.error("Echec verification titres beta:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
