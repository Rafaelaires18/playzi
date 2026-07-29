import fs from "node:fs/promises";
import path from "node:path";
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

const PAGE_SIZE = 1000;
const AUTH_PAGE_SIZE = 200;
const AVATAR_BUCKET = "avatars";

const TABLES = [
    "public.profiles",
    "public.activities",
    "public.activity_private_locations",
    "public.participations",
    "public.activity_feedback",
    "public.reports",
    "public.connection_requests",
    "public.user_connections",
    "public.pulse_transactions",
    "public.pulse_summaries",
    "public.monthly_summary_reads",
    "public.activity_invitations",
    "public.activity_invite_links",
    "public.activity_invitation_notifications",
    "public.user_blocks",
    "public.email_change_requests",
    "public.support_reports",
    "public.support_requests",
    "public.activity_cancellation_proposals",
    "public.activity_cancellation_votes",
    "public.activity_cancellation_vote_notifications",
    "public.activity_cancellation_acknowledgements",
    "public.activity_chat_messages",
    "public.activity_chat_message_views",
    "public.moderation_chat_reports",
    "public.moderation_user_status",
    "public.moderation_actions_log",
    "public.moderation_notifications",
    "public.admin_notifications_log",
    "public.user_notification_preferences",
    "public.user_notifications",
    "public.web_push_subscriptions",
];

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

function timestampSlug(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, "-");
}

function splitQualifiedTable(qualifiedTable) {
    const [schema, table] = qualifiedTable.split(".");
    if (!schema || !table) {
        throw new Error(`Nom de table invalide: ${qualifiedTable}`);
    }
    return { schema, table };
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, value) {
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fetchTableRows(supabase, qualifiedTable) {
    const { schema, table } = splitQualifiedTable(qualifiedTable);
    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .schema(schema)
            .from(table)
            .select("*")
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            throw new Error(`${qualifiedTable}: ${error.message}`);
        }

        const batch = Array.isArray(data) ? data : [];
        rows.push(...batch);

        if (batch.length < PAGE_SIZE) {
            break;
        }

        from += PAGE_SIZE;
    }

    return rows;
}

async function backupTables(supabase, backupDir) {
    const tablesDir = path.join(backupDir, "tables");
    await ensureDir(tablesDir);

    const summary = [];

    for (const qualifiedTable of TABLES) {
        const rows = await fetchTableRows(supabase, qualifiedTable);
        const fileName = qualifiedTable.replace(".", "__") + ".json";
        await writeJson(path.join(tablesDir, fileName), rows);
        summary.push({ table: qualifiedTable, rows: rows.length, file: path.join("tables", fileName) });
        console.log(`Sauvegarde table OK: ${qualifiedTable} (${rows.length} lignes)`);
    }

    return summary;
}

async function backupAuthUsers(supabase, backupDir) {
    const users = [];
    let page = 1;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage: AUTH_PAGE_SIZE,
        });

        if (error) {
            throw new Error(`auth.users: ${error.message}`);
        }

        const batch = Array.isArray(data?.users) ? data.users : [];
        users.push(...batch);

        if (batch.length < AUTH_PAGE_SIZE) {
            break;
        }

        page += 1;
    }

    const authDir = path.join(backupDir, "auth");
    await ensureDir(authDir);
    await writeJson(path.join(authDir, "users.json"), users);
    console.log(`Sauvegarde Auth OK: ${users.length} utilisateurs`);
    return { count: users.length, file: path.join("auth", "users.json") };
}

async function downloadAvatarFolder(supabase, backupDir, userId) {
    const { data, error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(userId, { limit: 100, offset: 0 });

    if (error) {
        throw new Error(`avatars/${userId}: ${error.message}`);
    }

    const files = Array.isArray(data) ? data.filter((item) => item && item.name && item.id) : [];
    const outputDir = path.join(backupDir, "storage", AVATAR_BUCKET, userId);
    await ensureDir(outputDir);

    const savedFiles = [];
    for (const file of files) {
        const objectPath = `${userId}/${file.name}`;
        const { data: blob, error: downloadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .download(objectPath);

        if (downloadError) {
            throw new Error(`${objectPath}: ${downloadError.message}`);
        }

        const arrayBuffer = await blob.arrayBuffer();
        const outputFile = path.join(outputDir, file.name);
        await fs.writeFile(outputFile, Buffer.from(arrayBuffer));
        savedFiles.push(path.join("storage", AVATAR_BUCKET, userId, file.name));
    }

    return savedFiles;
}

async function backupAvatarStorage(supabase, backupDir, profiles) {
    const profileIds = profiles
        .map((row) => (typeof row?.id === "string" ? row.id : ""))
        .filter(Boolean);

    const savedFiles = [];
    for (const userId of profileIds) {
        const files = await downloadAvatarFolder(supabase, backupDir, userId);
        if (files.length > 0) {
            console.log(`Sauvegarde avatars OK: ${userId} (${files.length} fichiers)`);
        }
        savedFiles.push(...files);
    }

    return { count: savedFiles.length, files: savedFiles };
}

async function main() {
    const supabase = createServiceRoleClient();
    const backupDir = path.join(process.cwd(), "backups", `supabase-${timestampSlug()}`);
    await ensureDir(backupDir);

    const tablesSummary = await backupTables(supabase, backupDir);
    const profilesSummary = tablesSummary.find((entry) => entry.table === "public.profiles");
    const profilesFile = profilesSummary ? path.join(backupDir, profilesSummary.file) : null;
    const profiles = profilesFile ? JSON.parse(await fs.readFile(profilesFile, "utf8")) : [];
    const authSummary = await backupAuthUsers(supabase, backupDir);
    const avatarSummary = await backupAvatarStorage(supabase, backupDir, profiles);

    const manifest = {
        created_at: new Date().toISOString(),
        supabase_url: SUPABASE_URL,
        tables: tablesSummary,
        auth: authSummary,
        storage: {
            bucket: AVATAR_BUCKET,
            ...avatarSummary,
        },
        limitations: [
            "Les mots de passe Auth ne sont pas exportables via l'API admin Supabase.",
            "Cette sauvegarde couvre les donnees metier, les metadonnees Auth et les fichiers d'avatars.",
            "Pour une restauration complete des comptes avec mot de passe, il faut un vrai dump Postgres/Auth cote Supabase.",
        ],
    };

    await writeJson(path.join(backupDir, "manifest.json"), manifest);

    console.log("");
    console.log(`Sauvegarde locale creee: ${backupDir}`);
    console.log("Fichier manifeste: backups/.../manifest.json");
    console.log("Important: les mots de passe utilisateurs ne peuvent pas etre restaures depuis cette sauvegarde.");
}

main().catch((error) => {
    console.error("Echec sauvegarde Supabase:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
