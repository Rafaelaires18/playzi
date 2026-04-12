import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getModerationServiceClient, getModeratorAccessDebug, isModeratorUser } from "@/lib/moderation";

const ADULT_MIN_AGE = 18;

const getSchema = z.object({
    user_id: z.string().uuid(),
});

const patchSchema = z.object({
    user_id: z.string().uuid(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    age_verification_status: z.enum(["verified_adult", "blocked_minor", "non_verified"]).optional(),
});

function parseBirthDate(raw: string) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return null;
    return date;
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

function toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function mapAgeStatus(value: string | null | undefined) {
    if (value === "verified_adult") return "verified_adult";
    if (value === "blocked_minor") return "blocked_minor";
    return "non_verified";
}

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
        const parsed = getSchema.safeParse(searchParams);
        if (!parsed.success) {
            return createErrorResponse("Paramètres invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const { user_id } = parsed.data;
        const { data: profile, error } = await db
            .from("profiles")
            .select("id,pseudo,birth_date,age_verification_status,age_verified_at")
            .eq("id", user_id)
            .maybeSingle();

        if (error) return createErrorResponse("Impossible de charger le profil", 400, error.message);
        if (!profile) return createErrorResponse("Profil introuvable", 404);

        return createSuccessResponse({
            user_id: profile.id,
            pseudo: profile.pseudo || "Utilisateur",
            birth_date: profile.birth_date || null,
            age_verification_status: mapAgeStatus(profile.age_verification_status),
            age_verified_at: profile.age_verified_at || null,
        }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors du chargement du profil",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const supabase = await createClient();
        const db = getModerationServiceClient() ?? supabase;
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();
        if (authErr || !user) return createErrorResponse("Non authentifié", 401);

        const allowed = await isModeratorUser(supabase, user);
        if (!allowed) {
            const debug = await getModeratorAccessDebug(supabase as never, user as never);
            return createErrorResponse("Accès admin refusé", 403, debug);
        }

        const payload = await req.json().catch(() => null);
        const parsed = patchSchema.safeParse(payload);
        if (!parsed.success) {
            return createErrorResponse("Données invalides", 400, parsed.error.flatten().fieldErrors);
        }

        const { user_id, birth_date, age_verification_status } = parsed.data;
        if (!birth_date && !age_verification_status) {
            return createErrorResponse("Aucune modification fournie.", 400);
        }

        const updatePayload: Record<string, unknown> = {};
        let computedAgeYears: number | null = null;
        let computedStatus: "verified_adult" | "blocked_minor" | "pending" | null = null;

        if (birth_date) {
            const birthDateObj = parseBirthDate(birth_date);
            if (!birthDateObj) return createErrorResponse("Date de naissance invalide.", 400);

            const todayIso = toIsoDate(new Date());
            if (birth_date > todayIso) {
                return createErrorResponse("La date de naissance ne peut pas être dans le futur.", 400);
            }

            computedAgeYears = computeAgeYears(birthDateObj);
            computedStatus = computedAgeYears >= ADULT_MIN_AGE ? "verified_adult" : "blocked_minor";
            updatePayload.birth_date = birth_date;
            updatePayload.age_verification_status = computedStatus;
            updatePayload.age_verified_at = new Date().toISOString();
        } else if (age_verification_status) {
            const mapped = age_verification_status === "non_verified" ? "pending" : age_verification_status;
            computedStatus = mapped;
            updatePayload.age_verification_status = mapped;
            updatePayload.age_verified_at = mapped === "pending" ? null : new Date().toISOString();
        }

        const { data: updated, error } = await db
            .from("profiles")
            .update(updatePayload)
            .eq("id", user_id)
            .select("id,pseudo,birth_date,age_verification_status,age_verified_at")
            .maybeSingle();

        if (error) return createErrorResponse("Impossible de mettre à jour le profil", 400, error.message);
        if (!updated) return createErrorResponse("Profil introuvable", 404);

        return createSuccessResponse({
            user_id: updated.id,
            pseudo: updated.pseudo || "Utilisateur",
            birth_date: updated.birth_date || null,
            age_verification_status: mapAgeStatus(updated.age_verification_status),
            age_verified_at: updated.age_verified_at || null,
            age_years: computedAgeYears,
        }, 200);
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors de la mise à jour",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
