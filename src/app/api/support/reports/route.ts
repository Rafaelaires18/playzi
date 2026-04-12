import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/pulse";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

const SUPPORT_REPORT_BUCKET = "support-reports";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const CATEGORY_LABEL_TO_CODE = {
    Bug: "bug",
    Abus: "abuse",
    Paiement: "payment",
    Autre: "other",
} as const;

type SupportCategoryCode = (typeof CATEGORY_LABEL_TO_CODE)[keyof typeof CATEGORY_LABEL_TO_CODE];

function normalizeCategory(value: string): SupportCategoryCode | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed in CATEGORY_LABEL_TO_CODE) {
        return CATEGORY_LABEL_TO_CODE[trimmed as keyof typeof CATEGORY_LABEL_TO_CODE];
    }
    const lower = trimmed.toLowerCase();
    if (lower === "bug" || lower === "abuse" || lower === "payment" || lower === "other") {
        return lower;
    }
    return null;
}

function extensionFromMime(mime: string) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
}

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "support:reports:create", user.id),
            { limit: 20, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const formData = await req.formData();
        const rawCategory = String(formData.get("category") || "");
        const description = String(formData.get("description") || "").trim();
        const maybeFile = formData.get("file");

        const category = normalizeCategory(rawCategory);
        if (!category) {
            return createErrorResponse("Catégorie invalide", 400);
        }
        if (!description) {
            return createErrorResponse("La description est obligatoire", 400);
        }
        if (description.length > 2000) {
            return createErrorResponse("La description est trop longue (max 2000 caractères)", 400);
        }

        let imageUrl: string | null = null;

        if (maybeFile instanceof File) {
            if (!ALLOWED_MIME.has(maybeFile.type)) {
                return createErrorResponse("Format image non autorisé (jpg, png, webp)", 400);
            }
            if (maybeFile.size > MAX_FILE_SIZE) {
                return createErrorResponse("Image trop volumineuse (max 8MB)", 400);
            }

            const serviceRoleClient = createServiceRoleClient();
            if (!serviceRoleClient) {
                return createErrorResponse("Configuration serveur incomplète", 500);
            }

            const { data: buckets } = await serviceRoleClient.storage.listBuckets();
            const bucketExists = (buckets || []).some((bucket) => bucket.name === SUPPORT_REPORT_BUCKET);
            if (!bucketExists) {
                await serviceRoleClient.storage.createBucket(SUPPORT_REPORT_BUCKET, {
                    public: true,
                    fileSizeLimit: `${MAX_FILE_SIZE}`,
                    allowedMimeTypes: Array.from(ALLOWED_MIME),
                });
            }

            const extension = extensionFromMime(maybeFile.type);
            const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
            const buffer = new Uint8Array(await maybeFile.arrayBuffer());

            const { error: uploadError } = await serviceRoleClient.storage
                .from(SUPPORT_REPORT_BUCKET)
                .upload(path, buffer, {
                    contentType: maybeFile.type,
                    upsert: false,
                    cacheControl: "3600",
                });

            if (uploadError) {
                return createErrorResponse("Impossible d'envoyer la pièce jointe", 400, uploadError.message);
            }

            const { data: publicData } = serviceRoleClient.storage
                .from(SUPPORT_REPORT_BUCKET)
                .getPublicUrl(path);

            imageUrl = publicData.publicUrl;
        }

        const { data: inserted, error: insertError } = await supabase
            .from("support_reports")
            .insert({
                user_id: user.id,
                category,
                description,
                image_url: imageUrl,
                status: "new",
            })
            .select("id,category,status,created_at")
            .single();

        if (insertError || !inserted) {
            return createErrorResponse("Impossible d'envoyer le signalement", 400, insertError?.message);
        }

        return createSuccessResponse(
            {
                report: inserted,
                message: "Votre signalement a bien été envoyé.",
            },
            201
        );
    } catch (error) {
        return createErrorResponse(
            "Erreur interne lors de l'envoi du signalement",
            500,
            error instanceof Error ? error.message : "Erreur inconnue"
        );
    }
}
