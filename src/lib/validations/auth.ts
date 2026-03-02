import { z } from "zod";

export const loginSchema = z.object({
    email: z.string().email("L'adresse email est invalide"),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères")
});

export const registerSchema = z.object({
    email: z.string().email("L'adresse email est invalide"),
    password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
        .regex(/^[a-zA-Z0-9_.-]+$/, "Le pseudo ne peut contenir que des lettres, chiffres, tirets, underscores et points"),
    gender: z.string().refine(val => val === "male" || val === "female", {
        message: "Le genre doit être 'male' ou 'female'"
    })
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
