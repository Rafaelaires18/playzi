import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

type BlockedProfile = {
  id: string;
  pseudo: string | null;
  first_name: string | null;
  last_name: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return createErrorResponse("Non authentifié", 401);

    const { data: rows, error } = await supabase
      .from("user_blocks")
      .select("blocked_user_id,created_at")
      .eq("blocker_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return createErrorResponse("Impossible de charger les utilisateurs bloqués", 400, error.message);
    }

    const blockedIds = (rows || []).map((row) => String(row.blocked_user_id || "")).filter(Boolean);
    if (blockedIds.length === 0) {
      return createSuccessResponse({ blocked_users: [] }, 200);
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,pseudo,first_name,last_name")
      .in("id", blockedIds);

    const profileById = new Map<string, BlockedProfile>(
      ((profiles || []) as BlockedProfile[]).map((profile) => [profile.id, profile])
    );

    const blockedUsers = blockedIds
      .map((blockedId) => {
        const profile = profileById.get(blockedId);
        if (!profile) return null;
        return {
          id: blockedId,
          pseudo: profile.pseudo || "utilisateur",
          first_name: profile.first_name,
          last_name: profile.last_name,
        };
      })
      .filter((row): row is NonNullable<typeof row> => !!row);

    return createSuccessResponse({ blocked_users: blockedUsers }, 200);
  } catch (e) {
    return createErrorResponse(
      "Erreur interne lors du chargement des blocages",
      500,
      e instanceof Error ? e.message : "Erreur inconnue"
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return createErrorResponse("Non authentifié", 401);

    const body = await req.json().catch(() => null);
    const targetUserId = typeof body?.target_user_id === "string" ? body.target_user_id : "";

    if (!targetUserId) return createErrorResponse("target_user_id requis", 400);
    if (targetUserId === user.id) return createErrorResponse("Action impossible", 400);

    const { error: insertError } = await supabase
      .from("user_blocks")
      .upsert(
        {
          blocker_user_id: user.id,
          blocked_user_id: targetUserId,
          created_at: new Date().toISOString(),
        },
        { onConflict: "blocker_user_id,blocked_user_id" }
      );

    if (insertError) {
      return createErrorResponse("Impossible d'appliquer le blocage", 400, insertError.message);
    }

    const userA = user.id < targetUserId ? user.id : targetUserId;
    const userB = user.id < targetUserId ? targetUserId : user.id;

    await Promise.all([
      supabase.from("user_connections").delete().eq("user_a", userA).eq("user_b", userB),
      supabase
        .from("connection_requests")
        .delete()
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`
        ),
    ]);

    return createSuccessResponse({ blocked: true }, 200);
  } catch (e) {
    return createErrorResponse(
      "Erreur interne lors du blocage",
      500,
      e instanceof Error ? e.message : "Erreur inconnue"
    );
  }
}
