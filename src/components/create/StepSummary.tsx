import { SportParams } from "@/components/create/StepSport";
import { formatPace } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StepSummaryProps {
    sport: string | null;
    level: string | null;
    date: string;
    time: string;
    locationText: string | null;
    maxParticipants: number;
    isUnlimited: boolean;
    groupType: "mixte" | "filles" | null;
    sportParams: SportParams;
    tags: string[];
    description: string;
    isFemale: boolean;
}

export default function StepSummary({
    sport,
    level,
    date,
    time,
    locationText,
    maxParticipants,
    isUnlimited,
    groupType,
    sportParams,
    tags,
    description,
    isFemale
}: StepSummaryProps) {

    // Format Date / Time
    let formattedDateTime = "Date et heure non définies";
    if (date && time) {
        try {
            const [y, m, d] = date.split('-');
            const [hr, min] = time.split(':');
            const dateObj = new Date(Number(y), Number(m) - 1, Number(d), Number(hr), Number(min));
            formattedDateTime = format(dateObj, "EEEE d MMMM 'à' HH:mm", { locale: fr });
            // Capitalize first letter
            formattedDateTime = formattedDateTime.charAt(0).toUpperCase() + formattedDateTime.slice(1);
        } catch (e) {
            formattedDateTime = "Date invalide";
        }
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Sport Header Row */}
            <div className="flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100">
                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-gray-100 bg-white">
                    <img
                        src={`/images/${sport === "running" ? "running.png" : sport === "beach-volley" ? "beachvolley.png" : "cycling.png"}`}
                        alt="Sport Thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-dark capitalize">{sport || "Sport"}</h2>

                    {/* Metrics / Levels */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {sport === "running" ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md border border-emerald-100/50 uppercase tracking-wide">
                                {sportParams.distance} km • {formatPace(sportParams.pace)}/km
                            </span>
                        ) : sport === "vélo" ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-md border border-emerald-100/50 uppercase tracking-wide">
                                {sportParams.distance} km • {level}
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-bold rounded-md border border-gray-200/50 uppercase tracking-wide">
                                {level || "Tout niveau"}
                            </span>
                        )}

                        {isFemale && groupType === "filles" && (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-[11px] font-bold rounded-md border border-purple-100/50 uppercase tracking-wide">
                                Entre filles
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Detailed Summary Grid */}
            <div className="flex flex-col gap-4">

                {/* When & Where */}
                <div className="bg-white border text-sm border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                        <span className="text-gray-400 font-bold shrink-0">Quand</span>
                        <span className="text-gray-dark font-semibold text-right">{formattedDateTime}</span>
                    </div>
                    <div className="h-px bg-gray-100 w-full" />
                    <div className="flex justify-between items-start">
                        <span className="text-gray-400 font-bold shrink-0">Où</span>
                        <span className="text-gray-dark font-semibold text-right max-w-[65%] truncate">{locationText || "Lausanne"}</span>
                    </div>
                    <div className="h-px bg-gray-100 w-full" />
                    <div className="flex justify-between items-start">
                        <span className="text-gray-400 font-bold shrink-0">Participants</span>
                        <span className="text-gray-dark font-semibold text-right">
                            {isUnlimited ? "Illimité" : maxParticipants}
                        </span>
                    </div>
                </div>

                {/* Tags & Description */}
                {(tags.length > 0 || description) && (
                    <div className="bg-white border text-sm border-gray-100 rounded-3xl p-5 shadow-sm space-y-4">
                        {tags.length > 0 && (
                            <div className="flex flex-col space-y-2">
                                <span className="text-gray-400 font-bold">Tags</span>
                                <div className="flex flex-wrap gap-2">
                                    {tags.map((tag) => (
                                        <span key={tag} className="px-3 py-1 bg-gray-50 border border-gray-100 text-gray-600 rounded-xl text-[12px] font-bold">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {tags.length > 0 && description && <div className="h-px bg-gray-100 w-full" />}
                        {description && (
                            <div className="flex flex-col space-y-2">
                                <span className="text-gray-400 font-bold">Ambiance</span>
                                <p className="text-gray-600 font-medium leading-relaxed italic border-l-2 border-gray-200 pl-3">
                                    "{description}"
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <p className="text-center text-[12px] font-medium text-gray-400 mb-8">
                Relisez les informations ci-dessus avant de publier votre activité.
            </p>
        </div>
    );
}
