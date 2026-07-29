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

const AVATAR_BUCKET = "avatars";
const AUTH_PAGE_SIZE = 200;
const STORAGE_PAGE_SIZE = 100;

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

async function listAllAuthUsers(supabase) {
    const users = [];
    let page = 1;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage: AUTH_PAGE_SIZE,
        });

        if (error) {
            throw new Error(`Liste des utilisateurs impossible: ${error.message}`);
        }

        const batch = Array.isArray(data?.users) ? data.users : [];
        users.push(...batch);

        if (batch.length < AUTH_PAGE_SIZE) {
            break;
        }

        page += 1;
    }

    return users;
}

async function listFolderEntries(supabase, prefix = "") {
    const entries = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabase.storage
            .from(AVATAR_BUCKET)
            .list(prefix, { limit: STORAGE_PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });

        if (error) {
            throw new Error(`Listing storage impossible (${prefix || "/"}): ${error.message}`);
        }

        const batch = Array.isArray(data) ? data : [];
        entries.push(...batch);

        if (batch.length < STORAGE_PAGE_SIZE) {
            break;
        }

        offset += STORAGE_PAGE_SIZE;
    }

    return entries;
}

async function listAllStoragePaths(supabase, prefix = "") {
    const entries = await listFolderEntries(supabase, prefix);
    const paths = [];

    for (const entry of entries) {
        if (!entry?.name) continue;
        const currentPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) {
            paths.push(currentPath);
            continue;
        }
        const nestedPaths = await listAllStoragePaths(supabase, currentPath);
        paths.push(...nestedPaths);
    }

    return paths;
}

async function removeStorageObjects(supabase) {
    const objectPaths = await listAllStoragePaths(supabase);
    if (objectPaths.length === 0) {
        console.log("Aucun avatar a supprimer.");
        return 0;
    }

    const chunkSize = 100;
    for (let index = 0; index < objectPaths.length; index += chunkSize) {
        const chunk = objectPaths.slice(index, index + chunkSize);
        const { error } = await supabase.storage.from(AVATAR_BUCKET).remove(chunk);
        if (error) {
            throw new Error(`Suppression avatars impossible: ${error.message}`);
        }
    }

    console.log(`Avatars supprimes: ${objectPaths.length}`);
    return objectPaths.length;
}

async function deleteAllAuthUsers(supabase) {
    const users = await listAllAuthUsers(supabase);
    if (users.length === 0) {
        console.log("Aucun utilisateur Auth a supprimer.");
        return 0;
    }

    for (const user of users) {
        const { error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) {
            throw new Error(`Suppression utilisateur impossible (${user.id}): ${error.message}`);
        }
    }

    console.log(`Utilisateurs Auth supprimes: ${users.length}`);
    return users.length;
}

async function clearBetaTesterTitleGrants(supabase) {
    const { error } = await supabase
        .from("beta_tester_title_grants")
        .delete()
        .not("user_id", "is", null);

    if (error) {
        const missingTable = error.code === "42P01"
            || error.code === "PGRST205"
            || String(error.message || "").toLowerCase().includes("beta_tester_title_grants");

        if (missingTable) {
            console.log("Historique titres beta absent, rien a vider.");
            return false;
        }

        throw new Error(`Vidage historique titres beta impossible: ${error.message}`);
    }

    console.log("Historique titres beta vide.");
    return true;
}

async function main() {
    const supabase = createServiceRoleClient();

    console.log("Debut full beta reset...");
    const removedAvatars = await removeStorageObjects(supabase);
    const removedUsers = await deleteAllAuthUsers(supabase);
    await clearBetaTesterTitleGrants(supabase);
    console.log("");
    console.log("Full reset termine.");
    console.log(`Avatars supprimes: ${removedAvatars}`);
    console.log(`Utilisateurs Auth supprimes: ${removedUsers}`);
    console.log("Les donnees relationnelles liees a profiles/auth.users ont ete supprimees en cascade.");
}

main().catch((error) => {
    console.error("Echec full reset Supabase:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
