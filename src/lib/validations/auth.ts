import { z } from "zod";
import { isPasswordCompositionValid } from "@/lib/password-rules";

export const genderSchema = z.enum(["male", "female", "other"], {
    message: "Le genre doit être 'male', 'female' ou 'other'"
});

export const passwordSchema = z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe ne peut pas dépasser 128 caractères")
    .refine(
        (value) => isPasswordCompositionValid(value),
        "Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial (ex: ! ? . , : ; @ #)"
    );

export const loginSchema = z.object({
    email: z.string().email("L'adresse email est invalide"),
    password: z.string().min(1, "Le mot de passe est requis")
});

export const registerSchema = z.object({
    first_name: z.string().min(2, "Le prénom doit contenir au moins 2 caractères").max(40, "Le prénom ne peut pas dépasser 40 caractères"),
    last_name: z.string().min(2, "Le nom doit contenir au moins 2 caractères").max(40, "Le nom ne peut pas dépasser 40 caractères"),
    email: z.string().email("L'adresse email est invalide"),
    password: passwordSchema,
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
        .regex(/^[a-zA-Z0-9_]+$/, "Le pseudo ne peut contenir que des lettres, chiffres et underscores"),
    gender: genderSchema,
    accepted_terms: z.literal(true, {
        message: "Tu dois accepter les conditions pour continuer.",
    }),
    marketing_opt_in: z.boolean().optional().default(false),
});

export const updateAccountSchema = z.object({
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
        .regex(/^[a-zA-Z0-9_]+$/, "Le pseudo ne peut contenir que des lettres, chiffres et underscores"),
    first_name: z.string()
        .min(2, "Le prénom doit contenir au moins 2 caractères")
        .max(40, "Le prénom ne peut pas dépasser 40 caractères")
        .optional(),
    last_name: z.string()
        .min(2, "Le nom doit contenir au moins 2 caractères")
        .max(40, "Le nom ne peut pas dépasser 40 caractères")
        .optional(),
});

export const requestEmailChangeSchema = z.object({
    new_email: z.string().email("L'adresse email est invalide"),
    current_password: z.string().min(1, "Le mot de passe actuel est requis"),
});

export const changePasswordSchema = z.object({
    current_password: z.string().min(1, "Le mot de passe actuel est requis"),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "La confirmation du mot de passe est requise")
}).refine((data) => data.new_password === data.confirm_password, {
    message: "La confirmation du nouveau mot de passe ne correspond pas",
    path: ["confirm_password"]
});

export const updatePrivacySchema = z.object({
    approximate_location: z.boolean(),
});

export const updateConsentsSchema = z.object({
    accepted_terms: z.literal(true, {
        message: "Tu dois accepter les conditions pour continuer.",
    }),
    marketing_opt_in: z.boolean().optional().default(false),
});

export const deleteAccountSchema = z.object({
    password: z.string().min(1, "Le mot de passe est requis"),
    confirm_text: z.literal("SUPPRIMER", "Saisissez SUPPRIMER pour confirmer."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type GenderInput = z.infer<typeof genderSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type RequestEmailChangeInput = z.infer<typeof requestEmailChangeSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePrivacyInput = z.infer<typeof updatePrivacySchema>;
export type UpdateConsentsInput = z.infer<typeof updateConsentsSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
