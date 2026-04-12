"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export type TimeFilter = "1M" | "3M" | "6M" | "1A";
export type PulsePoint = { label: string; value: number; date_ms?: number };
export type PulseSeries = Record<TimeFilter, PulsePoint[]>;
type PulseChartPoint = PulsePoint & { delta: number; index: number };

function computeYAxisUpperBound(maxValue: number) {
    if (maxValue <= 0) return 100;
    if (maxValue <= 500) return Math.ceil(maxValue / 50) * 50;
    if (maxValue <= 1000) return Math.ceil(maxValue / 100) * 100;
    return Math.ceil(maxValue / 200) * 200;
}

function formatPulseTooltipDate(point: PulsePoint | null) {
    if (!point) return "";
    const ms = Number(point.date_ms);
    if (Number.isFinite(ms) && ms > 0) {
        return new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    }
    return point.label || "";
}

type PulseEvolutionCardProps = {
    title?: string;
    seriesByFilter: PulseSeries;
    initialFilter?: TimeFilter;
};

export default function PulseEvolutionCard({
    title = "Évolution Pulse",
    seriesByFilter,
    initialFilter = "1M",
}: PulseEvolutionCardProps) {
    const [timeFilter, setTimeFilter] = useState<TimeFilter>(initialFilter);
    const [selectedPulsePoint, setSelectedPulsePoint] = useState<{ index: number; x: number; y: number } | null>(null);
    const pulseChartWrapRef = useRef<HTMLDivElement | null>(null);
    const pulsePointCoordsRef = useRef<Record<number, { x: number; y: number }>>({});
    const [pulseChartWrapWidth, setPulseChartWrapWidth] = useState(0);

    const pulseChartData = useMemo<PulseChartPoint[]>(() => {
        const base = seriesByFilter[timeFilter] || [];
        return base.map((point, index) => ({
            ...point,
            index,
            delta: index === 0 ? Number(point.value || 0) : Number(point.value || 0) - Number(base[index - 1]?.value || 0),
        }));
    }, [seriesByFilter, timeFilter]);

    const pulseChartUpperBound = useMemo(() => {
        const maxValue = pulseChartData.reduce((max, point) => Math.max(max, Number(point.value || 0)), 0);
        return computeYAxisUpperBound(maxValue);
    }, [pulseChartData]);

    const selectedPulseData = selectedPulsePoint && selectedPulsePoint.index < pulseChartData.length
        ? pulseChartData[selectedPulsePoint.index]
        : null;
    const selectedPulseGain = selectedPulseData ? selectedPulseData.delta : 0;
    const selectedPulseGainLabel = `${selectedPulseGain >= 0 ? "+" : ""}${selectedPulseGain} Pulse`;
    const selectedPulseDateLabel = formatPulseTooltipDate(selectedPulseData);

    useEffect(() => {
        const element = pulseChartWrapRef.current;
        if (!element) return;
        const updateWidth = () => setPulseChartWrapWidth(element.clientWidth || 0);
        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!selectedPulsePoint) return;
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (!pulseChartWrapRef.current?.contains(target)) {
                setSelectedPulsePoint(null);
            }
        };
        const onScroll = () => setSelectedPulsePoint(null);
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("touchstart", onPointerDown);
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("touchstart", onPointerDown);
            window.removeEventListener("scroll", onScroll);
        };
    }, [selectedPulsePoint]);

    return (
        <section className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-[18px] font-black text-[#242841]">{title}</h3>
                <div className="inline-flex rounded-full border border-gray-200 bg-gray-100/80 p-1">
                    {(Object.keys(seriesByFilter) as TimeFilter[]).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => {
                                setTimeFilter(filter);
                                setSelectedPulsePoint(null);
                                pulsePointCoordsRef.current = {};
                            }}
                            className={cn(
                                "rounded-full px-3 py-1 text-[11px] font-black transition",
                                timeFilter === filter ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500"
                            )}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>
            <div
                ref={pulseChartWrapRef}
                className="relative"
                onClick={(event) => {
                    const container = pulseChartWrapRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const clickX = event.clientX - rect.left;
                    const coords = Object.entries(pulsePointCoordsRef.current);
                    if (!coords.length) return;
                    let nearestIndex = -1;
                    let nearestDistance = Number.POSITIVE_INFINITY;
                    for (const [indexStr, point] of coords) {
                        const distance = Math.abs(point.x - clickX);
                        if (distance < nearestDistance) {
                            nearestDistance = distance;
                            nearestIndex = Number(indexStr);
                        }
                    }
                    if (nearestIndex >= 0) {
                        const nearestPoint = pulsePointCoordsRef.current[nearestIndex];
                        if (nearestPoint) {
                            setSelectedPulsePoint({ index: nearestIndex, x: nearestPoint.x, y: nearestPoint.y });
                        }
                    }
                }}
            >
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={pulseChartData} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.18} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }}
                                interval="preserveStartEnd"
                                minTickGap={16}
                                padding={{ left: 2, right: 14 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 700 }}
                                width={44}
                                domain={[0, pulseChartUpperBound]}
                                allowDecimals={false}
                            />
                            <Area
                                key={`pulse-area-${timeFilter}`}
                                type="monotone"
                                dataKey="value"
                                stroke="#10B981"
                                strokeWidth={2.5}
                                fill="url(#pulseGradient)"
                                dot={(dotProps) => {
                                    const pointIndex = Number(dotProps.index ?? -1);
                                    const isSelected = pointIndex >= 0 && selectedPulsePoint?.index === pointIndex;
                                    const cx = Number(dotProps.cx ?? 0);
                                    const cy = Number(dotProps.cy ?? 0);
                                    const isLatestPoint = pointIndex === pulseChartData.length - 1;
                                    if (pointIndex >= 0) {
                                        pulsePointCoordsRef.current[pointIndex] = { x: cx, y: cy };
                                    }
                                    return (
                                        <g>
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={15}
                                                fill="transparent"
                                                style={{ cursor: "pointer" }}
                                                onMouseDown={(event) => event.stopPropagation()}
                                                onTouchStart={(event) => {
                                                    event.stopPropagation();
                                                    if (pointIndex < 0) return;
                                                    setSelectedPulsePoint({ index: pointIndex, x: cx, y: cy });
                                                }}
                                                onClick={() => {
                                                    if (pointIndex < 0) return;
                                                    setSelectedPulsePoint({ index: pointIndex, x: cx, y: cy });
                                                }}
                                            />
                                            {isLatestPoint && (
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={7}
                                                    fill="transparent"
                                                    stroke="#10B981"
                                                    strokeOpacity={0.24}
                                                    strokeWidth={1.6}
                                                />
                                            )}
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={isSelected ? 4.8 : isLatestPoint ? 3.7 : 2.4}
                                                fill={isLatestPoint ? "#059669" : "#10B981"}
                                                stroke="#ffffff"
                                                strokeWidth={isSelected ? 1.9 : isLatestPoint ? 1.6 : 1.2}
                                                style={{ transition: "all 120ms ease" }}
                                            />
                                        </g>
                                    );
                                }}
                                activeDot={false}
                                isAnimationActive={true}
                                animationDuration={620}
                                animationEasing="ease-out"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {selectedPulsePoint && selectedPulseData && (
                    <div
                        className="pointer-events-none absolute inset-y-3 border-l border-dashed border-emerald-300"
                        style={{ left: `${selectedPulsePoint.x}px` }}
                    />
                )}

                {selectedPulsePoint && selectedPulseData && (
                    <div
                        className="pointer-events-none absolute z-20 w-[150px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-[#1f2937] shadow-[0_8px_24px_rgba(31,41,55,0.12)]"
                        style={{
                            left: `${Math.max(8, Math.min(selectedPulsePoint.x - 75, Math.max(8, pulseChartWrapWidth - 158)))}px`,
                            top: `${Math.max(0, selectedPulsePoint.y - 80)}px`,
                        }}
                    >
                        <p className="text-[12px] font-bold capitalize">{selectedPulseDateLabel}</p>
                        <p className="mt-1 text-[12px] font-black text-emerald-600">{selectedPulseGainLabel}</p>
                        <p className="mt-1 text-[11px] font-semibold">Total : {selectedPulseData.value}</p>
                    </div>
                )}
            </div>
        </section>
    );
}
