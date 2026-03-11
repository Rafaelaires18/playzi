import { canAuthorizedMemberViewExactLocation } from "@/lib/activity-rules";

type ActivityParticipation = {
    user_id?: string | null;
    status?: string | null;
};

type ActivityLike = {
    creator_id?: string | null;
    location?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    public_location?: string | null;
    public_lat?: number | null;
    public_lng?: number | null;
    exact_address?: string | null;
    exact_lat?: number | null;
    exact_lng?: number | null;
    participations?: ActivityParticipation[] | null;
    [key: string]: unknown;
};

function roundToApprox(value?: number | null) {
    if (typeof value !== "number" || Number.isNaN(value)) return null;
    return Number(value.toFixed(2));
}

function hasConfirmedParticipation(activity: ActivityLike, viewerId?: string | null) {
    if (!viewerId) return false;
    const participations = Array.isArray(activity.participations) ? activity.participations : [];
    return participations.some((p) => p.user_id === viewerId && p.status === "confirmé");
}

export function canViewExactActivityLocation(activity: ActivityLike, viewerId?: string | null) {
    if (!viewerId) return false;
    const isCreator = activity.creator_id === viewerId;
    const isConfirmedParticipant = hasConfirmedParticipation(activity, viewerId);
    if (!isCreator && !isConfirmedParticipant) return false;
    return canAuthorizedMemberViewExactLocation(
        {
            sport: activity.sport as string | null | undefined,
            status: activity.status as string | null | undefined,
            start_time: activity.start_time as string | null | undefined,
            max_attendees: activity.max_attendees as number | null | undefined,
            attendees: activity.attendees as number | null | undefined,
        },
        Date.now()
    );
}

export function sanitizeActivityLocationForViewer<T extends ActivityLike>(activity: T, viewerId?: string | null) {
    const exactAllowed = canViewExactActivityLocation(activity, viewerId);

    if (exactAllowed) {
        return {
            ...activity,
            address: activity.exact_address ?? activity.address ?? null,
            lat: activity.exact_lat ?? activity.lat ?? null,
            lng: activity.exact_lng ?? activity.lng ?? null,
            location_visibility: "exact" as const,
        };
    }

    const publicLocation = (activity.public_location || activity.location || "Zone communiquée après confirmation").trim();
    const publicLat = activity.public_lat ?? roundToApprox(activity.lat);
    const publicLng = activity.public_lng ?? roundToApprox(activity.lng);

    return {
        ...activity,
        location: publicLocation,
        address: null,
        lat: publicLat,
        lng: publicLng,
        location_visibility: "public" as const,
    };
}
