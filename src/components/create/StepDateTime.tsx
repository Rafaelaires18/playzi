"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface StepDateTimeProps {
    date: string;
    time: string;
    onDateChange: (d: string) => void;
    onTimeChange: (t: string) => void;
}

// Allowed window for V1: 05:45 -> 23:45
const HOURS = Array.from({ length: 19 }, (_, i) => String(i + 5).padStart(2, "0")); // 05..23
// Generate minutes in 15-min steps
const MINUTES = ["00", "15", "30", "45"];

function formatLocalDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getSlotMinutes(timeValue: string) {
    const [slotHour, slotMinute] = timeValue.split(":").map(Number);
    if (!Number.isFinite(slotHour) || !Number.isFinite(slotMinute)) return null;
    return (slotHour * 60) + slotMinute;
}

export function getMinimumBookableTime(selectedDate: string, now = new Date()) {
    const today = formatLocalDateInputValue(now);
    if (selectedDate !== today) return null;

    const currentMinutes =
        (now.getHours() * 60)
        + now.getMinutes()
        + (now.getSeconds() > 0 || now.getMilliseconds() > 0 ? 1 / 60 : 0);
    const nextQuarterMinutes = Math.ceil(currentMinutes / 15) * 15;
    const hour = Math.floor(nextQuarterMinutes / 60);
    const minute = nextQuarterMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isTimeSlotAvailable(selectedDate: string, slotTime: string, now = new Date()) {
    if (!selectedDate) return true;
    if (selectedDate < formatLocalDateInputValue(now)) return false;

    const minimumTime = getMinimumBookableTime(selectedDate, now);
    if (!minimumTime) return true;

    const slotMinutes = getSlotMinutes(slotTime);
    const minimumMinutes = getSlotMinutes(minimumTime);
    if (slotMinutes === null || minimumMinutes === null) return false;
    return slotMinutes >= minimumMinutes;
}

export default function StepDateTime({ date, time, onDateChange, onTimeChange }: StepDateTimeProps) {
    const today = formatLocalDateInputValue(new Date());
    const [hour, minute] = time ? time.split(":") : ["", ""];
    const allowedMinutes = hour === "05" ? ["45"] : MINUTES;
    const isHourAvailable = (h: string) => {
        const minutesForHour = h === "05" ? ["45"] : MINUTES;
        return minutesForHour.some((m) => isTimeSlotAvailable(date, `${h}:${m}`));
    };
    const fallbackHour = hour || HOURS.find(isHourAvailable) || "08";
    const availableMinutes = allowedMinutes.filter((m) => isTimeSlotAvailable(date, `${fallbackHour}:${m}`));

    useEffect(() => {
        if (!time) return;
        if (!isTimeSlotAvailable(date, time)) onTimeChange("");
    }, [date, time, onTimeChange]);

    const handleHourChange = (h: string) => {
        const minutesForHour = h === "05" ? ["45"] : MINUTES;
        const nextMinute = minutesForHour.includes(minute) && isTimeSlotAvailable(date, `${h}:${minute}`)
            ? minute
            : minutesForHour.find((m) => isTimeSlotAvailable(date, `${h}:${m}`));
        if (!nextMinute) return;
        onTimeChange(`${h}:${nextMinute}`);
    };

    const handleMinuteChange = (m: string) => {
        const safeHour = hour || HOURS.find(isHourAvailable) || "08";
        const safeMinute = safeHour === "05" ? "45" : m;
        if (!isTimeSlotAvailable(date, `${safeHour}:${safeMinute}`)) return;
        onTimeChange(`${safeHour}:${safeMinute}`);
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
                            <option value="" disabled className="text-gray-300">Heure</option>
                            {HOURS.map((h) => (
                                <option
                                    key={h}
                                    value={h}
                                    disabled={!isHourAvailable(h)}
                                    className={isHourAvailable(h) ? "text-gray-dark" : "text-gray-300"}
                                    style={{ color: isHourAvailable(h) ? "#2B2D42" : "#D1D5DB" }}
                                >
                                    {h}h
                                </option>
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
                            <option value="" disabled className="text-gray-300">Min</option>
                            {allowedMinutes.map((m) => (
                                <option
                                    key={m}
                                    value={m}
                                    disabled={!availableMinutes.includes(m)}
                                    className={availableMinutes.includes(m) ? "text-gray-dark" : "text-gray-300"}
                                    style={{ color: availableMinutes.includes(m) ? "#2B2D42" : "#D1D5DB" }}
                                >
                                    {m}
                                </option>
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
