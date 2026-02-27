"use client";

import { cn } from "@/lib/utils";

interface StepDateTimeProps {
    date: string;
    time: string;
    onDateChange: (d: string) => void;
    onTimeChange: (t: string) => void;
}

// Generate hours 00-23
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
// Generate minutes in 15-min steps
const MINUTES = ["00", "15", "30", "45"];

export default function StepDateTime({ date, time, onDateChange, onTimeChange }: StepDateTimeProps) {
    const today = new Date().toISOString().split("T")[0];
    const [hour, minute] = time ? time.split(":") : ["", ""];

    const handleHourChange = (h: string) => {
        onTimeChange(`${h}:${minute || "00"}`);
    };

    const handleMinuteChange = (m: string) => {
        onTimeChange(`${hour || "08"}:${m}`);
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Date */}
            <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                    Date
                </label>
                <input
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="w-full h-14 px-4 rounded-2xl border-2 border-gray-100 bg-white text-gray-dark text-[15px] font-semibold focus:outline-none focus:border-playzi-green transition-colors"
                />
            </div>

            {/* Time — Premium selectors */}
            <div className="flex flex-col gap-2">
                <label className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                    Heure de début
                </label>
                <div className="flex items-center gap-3">
                    {/* Hour Select */}
                    <div className="relative flex-1">
                        <select
                            value={hour || ""}
                            onChange={(e) => handleHourChange(e.target.value)}
                            className={cn(
                                "w-full h-14 px-4 rounded-2xl border-2 border-gray-100 bg-white text-[15px] font-semibold focus:outline-none focus:border-playzi-green transition-colors appearance-none text-center",
                                hour ? "text-gray-dark" : "text-gray-300"
                            )}
                        >
                            <option value="" disabled>Heure</option>
                            {HOURS.map((h) => (
                                <option key={h} value={h}>{h}h</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    <span className="text-2xl font-bold text-gray-300">:</span>

                    {/* Minute Select */}
                    <div className="relative flex-1">
                        <select
                            value={minute || ""}
                            onChange={(e) => handleMinuteChange(e.target.value)}
                            className={cn(
                                "w-full h-14 px-4 rounded-2xl border-2 border-gray-100 bg-white text-[15px] font-semibold focus:outline-none focus:border-playzi-green transition-colors appearance-none text-center",
                                minute ? "text-gray-dark" : "text-gray-300"
                            )}
                        >
                            <option value="" disabled>Min</option>
                            {MINUTES.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
