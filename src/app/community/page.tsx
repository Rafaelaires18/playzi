import Image from "next/image";
import { Activity, HeartHandshake, MessageCircle, ShieldCheck, TimerReset, Users } from "lucide-react";

type CommunitySection = {
    title: string;
    icon: typeof HeartHandshake;
    paragraphs: string[];
    bullets?: string[];
    closing?: string;
};

const sections: CommunitySection[] = [
    {
        title: "1 — L’esprit Playzi",
        icon: HeartHandshake,
        paragraphs: [
            "Playzi repose sur des valeurs simples :",
        ],
        bullets: [
            "respect",
            "esprit sportif",
            "bienveillance",
            "fiabilité",
        ],
        closing: "Chaque participant contribue à créer une communauté positive.\nLes activités organisées sur Playzi doivent rester dans un esprit sportif et inclusif, où chacun se sent à sa place.",
    },
    {
        title: "2 — Respect entre participants",
        icon: Users,
        paragraphs: [
            "Les interactions entre utilisateurs doivent rester respectueuses.",
            "Les comportements suivants sont strictement interdits :",
        ],
        bullets: [
            "harcèlement",
            "insultes",
            "menaces",
            "discrimination",
            "propos offensants ou agressifs",
        ],
        closing: "Playzi est une communauté sportive, pas un espace de conflit.\nChaque utilisateur doit contribuer à maintenir un climat respectueux et agréable.",
    },
    {
        title: "3 — Organisation des activités",
        icon: Activity,
        paragraphs: [
            "Les activités doivent être organisées de manière claire et honnête.",
            "Les organisateurs doivent :",
        ],
        bullets: [
            "indiquer le lieu réel de l’activité",
            "respecter l’horaire annoncé",
            "préciser le niveau sportif si nécessaire",
        ],
        closing: "Les activités trompeuses, fausses ou destinées à spammer la plateforme sont interdites.",
    },
    {
        title: "4 — Utilisation du chat",
        icon: MessageCircle,
        paragraphs: [
            "Le chat d’activité sert à faciliter l’organisation.",
            "Il doit être utilisé pour :",
        ],
        bullets: [
            "coordonner l’activité",
            "poser des questions",
            "partager des informations utiles",
        ],
        closing: "Les comportements suivants ne sont pas autorisés : spam, messages inappropriés, harcèlement d’un participant, contenu offensant.\nLe chat doit rester un espace utile et respectueux.",
    },
    {
        title: "5 — Feedbacks et signalements",
        icon: ShieldCheck,
        paragraphs: [
            "Les utilisateurs peuvent signaler un comportement problématique.",
            "Les signalements doivent être utilisés de manière responsable.",
            "Les faux signalements abusifs peuvent également entraîner des sanctions.",
            "Les feedbacks permettent d’améliorer la qualité de la communauté et de maintenir un environnement sûr.",
        ],
    },
    {
        title: "6 — Fiabilité et engagement",
        icon: TimerReset,
        paragraphs: [
            "Playzi repose sur la confiance entre participants.",
            "Nous encourageons les utilisateurs à :",
        ],
        bullets: [
            "respecter leur participation",
            "prévenir en cas d’empêchement",
            "éviter les absences injustifiées",
        ],
        closing: "La fiabilité des participants est essentielle pour garantir de bonnes expériences sportives.",
    },
    {
        title: "7 — Modération et sanctions",
        icon: ShieldCheck,
        paragraphs: [
            "Afin de protéger la communauté, Playzi peut appliquer différentes mesures en cas de non-respect des règles :",
        ],
        bullets: [
            "avertissement",
            "restriction temporaire du chat",
            "suspension temporaire du compte",
            "suspension prolongée",
        ],
        closing: "Les sanctions sont appliquées en fonction de la gravité du comportement, du nombre de signalements et de la répétition des infractions.",
    },
];

export default function CommunityPage() {
    return (
        <main className="min-h-screen bg-white px-4 py-10 text-[#1f2937] sm:px-6">
            <div className="mx-auto w-full max-w-[900px]">
                <section className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-6 sm:p-10">
                    <p className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                        Community
                    </p>
                    <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Règles de la communauté Playzi</h1>
                    <p className="mt-3 text-base font-medium text-gray-600 sm:text-lg">
                        Construire une communauté sportive respectueuse et conviviale.
                    </p>
                </section>

                <section className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 sm:p-8">
                    <h2 className="text-2xl font-black tracking-tight">Introduction</h2>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        Playzi est une plateforme conçue pour permettre aux passionnés de sport de se rencontrer, de partager des activités
                        et de créer des moments sportifs ensemble.
                    </p>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        Notre objectif est simple : permettre à chacun de pratiquer du sport dans un environnement respectueux, fiable et convivial.
                    </p>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        Pour garantir cette expérience, tous les utilisateurs doivent respecter les règles de la communauté Playzi.
                    </p>
                </section>

                <section className="mt-6 space-y-4">
                    {sections.map((section) => {
                        const Icon = section.icon;
                        return (
                            <article key={section.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 rounded-xl bg-emerald-50 p-2 text-emerald-700">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-black tracking-tight">{section.title}</h3>
                                        <div className="mt-3 space-y-3">
                                            {section.paragraphs.map((paragraph) => (
                                                <p key={paragraph} className="text-[16px] leading-relaxed text-gray-700">
                                                    {paragraph}
                                                </p>
                                            ))}
                                            {section.bullets ? (
                                                <ul className="list-disc space-y-1 pl-5 text-[16px] leading-relaxed text-gray-700">
                                                    {section.bullets.map((bullet) => (
                                                        <li key={bullet}>{bullet}</li>
                                                    ))}
                                                </ul>
                                            ) : null}
                                            {section.closing
                                                ? section.closing.split("\n").map((line) => (
                                                    <p key={line} className="text-[16px] leading-relaxed text-gray-700">
                                                        {line}
                                                    </p>
                                                ))
                                                : null}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </section>

                <section className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-6 sm:p-8">
                    <h2 className="text-2xl font-black tracking-tight">Conclusion</h2>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        Playzi existe pour permettre aux gens de se rencontrer autour du sport.
                    </p>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        En respectant ces règles, chacun contribue à construire une communauté sportive respectueuse, fiable et conviviale.
                    </p>
                    <p className="mt-3 text-[16px] leading-relaxed text-gray-700">
                        Merci de faire partie de la communauté Playzi.
                    </p>
                </section>

                <footer className="mt-8 border-t border-gray-100 py-8 text-center">
                    <Image
                        src="/playzi_logo_transparant.png"
                        alt="Playzi"
                        width={120}
                        height={40}
                        className="mx-auto h-auto w-[120px]"
                        priority={false}
                    />
                    <p className="mt-3 text-sm text-gray-500">© Playzi</p>
                </footer>
            </div>
        </main>
    );
}
