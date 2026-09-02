"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import SwipeCard, { Activity } from "@/components/SwipeCard";
import PlayziLoader from "@/components/PlayziLoader";
import BottomSheetConfirmation from "@/components/BottomSheetConfirmation";
import BottomSheetFilter from "@/components/BottomSheetFilter";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import ParticipantsSheet from "@/components/ParticipantsSheet";
import { Calendar, Lock, MapPin, Rows3, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getUrgentChatOpenMs } from "@/lib/activity-rules";
import { refreshActivitiesNotificationState } from "@/lib/activities-notification-store";
import {
  PLAYZI_ONBOARDING_ACTION_EVENT,
  PLAYZI_ONBOARDING_REQUEST_EVENT,
  PLAYZI_ONBOARDING_STEP_EVENT,
} from "@/lib/playzi-onboarding";
import {
  getTutorialModeSnapshot,
  PLAYZI_TUTORIAL_MODE_CHANGED_EVENT,
} from "@/lib/tutorial-mode";
import { usePlayziPlus } from "@/lib/billing/use-playzi-plus";
import { buildActivitiesCacheKey, clearActivitiesPayloadCache, fetchActivitiesPayload, getCachedActivitiesPayload } from "@/lib/activities-client-cache";
import type { GenderInput } from "@/lib/validations/auth";
import { formatActivitySportLabel } from "@/lib/sport-labels";

const DISCOVER_STATE_KEY = "playzi_discover_state_v1";
const DISCOVER_VIEW_MODE_KEY = "playzi_discover_view_mode_v1";
const DISCOVER_REFRESH_REQUEST_EVENT = "playzi:discover-refresh-requested";
const AUTH_STATE_RESET_EVENT = "playzi:auth-state-reset";
const INITIAL_MY_ACTIVITIES_REDIRECT_KEY = "playzi_initial_my_activities_redirect_done_v1";
const PRIVACY_UPDATED_EVENT = "playzi:privacy-updated";
const TUTORIAL_DISCOVER_ACTIVITY_ID = "tutorial-discover-running-vidy";
const DISCOVER_CARD_HEIGHT_CSS = "clamp(360px, calc(100dvh - 72px - 66px - 112px - env(safe-area-inset-bottom)), 540px)";
const DISCOVER_FEED_STYLE: CSSProperties & Record<"--discover-card-height", string> = {
  "--discover-card-height": DISCOVER_CARD_HEIGHT_CSS,
};

const TUTORIAL_DISCOVER_ACTIVITY: Activity = {
  id: TUTORIAL_DISCOVER_ACTIVITY_ID,
  sport: "Running",
  level: "Intermédiaire",
  location: "Parc de Vidy",
  start_time: (() => {
    const now = new Date();
    now.setHours(18, 45, 0, 0);
    return now.toISOString();
  })(),
  tutorial_start_label: "Ce soir, 18h45",
  attendees: 3,
  max_attendees: 8,
  status: "ouvert",
  distance: 8,
  pace: 330,
  gender_filter: "mixte",
  image_url: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1400&q=80",
  tags: ["Mixte", "Intermédiaire"],
};

type DiscoverState = {
  activities: Activity[];
  distanceFilter: number;
  genderFilter: 'mixte' | 'filles' | 'tout';
  cityFilter: string | null;
  scrollY: number;
};

type UserCoords = { lat: number; lng: number };
type ActivitiesApiResponse = { data?: Activity[] };
type DiscoverViewMode = "swipe" | "list";

function normalizeDistanceParam(raw: string | null): number {
  if (raw === null || raw.trim().length === 0) return 30;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  const rounded = Math.round(parsed / 5) * 5;
  return Math.min(30, Math.max(5, rounded));
}

