"use client";

import { useRouter } from "next/navigation";
import SettingsView from "@/components/options/SettingsView";

export default function SettingsPage() {
    const router = useRouter();

    const handleClose = () => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/discover");
    };

    return (
        <main className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm sm:items-center sm:justify-center">
            <div className="h-[90vh] w-full overflow-hidden rounded-t-[32px] bg-white shadow-2xl sm:h-auto sm:max-h-[85vh] sm:w-[400px] sm:rounded-[32px]">
                <SettingsView onBack={handleClose} />
            </div>
        </main>
    );
}
