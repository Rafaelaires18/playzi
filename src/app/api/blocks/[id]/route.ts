import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: blockedUserId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return createErrorResponse("Non authentifié", 401);

    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_user_id", user.id)
      .eq("blocked_user_id", blockedUserId);

    if (error) {
      return createErrorResponse("Impossible de débloquer cet utilisateur", 400, error.message);
    }

    return createSuccessResponse({ unblocked: true }, 200);
  } catch (e) {
    return createErrorResponse(
      "Erreur interne lors du déblocage",
      500,
      e instanceof Error ? e.message : "Erreur inconnue"
    );
  }
}
