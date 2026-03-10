import { createErrorResponse } from "@/lib/types/api";

export function tooManyRequestsResponse(retryAfterSeconds: number) {
    return createErrorResponse(
        "Trop de tentatives. Réessaie dans quelques instants.",
        429,
        { retry_after_seconds: retryAfterSeconds }
    );
}

export function forbiddenOriginResponse() {
    return createErrorResponse("Requête non autorisée.", 403);
}
