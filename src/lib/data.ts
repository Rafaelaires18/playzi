export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
    type: 'user' | 'system';
}

export interface Activity {
    id: string;
    sport: string;
    variant: string;
    level: string;
    location: string;
    exactAddress?: string; // Only shown when complet
    coordinates?: { lat: number; lng: number }; // Precise GPS pin
    time: string;
    attendees: number;
    maxAttendees: number;
    imageUrl?: string;
    imagePosition?: 'top' | 'center' | 'bottom';
    status?: 'confirmé' | 'en_attente' | 'complet' | 'passé'; // Used for the "Mes Activités" view
    isCreator?: boolean; // Determines if the current user is the chef
    discussionStatus?: 'none' | 'active' | 'resolved'; // Manages the Discussion (formerly Urgency) Mode state
    feedbackStatus?: 'pending' | 'completed' | 'none'; // Manages post-activity feedback state
    isoDate?: string; // Used to calculate time until event for chat unlocking
    chatMessages?: ChatMessage[];
    unreadMessagesCount?: number; // Number of unread chat messages
    isUnlimited?: boolean; // If true, the activity accepts an unlimited number of participants
    genderFilter?: 'mixte' | 'filles'; // Gender visibility filter
    distance?: number;  // km — for Running and Vélo
    pace?: number;      // sec/km — for Running only (e.g. 330 = 5:30/km)
    description?: string; // Optional free-text, shown on card
    tags?: string[];      // Selected chips from step 6
}

export const MOCK_CURRENT_USER = {
    id: 'me',
    name: 'Moi',
    gender: 'female' as 'male' | 'female' // Toggle this to 'male' to test the hidden logic
};

