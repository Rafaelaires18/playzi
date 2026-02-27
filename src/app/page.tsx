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
  const cityFilter = searchParams.get("city");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);

  // Dev Toggle State
  const [mockGender, setMockGender] = useState<'male' | 'female'>(MOCK_CURRENT_USER.gender);

  // New Filter States
  // New Filter States
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [distanceFilter, setDistanceFilter] = useState<number>(30); // Default 30km
  const [genderFilter, setGenderFilter] = useState<'mixte' | 'filles' | 'tout'>('mixte');

  // Load from sessionStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDist = sessionStorage.getItem("playzi_distanceFilter");
      const savedGen = sessionStorage.getItem("playzi_genderFilter") as 'mixte' | 'filles' | 'tout';
      if (savedDist) setDistanceFilter(parseInt(savedDist, 10));
      if (savedGen && mockGender !== 'male') setGenderFilter(savedGen);
      else if (!savedGen) setGenderFilter(mockGender === 'female' ? 'tout' : 'mixte');
    }
  }, []); // Only on initial client mount

  // When mock gender changes: hard-reset for male, keep saved filter for female
  useEffect(() => {
    if (mockGender === 'male') {
      setGenderFilter('mixte');
    } else {
      // Restore the last saved gender filter — don't wipe validated filters
      const savedGen = typeof window !== 'undefined'
        ? sessionStorage.getItem("playzi_genderFilter") as 'mixte' | 'filles' | 'tout' | null
        : null;
      setGenderFilter(savedGen ?? 'tout');
    }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('playzi_mockGender', mockGender);
    }
  }, [mockGender]);

  // Persist filters to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("playzi_distanceFilter", distanceFilter.toString());
      sessionStorage.setItem("playzi_genderFilter", genderFilter);
    }
  }, [distanceFilter, genderFilter]);


  // Filter activities when component mounts or filters change
  useEffect(() => {
    let filtered = [...MOCK_ACTIVITIES];

    // 0. Base Logic: Never show full activities in the Discover feed
    filtered = filtered.filter(a => a.isUnlimited || a.attendees < a.maxAttendees);

    // 1. Hard Filter: Men NEVER see "Entre filles" activities
    if (mockGender === 'male') {
      filtered = filtered.filter(a => a.genderFilter !== 'filles');
    }

    // 2. User Preferences Filter
    if (mockGender === 'female' && genderFilter !== 'tout') {
      filtered = filtered.filter(a => (a.genderFilter || 'mixte') === genderFilter);
    }

    // 3. City Filter
    if (cityFilter) {
      filtered = filtered.filter((a) => a.location === cityFilter);
    }

    // Note: Distance filtering is just UI mock for now since activities lack coordinates,
    // but the state exists and is ready for real backend implementation.

    setActivities(filtered);
  }, [cityFilter, genderFilter, distanceFilter, mockGender]);

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
  };

  const handleApplyFilters = (dist: number, gen: 'mixte' | 'filles' | 'tout') => {
    setDistanceFilter(dist);
    setGenderFilter(gen);
  };

  return (
    <main className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background relative overflow-hidden">
      <Header devGender={mockGender} onDevGenderChange={setMockGender} />

      {/* --- Filter System & Feed Container --- */}
      <div className="flex-1 w-full flex flex-col pt-[76px]">

        {/* ── Filter Zone — fixed height, no layout shift ── */}
        <div className="px-6 flex flex-col mb-5">

          {/* Row 1: Localisation — always reserved, visible only when active */}
          <div className="flex items-center min-h-[20px]">
            {cityFilter ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                📍 {cityFilter}
                <button onClick={clearFilter} className="hover:bg-gray-100 p-0.5 rounded-full transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ) : <span className="inline-block h-4" />}
          </div>

          {/* Row 2: Filtres actifs (gauche) + bouton Filtrer (droite) — always at same position */}
          <div className="flex items-center justify-between min-h-[32px]">
            <div className="flex-1">
              {(distanceFilter !== 30 || genderFilter !== (mockGender === 'female' ? 'tout' : 'mixte')) && (
                <p className="text-[12px] font-medium text-gray-500">
                  {distanceFilter !== 30 && `Distance ${distanceFilter} km`}
                  {distanceFilter !== 30 && genderFilter !== (mockGender === 'female' ? 'tout' : 'mixte') && <span className="mx-1.5 font-bold">·</span>}
                  {genderFilter === 'filles' && 'Entre filles'}
                  {mockGender === 'female' && genderFilter === 'mixte' && 'Mixte'}
                </p>
              )}
            </div>
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="h-8 min-w-[80px] shrink-0 bg-white rounded-full shadow-sm border border-gray-100 flex items-center justify-center px-3 transition-all hover:bg-gray-50 active:scale-95"
            >
              <span className="text-[12px] font-semibold text-gray-dark tracking-wide flex items-center gap-1">
                Filtrer
                {(distanceFilter !== 30 || genderFilter !== (mockGender === 'female' ? 'tout' : 'mixte')) && (
                  <span className="ml-0.5 text-playzi-green font-bold">
                    {(distanceFilter !== 30 ? 1 : 0) + (genderFilter !== (mockGender === 'female' ? 'tout' : 'mixte') ? 1 : 0)}
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
        isFemale={mockGender === 'female'}
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
