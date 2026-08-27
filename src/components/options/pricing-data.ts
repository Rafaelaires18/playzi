export type PricingPlan = {
    id: "free" | "plus";
    name: string;
    price: string;
    cadence?: string;
    badge?: string;
    features: string[];
};

export const LAUNCH_OFFER = {
    badge: "OFFRE DE LANCEMENT",
    title: "Playzi+ offert pendant le lancement",
    text: "Profite de toutes les fonctionnalités Playzi+ sans frais pendant la période de lancement.",
    note: "Offre valable uniquement pendant la période de lancement.",
};

export const PRICING_PLANS: PricingPlan[] = [
    {
        id: "free",
        name: "Playzi",
        price: "0 CHF",
        cadence: "/ mois",
        features: [
            "Rejoindre des activités en illimité",
            "Créer 1 activité par semaine",
            "Filtres essentiels",
            "Statistiques de base",
            "Progression Pulse",
            "Support standard",
        ],
    },
    {
        id: "plus",
        name: "Playzi+",
        price: "4,90 CHF",
        cadence: "/ mois",
        badge: "Le plus complet",
        features: [
            "Création d’activités illimitée",
            "Sans publicité",
            "Filtres avancés",
            "Statistiques & graphiques avancés",
            "Voir les participants avant de rejoindre",
            "Accès aux profils des participants",
            "Avantages Playzi+ / personnalisation",
        ],
    },
];
