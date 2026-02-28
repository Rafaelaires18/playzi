import { useState, ChangeEvent } from "react";
import Image from "next/image";
import { ChevronLeft, Send, ImagePlus, X } from "lucide-react";

interface ReportViewProps {
    onBack: () => void;
}

const categories = ["Bug", "Abus", "Paiement", "Autre"] as const;

export default function ReportView({ onBack }: ReportViewProps) {
    const [category, setCategory] = useState<(typeof categories)[number]>("Bug");
    const [description, setDescription] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }

        setImagePreview(URL.createObjectURL(file));
    };

    const removeImage = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
        }
        setImagePreview(null);
    };

    const handleSubmit = () => {
        window.alert("Merci, on a bien reçu votre signalement.");
        setDescription("");
        removeImage();
        setCategory("Bug");
        onBack();
    };

    return (
        <div className="flex flex-col h-full bg-gray-50/50 animate-in slide-in-from-right-8 duration-300 ease-out">
            <div className="flex items-center px-4 py-3 shrink-0 bg-white border-b border-gray-100">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-700" strokeWidth={2.5} />
                </button>
                <h2 className="text-[18px] font-black text-[#2D2E3B] ml-2">Signaler un problème</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-safe space-y-6">
                <div>
                    <h1 className="text-[28px] font-black tracking-tight text-[#2D2E3B]">Signaler</h1>
                    <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-500">
                        Aidez-nous à améliorer Playzi. Décrivez le problème et ajoutez une capture si possible.
                    </p>
                </div>

                <div className="space-y-5">
                    {/* Catégorie */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-widest text-gray-400 px-1">
                            Catégorie
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as (typeof categories)[number])}
                            className="w-full h-12 px-4 rounded-[16px] border border-gray-200 bg-white shadow-sm text-[15px] font-bold text-[#2D2E3B] focus:outline-none focus:border-playzi-green/50 focus:ring-2 focus:ring-playzi-green/10 appearance-none transition-all"
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-widest text-gray-400 px-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Que s'est-il passé ?"
                            className="w-full h-28 p-4 rounded-[16px] border border-gray-200 bg-white shadow-sm text-[14px] font-medium text-[#2D2E3B] placeholder-gray-300 focus:outline-none focus:border-playzi-green/50 focus:ring-2 focus:ring-playzi-green/10 resize-none transition-all"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-1.5">
                        <label className="text-[12px] font-bold uppercase tracking-widest text-gray-400 px-1">
                            Pièce jointe (Optionnel)
                        </label>

                        {!imagePreview ? (
                            <label className="flex flex-col items-center justify-center w-full h-28 rounded-[16px] border-2 border-dashed border-gray-200 bg-gray-50/50 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors">
                                <ImagePlus className="w-8 h-8 text-gray-300 mb-2" strokeWidth={2} />
                                <span className="text-[13px] font-bold text-gray-400">Ajouter une capture d'écran</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        ) : (
                            <div className="relative w-full rounded-[16px] overflow-hidden border border-gray-100 shadow-sm bg-gray-100">
                                <Image src={imagePreview} alt="Aperçu" width={600} height={400} className="w-full h-auto object-cover max-h-40" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between p-3">
                                    <span className="text-white text-[12px] font-bold">Aperçu</span>
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="bg-white/20 backdrop-blur-md rounded-full px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-white/30 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 pb-6">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!description.trim()}
                        className={`w-full h-12 rounded-[16px] flex items-center justify-center gap-2 font-bold text-[15px] transition-all shadow-sm ${description.trim() ? "bg-[#2D2E3B] text-white active:scale-[0.98] hover:bg-gray-800" : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"}`}
                    >
                        <Send className="w-4 h-4 opacity-80" strokeWidth={2.5} />
                        Envoyer
                    </button>
                </div>
            </div>
        </div>
    );
}
