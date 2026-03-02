export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    details?: any;
    status: number;
}

export function createErrorResponse(message: string, status: number = 400, details?: any): Response {
    return Response.json(
        { error: message, ...(details ? { details } : {}) },
        { status }
    );
}

export function createSuccessResponse<T>(data: T, status: number = 200): Response {
    return Response.json(
        { data },
        { status }
    );
}
