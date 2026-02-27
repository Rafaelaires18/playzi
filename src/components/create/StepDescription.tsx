"use client";

import { motion } from "framer-motion";

const MAX_TAGS = 3;
const MAX_CHARS = 100;

type ChipGroup = { label?: string; chips: string[] };

const SPORT_CHIPS: Record<string, ChipGroup[]> = {
    running: [{ chips: ["Footing détente", "Sortie longue", "Fractionné", "Tempo run", "Intervalles"] }],
    velo: [{ chips: ["Sortie chill", "Endurance", "Terrain vallonné", "Gravel"] }],
    "beach-volley": [
        { label: "Format", chips: ["2v2", "3v3", "4v4", "5v5"] },
        { label: "Session", chips: ["Match", "Entraînement"] },
    ],
    football: [
        { label: "Format", chips: ["4v4", "5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"] },
        { label: "Session", chips: ["Match", "Technique", "Entraînement"] },
    ],
};

function formatPace(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSportLabel(sport: string | null) {
    if (!sport) return "Sport";
    return sport.charAt(0).toUpperCase() + sport.slice(1);
}

interface StepDescriptionProps {
    sport: string | null;
    level?: string | null;
    distance?: number;
    pace?: number;
    tags: string[];
    onTagsChange: (tags: string[]) => void;
    description: string;
    onDescriptionChange: (d: string) => void;
}

export default function StepDescription({
    sport,
    level,
    distance,
    pace,
    tags,
    onTagsChange,
    description,
    onDescriptionChange,
}: StepDescriptionProps) {
    const sportKey = sport?.toLowerCase() ?? "";
    const groups: ChipGroup[] = SPORT_CHIPS[sportKey] ?? [];

    const toggleTag = (chip: string) => {
        if (tags.includes(chip)) {
            onTagsChange(tags.filter((t) => t !== chip));
        } else if (tags.length < MAX_TAGS) {
            onTagsChange([...tags, chip]);
        }
    };

    // Badge for the card preview
    const badge = (() => {
        if (sport === "running" && distance) {
            return `${distance} km${pace ? ` · ${formatPace(pace)}/km` : ""}`;
        }
        if (sport === "velo" && distance) {
            return `${distance} km${level ? ` · ${level}` : ""}`;
        }
        return level ?? null;
    })();

    const hasPreviewContent = tags.length > 0 || description.trim();

    return (
        <div className="flex flex-col gap-6">

            {/* ── Live card preview ─────────────────────────── */}
            <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                    Aperçu carte
                </p>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col gap-1.5">
                    {/* Sport + badge row */}
                    <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-gray-dark leading-tight">
                            {getSportLabel(sport)}
                        </span>
                        {badge && (
                            sport === "running" ? (
                                <span className="flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-100">
                                    {badge}
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold tracking-widest uppercase rounded-full border border-gray-100">
                                    {badge}
                                </span>
                            )
                        )}
                    </div>

                    {/* Tags + description */}
                    {hasPreviewContent ? (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                            {tags.length > 0 && (
                                <p className="text-[11px] font-semibold text-gray-300 truncate">
                                    {tags.join("\u00a0•\u00a0")}
                                </p>
                            )}
                            {description.trim() && (
                                <p className="text-[12px] text-gray-300 truncate">
                                    {description}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-200 italic mt-0.5">
                            Sélectionne des tags ou ajoute une ambiance…
                        </p>
                    )}
                </div>
            </div>

            {/* ── Chips ─────────────────────────────────────── */}
            {groups.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                            Suggestions rapides
                        </p>
                        {tags.length > 0 && (
                            <span className="text-[11px] font-semibold text-playzi-green">
                                {tags.length}/{MAX_TAGS} sélectionné{tags.length > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>

                    {groups.map((group, gi) => (
                        <div key={gi} className="flex flex-col gap-2">
                            {group.label && (
                                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
                                    {group.label}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {group.chips.map((chip) => {
                                    const selected = tags.includes(chip);
                                    const disabled = !selected && tags.length >= MAX_TAGS;
                                    return (
                                        <motion.button
                                            key={chip}
                                            whileTap={{ scale: 0.93 }}
                                            onClick={() => toggleTag(chip)}
                                            disabled={disabled}
                                            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border-2 transition-all ${selected
                                                    ? "bg-playzi-green/10 border-playzi-green text-playzi-green shadow-sm"
                                                    : disabled
                                                        ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed"
                                                        : "bg-white border-gray-100 text-gray-500 hover:border-playzi-green hover:text-playzi-green"
                                                }`}
                                        >
                                            {chip}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Ambiance (texte court) ─────────────────────── */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <label className="text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                        Ambiance
                    </label>
                    <span className="text-[11px] text-gray-400 font-medium">Facultatif</span>
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => {
                            const val = e.target.value.replace(/[\r\n]/g, "");
                            if (val.length <= MAX_CHARS) onDescriptionChange(val);
                        }}
                        placeholder="Ambiance chill, on joue sérieux 🔥"
                        className="w-full px-4 py-3.5 pr-14 rounded-2xl border-2 border-gray-100 bg-white text-[14px] text-gray-dark placeholder:text-gray-300 focus:outline-none focus:border-playzi-green transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-gray-300 font-medium pointer-events-none">
                        {description.length}/{MAX_CHARS}
                    </span>
                </div>
            </div>

            {/* ── Tip ───────────────────────────────────────── */}
            <div className="bg-playzi-green/5 border border-playzi-green/20 rounded-2xl px-4 py-3.5">
                <p className="text-[12px] text-playzi-green font-semibold mb-1">💡 Conseil</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">
                    Les tags aident les joueurs à identifier ton activité en un coup d&apos;œil. Une ambiance claire = plus de rejoints !
                </p>
            </div>
        </div>
    );
}
