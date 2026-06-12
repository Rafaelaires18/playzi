import { FormEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Mail, Sparkles } from "lucide-react";
import {
    PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI,
    PLAYZI_ONBOARDING_REQUEST_EVENT,
    startPlayziOnboarding
} from "@/lib/playzi-onboarding";

interface SupportViewProps {
    onBack: () => void;
}

const faqs = [
    {
        question: "Comment rejoindre une activité ?",
        answer: "Depuis Découvrir, ouvre une activité.\n\nConsulte les détails, puis confirme ta participation en un tap.\n\nTu peux ensuite voir les participants, accéder au chat du groupe et organiser l’activité avec les autres."
    },
    {
        question: "Comment créer une activité ?",
        answer: "Depuis Créer, configure ton activité (lieu, date, nombre de participants, niveau, etc.).\n\nTu peux aussi inviter des amis via un lien, WhatsApp ou tes connexions.\n\nMême sans compte, une personne peut rejoindre via le lien en s’inscrivant."
    },
    {
        question: "Pourquoi je ne vois pas l'emplacement exact ?",
        answer: "L’emplacement exact est volontairement masqué.\n\nIl est uniquement visible une fois que tu as rejoint l’activité.\n\nCela permet de garantir la sécurité et la qualité des rencontres."
    },
    {
        question: "Comment annuler ma participation ?",
        answer: "L’annulation est limitée pour garantir la fiabilité des activités.\n\nSi tu es participant, tu ne peux pas annuler librement.\n\nPréviens dans le chat du groupe dès que possible, et idéalement propose un remplaçant.\n\nSi tu es créateur, tu peux supprimer l’activité si personne ne t’a encore rejoint.\n\nSinon, tu peux lancer un sondage.\n\nSi la majorité vote pour annuler (avec une raison valable), l’activité sera annulée sans pénalité.\n\nImportant: inscris-toi uniquement si tu es sûr de pouvoir participer."
    },
    {
        question: "Que se passe-t-il s’il manque des joueurs ?",
        answer: "Pour certaines activités (football, beach volley…), un nombre minimum de participants est recommandé.\n\nSi le groupe n’est pas complet, un chat d’urgence s’ouvre automatiquement.\n\nIl permet aux participants de décider quoi faire ensemble.\n\nOuverture du chat:\n\nActivité le matin → 20h la veille\nActivité plus tard → 2h avant\n\nLes participants peuvent maintenir l’activité, s’adapter ou proposer d’annuler.\n\nLe créateur de l’activité décide.\n\nS’il confirme, l’activité est maintenue.\nS’il ne répond pas, elle est considérée comme annulée.\n\nMême en petit groupe, l’activité peut souvent être maintenue en s’adaptant."
    },
    {
        question: "Que se passe-t-il si je suis en retard / no-show ?",
        answer: "Si tu es en retard, préviens dans le chat dès que possible.\n\nSi tu ne viens pas (no-show), tu recevras un malus de pulses.\n\nLe respect des autres participants est essentiel pour le bon fonctionnement des activités."
    },
    {
        question: "Comment fonctionnent les grades & streaks ?",
        answer: "Les grades évoluent selon tes participations et ton comportement.\n\nTu gagnes des pulses en participant activement et en ayant de bons retours.\n\nTu peux en perdre en cas de retard, no-show ou mauvais comportement.\n\nLes streaks se maintiennent en participant à au moins une activité par semaine."
    },
    {
        question: "Comment fonctionnent les récompenses ?",
        answer: "Les récompenses sont disponibles une fois que tous les participants ont donné leur feedback.\n\nSinon, elles deviennent aussi disponibles automatiquement après un certain délai.\n\nTu peux les récupérer dans Mes activités → Activités passées."
    },
    {
        question: "Puis-je bloquer quelqu’un ?",
        answer: "Oui.\n\nVa sur le profil de la personne et utilise l’option Bloquer.\n\nVous ne serez plus proposés dans les mêmes activités."
    },
    {
        question: "Comment fonctionnent les connexions ?",
        answer: "Après une activité, tu peux envoyer une demande de connexion à un participant.\n\nSi elle est acceptée, vous restez connectés.\n\nVous pouvez ainsi vous retrouver plus facilement ou vous inviter à de futures activités."
    },
    {
        question: "Quelles sont les règles dans les chats ?",
        answer: "Les échanges doivent rester respectueux et bienveillants.\n\nLes comportements abusifs (insultes, spam, harcèlement) sont interdits.\n\nTu peux signaler un utilisateur directement depuis le chat.\n\nEn cas d’abus, des sanctions peuvent être appliquées: avertissement, restriction du chat, suspension ou exclusion de l’application.\n\nPlayzi repose sur le respect et la confiance entre les utilisateurs."
    },
] as const;

