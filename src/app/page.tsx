"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import SwipeCard, { Activity } from "@/components/SwipeCard";
import PlayziLoader from "@/components/PlayziLoader";
import BottomSheetConfirmation from "@/components/BottomSheetConfirmation";
import BottomSheetFilter from "@/components/BottomSheetFilter";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUrgentChatOpenMs } from "@/lib/activity-rules";
import { refreshActivitiesNotificationState } from "@/lib/activities-notification-store";

const DISCOVER_STATE_KEY = "playzi_discover_state_v1";
const DISCOVER_REFRESH_REQUEST_EVENT = "playzi:discover-refresh-requested";
const AUTH_STATE_RESET_EVENT = "playzi:auth-state-reset";
const INITIAL_MY_ACTIVITIES_REDIRECT_KEY = "playzi_initial_my_activities_redirect_done_v1";
const PRIVACY_UPDATED_EVENT = "playzi:privacy-updated";

type DiscoverState = {
  activities: Activity[];
  distanceFilter: number;
  genderFilter: 'mixte' | 'filles' | 'tout';
  cityFilter: string | null;
  scrollY: number;
};

type UserCoords = { lat: number; lng: number };

function normalizeDistanceParam(raw: string | null): number {
  if (raw === null || raw.trim().length === 0) return 30;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  const rounded = Math.round(parsed / 5) * 5;
  return Math.min(30, Math.max(5, rounded));
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlCity = searchParams.get("city");
  const urlDistance = searchParams.get("distance");
  const urlGender = searchParams.get("gender") as 'mixte' | 'filles' | 'tout' | null;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Authentic User State
  const [userGender, setUserGender] = useState<'male' | 'female'>('male');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const hasTriedRestoreRef = useRef(false);

  // New Filter States
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);
  const refreshRequestIdRef = useRef(0);
  const refreshToastTimeoutRef = useRef<number | null>(null);
  const activitiesRef = useRef<Activity[]>([]);
  const [distanceFilter, setDistanceFilter] = useState<number>(normalizeDistanceParam(urlDistance));
  const [genderFilter, setGenderFilter] = useState<'mixte' | 'filles' | 'tout'>(urlGender || 'tout');
  const [cityFilter, setCityFilter] = useState<string | null>(urlCity || null);
  const [isApproximateLocationEnabled, setIsApproximateLocationEnabled] = useState(true);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [hasLocationAttempted, setHasLocationAttempted] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        // We know the user is authenticated. 
        // We need to fetch the profile to get the gender.
        const resUser = await res.json();
        if (resUser.data?.user?.gender) {
          setUserGender(resUser.data.user.gender as 'male' | 'female');
        }
        // Let's get the profile directly from Supabase since `/me` only returns basic auth data currently.
        // We will do a generic approach here to avoid circular imports.
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const fetchPrivacyPreference = async () => {
    try {
      const res = await fetch("/api/profile/privacy", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      const nextValue = body?.data?.privacy?.approximate_location !== false;
      setIsApproximateLocationEnabled(nextValue);
    } catch {
      // Keep last known value.
    }
  };

  const fetchActivities = async ({ manual = false }: { manual?: boolean } = {}) => {
    const requestId = ++refreshRequestIdRef.current;
    if (manual) setIsManualRefreshing(true);
    if (!manual) setIsLoadingActivities(true);
    const previousIds = manual ? new Set(activitiesRef.current.map((a) => a.id)) : null;
    try {
      // Pass gender filter as URL param so the API knows what the user explicitly requested
      const url = new URL("/api/activities", window.location.origin);
      if (genderFilter && genderFilter !== 'tout') {
        url.searchParams.append('genderFilter', genderFilter);
      }
      if (cityFilter) {
        url.searchParams.append('city', cityFilter);
      }
      if (!cityFilter && isApproximateLocationEnabled && distanceFilter && userCoords) {
        url.searchParams.append('maxDistance', distanceFilter.toString());
        url.searchParams.append("userLat", String(userCoords.lat));
        url.searchParams.append("userLng", String(userCoords.lng));
      }
      url.searchParams.append('t', Date.now().toString());
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          // The Backend API already securely filters out 'dead', 'full', and 'past' activities
          setActivities(data);
          if (manual && previousIds) {
            const nextActivities = Array.isArray(data) ? data as Activity[] : [];
            const newCount = nextActivities.reduce((count, item) => (
              item?.id && !previousIds.has(item.id) ? count + 1 : count
            ), 0);
            const message = newCount > 0
              ? `+${newCount} nouvelle${newCount > 1 ? "s" : ""} activité${newCount > 1 ? "s" : ""}`
              : "À jour";
            setRefreshFeedback(message);
            if (refreshToastTimeoutRef.current) window.clearTimeout(refreshToastTimeoutRef.current);
            refreshToastTimeoutRef.current = window.setTimeout(() => setRefreshFeedback(null), 1500);
          }
        }
      }
    } catch (e) {
      console.error("Failed to load activities", e);
    } finally {
      if (requestId !== refreshRequestIdRef.current) return;
      if (manual) {
        setIsManualRefreshing(false);
      } else {
        setIsLoadingActivities(false);
      }
    }
  };


  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  // 1. Initial Load: Check Auth
  useEffect(() => {
    fetchUser();
    void fetchPrivacyPreference();
  }, []);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void fetchPrivacyPreference();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    const onPrivacyUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ approximate_location?: boolean }>;
      const nextValue = customEvent.detail?.approximate_location !== false;
      setIsApproximateLocationEnabled(nextValue);
    };

    window.addEventListener(PRIVACY_UPDATED_EVENT, onPrivacyUpdated as EventListener);
    return () => {
      window.removeEventListener(PRIVACY_UPDATED_EVENT, onPrivacyUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isApproximateLocationEnabled) {
      setUserCoords(null);
      setHasLocationAttempted(true);
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setHasLocationAttempted(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setHasLocationAttempted(true);
      },
      () => {
        setHasLocationAttempted(true);
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60 * 1000,
      }
    );
  }, [isApproximateLocationEnabled]);

  useEffect(() => {
    let cancelled = false;

    const maybeRedirectToActivities = async () => {
      if (typeof window === "undefined") return;
      if (window.sessionStorage.getItem(INITIAL_MY_ACTIVITIES_REDIRECT_KEY) === "1") return;

      window.sessionStorage.setItem(INITIAL_MY_ACTIVITIES_REDIRECT_KEY, "1");
      const state = await refreshActivitiesNotificationState();
      if (cancelled) return;

      const hasUnreadMyActivities =
        Number(state.upcomingUnreadCount || 0) > 0
        || Number(state.upcomingCancellationVoteCount || 0) > 0;

      if (hasUnreadMyActivities) {
        router.replace("/activities");
      }
    };

    void maybeRedirectToActivities();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Sync URL Params to State to survive back-navigation
  useEffect(() => {
    setDistanceFilter(normalizeDistanceParam(urlDistance));
    setGenderFilter(urlGender || 'tout');
    setCityFilter(urlCity || null);
  }, [urlDistance, urlGender, urlCity]);

  useEffect(() => {
    if (isApproximateLocationEnabled) return;
    setDistanceFilter(30);
    const params = new URLSearchParams(searchParams.toString());
    if (!params.has("distance")) return;
    params.delete("distance");
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/");
  }, [isApproximateLocationEnabled, router, searchParams]);

  // 2. Fetch Activities when filters change
  useEffect(() => {
    if (isLoadingAuth) return;
    void fetchActivities();
  }, [isLoadingAuth, cityFilter, genderFilter, distanceFilter, userCoords, hasLocationAttempted]);

  useEffect(() => {
    const onDiscoverRefreshRequested = () => {
      void fetchActivities({ manual: true });
    };
    window.addEventListener(DISCOVER_REFRESH_REQUEST_EVENT, onDiscoverRefreshRequested as EventListener);
    return () => {
      window.removeEventListener(DISCOVER_REFRESH_REQUEST_EVENT, onDiscoverRefreshRequested as EventListener);
    };
  }, [cityFilter, distanceFilter, genderFilter, userCoords]);

  useEffect(() => {
    const onAuthStateReset = () => {
      setActivities([]);
      setSelectedActivity(null);
      setIsBottomSheetOpen(false);
      setRefreshFeedback(null);
      setIsManualRefreshing(false);
    };
    window.addEventListener(AUTH_STATE_RESET_EVENT, onAuthStateReset);
    return () => {
      window.removeEventListener(AUTH_STATE_RESET_EVENT, onAuthStateReset);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (refreshToastTimeoutRef.current) {
        window.clearTimeout(refreshToastTimeoutRef.current);
      }
    };
  }, []);

  // 3. Real-time: remove activities instantly when they are cancelled or become full
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('discover-activity-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'activities' },
        (payload: { new?: { id?: string; status?: string } }) => {
          const updated = payload.new;
          if (!updated?.id) return;
          const isHidden =
            updated.status === 'annulé' ||
            updated.status === 'passé' ||
            updated.status === 'complet';
          if (isHidden) {
            setActivities((prev) => prev.filter((a) => a.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSwipeRight = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsBottomSheetOpen(true);
  };

  const handleSwipeLeft = (activity: Activity) => {
    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    }, 300);
  };

  const handleConfirm = () => {
    setIsBottomSheetOpen(false);
    if (selectedActivity?.id) {
      setActivities((prev) => prev.filter((a) => a.id !== selectedActivity.id));
    }
    setSelectedActivity(null);
  };

  const handleCancel = () => {
    setIsBottomSheetOpen(false);
    setSelectedActivity(null);
  };

  const clearCityFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("city");
    const q = params.toString();
    router.push(q ? `/?${q}` : "/");
  };

  const handleApplyFilters = (dist: number, gen: 'mixte' | 'filles' | 'tout', city: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (city || !isApproximateLocationEnabled) params.delete("distance");
    else if (dist !== 30) params.set("distance", dist.toString());
    else params.delete("distance");
    if (gen !== 'tout') params.set("gender", gen);
    else params.delete("gender");
    if (city) params.set("city", city);
    else params.delete("city");
    const q = params.toString();
    router.push(q ? `/?${q}` : "/");
  };

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden touch-manipulation">
      <Header />

      {/* --- Filter System & Feed Container --- */}
      <div className="flex-1 w-full flex flex-col pt-[72px]">

        {/* ── Filter Zone — always visible above cards ── */}
        <div className="sticky top-[72px] z-20 px-4 pt-2 pb-2 flex flex-col bg-background/95 backdrop-blur-sm border-b border-gray-100">

          {/* Row 1: Localisation — always reserved, visible only when active */}
          <div className="flex items-center min-h-[18px]">
            {cityFilter ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                📍 {cityFilter}
                <button onClick={clearCityFilter} className="hover:bg-gray-100 p-0.5 rounded-full transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : (
              <span className="inline-flex min-h-[16px] items-center text-[11px] font-medium text-gray-400">
                {isManualRefreshing && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-playzi-green" />
                    Mise à jour des activités…
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Row 2: Filtres actifs (gauche) + bouton Filtrer (droite) — always at same position */}
          <div className="flex items-center justify-between min-h-[30px]">
            <div className="flex-1">
              {((!cityFilter && isApproximateLocationEnabled && distanceFilter !== 30) || (userGender === 'female' && genderFilter !== 'tout')) && (
                <p className="text-[12px] font-medium text-gray-500">
                  {!cityFilter && isApproximateLocationEnabled && distanceFilter !== 30 && `Distance ${distanceFilter} km`}
                  {!cityFilter && isApproximateLocationEnabled && distanceFilter !== 30 && (userGender === 'female' && genderFilter !== 'tout') && <span className="mx-1.5 font-bold">·</span>}
                  {userGender === 'female' && genderFilter === 'filles' && 'Entre filles'}
                  {userGender === 'female' && genderFilter === 'mixte' && 'Mixte'}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="h-8 min-w-[80px] shrink-0 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center px-3 transition-all hover:bg-gray-50 active:scale-95"
            >
              <span className="text-[11px] font-semibold text-gray-dark tracking-wide flex items-center gap-1">
                Filtrer
                {((!cityFilter && isApproximateLocationEnabled && distanceFilter !== 30) || (userGender === 'female' && genderFilter !== 'tout') || !!cityFilter) && (
                  <span className="ml-0.5 text-playzi-green font-bold">
                    {(!cityFilter && isApproximateLocationEnabled && distanceFilter !== 30 ? 1 : 0) + ((userGender === 'female' && genderFilter !== 'tout') ? 1 : 0) + (cityFilter ? 1 : 0)}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>




        {/* Swipeable Card Feed Area — 12px gap after filter zone */}
        <div className="relative flex-1 w-full px-3 pb-28 pt-0 flex items-start justify-center">
          {activities.length > 0 ? (
            [...activities].reverse().map((activity, i) => (
              <SwipeCard
                key={activity.id}
                activity={activity}
                index={i}
                onSwipeRight={handleSwipeRight}
                onSwipeLeft={handleSwipeLeft}
              />
            ))
          ) : (isLoadingAuth || isLoadingActivities) ? (
            <div className="flex h-full w-full items-center justify-center">
              <PlayziLoader message="Chargement des activités..." />
            </div>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-center px-8">
              <div className="mb-5 flex items-end text-[64px] font-black leading-none text-gray-dark">
                <span>P</span>
                <div className="relative mb-2 ml-1 h-3.5 w-3.5">
                  <span className="absolute inset-0 inline-block rounded-full bg-playzi-green/95 shadow-[0_0_0_1px_rgba(255,255,255,0.72)]" />
                  <motion.span
                    className="absolute inset-0 inline-block rounded-full bg-playzi-green/35"
                    animate={{ scale: [1, 2.05, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.95, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
              </div>

              <h2 className="text-[24px] font-black text-gray-dark">
                Aucune activité pour le moment
              </h2>

              <p className="mt-3 max-w-[300px] text-[14px] font-medium leading-relaxed text-gray-500">
                De nouvelles activités arrivent bientôt.
                <br />
                Reviens dans quelques minutes ou crée la tienne.
              </p>

              <button
                onClick={() => router.push("/create")}
                className="mt-7 rounded-full border border-gray-200 bg-white px-6 py-2.5 text-[14px] font-semibold text-gray-dark shadow-sm transition-all hover:bg-gray-50 active:scale-95"
              >
                Créer une activité
              </button>

              <p className="mt-2 text-center text-[12px] font-medium text-gray-400">
                et trouve des partenaires en quelques minutes.
              </p>

              {cityFilter && (
                <button
                  onClick={clearCityFilter}
                  className="mt-3 text-[13px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-dark hover:underline"
                >
                  Voir toutes les villes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomSheetConfirmation
        activity={selectedActivity}
        isOpen={isBottomSheetOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onTimeout={handleCancel}
        isUrgent={selectedActivity ? (() => {
          const startMs = new Date(selectedActivity.start_time).getTime();
          const hasAttendeeLimit = Number(selectedActivity.max_attendees || 0) > 0;
          const urgentOpenMs = getUrgentChatOpenMs({
            start_time: selectedActivity.start_time,
            max_attendees: selectedActivity.max_attendees,
          });
          return hasAttendeeLimit
            && Number.isFinite(startMs)
            && startMs > Date.now()
            && urgentOpenMs !== null
            && Date.now() >= urgentOpenMs;
        })() : false}
      />

      <BottomSheetFilter
        key={`filter-${isFilterSheetOpen ? "open" : "closed"}-${distanceFilter}-${genderFilter}-${cityFilter || "none"}`}
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApplyParams={handleApplyFilters}
        currentDistance={distanceFilter}
        currentGenderFilter={genderFilter}
        currentCity={cityFilter}
        isFemale={userGender === 'female'}
        isDistanceEnabled={isApproximateLocationEnabled}
      />

      <AnimatePresence>
        {refreshFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute left-1/2 top-[78px] z-30 -translate-x-1/2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm"
          >
            {refreshFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavigation isHidden={isBottomSheetOpen} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-background w-full" />}>
      <HomeContent />
    </Suspense>
  );
}
