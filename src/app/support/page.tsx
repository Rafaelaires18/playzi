"use client";

import { useState } from "react";
import Header from "@/components/Header";
import OptionsSheet from "@/components/options/OptionsSheet";
import { HelpCircle, ChevronRight, Mail } from "lucide-react";

const faqs = [
    {
        question: "Comment rejoindre une activité ?",
        answer: "Depuis Découvrir, ouvrez une activité, vérifiez les détails puis confirmez votre participation en un tap."
    },
    {
        question: "Comment créer une activité ?",
        answer: "Utilisez le bouton central de la navigation, choisissez le sport, l'heure, le lieu puis publiez votre proposition."
    },
    {
        question: "Pourquoi je ne vois pas l'emplacement exact ?",
        answer: "L'emplacement précis peut rester masqué jusqu'à la confirmation afin de protéger l'organisation et la sécurité des participants."
    },
    {
        question: "Comment annuler ma participation ?",
        answer: "Ouvrez votre activité dans Mes activités puis utilisez l'action d'annulation disponible avant le début."
    },
    {
        question: "Que se passe-t-il si je suis en retard / no-show ?",
        answer: "Les absences non excusées peuvent impacter votre grade et votre fiabilité afin de garder une communauté sérieuse."
    },
    {
        question: "Comment fonctionnent les grades & streaks ?",
        answer: "Votre progression évolue selon vos participations complètes, votre régularité et votre comportement dans les activités."
    }
] as const;

export default function SupportPage() {
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0].question);

    return (
        <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white relative">
            <Header onOpenOptions={() => setIsOptionsOpen(true)} />
            <OptionsSheet open={isOptionsOpen} onClose={() => setIsOptionsOpen(false)} />

            <div className="flex-1 overflow-y-auto px-6 pb-12 pt-24 space-y-8 bg-gray-50/50">
                <div>
                    <h1 className="text-[32px] font-black tracking-tight text-[#2D2E3B] flex items-center gap-3">
                        <HelpCircle className="w-8 h-8 text-playzi-green" strokeWidth={2.5} />
                        Aide & Support
                    </h1>
                </div>

                {/* FAQ Section */}
                <section>
                    <h2 className="text-[14px] font-black uppercase tracking-wider text-gray-400 mb-4 px-1">Questions Fréquentes</h2>
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        {faqs.map((faq, index) => {
                            const isOpen = openQuestion === faq.question;
                            return (
                                <div key={faq.question} className={`border-b border-gray-50 last:border-b-0 ${isOpen ? 'bg-gray-50/30' : ''}`}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenQuestion(isOpen ? null : faq.question)}
                                        className="w-full text-left flex items-start justify-between p-5 gap-4"
                                    >
                                        <span className={`text-[15px] leading-snug font-bold ${isOpen ? 'text-[#2D2E3B]' : 'text-gray-500'}`}>
                                            {faq.question}
                                        </span>
                                        <ChevronRight className={`shrink-0 w-5 h-5 transition-transform duration-200 mt-0.5 ${isOpen ? "rotate-90 text-gray-400" : "text-gray-300"}`} strokeWidth={2.5} />
                                    </button>
                                    {isOpen && (
                                        <div className="px-5 pb-5 pt-1">
                                            <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Contact Support */}
                <section className="bg-playzi-green/5 rounded-[28px] border border-playzi-green/10 p-6 flex flex-col items-center text-center">
                    <h2 className="text-[18px] font-black tracking-tight text-[#2D2E3B] mb-2">
                        Votre question n'est pas ici ?
                    </h2>
                    <p className="text-[14px] font-medium text-gray-500 mb-6 leading-relaxed">
                        Notre équipe Playzi est disponible pour vous répondre et vous accompagner en cas de souci.
                    </p>
                    <a
                        href="mailto:support@playzi.app?subject=Demande%20de%20support%20Playzi"
                        className="w-full h-12 bg-[#2D2E3B] text-white font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md hover:bg-gray-800"
                    >
                        <Mail className="w-5 h-5 text-gray-300" strokeWidth={2.5} />
                        Contacter le support
                    </a>
                </section>
            </div>
        </main>
    );
}
