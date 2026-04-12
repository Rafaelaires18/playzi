import type { SupabaseClient } from "@supabase/supabase-js";
import { areUsersBlockedEitherWay } from "@/lib/blocks";

function intersectionExists(a: Set<string>, b: Set<string>) {
  for (const item of a) {
    if (b.has(item)) return true;
  }
  return false;
}

export async function canViewerAccessTargetProfile(
  supabase: SupabaseClient,
  viewerUserId: string,
  targetUserId: string
): Promise<boolean> {
  if (!viewerUserId || !targetUserId) return false;
  if (viewerUserId === targetUserId) return true;

  const usersBlocked = await areUsersBlockedEitherWay(supabase, viewerUserId, targetUserId);
  if (usersBlocked) return false;

  const canonicalA = viewerUserId < targetUserId ? viewerUserId : targetUserId;
  const canonicalB = viewerUserId < targetUserId ? targetUserId : viewerUserId;

  const { data: connection } = await supabase
    .from("user_connections")
    .select("id")
    .eq("user_a", canonicalA)
    .eq("user_b", canonicalB)
    .maybeSingle();

  if (connection?.id) return true;

  const [
    { data: viewerParticipations },
    { data: targetParticipations },
    { data: viewerCreated },
    { data: targetCreated },
  ] = await Promise.all([
    supabase
      .from("participations")
      .select("activity_id")
      .eq("user_id", viewerUserId)
      .eq("status", "confirmé"),
    supabase
      .from("participations")
      .select("activity_id")
      .eq("user_id", targetUserId)
      .eq("status", "confirmé"),
    supabase.from("activities").select("id").eq("creator_id", viewerUserId),
    supabase.from("activities").select("id").eq("creator_id", targetUserId),
  ]);

  const viewerActivityIds = new Set<string>([
    ...((viewerParticipations || []).map((row) => String(row.activity_id || "")).filter(Boolean)),
    ...((viewerCreated || []).map((row) => String(row.id || "")).filter(Boolean)),
  ]);

  const targetActivityIds = new Set<string>([
    ...((targetParticipations || []).map((row) => String(row.activity_id || "")).filter(Boolean)),
    ...((targetCreated || []).map((row) => String(row.id || "")).filter(Boolean)),
  ]);

  return intersectionExists(viewerActivityIds, targetActivityIds);
}
