import { z } from "zod";

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export const passwordSchema = z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(128, "Le mot de passe ne peut pas dépasser 128 caractères")
    .regex(
        PASSWORD_COMPLEXITY_REGEX,
        "Le mot de passe doit contenir au moins une majuscule, un chiffre et un caractère spécial"
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
    gender: z.string().refine(val => val === "male" || val === "female", {
        message: "Le genre doit être 'male' ou 'female'"
    })
});

export const updateAccountSchema = z.object({
    pseudo: z.string()
        .min(2, "Le pseudo doit contenir au moins 2 caractères")
        .max(20, "Le pseudo ne peut pas dépasser 20 caractères")
        .regex(/^[a-zA-Z0-9_]+$/, "Le pseudo ne peut contenir que des lettres, chiffres et underscores"),
    email: z.string().email("L'adresse email est invalide")
});

export const changePasswordSchema = z.object({
    current_password: z.string().min(1, "Le mot de passe actuel est requis"),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "La confirmation du mot de passe est requise")
}).refine((data) => data.new_password === data.confirm_password, {
    message: "La confirmation du nouveau mot de passe ne correspond pas",
    path: ["confirm_password"]
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
