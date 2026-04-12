"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type SearchProfile = {
  id: string;
  pseudo: string;
  first_name: string | null;
  last_name: string | null;
  gender?: string | null;
};

interface StepInviteProps {
  maxParticipants: number;
  invitedFriends: string[];
  groupType: "mixte" | "filles" | null;
  onInviteChange: (friends: string[]) => void;
}

type ConnectionItem = {
  id: string;
  pseudo: string;
  fullName: string;
  gender?: string | null;
};

type ConnectionApiRow = {
  user_id?: string | null;
  pseudo?: string | null;
  name?: string | null;
  gender?: string | null;
};

function isFemaleGender(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "female" || normalized === "femme";
}

export default function StepInvite({ maxParticipants, invitedFriends, groupType, onInviteChange }: StepInviteProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [connectionsById, setConnectionsById] = useState<Set<string>>(new Set());
  const shouldRestrictToFemale = groupType === "filles";

  const totalOccupied = 1 + invitedFriends.length;
  const canInviteMore = totalOccupied < maxParticipants;
  const invitedSet = useMemo(() => new Set(invitedFriends), [invitedFriends]);
  const resultRows = useMemo(() => results, [results]);
  const unknownInvitedCount = useMemo(
    () => invitedFriends.filter((id) => !connectionsById.has(id)).length,
    [invitedFriends, connectionsById]
  );
  const unknownLimitReached = unknownInvitedCount >= 4;
  useEffect(() => {
    let cancelled = false;
    const loadConnections = async () => {
      try {
        setIsLoadingConnections(true);
        const res = await fetch(`/api/connections?t=${Date.now()}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "Impossible de charger les connexions");
        if (cancelled) return;
        const rows: ConnectionApiRow[] = Array.isArray(body?.data?.connections) ? body.data.connections : [];
        const mapped: ConnectionItem[] = rows.map((row) => ({
          id: String(row?.user_id || ""),
          pseudo: String(row?.pseudo || "utilisateur"),
          fullName: String(row?.name || row?.pseudo || "Utilisateur Playzi"),
          gender: row?.gender ?? null,
        })).filter((row: ConnectionItem) => row.id);
        setConnections(mapped);
        setConnectionsById(new Set(mapped.map((row) => row.id)));
      } catch {
        if (cancelled) return;
        setConnections([]);
        setConnectionsById(new Set());
      } finally {
        if (!cancelled) setIsLoadingConnections(false);
      }
    };
    void loadConnections();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        setSearchError(null);
        const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || "Impossible de lancer la recherche");
        if (cancelled) return;
        const profiles = Array.isArray(body?.data?.profiles) ? body.data.profiles : [];
        const filteredProfiles = shouldRestrictToFemale
          ? profiles.filter((profile: SearchProfile) => isFemaleGender(profile?.gender))
          : profiles;
        setResults(filteredProfiles);
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setSearchError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, shouldRestrictToFemale]);

  const visibleConnections = useMemo(
    () => (shouldRestrictToFemale
      ? connections.filter((connection) => isFemaleGender(connection.gender))
      : connections),
    [connections, shouldRestrictToFemale]
  );

  useEffect(() => {
    if (!shouldRestrictToFemale) return;
    const femaleConnectionIds = new Set(
      connections.filter((connection) => isFemaleGender(connection.gender)).map((connection) => connection.id)
    );
    const sanitizedInvites = invitedFriends.filter((id) => !connectionsById.has(id) || femaleConnectionIds.has(id));
    if (sanitizedInvites.length !== invitedFriends.length) {
      onInviteChange(sanitizedInvites);
    }
  }, [shouldRestrictToFemale, connections, connectionsById, invitedFriends, onInviteChange]);

  const toggle = (id: string) => {
    if (invitedSet.has(id)) {
      onInviteChange(invitedFriends.filter((friendId) => friendId !== id));
      return;
    }
    if (!canInviteMore) return;
    const isKnownConnection = connectionsById.has(id);
    if (!isKnownConnection && unknownLimitReached) return;
    onInviteChange([...invitedFriends, id]);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-2xl border-2 border-gray-100 bg-white px-5 py-4">
        <div>
          <p className="text-[13px] font-bold text-gray-dark">Places réservées</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            1 créateur + {invitedFriends.length} invité{invitedFriends.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-playzi-green">{totalOccupied}</span>
          <span className="text-[13px] font-medium text-gray-400">/ {maxParticipants}</span>
        </div>
      </div>

      <div className="relative">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-gray-400">Inviter des personnes</h2>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par pseudo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-12 w-full rounded-2xl border-2 border-gray-100 bg-white pl-10 pr-10 text-[14px] text-gray-dark transition-colors focus:border-playzi-green focus:outline-none"
          />
          {isSearching && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />}
        </div>

        {searchError && <p className="mt-2 text-[12px] font-semibold text-rose-600">{searchError}</p>}
        {unknownLimitReached && (
          <p className="mt-2 text-[12px] font-semibold text-amber-700">
            Vous pouvez inviter jusqu’à 4 personnes hors connexions
          </p>
        )}
        <p className="mt-2 text-[12px] font-medium text-gray-500">
          Les places invitées sont réservées pendant 10 minutes. Passé ce délai, elles peuvent être rejointes par d’autres personnes.
        </p>

        <AnimatePresence>
          {search.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="relative z-20 mt-2 flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-gray-100 bg-white p-2 shadow-[0_8px_24px_rgba(17,24,39,0.06)]"
            >
              {resultRows.map((profile) => {
                const invited = invitedFriends.includes(profile.id);
                const canInviteUnknown = connectionsById.has(profile.id) || !unknownLimitReached || invited;
                const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-2xl border-2 border-gray-100 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-gray-dark">@{profile.pseudo}</p>
                      <p className="truncate text-[11px] text-gray-400">{fullName || "Utilisateur Playzi"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(profile.id)}
                      disabled={!invited && (!canInviteMore || !canInviteUnknown)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-55",
                        invited
                          ? "bg-playzi-green/10 text-playzi-green"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {invited ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Invité
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3.5 w-3.5" /> Inviter
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
              {!isSearching && !searchError && resultRows.length === 0 && (
                <p className="px-2 py-1 text-[12px] font-medium text-gray-500">Aucun pseudo trouvé.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-2xl border-2 border-gray-100 bg-white p-3.5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-gray-400">Mes connexions</h2>
        <div className="space-y-2">
          {isLoadingConnections && (
            <div className="flex h-12 items-center justify-center rounded-2xl border-2 border-gray-100 bg-white">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}
          {!isLoadingConnections && visibleConnections.length === 0 && (
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] font-medium text-gray-500">Aucune connexion pour le moment.</p>
          )}
          {!isLoadingConnections && visibleConnections.map((connection) => {
            const invited = invitedSet.has(connection.id);
            return (
              <div
                key={connection.id}
                className="flex items-center justify-between rounded-2xl border-2 border-gray-100 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] font-semibold text-gray-dark">@{connection.pseudo}</p>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                      Connecté
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-gray-400">{connection.fullName}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(connection.id)}
                  disabled={!invited && !canInviteMore}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all disabled:opacity-55",
                    invited
                      ? "bg-playzi-green/10 text-playzi-green"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  )}
                >
                  {invited ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Invité
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" /> Inviter
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-gray-100 bg-white p-3.5">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-widest text-gray-400">Inviter via lien</h2>
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[12px] font-medium text-blue-700">
          Le lien WhatsApp est généré après publication pour garantir un lien valide.
        </p>
      </div>
    </div>
  );
}
