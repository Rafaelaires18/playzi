import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/types/api";
import { buildRateLimitKey, isSameOriginRequest } from "@/lib/security/request";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { forbiddenOriginResponse, tooManyRequestsResponse } from "@/lib/security/response";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_EXTENSION_BY_MIME: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};

function extensionFromMime(mime: string) {
    return AVATAR_EXTENSION_BY_MIME[mime] || "jpg";
}

export async function POST(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "profile:avatar:upload", user.id),
            { limit: 30, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const formData = await req.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return createErrorResponse("Fichier manquant", 400);
        }
        if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
            return createErrorResponse("Format image non autorisé (jpg, png, webp)", 400);
        }
        if (file.size > MAX_AVATAR_SIZE_BYTES) {
            return createErrorResponse("Image trop volumineuse (max 5MB)", 400);
        }

        const extension = extensionFromMime(file.type);
        const filePath = `${user.id}/avatar-${Date.now()}.${extension}`;
        const arrayBuffer = await file.arrayBuffer();
        const payload = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from(AVATAR_BUCKET)
            .upload(filePath, payload, {
                cacheControl: "3600",
                upsert: true,
                contentType: file.type
            });

        if (uploadError) {
            return createErrorResponse("Upload avatar impossible", 400);
        }

        const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
        const avatarUrl = publicData.publicUrl;

        const { error: profileError } = await supabase
            .from("profiles")
            .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
            .eq("id", user.id);

        if (profileError) {
            return createErrorResponse("Impossible de sauvegarder l'avatar", 400);
        }

        // Best effort sync on auth metadata for places still reading user_metadata.
        await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl }
        });

        return createSuccessResponse({ avatar_url: avatarUrl }, 200);
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de l'upload de l'avatar",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        if (!isSameOriginRequest(req)) {
            return forbiddenOriginResponse();
        }
        const supabase = await createClient();
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return createErrorResponse("Non authentifié", 401);
        }

        const rate = checkRateLimit(
            buildRateLimitKey(req, "profile:avatar:delete", user.id),
            { limit: 30, windowMs: 60 * 60 * 1000 }
        );
        if (!rate.allowed) {
            return tooManyRequestsResponse(Math.ceil(rate.retryAfterMs / 1000));
        }

        const { data: files } = await supabase.storage
            .from(AVATAR_BUCKET)
            .list(user.id, { limit: 100, offset: 0 });

        if (files && files.length > 0) {
            const paths = files.map((file) => `${user.id}/${file.name}`);
            await supabase.storage.from(AVATAR_BUCKET).remove(paths);
        }

        const { error: profileError } = await supabase
            .from("profiles")
            .update({ avatar_url: null, updated_at: new Date().toISOString() })
            .eq("id", user.id);

        if (profileError) {
            return createErrorResponse("Impossible de supprimer l'avatar", 400);
        }

        await supabase.auth.updateUser({
            data: { avatar_url: null }
        });

        return createSuccessResponse({ avatar_url: null }, 200);
    } catch (e) {
        return createErrorResponse(
            "Erreur interne lors de la suppression de l'avatar",
            500,
            e instanceof Error ? e.message : "Erreur inconnue"
        );
    }
}
