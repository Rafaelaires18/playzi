import type { SupabaseClient } from "@supabase/supabase-js";

type BlockRow = {
  blocker_user_id: string;
  blocked_user_id: string;
};

function isMissingBlocksTableError(error: { code?: string | null; message?: string | null } | null | undefined) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("user_blocks");
}

export async function getBlockedUserIdsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(`blocker_user_id.eq.${userId},blocked_user_id.eq.${userId}`);

  if (error) {
    if (isMissingBlocksTableError(error)) {
      return new Set();
    }
    throw error;
  }

  const ids = new Set<string>();
  for (const row of (data || []) as BlockRow[]) {
    if (row.blocker_user_id === userId && row.blocked_user_id) {
      ids.add(row.blocked_user_id);
    } else if (row.blocked_user_id === userId && row.blocker_user_id) {
      ids.add(row.blocker_user_id);
    }
  }
  return ids;
}

export async function areUsersBlockedEitherWay(
  supabase: SupabaseClient,
  userA: string,
  userB: string
): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false;

  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocker_user_id,blocked_user_id")
    .or(
      `and(blocker_user_id.eq.${userA},blocked_user_id.eq.${userB}),and(blocker_user_id.eq.${userB},blocked_user_id.eq.${userA})`
    )
    .limit(1);

  if (error) {
    if (isMissingBlocksTableError(error)) {
      return false;
    }
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}
