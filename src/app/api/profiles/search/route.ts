import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { getBlockedUserIdsForUser } from "@/lib/blocks";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return createErrorResponse("Non authentifié", 401);

    const query = String(new URL(req.url).searchParams.get("q") || "").trim();
    if (query.length < 2) return createSuccessResponse({ profiles: [] }, 200);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,pseudo,first_name,last_name,gender")
      .ilike("pseudo", `%${query}%`)
      .neq("id", user.id)
      .order("pseudo", { ascending: true })
      .limit(12);

    if (error) {
      return createErrorResponse("Impossible de rechercher des profils", 400, error.message);
    }

    const blockedIds = await getBlockedUserIdsForUser(supabase as never, user.id);
    const profiles = (data || [])
      .filter((row) => !blockedIds.has(String(row.id || "")))
      .map((row) => ({
      id: row.id,
      pseudo: row.pseudo || "utilisateur",
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      gender: row.gender || null,
    }));

    return createSuccessResponse({ profiles }, 200);
  } catch (e) {
    return createErrorResponse(
      "Erreur interne lors de la recherche de profils",
      500,
      e instanceof Error ? e.message : "Erreur inconnue"
    );
  }
}
