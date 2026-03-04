"use client";

import { Suspense, useEffect, useState } from "react";
import SwipeCard, { Activity } from "@/components/SwipeCard";
import BottomSheetConfirmation from "@/components/BottomSheetConfirmation";
import BottomSheetFilter from "@/components/BottomSheetFilter";
import BottomNavigation from "@/components/BottomNavigation";
import Header from "@/components/Header";
import { Filter, X } from "lucide-react";
import { MOCK_ACTIVITIES, MOCK_CURRENT_USER } from "@/lib/data";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlCity = searchParams.get("city");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Authentic User State
  const [userGender, setUserGender] = useState<'male' | 'female'>('male');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  // New Filter States
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<number>(30); // Default 30km
  const [genderFilter, setGenderFilter] = useState<'mixte' | 'filles' | 'tout'>('tout');
  const [cityFilter, setCityFilter] = useState<string | null>(urlCity || null);

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

  const fetchActivities = async () => {
    try {
      // Pass gender filter as URL param so the API knows what the user explicitly requested
      const url = new URL("/api/activities", window.location.origin);
      if (genderFilter && genderFilter !== 'tout') {
        url.searchParams.append('genderFilter', genderFilter);
      }
      if (cityFilter) {
        url.searchParams.append('city', cityFilter);
      }
      if (distanceFilter) {
        url.searchParams.append('maxDistance', distanceFilter.toString());
      }
      // Add cache buster
      url.searchParams.append('t', Date.now().toString());

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          // Base Logic: Never show full activities in the Discover feed
          const available = data.filter((a: any) => a.is_unlimited || (a.max_attendees && a.attendees < a.max_attendees));
          setActivities(available);
        }
      }
    } catch (e) {
      console.error("Failed to load activities", e);
    }
  };

  // 1. Initial Load: Check Auth
  useEffect(() => {
    fetchUser();
  }, []);

  // 2. Fetch Activities when filters change
  useEffect(() => {
    fetchActivities();
  }, [cityFilter, genderFilter, distanceFilter]);

  if (isLoadingAuth) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-playzi-green"></div>
      </div>
    );
  }

  const handleSwipeRight = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsBottomSheetOpen(true);
    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    }, 300);
  };

  const handleSwipeLeft = (activity: Activity) => {
    setTimeout(() => {
      setActivities((prev) => prev.filter((a) => a.id !== activity.id));
    }, 300);
  };

  const handleConfirm = () => {
    setIsBottomSheetOpen(false);
  };

  const handleCancel = () => {
    setIsBottomSheetOpen(false);
    setSelectedActivity(null);
  };

  const clearFilter = () => {
    router.push("/");
    setCityFilter(null);
  };

  const handleApplyFilters = (dist: number, gen: 'mixte' | 'filles' | 'tout', city: string | null) => {
    setDistanceFilter(dist);
    setGenderFilter(gen);
    setCityFilter(city);
  };

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden">
      <Header />

      {/* --- Filter System & Feed Container --- */}
      <div className="flex-1 w-full flex flex-col pt-[76px]">

        {/* ── Filter Zone — fixed height, no layout shift ── */}
        <div className="px-6 flex flex-col mb-10">

          {/* Row 1: Localisation — always reserved, visible only when active */}
          <div className="flex items-center min-h-[20px]">
            {cityFilter ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                📍 {cityFilter}
                <button onClick={clearFilter} className="hover:bg-gray-100 p-0.5 rounded-full transition-colors ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : <span className="inline-block h-4" />}
          </div>

          {/* Row 2: Filtres actifs (gauche) + bouton Filtrer (droite) — always at same position */}
          <div className="flex items-center justify-between min-h-[32px]">
            <div className="flex-1">
              {(distanceFilter !== 30 || (userGender === 'female' && genderFilter !== 'tout')) && (
                <p className="text-[12px] font-medium text-gray-500">
                  {distanceFilter !== 30 && `Distance ${distanceFilter} km`}
                  {distanceFilter !== 30 && (userGender === 'female' && genderFilter !== 'tout') && <span className="mx-1.5 font-bold">·</span>}
                  {userGender === 'female' && genderFilter === 'filles' && 'Entre filles'}
                  {userGender === 'female' && genderFilter === 'mixte' && 'Mixte'}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="h-8 min-w-[80px] shrink-0 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center px-3 transition-all hover:bg-gray-50 active:scale-95"
            >
              <span className="text-[12px] font-semibold text-gray-dark tracking-wide flex items-center gap-1">
                Filtrer
                {(distanceFilter !== 30 || (userGender === 'female' && genderFilter !== 'tout')) && (
                  <span className="ml-0.5 text-playzi-green font-bold">
                    {(distanceFilter !== 30 ? 1 : 0) + ((userGender === 'female' && genderFilter !== 'tout') ? 1 : 0)}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>




        {/* Swipeable Card Feed Area — 12px gap after filter zone */}
        <div className="relative flex-1 w-full px-4 pb-28 flex items-center justify-center">
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
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="text-5xl">🥺</div>
              <h2 className="text-2xl font-bold text-gray-dark">Plus rien pour le moment</h2>
              <p className="text-gray-500">
                {cityFilter ? `Aucune activité trouvée à ${cityFilter}.` : "Élargis tes filtres ou reviens plus tard !"}
              </p>
              {cityFilter && (
                <button
                  onClick={clearFilter}
                  className="mt-4 px-6 py-2 bg-playzi-green text-white font-bold rounded-full shadow-sm hover:translate-y-[-2px] transition-transform"
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
      />

      <BottomSheetFilter
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        onApplyParams={handleApplyFilters}
        currentDistance={distanceFilter}
        currentGenderFilter={genderFilter}
        currentCity={cityFilter}
        isFemale={userGender === 'female'}
      />

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