function normalizeActivitySport(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getActivityImage(activity: Activity) {
  if (activity.image_url) return activity.image_url;

  switch (normalizeActivitySport(activity.sport)) {
    case "running":
      return "/images/running.png";
    case "beach volley":
    case "beachvolley":
      return "/images/beachvolley.png";
    case "football":
    case "foot":
      return "/images/football_1.png";
    case "velo":
    case "cycling":
    case "cyclisme":
    case "bike":
    case "biking":
      return "/images/cycling_1.png";
    default:
      return "/images/running_mixed.png";
  }
}

function formatActivityListDate(startTime: string, fallback?: string) {
  if (fallback) return fallback;
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dayLabel = diffDays === 0
    ? "Aujourd’hui"
    : diffDays === 1
      ? "Demain"
      : date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  const timeLabel = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return `${dayLabel} · ${timeLabel}`;
}

function ActivityListCard({
  activity,
  onOpen,
}: {
  activity: Activity;
  onOpen: (activity: Activity) => void;
}) {
  const sportLabel = formatActivitySportLabel(activity.sport);
  const displayImage = getActivityImage(activity);
  const locationLabel = activity.location || activity.address || "Lieu à confirmer";
  const participantLabel = `${activity.attendees}/${activity.max_attendees} participant${activity.max_attendees > 1 ? "s" : ""}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(activity)}
      className="group flex w-full items-center gap-3 rounded-[20px] border border-gray-100 bg-white p-2.5 text-left shadow-[0_5px_16px_rgba(0,0,0,0.045)] transition-all active:scale-[0.985] sm:p-3"
    >
      <div
        role="img"
        aria-label={sportLabel}
        className="h-[92px] w-[92px] shrink-0 rounded-2xl bg-gray-100 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.02] sm:h-[104px] sm:w-[104px]"
        style={{
          backgroundImage: `url(${displayImage})`,
          backgroundPosition: activity.image_position || "center",
        }}
      />

      <div className="min-w-0 flex-1 py-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-black leading-tight text-gray-dark sm:text-[16px]">
              {sportLabel}
            </h3>
            {activity.level && (
              <p className="mt-1 truncate text-[11px] font-bold text-gray-400">
                {activity.level}
              </p>
            )}
          </div>
          {activity.distance ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
              {activity.distance} km
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 space-y-1.5 text-[12px] font-semibold text-gray-500">
          <p className="flex min-w-0 items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-playzi-green" />
            <span className="truncate">{formatActivityListDate(activity.start_time, activity.tutorial_start_label)}</span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{locationLabel}</span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-gray-dark">
            <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{participantLabel}</span>
          </p>
        </div>
      </div>
    </button>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const playziPlus = usePlayziPlus();
  const urlCity = searchParams.get("city");
  const urlDistance = searchParams.get("distance");
  const urlGender = searchParams.get("gender") as 'mixte' | 'filles' | 'tout' | null;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [participantsActivityId, setParticipantsActivityId] = useState<string | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Authentic User State
  const [userGender, setUserGender] = useState<GenderInput>('male');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const [discoverViewMode, setDiscoverViewMode] = useState<DiscoverViewMode>("swipe");
  const [isApproximateLocationEnabled, setIsApproximateLocationEnabled] = useState(true);
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [hasLocationAttempted, setHasLocationAttempted] = useState(false);
  const [isTutorialMode, setIsTutorialMode] = useState(false);
  const [tutorialStepId, setTutorialStepId] = useState<string | null>(null);
  const [isTutorialSwipeCardVisible, setIsTutorialSwipeCardVisible] = useState(false);
  const [tutorialSwipeFeedback, setTutorialSwipeFeedback] = useState<string | null>(null);
  const tutorialSwipeFeedbackTimeoutRef = useRef<number | null>(null);
  const canUseAdvancedFilters = playziPlus.isLoading || playziPlus.can("advanced_filters");
  const canUseListMode = playziPlus.isLoading || playziPlus.can("premium_customization");
  const effectiveViewMode: DiscoverViewMode = isTutorialMode || !canUseListMode ? "swipe" : discoverViewMode;
  const effectiveDistanceFilter = canUseAdvancedFilters ? distanceFilter : 30;
  const effectiveCityFilter = canUseAdvancedFilters ? cityFilter : null;

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        // We know the user is authenticated. 
        // We need to fetch the profile to get the gender.
        const resUser = await res.json();
        setCurrentUserId(typeof resUser.data?.user?.id === "string" ? resUser.data.user.id : null);
        if (resUser.data?.user?.gender) {
          setUserGender(resUser.data.user.gender as GenderInput);
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
      if (effectiveCityFilter) {
        url.searchParams.append('city', effectiveCityFilter);
      }
      if (!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter && userCoords) {
        url.searchParams.append('maxDistance', effectiveDistanceFilter.toString());
        url.searchParams.append("userLat", String(userCoords.lat));
        url.searchParams.append("userLng", String(userCoords.lng));
      }
      url.searchParams.append('t', Date.now().toString());
      const cacheKey = buildActivitiesCacheKey(url);
      const cached = getCachedActivitiesPayload<ActivitiesApiResponse>(cacheKey);
      if (!manual && cached?.data) {
        setActivities(cached.data);
        setIsLoadingActivities(false);
      }

      const { data } = await fetchActivitiesPayload<ActivitiesApiResponse>(url, { force: manual });
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

  useEffect(() => {
    const syncTutorialState = () => {
      const snapshot = getTutorialModeSnapshot();
      setIsTutorialMode(snapshot.enabled);
      setTutorialStepId(snapshot.stepId);
    };

    const onModeChanged = () => syncTutorialState();
    const onStepChanged = (event: Event) => {
      const custom = event as CustomEvent<{ stepId?: string | null }>;
      const stepId = custom.detail?.stepId ?? null;
      setTutorialStepId(stepId);
    };

    syncTutorialState();
    window.addEventListener(PLAYZI_TUTORIAL_MODE_CHANGED_EVENT, onModeChanged);
    window.addEventListener(PLAYZI_ONBOARDING_STEP_EVENT, onStepChanged as EventListener);
    return () => {
      window.removeEventListener(PLAYZI_TUTORIAL_MODE_CHANGED_EVENT, onModeChanged);
      window.removeEventListener(PLAYZI_ONBOARDING_STEP_EVENT, onStepChanged as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isTutorialMode && tutorialStepId === "discover-swipe") {
      setIsTutorialSwipeCardVisible(true);
      return;
    }
    setIsTutorialSwipeCardVisible(false);
  }, [isTutorialMode, tutorialStepId]);

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
    if (canUseAdvancedFilters || playziPlus.isLoading) return;
    setDistanceFilter(30);
    setCityFilter(null);
    const params = new URLSearchParams(searchParams.toString());
    const hadPremiumParams = params.has("distance") || params.has("city");
    params.delete("distance");
    params.delete("city");
    if (!hadPremiumParams) return;
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/");
  }, [canUseAdvancedFilters, playziPlus.isLoading, router, searchParams]);

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
  }, [isLoadingAuth, effectiveCityFilter, genderFilter, effectiveDistanceFilter, userCoords, hasLocationAttempted]);

  useEffect(() => {
    const onDiscoverRefreshRequested = () => {
      void fetchActivities({ manual: true });
    };
    window.addEventListener(DISCOVER_REFRESH_REQUEST_EVENT, onDiscoverRefreshRequested as EventListener);
    return () => {
      window.removeEventListener(DISCOVER_REFRESH_REQUEST_EVENT, onDiscoverRefreshRequested as EventListener);
    };
  }, [effectiveCityFilter, effectiveDistanceFilter, genderFilter, userCoords]);

  useEffect(() => {
    const onAuthStateReset = () => {
      setActivities([]);
      setSelectedActivity(null);
      setParticipantsActivityId(null);
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
      if (tutorialSwipeFeedbackTimeoutRef.current) {
        window.clearTimeout(tutorialSwipeFeedbackTimeoutRef.current);
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
    if (isTutorialMode) {
      if (activity.id !== TUTORIAL_DISCOVER_ACTIVITY_ID) return;
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
      if (activity.id === TUTORIAL_DISCOVER_ACTIVITY_ID) {
        setIsTutorialSwipeCardVisible(false);
        setTutorialSwipeFeedback("Parfait. À droite, tu demandes à rejoindre l’activité.");
        window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
          detail: { type: "swipe", stepId: "discover-swipe", direction: "right" },
        }));
      } else {
        setTutorialSwipeFeedback("Mode tutoriel: interaction simulée.");
      }
      if (tutorialSwipeFeedbackTimeoutRef.current) {
        window.clearTimeout(tutorialSwipeFeedbackTimeoutRef.current);
      }
      tutorialSwipeFeedbackTimeoutRef.current = window.setTimeout(() => setTutorialSwipeFeedback(null), 2000);
      return;
    }

    setSelectedActivity(activity);
    setIsBottomSheetOpen(true);
  };

  const handleOpenActivityDetails = (activity: Activity) => {
    if (isTutorialMode) return;
    setSelectedActivity(activity);
    setIsBottomSheetOpen(true);
  };

  const handleSwipeLeft = (activity: Activity) => {
    if (isTutorialMode) {
      if (activity.id !== TUTORIAL_DISCOVER_ACTIVITY_ID) return;
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
      if (activity.id === TUTORIAL_DISCOVER_ACTIVITY_ID) {
        setIsTutorialSwipeCardVisible(false);
        window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
          detail: { type: "swipe", stepId: "discover-swipe", direction: "left" },
        }));
      }
      return;
    }

    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    }, 300);
  };

  const handleConfirm = () => {
    setIsBottomSheetOpen(false);
    if (selectedActivity?.id) {
      clearActivitiesPayloadCache();
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
    const nextDistance = canUseAdvancedFilters ? dist : 30;
    const nextCity = canUseAdvancedFilters ? city : null;

    if (isTutorialMode) {
      setDistanceFilter(nextDistance);
      setGenderFilter(gen);
      setCityFilter(nextCity);
      setIsFilterSheetOpen(false);
      setRefreshFeedback("Mode tutoriel: filtres simulés.");
      if (refreshToastTimeoutRef.current) window.clearTimeout(refreshToastTimeoutRef.current);
      refreshToastTimeoutRef.current = window.setTimeout(() => setRefreshFeedback(null), 1500);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (nextCity || !isApproximateLocationEnabled) params.delete("distance");
    else if (nextDistance !== 30) params.set("distance", nextDistance.toString());
    else params.delete("distance");
    if (gen !== 'tout') params.set("gender", gen);
    else params.delete("gender");
    if (nextCity) params.set("city", nextCity);
    else params.delete("city");
    const q = params.toString();
    router.push(q ? `/?${q}` : "/");
  };

  const handleFilterButtonClick = () => {
    setIsFilterSheetOpen(true);
    if (isTutorialMode && tutorialStepId === "discover-filters-cta") {
      window.dispatchEvent(new CustomEvent(PLAYZI_ONBOARDING_ACTION_EVENT, {
        detail: { type: "filter_press", stepId: "discover-filters-cta" },
      }));
    }
  };

  const handleDiscoverViewModeChange = (mode: DiscoverViewMode) => {
    if (mode === "list" && !canUseListMode) {
      router.push("/pricing");
      return;
    }
    setDiscoverViewMode(mode);
    try {
      window.localStorage.setItem(DISCOVER_VIEW_MODE_KEY, mode);
    } catch {
      // Keep the in-memory preference if localStorage is unavailable.
    }
  };

  useEffect(() => {
    const onOnboardingRequest = (event: Event) => {
      const custom = event as CustomEvent<{ type?: string }>;
      if (custom.detail?.type === "close-filters-sheet") {
        setIsFilterSheetOpen(false);
      }
    };
    window.addEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
    return () => {
      window.removeEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
    };
  }, []);

  useEffect(() => {
    try {
      const storedMode = window.localStorage.getItem(DISCOVER_VIEW_MODE_KEY);
      if (storedMode === "swipe" || storedMode === "list") {
        setDiscoverViewMode(storedMode);
      }
    } catch {
      // Default to Swipe.
    }
  }, []);

  useEffect(() => {
    if (!canUseListMode && discoverViewMode === "list") {
      setDiscoverViewMode("swipe");
    }
  }, [canUseListMode, discoverViewMode]);

  const displayedActivities = (
    isTutorialMode && tutorialStepId === "discover-swipe" && isTutorialSwipeCardVisible
      ? [TUTORIAL_DISCOVER_ACTIVITY, ...activities]
      : activities
  );

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden touch-manipulation">
      <Header />

      {/* --- Filter System & Feed Container --- */}
      <div className="flex-1 w-full flex flex-col pt-[72px]">

        {/* ── Filter Zone — always visible above cards ── */}
        <div data-onboarding-id="discover-filters-zone" className="sticky top-[72px] z-20 px-4 pt-2 pb-2 flex flex-col bg-background/95 backdrop-blur-sm border-b border-gray-100">

          {/* Row 1: Localisation — always reserved, visible only when active */}
          <div className="flex items-center min-h-[18px]">
            {effectiveCityFilter ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                📍 {effectiveCityFilter}
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

          {/* Row 2: Filtres actifs (gauche) + mode Discover + bouton Filtrer (droite) */}
          <div className="flex min-h-[34px] items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {((!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter !== 30) || (userGender === 'female' && genderFilter !== 'tout')) && (
                <p className="truncate text-[12px] font-medium text-gray-500">
                  {!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter !== 30 && `Distance ${effectiveDistanceFilter} km`}
                  {!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter !== 30 && (userGender === 'female' && genderFilter !== 'tout') && <span className="mx-1.5 font-bold">·</span>}
                  {userGender === 'female' && genderFilter === 'filles' && 'Entre filles'}
                  {userGender === 'female' && genderFilter === 'mixte' && 'Mixte'}
                </p>
              )}
            </div>
            <div className="inline-flex shrink-0 rounded-full border border-gray-100 bg-white/80 p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => handleDiscoverViewModeChange("swipe")}
                className={`h-7 rounded-full px-3 text-[10px] font-black transition-all active:scale-95 ${effectiveViewMode === "swipe"
                  ? "bg-playzi-green text-white shadow-[0_4px_12px_rgba(34,197,94,0.18)]"
                  : "text-gray-500 hover:text-gray-dark"
                  }`}
              >
                Swipe
              </button>
              <button
                type="button"
                onClick={() => handleDiscoverViewModeChange("list")}
                className={`ml-0.5 h-7 rounded-full px-2.5 text-[10px] font-black transition-all active:scale-95 ${effectiveViewMode === "list"
                  ? "bg-playzi-green text-white shadow-[0_4px_12px_rgba(34,197,94,0.18)]"
                  : canUseListMode
                    ? "text-gray-500 hover:text-gray-dark"
                    : "border border-emerald-100 bg-emerald-50 text-emerald-700"
                  }`}
                aria-label={canUseListMode ? "Afficher les activités en liste" : "Mode Liste Playzi+"}
              >
                <span className="inline-flex items-center gap-1">
                  {canUseListMode ? <Rows3 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  Liste
                  {!canUseListMode && <span className="text-[9px]">Playzi+</span>}
                </span>
              </button>
            </div>
            <button
              data-onboarding-id="filter-button"
              onClick={handleFilterButtonClick}
              className="h-8 min-w-[80px] shrink-0 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center px-3 transition-all hover:bg-gray-50 active:scale-95"
            >
              <span className="text-[11px] font-semibold text-gray-dark tracking-wide flex items-center gap-1">
                Filtrer
                {((!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter !== 30) || (userGender === 'female' && genderFilter !== 'tout') || !!effectiveCityFilter) && (
                  <span className="ml-0.5 text-playzi-green font-bold">
                    {(!effectiveCityFilter && isApproximateLocationEnabled && effectiveDistanceFilter !== 30 ? 1 : 0) + ((userGender === 'female' && genderFilter !== 'tout') ? 1 : 0) + (effectiveCityFilter ? 1 : 0)}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>




        {/* Swipeable Card Feed Area — 12px gap after filter zone */}
        <div
          data-onboarding-id="discover-feed"
          className="relative flex-1 w-full px-3 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-0 flex items-start justify-center overflow-y-auto overscroll-contain"
          style={DISCOVER_FEED_STYLE}
        >
          {displayedActivities.length > 0 ? (
            effectiveViewMode === "list" ? (
              <div className="flex w-full flex-col gap-2.5 pb-5 pt-3">
                {displayedActivities.map((activity) => (
                  <ActivityListCard
                    key={activity.id}
                    activity={activity}
                    onOpen={handleOpenActivityDetails}
                  />
                ))}
              </div>
            ) : (
              <>
                <div aria-hidden className="pointer-events-none h-[calc(var(--discover-card-height)+16px)] w-full shrink-0 sm:hidden" />
                {[...displayedActivities].reverse().map((activity, i) => (
                  <SwipeCard
                    key={activity.id}
                    activity={activity}
                    index={i}
                    onboardingId={activity.id === TUTORIAL_DISCOVER_ACTIVITY_ID ? "activity-card" : undefined}
                    swipeEnabled={!isTutorialMode || activity.id === TUTORIAL_DISCOVER_ACTIVITY_ID}
                    onSwipeRight={handleSwipeRight}
                    onSwipeLeft={handleSwipeLeft}
                    onParticipantsClick={setParticipantsActivityId}
                  />
                ))}
              </>
            )
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

              {effectiveCityFilter && (
                <button
                  onClick={clearCityFilter}
                  className="mt-3 text-[13px] font-semibold text-gray-500 underline-offset-2 hover:text-gray-dark hover:underline"
                >
                  Voir toutes les villes
                </button>
              )}
            </div>
          )}

          {isTutorialMode && tutorialStepId === "discover-swipe" && isTutorialSwipeCardVisible && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-none absolute left-2 top-6 z-20 rounded-full border border-rose-200 bg-white/90 px-2 py-1 text-[10px] font-bold text-rose-600 shadow-sm"
              >
                ← Passer
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="pointer-events-none absolute right-2 top-6 z-20 rounded-full border border-emerald-200 bg-white/92 px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm"
              >
                Rejoindre →
              </motion.div>
            </>
          )}

          <AnimatePresence>
            {tutorialSwipeFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm"
              >
                {tutorialSwipeFeedback}
              </motion.div>
            )}
          </AnimatePresence>
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
        key={`filter-${isFilterSheetOpen ? "open" : "closed"}-${effectiveDistanceFilter}-${genderFilter}-${effectiveCityFilter || "none"}-${canUseAdvancedFilters ? "plus" : "free"}`}
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApplyParams={handleApplyFilters}
        currentDistance={effectiveDistanceFilter}
        currentGenderFilter={genderFilter}
        currentCity={effectiveCityFilter}
        isFemale={userGender === 'female'}
        isDistanceEnabled={isApproximateLocationEnabled}
        canUseAdvancedFilters={canUseAdvancedFilters}
      />

      <ParticipantsSheet
        isOpen={!!participantsActivityId}
        onClose={() => setParticipantsActivityId(null)}
        activityId={participantsActivityId}
        currentUserId={currentUserId}
        onSelectParticipant={(participantId) => {
          setParticipantsActivityId(null);
          router.push(`/profil/${participantId}`);
        }}
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
