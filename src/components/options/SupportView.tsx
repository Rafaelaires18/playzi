import { useState } from "react";
import { ChevronLeft, ChevronRight, Mail } from "lucide-react";

interface SupportViewProps {
    onBack: () => void;
}

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
        answer: "Votre progression évolue selon vos participations complètes, votre régularité et votre comportement."
    }
] as const;

export default function SupportView({ onBack }: SupportViewProps) {
    const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0].question);

    return (
        <div className="flex flex-col h-full bg-gray-50/50 animate-in slide-in-from-right-8 duration-300 ease-out">
            <div className="flex items-center px-4 py-3 shrink-0 bg-white border-b border-gray-100">
                <button
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 text-gray-700" strokeWidth={2.5} />
                </button>
                <h2 className="text-[18px] font-black text-[#2D2E3B] ml-2">Aide & Support</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-safe space-y-8">
                {/* FAQ Section */}
                <section>
                    <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">Questions Fréquentes</h2>
                    <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        {faqs.map((faq) => {
                            const isOpen = openQuestion === faq.question;
                            return (
                                <div key={faq.question} className={`border-b border-gray-50 last:border-b-0 ${isOpen ? 'bg-gray-50/30' : ''}`}>
                                    <button
                                        type="button"
                                        onClick={() => setOpenQuestion(isOpen ? null : faq.question)}
                                        className="w-full text-left flex items-start justify-between p-4 gap-3"
                                    >
                                        <span className={`text-[14px] leading-snug font-bold ${isOpen ? 'text-[#2D2E3B]' : 'text-gray-500'}`}>
                                            {faq.question}
                                        </span>
                                        <ChevronRight className={`shrink-0 w-5 h-5 transition-transform duration-200 mt-0.5 ${isOpen ? "rotate-90 text-gray-400" : "text-gray-300"}`} strokeWidth={2.5} />
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-4 pt-0">
                                            <p className="text-[13px] leading-relaxed text-gray-500 font-medium">
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
                <section className="bg-playzi-green/5 rounded-[24px] border border-playzi-green/10 p-5 flex flex-col items-center text-center">
                    <h2 className="text-[16px] font-black tracking-tight text-[#2D2E3B] mb-2">
                        Votre question n'est pas ici ?
                    </h2>
                    <p className="text-[13px] font-medium text-gray-500 mb-5 leading-relaxed">
                        Notre équipe Playzi est disponible pour vous répondre en cas de souci.
                    </p>
                    <a
                        href="mailto:support@playzi.app?subject=Demande%20de%20support%20Playzi"
                        className="w-full h-12 bg-[#2D2E3B] text-white font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md hover:bg-gray-800"
                    >
                        <Mail className="w-4 h-4 text-gray-300" strokeWidth={2.5} />
                        Contacter le support
                    </a>
                </section>

                <div className="h-4"></div>
            </div>
        </div>
    );
}