export const MOCK_ACTIVITIES: Activity[] = [
    {
        id: "5b",
        sport: "Yoga",
        variant: "Vinyasa au parc",
        level: "Tous niveaux",
        location: "Lausanne",
        coordinates: { lat: 46.5155, lng: 6.6200 }, // Ouchy area
        time: "Dimanche, 10h00",
        attendees: 3,
        maxAttendees: 12,
        imageUrl: "/images/beachvolley.png", // Using a generic image for now
        genderFilter: 'filles'
    },
    {
        id: "1",
        sport: "Beach-Volley",
        variant: "4v4 Mixte",
        level: "Intermédiaire",
        location: "Lausanne",
        exactAddress: "Vidy Beach, Terrain 3",
        coordinates: { lat: 46.5135, lng: 6.6000 }, // Vidy Beach
        time: "Aujourd'hui, 18h30",
        attendees: 8,
        maxAttendees: 8,
        imageUrl: "/images/beachvolley.png",
        imagePosition: "top",
        status: "complet", // Ready to organize!
        isCreator: false,
        discussionStatus: 'none',
        isoDate: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago (Started)
        unreadMessagesCount: 2,
        chatMessages: [
            { id: "cm1", senderId: "sys", senderName: "Système", content: "🎉 Activité confirmée — on y va !", timestamp: "18:00", type: "system" },
            { id: "cm2", senderId: "u2", senderName: "Léo", content: "Je prends le ballon les gars 🏐", timestamp: "18:05", type: "user" },
            { id: "cm3", senderId: "me", senderName: "Moi", content: "Super ! J'arrive vers 18h20.", timestamp: "18:10", type: "user" }
        ]
    },
    {
        id: "2",
        sport: "Running",
        variant: "Tour du lac (10km)",
        level: "Avancé",
        location: "Lausanne",
        coordinates: { lat: 46.5080, lng: 6.6220 }, // Lakefront
        time: "Demain, 07h00",
        attendees: 3,
        maxAttendees: 10,
        isUnlimited: true,
        distance: 10,
        pace: 300, // 5:00/km
        description: "Sortie longue au bord du lac — allure soutenue mais accessible.",
        tags: ["Sortie longue", "Tempo run"],
        imageUrl: "/images/running_1.png",
        status: "confirmé",
        isoDate: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // 12 hours from now (< 24h, chat open)
        unreadMessagesCount: 1,
        chatMessages: [
            { id: "cm6", senderId: "sys", senderName: "Système", content: "Le chat est désormais ouvert pour préparer votre activité !", timestamp: "07:00", type: "system" },
            { id: "cm7", senderId: "u4", senderName: "Alice", content: "Hello ! Quelqu'un part depuis Ouchy ?", timestamp: "08:15", type: "user" }
        ]
    },
    {
        id: "2b",
        sport: "Running",
        variant: "Entraînement fractionné",
        level: "Intermédiaire",
        location: "Lausanne",
        coordinates: { lat: 46.5220, lng: 6.6380 }, // Mon Repos
        time: "Dans 2 jours, 18h00",
        attendees: 5,
        maxAttendees: 15,
        isUnlimited: true,
        distance: 8,
        pace: 270, // 4:30/km — fractionné
        imageUrl: "/images/running_mixed.png",
        status: "confirmé",
        isoDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // 48 hours from now (> 24h, chat closed)
    },
    {
        id: "3",
        sport: "Football",
        variant: "5c5 sur gazon",
        level: "Tous niveaux",
        location: "Genève",
        coordinates: { lat: 46.2044, lng: 6.1432 }, // Plainpalais
        time: "Ven 26 Fév, 19h00",
        attendees: 9,
        maxAttendees: 10,
        imageUrl: "/images/football_1.png",
        status: "en_attente",
        isCreator: true, // User is creator here to test "Confirmer" button
        discussionStatus: 'active', // Forces Discussion Mode UI
        isoDate: new Date(Date.now() + 1000 * 60 * 60 * 1).toISOString(), // 1 hour from now
        unreadMessagesCount: 1,
        chatMessages: [
            { id: "cm4", senderId: "sys", senderName: "Système", content: "Mode discussion activé — Décidez ensemble si vous maintenez l'activité.", timestamp: "17:00", type: "system" },
            { id: "cm5", senderId: "u3", senderName: "Sam", content: "Moi je suis chaud même à 9 !", timestamp: "17:05", type: "user" }
        ]
    },
    {
        id: "4",
        sport: "Vélo",
        variant: "Sortie Route (50km)",
        level: "Débutant",
        location: "Lausanne",
        coordinates: { lat: 46.5333, lng: 6.6667 }, // Chalet-à-Gobet
        time: "Samedi, 14h00",
        attendees: 2,
        maxAttendees: 10,
        isUnlimited: true,
        distance: 50,
        imageUrl: "/images/cycling_1.png",
        status: "confirmé",
        isoDate: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // 3 days from now
    },
    {
        id: "5",
        sport: "Running",
        variant: "Footing détente (5km)",
        level: "Tous niveaux",
        location: "Neuchâtel",
        coordinates: { lat: 46.9896, lng: 6.9293 }, // Neuchâtel center
        time: "Aujourd'hui, 17h30",
        attendees: 1,
        maxAttendees: 4,
        isUnlimited: true,
        distance: 5,
        pace: 360, // 6:00/km — détente
        imageUrl: "/images/running_mixed.png",
        status: "confirmé",
        isoDate: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(), // 3 hours from now
    },
    {
        id: "6",
        sport: "Vélo",
        variant: "Col de la Croix",
        level: "Avancé",
        location: "Genève",
        coordinates: { lat: 46.2100, lng: 6.1500 }, // Eaux-Vives
        time: "Dimanche 18 Fév, 08h00",
        attendees: 6,
        maxAttendees: 6,
        isUnlimited: true,
        distance: 80,
        imageUrl: "/images/cycling_2.png",
        status: "passé", // Past activity
        feedbackStatus: "completed"
    },
    {
        id: "7",
        sport: "Tennis",
        variant: "Double Mixte",
        level: "Intermédiaire",
        location: "Lausanne",
        coordinates: { lat: 46.5140, lng: 6.6430 }, // Malley
        time: "Hier, 18h00",
        attendees: 4,
        maxAttendees: 4,
        imageUrl: "/images/beachvolley.png", // Using existing image for MVP
        status: "passé",
        feedbackStatus: "pending"
    }
];
