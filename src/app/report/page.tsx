"use client";

import { useState, ChangeEvent } from "react";
import Image from "next/image";
import Header from "@/components/Header";
import OptionsSheet from "@/components/options/OptionsSheet";
import { AlertTriangle, Send, ImagePlus, X } from "lucide-react";

const categories = ["Bug", "Abus", "Paiement", "Autre"] as const;

export default function ReportPage() {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
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
    };

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white relative">
            <Header onOpenOptions={() => setIsOptionsOpen(true)} />
            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

            <div className="flex-1 overflow-y-auto px-6 pb-12 pt-24 space-y-6 bg-gray-50/50">
                <div>
                    <h1 className="text-[32px] font-black tracking-tight text-[#2D2E3B] flex items-center gap-3">
                        <AlertTriangle className="w-8 h-8 text-amber-500" strokeWidth={2.5} />
                        Signaler
                    </h1>
                    <p className="mt-2 text-[15px] font-medium leading-relaxed text-gray-500">
                        Aidez-nous à améliorer Playzi. Décrivez le problème et ajoutez une capture si possible.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Catégorie */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-bold uppercase tracking-wider text-gray-400 px-1">
                            Catégorie
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value as (typeof categories)[number])}
                            className="w-full h-14 px-4 rounded-[20px] border border-gray-200 bg-white shadow-sm text-[16px] font-bold text-[#2D2E3B] focus:outline-none focus:border-playzi-green/50 focus:ring-4 focus:ring-playzi-green/10 appearance-none transition-all"
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-bold uppercase tracking-wider text-gray-400 px-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Que s'est-il passé ?"
                            className="w-full h-32 p-4 rounded-[20px] border border-gray-200 bg-white shadow-sm text-[15px] font-medium text-[#2D2E3B] placeholder-gray-300 focus:outline-none focus:border-playzi-green/50 focus:ring-4 focus:ring-playzi-green/10 resize-none transition-all"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-2">
                        <label className="text-[13px] font-bold uppercase tracking-wider text-gray-400 px-1">
                            Pièce jointe (Optionnel)
                        </label>

                        {!imagePreview ? (
                            <label className="flex flex-col items-center justify-center w-full h-32 rounded-[20px] border-2 border-dashed border-gray-200 bg-gray-50/50 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors">
                                <ImagePlus className="w-8 h-8 text-gray-300 mb-2" strokeWidth={2} />
                                <span className="text-[14px] font-bold text-gray-400">Ajouter une capture d'écran</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                />
                            </label>
                        ) : (
                            <div className="relative w-full rounded-[20px] overflow-hidden border border-gray-100 shadow-sm bg-gray-100">
                                <Image src={imagePreview} alt="Aperçu" width={600} height={400} className="w-full h-auto object-cover max-h-48" unoptimized />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between p-4">
                                    <span className="text-white text-[13px] font-bold">Aperçu de l'image</span>
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-white/30 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-white" strokeWidth={2.5} />
                                        <span className="text-[13px] font-bold text-white">Retirer</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-6 pb-8">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!description.trim()}
                        className={`w-full h-14 rounded-[20px] flex items-center justify-center gap-2 font-bold text-[16px] transition-all shadow-md ${description.trim() ? "bg-[#2D2E3B] text-white active:scale-[0.98] hover:bg-gray-800" : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"}`}
                    >
                        <Send className="w-5 h-5 opacity-80" strokeWidth={2.5} />
                        Envoyer
                    </button>
                </div>

            </div>
        </main>
    );
}
