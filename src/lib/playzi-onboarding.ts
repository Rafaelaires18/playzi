export const PLAYZI_ONBOARDING_START_EVENT = "playzi:onboarding-start";
export const PLAYZI_ONBOARDING_STEP_EVENT = "playzi:onboarding-step";
export const PLAYZI_ONBOARDING_ACTION_EVENT = "playzi:onboarding-action";
export const PLAYZI_ONBOARDING_REQUEST_EVENT = "playzi:onboarding-request";
export const PLAYZI_ONBOARDING_STORAGE_KEY = "playzi_onboarding_completed_v1";
export const PLAYZI_ONBOARDING_AUTO_SHOWN_KEY = "playzi_onboarding_auto_shown_v1";
export const PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI = "close-transient-ui";

export type PlayziOnboardingAction =
    | "swipe_simulation"
    | "filter_press"
    | "logo_press"
    | "logo_refreshing"
    | "logo_refreshed"
    | "plus_press"
    | "activities_solo_long_press";
export type PlayziOnboardingStepType = "swipe-demo" | "tooltip";

export type PlayziOnboardingStep = {
    step: number;
    id: string;
    route: string;
    target: string;
    type: PlayziOnboardingStepType;
    title: string;
    body: string;
    targetId?: string;
    action?: PlayziOnboardingAction;
};

