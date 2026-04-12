import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { isSameOriginRequest } from "@/lib/security/request";
import { forbiddenOriginResponse } from "@/lib/security/response";

const ADULT_MIN_AGE = 18;

function parseBirthDate(raw: unknown): Date | null {
    if (typeof raw !== "string") return null;
    const value = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return null;
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
            .select("age_verification_status")
            .eq("id", user.id)
            .maybeSingle();

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

        const { error: updateError } = await supabase
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
