import { createSuccessResponse } from "@/lib/types/api";
import { getWebPushPublicKey } from "@/lib/web-push";

export async function GET() {
    const publicKey = getWebPushPublicKey();
    return createSuccessResponse({ publicKey: publicKey || null }, 200);
}
