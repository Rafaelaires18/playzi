import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildPulseEventKey, recordPulseTransaction } from "@/lib/pulse";

type SummaryLine = {
    reason_code?: string;
    reason_label?: string;
    signed_points?: number;
    claim_state?: "pending" | "applied";
};

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const body = await req.json().catch(() => null);
        const activityId = typeof body?.activity_id === "string" ? body.activity_id : null;
        if (!activityId) {
            return createErrorResponse("activity_id requis", 400);
        }

        const { data: summary, error: summaryErr } = await supabase
            .from("pulse_summaries")
            .select("activity_id,user_id,total_points,breakdown,created_at")
            .eq("activity_id", activityId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (summaryErr) {
            return createErrorResponse("Impossible de charger le résumé Pulse", 400, summaryErr.message);
        }
        if (!summary) {
            return createErrorResponse("Résumé Pulse introuvable", 404);
        }

        const lines = (Array.isArray(summary.breakdown) ? summary.breakdown : []) as SummaryLine[];
        const pendingPositive = lines.filter((line) => Number(line.signed_points || 0) > 0 && line.claim_state === "pending");

        if (pendingPositive.length === 0) {
            return createSuccessResponse({ claimed: false, reason: "nothing_to_claim" }, 200);
        }

        for (let i = 0; i < pendingPositive.length; i += 1) {
            const line = pendingPositive[i];
            await recordPulseTransaction(supabase, {
                userId: user.id,
                activityId,
                sourceType: "pulse_claim",
                points: Number(line.signed_points || 0),
                reasonCode: String(line.reason_code || "pulse_claim"),
                reasonLabel: String(line.reason_label || "Pulse récupérés"),
                uniqueEventKey: buildPulseEventKey(["pulse_claim", activityId, user.id, String(line.reason_code || "line"), String(i)]),
                metadata: {
                    claimed_at: new Date().toISOString(),
                },
            });
        }

        const updatedBreakdown = lines.map((line) => {
            if (Number(line.signed_points || 0) > 0 && line.claim_state === "pending") {
                return { ...line, claim_state: "applied" as const };
            }
            return line;
        });

        const { error: updateErr } = await supabase
            .from("pulse_summaries")
            .update({ breakdown: updatedBreakdown })
            .eq("activity_id", activityId)
            .eq("user_id", user.id);

        if (updateErr) {
            return createErrorResponse("Claim effectué mais résumé non mis à jour", 400, updateErr.message);
        }

        return createSuccessResponse(
            {
                claimed: true,
                claimed_points: pendingPositive.reduce((sum, line) => sum + Number(line.signed_points || 0), 0),
            },
            200
        );
    } catch (error) {
        return createErrorResponse(
            "Erreur interne",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
