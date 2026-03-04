import { z } from "zod";

export const createActivitySchema = z.object({
    title: z.string()
        .min(2, "Le titre est trop court")
        .max(100, "Le titre ne doit pas dépasser 100 caractères"),
    sport: z.string().min(2, "Le sport est requis"),
    location: z.string().min(2, "La ville ou le lieu principal est requis"),
    address: z.string().optional(),
    level: z.string().min(1, "Le niveau est requis"),
    max_attendees: z.number().int().min(1, "Il faut au moins 1 place disponible"),
    gender_filter: z.enum(['mixte', 'filles', 'garçons']).default('mixte'),
    is_unlimited: z.boolean().default(false),
    status: z.enum(['ouvert', 'complet', 'confirmé', 'en_attente', 'passé', 'annulé']).default('ouvert'),
    start_time: z.string().datetime({ message: "Format de date invalide (doit être au format ISO)" }),
    end_time: z.string().datetime().optional(),

    // Nouveaux champs Phase 7
    variant: z.string().optional(),
    session_type: z.string().optional(),
    distance: z.number().positive().optional(),
    pace: z.number().positive().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    description: z.string().max(100, "L'ambiance ne doit pas dépasser 100 caractères").optional(),
    tags: z.array(z.string()).max(3, "Maximum 3 tags autorisés").optional()
});

export const updateActivitySchema = createActivitySchema.partial();

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
