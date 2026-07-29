import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { isSameOriginRequest } from "@/lib/security/request";
import { forbiddenOriginResponse } from "@/lib/security/response";
import { createServiceRoleClient } from "@/lib/pulse";
import type { User } from "@supabase/supabase-js";

const ADULT_MIN_AGE = 18;

function parseBirthDate(raw: unknown): Date | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return null;
    if (date.toISOString().slice(0, 10) !== value) return null;
    return date;
}

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function computeAgeYears(birthDate: Date, now = new Date()): number {
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const nowMonth = now.getUTCMonth();
    const birthMonth = birthDate.getUTCMonth();
    if (
        nowMonth < birthMonth
        || (nowMonth === birthMonth && now.getUTCDate() < birthDate.getUTCDate())
    ) {
        age -= 1;
    }
    return age;
}

function normalizePseudoBase(value: string | null | undefined) {
    const normalized = String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9_]/g, "")
        .trim();
    return normalized || "joueur";
}

async function buildUniquePseudo(base: string) {
    const db = createServiceRoleClient();
    if (!db) return base;

    let candidate = base;
    for (let counter = 0; counter < 50; counter += 1) {
        const { data } = await db
            .from("profiles")
            .select("id")
            .ilike("pseudo", candidate)
            .limit(1);

        if (!data || data.length === 0) return candidate;
        candidate = `${base}${counter + 1}`;
    }

    return `${base}${Date.now().toString(36)}`;
}

async function repairMissingProfile(user: User) {
    const db = createServiceRoleClient();
    if (!db) {
        throw new Error("Profil supprimé: service role manquante pour réparer le compte.");
    }

    const metadata = (user.user_metadata || {}) as Record<string, unknown>;
    const basePseudo = normalizePseudoBase(
        typeof metadata.pseudo === "string"
            ? metadata.pseudo
            : typeof metadata.name === "string"
                ? metadata.name
                : user.email?.split("@")[0]
    );
    const pseudo = await buildUniquePseudo(basePseudo);
    const firstName = typeof metadata.first_name === "string" && metadata.first_name.trim()
        ? metadata.first_name.trim()
        : "Utilisateur";
    const lastName = typeof metadata.last_name === "string" && metadata.last_name.trim()
        ? metadata.last_name.trim()
        : "";

    const { error } = await db
        .from("profiles")
        .insert({
            id: user.id,
            pseudo,
            gender: null,
            first_name: firstName,
            last_name: lastName,
        });

    if (error && error.code !== "23505") {
        throw new Error(error.message);
    }
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("birth_date,age_verification_status,age_verified_at")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            return createErrorResponse("Impossible de charger le statut d'âge", 400, profileError.message);
        }

        const status = String(profile?.age_verification_status || "pending");
        return createSuccessResponse(
            {
                status,
                birth_date: profile?.birth_date || null,
                age_verified_at: profile?.age_verified_at || null,
                is_adult_verified: status === "verified_adult",
                is_blocked_minor: status === "blocked_minor",
                requires_verification: status === "pending",
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) return forbiddenOriginResponse();

        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return createErrorResponse("Non authentifié", 401);

        const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id,age_verification_status")
            .eq("id", user.id)
            .maybeSingle();

        if (!existingProfile) {
            await repairMissingProfile(user);
        }

        const currentStatus = String(existingProfile?.age_verification_status || "pending");
        if (currentStatus === "blocked_minor") {
            return createErrorResponse("Playzi est réservé aux personnes de 18 ans et plus.", 403, {
                code: "minor_blocked",
            });
        }

        const body = await req.json().catch(() => null);
        const birthDate = parseBirthDate(body?.birth_date);
        if (!birthDate) {
            return createErrorResponse("Date de naissance invalide (format attendu: YYYY-MM-DD).", 400);
        }

        const today = new Date();
        const todayIso = toIsoDate(today);
        const birthIso = toIsoDate(birthDate);
        if (birthIso > todayIso) {
            return createErrorResponse("La date de naissance ne peut pas être dans le futur.", 400);
        }

        const ageYears = computeAgeYears(birthDate, today);
        const isAdult = ageYears >= ADULT_MIN_AGE;
        const nextStatus = isAdult ? "verified_adult" : "blocked_minor";

        const db = createServiceRoleClient() || supabase;
        const { error: updateError } = await db
            .from("profiles")
            .update({
                birth_date: birthIso,
                age_verification_status: nextStatus,
                age_verified_at: new Date().toISOString(),
            })
            .eq("id", user.id);

        if (updateError) {
            return createErrorResponse("Impossible d'enregistrer la vérification d'âge", 400, updateError.message);
        }

        if (!isAdult) {
            return createErrorResponse("Playzi est réservé aux personnes de 18 ans et plus.", 403, {
                code: "minor_blocked",
                age_years: ageYears,
            });
        }

        return createSuccessResponse(
            {
                status: "verified_adult",
                age_years: ageYears,
            },
            200
        );
    } catch (e) {
        return createErrorResponse("Erreur interne", 500, e instanceof Error ? e.message : "Erreur inconnue");
    }
}
