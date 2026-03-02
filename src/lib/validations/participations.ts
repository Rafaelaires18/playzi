import { z } from "zod";

export const joinActivitySchema = z.object({
    activity_id: z.string().uuid("L'ID de l'activité est invalide"),
});

export type JoinActivityInput = z.infer<typeof joinActivitySchema>;
