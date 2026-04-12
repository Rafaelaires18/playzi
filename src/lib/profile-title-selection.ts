import { DEFAULT_PROFILE_TITLE_IDS, getSelectableProfileTitles } from "@/lib/titles";

export type ProfileTitleSelection = {
    primaryId: string;
    secondaryIds: string[];
    seasonalId: string | null;
};

type RawSelection = {
    primaryId?: unknown;
    secondaryIds?: unknown;
    seasonalId?: unknown;
};

function buildSelectionSets() {
    const selectableTitles = getSelectableProfileTitles();
    const regularTitles = selectableTitles.filter((title) => title.type !== "seasonal");
    const seasonalTitles = selectableTitles.filter((title) => title.type === "seasonal");
    const regularIdSet = new Set(regularTitles.map((title) => title.id));
    const seasonalIdSet = new Set(seasonalTitles.map((title) => title.id));
    const fallbackPrimaryId = regularTitles[0]?.id ?? DEFAULT_PROFILE_TITLE_IDS[0];
    return { regularIdSet, seasonalIdSet, fallbackPrimaryId };
}

export function normalizeProfileTitleSelection(raw: RawSelection | null | undefined): ProfileTitleSelection {
    const { regularIdSet, seasonalIdSet, fallbackPrimaryId } = buildSelectionSets();
    const rawPrimary = typeof raw?.primaryId === "string" ? raw.primaryId : fallbackPrimaryId;
    const primaryId = regularIdSet.has(rawPrimary) ? rawPrimary : fallbackPrimaryId;
    const rawSecondary = Array.isArray(raw?.secondaryIds) ? raw?.secondaryIds : [];
    const secondaryIds = rawSecondary
        .filter((id): id is string => typeof id === "string")
        .filter((id) => regularIdSet.has(id))
        .filter((id) => id !== primaryId)
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .slice(0, 2);
    const rawSeasonal = typeof raw?.seasonalId === "string" ? raw.seasonalId : null;
    const seasonalId = rawSeasonal && seasonalIdSet.has(rawSeasonal) ? rawSeasonal : null;
    return { primaryId, secondaryIds, seasonalId };
}

export function parseSelectionFromProfileRow(row: {
    primary_title_id?: string | null;
    secondary_title_ids?: string[] | null;
    seasonal_title_id?: string | null;
}): ProfileTitleSelection {
    return normalizeProfileTitleSelection({
        primaryId: row.primary_title_id || undefined,
        secondaryIds: row.secondary_title_ids || undefined,
        seasonalId: row.seasonal_title_id || undefined,
    });
}

export function toProfileSelectionColumns(selection: ProfileTitleSelection) {
    return {
        primary_title_id: selection.primaryId,
        secondary_title_ids: selection.secondaryIds,
        seasonal_title_id: selection.seasonalId,
    };
}

export function isSameProfileTitleSelection(a: ProfileTitleSelection, b: ProfileTitleSelection) {
    if (a.primaryId !== b.primaryId) return false;
    if (a.seasonalId !== b.seasonalId) return false;
    if (a.secondaryIds.length !== b.secondaryIds.length) return false;
    return a.secondaryIds.every((id, index) => id === b.secondaryIds[index]);
}