export default function SupportView({ onBack }: SupportViewProps) {
    const [openQuestion, setOpenQuestion] = useState<string | null>(faqs[0].question);
    const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
    const [supportEmail, setSupportEmail] = useState("");
    const [supportMessage, setSupportMessage] = useState("");
    const [supportError, setSupportError] = useState<string | null>(null);
    const [supportSuccess, setSupportSuccess] = useState<string | null>(null);
    const [isSupportSubmitting, setIsSupportSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const preloadSupportEmail = async () => {
            try {
                const res = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
                const body = await res.json().catch(() => null);
                const email = typeof body?.data?.user?.email === "string" ? body.data.user.email.trim() : "";
                if (!cancelled && email) setSupportEmail(email);
            } catch {
                // Best effort prefill only.
            }
        };

        void preloadSupportEmail();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const onOnboardingRequest = (event: Event) => {
            const customEvent = event as CustomEvent<{ type?: string }>;
            if (customEvent.detail?.type !== PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI) return;
            setIsSupportModalOpen(false);
        };
        window.addEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
        return () => {
            window.removeEventListener(PLAYZI_ONBOARDING_REQUEST_EVENT, onOnboardingRequest as EventListener);
        };
    }, []);

    const handleSubmitSupportRequest = async (event: FormEvent) => {
        event.preventDefault();
        setSupportError(null);
        setSupportSuccess(null);

        const trimmedEmail = supportEmail.trim();
        const trimmedMessage = supportMessage.trim();
        if (!trimmedEmail) {
            setSupportError("Merci d'indiquer un email de contact.");
            return;
        }
        if (!trimmedMessage) {
            setSupportError("Merci d'indiquer votre question.");
            return;
        }

        setIsSupportSubmitting(true);
        try {
            const res = await fetch("/api/support/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: trimmedEmail,
                    message: trimmedMessage,
                    type: "question",
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(body?.error || "Impossible d'envoyer votre demande.");
            }
            setSupportSuccess("Question envoyée. L'équipe support vous répondra rapidement.");
            setSupportMessage("");
        } catch (e) {
            setSupportError(e instanceof Error ? e.message : "Impossible d'envoyer votre demande.");
        } finally {
            setIsSupportSubmitting(false);
        }
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
                <h2 className="text-[18px] font-black text-[#2D2E3B] ml-2">Aide & Support</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-safe space-y-8">
                {/* FAQ Section */}
                <section>
                    <h2 className="text-[13px] font-black uppercase tracking-widest text-gray-400 mb-3 px-1">Questions Fréquentes</h2>
                    <button
                        type="button"
                        data-onboarding-id="support-tutorial-cta"
                        onClick={() => startPlayziOnboarding("support_sheet")}
                        className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left shadow-sm"
                    >
                        <span className="flex items-center gap-2">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600">
                                <Sparkles className="h-4 w-4" />
                            </span>
                            <span>
                                <span className="block text-[13px] font-black text-emerald-800">Guide Playzi</span>
                                <span className="block text-[12px] font-semibold text-emerald-700/80">Voir le tutoriel interactif</span>
                            </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-emerald-700" />
                    </button>
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
                                        <span className={`text-[15px] leading-snug font-bold ${isOpen ? 'text-[#2D2E3B]' : 'text-gray-500'}`}>
                                            {faq.question}
                                        </span>
                                        <ChevronRight className={`shrink-0 w-5 h-5 transition-transform duration-200 mt-0.5 ${isOpen ? "rotate-90 text-gray-400" : "text-gray-300"}`} strokeWidth={2.5} />
                                    </button>
                                    {isOpen && (
                                        <div className="px-4 pb-4 pt-0">
                                            <p className="whitespace-pre-line text-[13px] leading-relaxed text-gray-500 font-medium">
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
                        Votre question n&apos;est pas ici ?
                    </h2>
                    <p className="text-[13px] font-medium text-gray-500 mb-5 leading-relaxed">
                        Notre équipe Playzi est disponible pour vous répondre en cas de souci.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSupportError(null);
                            setSupportSuccess(null);
                            setIsSupportModalOpen(true);
                        }}
                        className="w-full h-12 bg-[#2D2E3B] text-white font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md hover:bg-gray-800"
                    >
                        <Mail className="w-4 h-4 text-gray-300" strokeWidth={2.5} />
                        Contacter le support
                    </button>
                </section>

                <div className="h-4"></div>
            </div>
            {isSupportModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/50 px-4">
                    <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-5 shadow-xl">
                        <h2 className="text-[18px] font-black text-[#242841]">Contacter le support</h2>
                        <p className="mt-1 text-[13px] font-medium text-gray-500">
                            Posez votre question, notre équipe vous répondra rapidement.
                        </p>

                        {supportError && (
                            <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
                                {supportError}
                            </div>
                        )}
                        {supportSuccess && (
                            <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
                                {supportSuccess}
                            </div>
                        )}

                        <form onSubmit={handleSubmitSupportRequest} className="mt-4 space-y-3">
                            <div>
                                <label className="mb-1 ml-1 block text-[12px] font-bold text-gray-500">Email</label>
                                <input
                                    type="email"
                                    value={supportEmail}
                                    onChange={(e) => setSupportEmail(e.target.value)}
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    placeholder="vous@email.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-1 ml-1 block text-[12px] font-bold text-gray-500">Votre question</label>
                                <textarea
                                    value={supportMessage}
                                    onChange={(e) => setSupportMessage(e.target.value)}
                                    className="min-h-[120px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-[14px] font-medium text-[#242841] outline-none focus:ring-2 focus:ring-emerald-200"
                                    placeholder="Quelle est votre question ?"
                                    maxLength={2000}
                                    required
                                />
                            </div>
                            <div className="mt-2 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSupportModalOpen(false)}
                                    className="h-11 flex-1 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-700"
                                >
                                    Fermer
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSupportSubmitting}
                                    className="h-11 flex-1 rounded-xl bg-emerald-500 text-[13px] font-black text-white disabled:opacity-70"
                                >
                                    {isSupportSubmitting ? "Envoi..." : "Envoyer"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