// Tour Controller source of truth: route + real target + interaction type.
export const ONBOARDING_STEPS: PlayziOnboardingStep[] = [
    {
        step: 1,
        id: "discover-swipe",
        route: "/discover",
        target: "activity-card",
        targetId: "activity-card",
        type: "swipe-demo",
        title: "Swipe Discover",
        body: "Glisse la carte : gauche = passer, droite = rejoindre.",
        action: "swipe_simulation",
    },
    {
        step: 2,
        id: "discover-filters-cta",
        route: "/discover",
        target: "filter-button",
        targetId: "filter-button",
        type: "tooltip",
        title: "Filtres",
        body: "Appuie sur le bouton Filtrer pour affiner ton feed.",
        action: "filter_press",
    },
    {
        step: 3,
        id: "discover-filters-modal",
        route: "/discover",
        target: "discover-filters-zone",
        targetId: "discover-filters-zone",
        type: "tooltip",
        title: "Configure tes filtres",
        body: "Choisis la distance maximale autour de toi ou sélectionne une ville sur la carte pour trouver les activités qui te correspondent.",
    },
    {
        step: 4,
        id: "discover-refresh",
        route: "/discover",
        target: "logo",
        targetId: "logo",
        type: "tooltip",
        title: "Actualise ton feed",
        body: "Appuie sur le logo Playzi pour rafraîchir les activités disponibles.",
    },
    {
        step: 5,
        id: "events-playzi",
        route: "/discover",
        target: "nav-events",
        targetId: "nav-events",
        type: "tooltip",
        title: "Events Playzi",
        body: "Ici : runs, tournois et rencontres spéciales officielles.",
    },
    {
        step: 6,
        id: "create-entry",
        route: "/discover",
        target: "nav-create",
        targetId: "nav-create",
        type: "tooltip",
        title: "Bouton +",
        body: "Le bouton central lance la création d'activité.",
    },
    {
        step: 7,
        id: "create-sport",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Sport + distance/niveau",
        body: "Choisis ton sport, puis ajoute les infos utiles comme la distance et le niveau.",
    },
    {
        step: 8,
        id: "create-date-time",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Date et heure",
        body: "Choisis une date et une heure sûres avant de publier.",
    },
    {
        step: 9,
        id: "create-location",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Lieu",
        body: "Place le point de départ ou le terrain avec précision. Le lieu exact n’est dévoilé qu’une fois l’activité confirmée.",
    },
    {
        step: 10,
        id: "create-participants",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Participants",
        body: "Choisis le nombre de participants.",
    },
    {
        step: 11,
        id: "create-invite",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Inviter",
        body: "Invite des participants via pseudo, connexions ou lien.",
    },
    {
        step: 12,
        id: "create-description",
        route: "/create",
        target: "create-root",
        targetId: "create-root",
        type: "tooltip",
        title: "Création — Description",
        body: "Ajoute des détails pour organiser au mieux l’activité.",
    },
    {
        step: 13,
        id: "create-summary",
        route: "/create",
        target: "create-publish-cta",
        targetId: "create-publish-cta",
        type: "tooltip",
        title: "Création — Résumé / publication",
        body: "Vérifie les informations puis publie ton activité.",
    },
    {
        step: 14,
        id: "activities-entry",
        route: "/activities",
        target: "activities-tabs",
        targetId: "activities-tabs",
        type: "tooltip",
        title: "Mes activités",
        body: "Retrouve tes activités créées, rejointes, en cours ou passées.",
    },
    {
        step: 15,
        id: "activities-status-intro",
        route: "/activities",
        target: "activities-tabs",
        targetId: "activities-tabs",
        type: "tooltip",
        title: "Mes activités",
        body: "Toutes tes activités créées ou rejointes apparaissent ici. Plusieurs statuts peuvent exister selon le groupe et le timing.",
    },
    {
        step: 16,
        id: "activities-status-confirmed-closed",
        route: "/activities",
        target: "tutorial-activity-solo",
        targetId: "tutorial-activity-solo",
        type: "tooltip",
        title: "Confirmé (chat fermé)",
        body: "L’activité est confirmée. Le chat s’ouvre automatiquement 24h avant pour organiser.",
    },
    {
        step: 17,
        id: "activities-status-confirmed-open",
        route: "/activities",
        target: "tutorial-activity-confirmed",
        targetId: "tutorial-activity-confirmed",
        type: "tooltip",
        title: "Confirmé (chat ouvert)",
        body: "Le chat est ouvert pour organiser les détails avec les participants.",
    },
    {
        step: 18,
        id: "activities-status-incomplete",
        route: "/activities",
        target: "tutorial-activity-pending",
        targetId: "tutorial-activity-pending",
        type: "tooltip",
        title: "Incomplet",
        body: "Les activités de sport d’équipe peuvent être incomplètes. L’activité sera automatiquement confirmée dès que le groupe est complet.",
    },
    {
        step: 19,
        id: "activities-status-urgent",
        route: "/activities",
        target: "tutorial-activity-urgent",
        targetId: "tutorial-activity-urgent",
        type: "tooltip",
        title: "Mode urgence",
        body: "Si le groupe n’est pas complet, un chat d’urgence s’ouvre pour décider si l’activité est maintenue. Pour une activité l’après-midi ou le soir, le chat s’ouvre 2h avant. Pour une activité le matin, le chat s’ouvre à 20h la veille.",
    },
    {
        step: 20,
        id: "activities-chat-location",
        route: "/activities",
        target: "tutorial-chat-map",
        targetId: "tutorial-chat-map",
        type: "tooltip",
        title: "Localisation exacte",
        body: "L’adresse exacte apparaît dans le chat de l’activité, uniquement quand l’activité est confirmée.\n\nCela évite de partager un lieu précis trop tôt.",
    },
    {
        step: 21,
        id: "activities-chat-participants",
        route: "/activities",
        target: "tutorial-chat-participants-count",
        targetId: "tutorial-chat-participants-count",
        type: "tooltip",
        title: "Participants",
        body: "Appuie sur le nombre de participants pour voir le groupe et créer des connexions.\n\nTu pourras ensuite réinviter plus facilement ces personnes.",
    },
    {
        step: 22,
        id: "activities-chat-management",
        route: "/activities",
        target: "tutorial-chat-options",
        targetId: "tutorial-chat-options",
        type: "tooltip",
        title: "Gestion de l’activité",
        body: "Le créateur peut proposer d’annuler l’activité si plusieurs participants sont déjà dans le groupe.\n\nLe groupe vote ensuite pour confirmer l’annulation.\n\nTous les participants peuvent aussi signaler un problème si nécessaire.",
    },
    {
        step: 23,
        id: "activities-quick-delete",
        route: "/activities",
        target: "tutorial-activity-solo",
        targetId: "tutorial-activity-solo",
        type: "tooltip",
        title: "Suppression rapide",
        body: "Si personne n’a encore rejoint ton activité, tu peux la supprimer directement.\n\nMaintiens la mini-card appuyée puis sélectionne “Supprimer”.",
    },
    {
        step: 24,
        id: "activities-post-feedback",
        route: "/activities",
        target: "tutorial-past-feedback-card",
        targetId: "tutorial-past-feedback-card",
        type: "tooltip",
        title: "Feedback après activité",
        body: "Après une activité, une période de feedback s’ouvre pendant 24h.\n\nLes participants peuvent confirmer que tout s’est bien passé ou signaler un problème.",
    },
    {
        step: 25,
        id: "activities-post-pulse",
        route: "/activities",
        target: "tutorial-past-pulse-card",
        targetId: "tutorial-past-pulse-card",
        type: "tooltip",
        title: "Récompenses Pulse",
        body: "Une fois les feedbacks terminés, les récompenses Pulse deviennent disponibles.\n\nLes Pulse permettent de progresser dans l’application et reflètent la fiabilité des joueurs.\n\nBon comportement = gains de Pulse. Problèmes répétés = malus possibles.",
    },
    {
        step: 26,
        id: "profile-overview",
        route: "/profil",
        target: "profile-onboarding-focus",
        targetId: "profile-onboarding-focus",
        type: "tooltip",
        title: "Profil Playzi",
        body: "Ton profil regroupe ta progression, tes statistiques et ta réputation Playzi.\n\nRetrouve tes Pulse, ton niveau, tes badges et l’historique de tes activités.\n\nUn bon comportement et des activités réussies améliorent progressivement ton profil.",
    },
];

export const PLAYZI_ONBOARDING_STEPS = ONBOARDING_STEPS;

export function startPlayziOnboarding(source = "manual") {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent(PLAYZI_ONBOARDING_REQUEST_EVENT, {
            detail: { type: PLAYZI_ONBOARDING_CLOSE_TRANSIENT_UI },
        })
    );
    window.dispatchEvent(
        new CustomEvent(PLAYZI_ONBOARDING_START_EVENT, {
            detail: { force: true, source },
        })
    );
}
