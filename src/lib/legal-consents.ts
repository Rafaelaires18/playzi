export const CURRENT_LEGAL_VERSION = 1;

export type LegalConsentLike = {
  accepted_terms?: boolean | null;
  accepted_terms_at?: string | null;
  accepted_legal_version?: number | null;
};

export function hasAcceptedCurrentLegalVersion(profile: LegalConsentLike | null | undefined): boolean {
  if (!profile) return false;
  const accepted = profile.accepted_terms === true && !!profile.accepted_terms_at;
  if (!accepted) return false;
  const acceptedVersion = Number(profile.accepted_legal_version || 0);
  return Number.isFinite(acceptedVersion) && acceptedVersion >= CURRENT_LEGAL_VERSION;
}
