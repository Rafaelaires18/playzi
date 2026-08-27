"use client";

import { useEffect, useState } from "react";
import {
    AlertTriangle,
    ChevronRight,
    HelpCircle,
    LogOut,
    Settings,
    Sparkles,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI, PLAYZI_ONBOARDING_REQUEST_EVENT } from "@/lib/playzi-onboarding";

// Internal Sub-Views
import PricingView from "./PricingView";
import SupportView from "./SupportView";
import ReportView from "./ReportView";
import SettingsView from "./SettingsView";

interface OptionsSheetProps {
    open: boolean;
    onClose: () => void;
    initialView?: ViewState;
}

type ViewState = "main" | "pricing" | "settings" | "support" | "report";

const menuItems = [
    {
        id: "pricing",
        icon: Sparkles,
        label: "Plans & tarifs",
        sublabel: "Playzi+ et abonnement",
        badge: "Playzi+",
        iconColor: "text-playzi-green",
        iconBg: "bg-emerald-50",
    },
    {
        id: "settings",
        icon: Settings,
        label: "Paramètres",
        iconColor: "text-gray-700",
        iconBg: "bg-gray-50",
    },
    {
        id: "support",
        icon: HelpCircle,
        label: "Aide & Support",
        iconColor: "text-gray-700",
        iconBg: "bg-gray-50",
    },
    {
        id: "report",
        icon: AlertTriangle,
        label: "Signaler un problème",
        iconColor: "text-gray-700",
        iconBg: "bg-gray-50",
    },
] as const;

export default function OptionsSheet({ open, onClose, initialView = "main" }: OptionsSheetProps) {
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [activeView, setActiveView] = useState<ViewState>(initialView);

    // Reset view when modal opens/closes
    useEffect(() => {
        if (open) {
            setActiveView(initialView);
            return;
        }
        // Small delay so animation finishes before jumping back to initial view
        const timeout = window.setTimeout(() => setActiveView(initialView), 300);
        return () => window.clearTimeout(timeout);
    }, [open, initialView]);

    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [open]);

    useEffect(() => {
        const onOnboardingRequest = (event: Event) => {
            const customEvent = event as CustomEvent<{ type?: string }>;
            if (customEvent.detail?.type !== PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI) return;
            onClose();
        };
        window.addEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
        return () => {
            window.removeEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
        };
    }, [onClose]);

    if (!open) return null;

    const handleLogout = async () => {
        if (isSigningOut) return;
        try {
            setIsSigningOut(true);
            await logoutUser();
        } finally {
            onClose();
            router.replace("/login?force_login=1");
            router.refresh();
        }
    };

    const handleBack = () => setActiveView("main");

    // Render logic
    let viewContent = null;
    if (activeView === "pricing") viewContent = <PricingView onBack={handleBack} />;
    else if (activeView === "settings") viewContent = <SettingsView onBack={handleBack} />;
    else if (activeView === "support") viewContent = <SupportView onBack={handleBack} />;
    else if (activeView === "report") viewContent = <ReportView onBack={handleBack} />;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto sm:items-center sm:justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Sheet / Modal Container */}
            <div className="relative z-[101] w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:w-[400px] bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 sm:fade-in duration-300 ease-out overflow-hidden">

                {activeView === "main" ? (
                    <>
                        {/* Main Header */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-4">
                            <h2 className="text-[28px] font-black tracking-tight text-[#2D2E3B]">Options</h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-10 h-10 flex shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 transition-colors"
                                aria-label="Fermer"
                            >
                                <X className="w-5 h-5" strokeWidth={2} />
                            </button>
                        </div>

                        <div className="px-6 border-b border-gray-50 w-full" />

                        {/* Menu Items */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {menuItems.map((item) => (
                                <motion.button
                                    key={item.label}
                                    type="button"
                                    onClick={() => {
                                        setActiveView(item.id as ViewState);
                                    }}
                                    whileTap={{ scale: 0.97, opacity: 0.82 }}
                                    className={cn(
                                        "flex w-full items-center gap-4 rounded-2xl px-2 py-2.5 transition-all group",
                                        item.id === "pricing"
                                            ? "bg-emerald-50/70 ring-1 ring-playzi-green/15"
                                            : "hover:bg-gray-50/70"
                                    )}
                                >
                                    <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center shrink-0 shadow-sm border border-gray-50/50", item.iconBg)}>
                                        <item.icon className={cn("w-6 h-6", item.iconColor)} strokeWidth={2} />
                                    </div>

                                    <div className="flex flex-col flex-1 text-left min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[17px] text-[#2D2E3B]">{item.label}</span>
                                            {"badge" in item && item.badge && (
                                                <span className="rounded-full border border-playzi-green/20 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-playzi-green">
                                                    {item.badge as string}
                                                </span>
                                            )}
                                        </div>
                                        {'sublabel' in item && item.sublabel && (
                                            <span className="text-[14px] text-gray-400 font-medium mt-0.5">{item.sublabel as string}</span>
                                        )}
                                    </div>

                                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 group-hover:text-gray-400 transition-colors" strokeWidth={2.5} />
                                </motion.button>
                            ))}
                        </div>

                        {/* Logout Button */}
                        <div className="px-6 pt-4 pb-8 sm:pb-6 mt-auto">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-4 text-center group transition-all hover:border-rose-200 active:scale-95"
                            >
                                <LogOut className="w-5 h-5 text-gray-700 transition-colors group-hover:text-rose-600 group-active:text-rose-600" strokeWidth={2.2} />
                                <span className="text-[16px] font-bold text-[#2D2E3B] transition-colors group-hover:text-rose-600 group-active:text-rose-600">
                                    {isSigningOut ? "Déconnexion..." : "Se déconnecter"}
                                </span>
                            </button>
                        </div>
                    </>
                ) : (
                    // Render Sub-Views
                    viewContent
                )}

            </div>
        </div>
    );
}
