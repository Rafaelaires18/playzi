import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { arePasswordRulesSatisfied, evaluatePasswordRules } from "@/lib/password-rules";

interface SettingsViewProps {
  onBack: () => void;
}

const PSEUDO_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRIVACY_UPDATED_EVENT = "playzi:privacy-updated";

export default function SettingsView({ onBack }: SettingsViewProps) {
  const [activeSubPage, setActiveSubPage] = useState<"main" | "privacy_policy" | "terms_of_use">("main");
  const [pseudo, setPseudo] = useState("");
  const [initialPseudo, setInitialPseudo] = useState("");
  const [email, setEmail] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [approximateLocation, setApproximateLocation] = useState(true);

  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailChangePassword, setEmailChangePassword] = useState("");
  const [isSubmittingEmailChange, setIsSubmittingEmailChange] = useState(false);
  const [emailChangeMessage, setEmailChangeMessage] = useState<string | null>(null);
  const [emailChangeError, setEmailChangeError] = useState<string | null>(null);
  const [isEmailChangeOpen, setIsEmailChangeOpen] = useState(false);

  const [isLoadingPrivacy, setIsLoadingPrivacy] = useState(true);
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; pseudo: string; first_name: string | null; last_name: string | null }>>([]);
  const [isLoadingBlockedUsers, setIsLoadingBlockedUsers] = useState(true);
  const [isUpdatingBlockedUserId, setIsUpdatingBlockedUserId] = useState<string | null>(null);
  const [blockedUsersFeedback, setBlockedUsersFeedback] = useState<string | null>(null);

  useEffect(() => {
    const loadAccount = async () => {
      try {
        setIsLoadingAccount(true);
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          setAccountError("Impossible de charger les informations du compte.");
          return;
        }
        const json = await res.json();
        const user = json?.data?.user;
        const nextPseudo = typeof user?.pseudo === "string" ? user.pseudo : "";
        setPseudo(nextPseudo);
        setInitialPseudo(nextPseudo);
        setEmail(typeof user?.email === "string" ? user.email : "");
      } catch {
        setAccountError("Impossible de charger les informations du compte.");
      } finally {
        setIsLoadingAccount(false);
      }
    };

    void loadAccount();
  }, []);

  useEffect(() => {
    const loadPrivacy = async () => {
      try {
        setIsLoadingPrivacy(true);
        const res = await fetch("/api/profile/privacy", { cache: "no-store" });
        if (!res.ok) {
          setPrivacyError("Impossible de charger les paramètres de confidentialité.");
          return;
        }
        const json = await res.json();
        const privacy = json?.data?.privacy;
        setApproximateLocation(privacy?.approximate_location !== false);
      } catch {
        setPrivacyError("Impossible de charger les paramètres de confidentialité.");
      } finally {
        setIsLoadingPrivacy(false);
      }
    };

    void loadPrivacy();
  }, []);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      try {
        setIsLoadingBlockedUsers(true);
        const res = await fetch("/api/blocks", { cache: "no-store" });
        if (!res.ok) {
          setBlockedUsers([]);
          return;
        }
        const json = await res.json().catch(() => null);
        const rows = Array.isArray(json?.data?.blocked_users) ? json.data.blocked_users : [];
        setBlockedUsers(rows);
      } catch {
        setBlockedUsers([]);
      } finally {
        setIsLoadingBlockedUsers(false);
      }
    };

    void loadBlockedUsers();
  }, []);

  const handleSavePseudo = async () => {
    setAccountMessage(null);
    setAccountError(null);

    if (!PSEUDO_REGEX.test(pseudo)) {
      setAccountError("Le pseudo doit contenir uniquement des lettres, chiffres et underscores.");
      return;
    }

    setIsSavingAccount(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.details) {
          const messages = Object.values(json.details).flatMap((value) => value as string[]);
          setAccountError(messages[0] || json?.error || "Impossible de mettre à jour le compte.");
          return;
        }
        setAccountError(json?.error || "Impossible de mettre à jour le compte.");
        return;
      }

      const nextPseudo = json?.data?.user?.pseudo;
      if (typeof nextPseudo === "string") setPseudo(nextPseudo);
      if (typeof nextPseudo === "string") setInitialPseudo(nextPseudo);
      setAccountMessage("Pseudo mis à jour");
    } catch {
      setAccountError("Impossible de mettre à jour le compte.");
    } finally {
      setIsSavingAccount(false);
    }
  };

  const handleRequestEmailChange = async () => {
    setEmailChangeMessage(null);
    setEmailChangeError(null);

    const normalizedCurrentEmail = email.trim().toLowerCase();
    const normalizedNewEmail = newEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedNewEmail)) {
      setEmailChangeError("Adresse email invalide.");
      return;
    }

    if (normalizedCurrentEmail === normalizedNewEmail) {
      setEmailChangeError("Le nouvel email doit être différent de l'email actuel.");
      return;
    }

    if (!emailChangePassword) {
      setEmailChangeError("Le mot de passe actuel est requis.");
      return;
    }

    setIsSubmittingEmailChange(true);
    try {
      const res = await fetch("/api/auth/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_email: normalizedNewEmail,
          current_password: emailChangePassword,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.details) {
          const messages = Object.values(json.details).flatMap((value) => value as string[]);
          setEmailChangeError(messages[0] || json?.error || "Impossible de modifier l'email.");
          return;
        }
        setEmailChangeError(json?.error || "Impossible de modifier l'email.");
        return;
      }

      const pendingEmail = json?.data?.pending_email;
      if (typeof pendingEmail === "string") {
        setNewEmail(pendingEmail);
      }
      setEmailChangePassword("");
      setEmailChangeMessage(
        json?.data?.message || "Un email de confirmation a été envoyé à votre nouvelle adresse."
      );
    } catch {
      setEmailChangeError("Impossible de modifier l'email.");
    } finally {
      setIsSubmittingEmailChange(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordMessage(null);
    setPasswordError(null);

    const rules = evaluatePasswordRules(newPassword);
    if (!arePasswordRulesSatisfied(rules)) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères, une majuscule, un chiffre et un caractère spécial (ex: ! ? . , : ; @ #).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation du nouveau mot de passe ne correspond pas.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        if (json?.details) {
          const messages = Object.values(json.details).flatMap((value) => value as string[]);
          setPasswordError(messages[0] || json?.error || "Impossible de modifier le mot de passe.");
          return;
        }
        setPasswordError(json?.error || "Impossible de modifier le mot de passe.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Mot de passe mis à jour avec succès.");
      setIsPasswordOpen(false);
    } catch {
      setPasswordError("Impossible de modifier le mot de passe.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleToggleApproximateLocation = async (nextValue: boolean) => {
    if (isLoadingPrivacy || isSavingPrivacy) return;

    const previousValue = approximateLocation;
    setApproximateLocation(nextValue);
    setPrivacyError(null);
    setIsSavingPrivacy(true);
    try {
      const res = await fetch("/api/profile/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approximate_location: nextValue }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setApproximateLocation(previousValue);
        setPrivacyError(json?.error || "Impossible de mettre à jour la confidentialité.");
        return;
      }
      window.dispatchEvent(
        new CustomEvent(PRIVACY_UPDATED_EVENT, {
          detail: { approximate_location: nextValue },
        })
      );
    } catch {
      setApproximateLocation(previousValue);
      setPrivacyError("Impossible de mettre à jour la confidentialité.");
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleUnblockUser = async (blockedUserId: string) => {
    if (!blockedUserId || isUpdatingBlockedUserId) return;
    setIsUpdatingBlockedUserId(blockedUserId);
    try {
      const res = await fetch(`/api/blocks/${blockedUserId}`, { method: "DELETE" });
      if (!res.ok) return;
      setBlockedUsers((prev) => prev.filter((user) => user.id !== blockedUserId));
      setBlockedUsersFeedback("Utilisateur débloqué");
      window.setTimeout(() => setBlockedUsersFeedback(null), 1400);
    } finally {
      setIsUpdatingBlockedUserId(null);
    }
  };

  const isPseudoChanged = pseudo.trim() !== initialPseudo.trim();
  const passwordRules = evaluatePasswordRules(newPassword);
  const isPrivacySubPage = activeSubPage === "privacy_policy";
  const isTermsSubPage = activeSubPage === "terms_of_use";
  const isLegalSubPage = isPrivacySubPage || isTermsSubPage;

  return (
    <div className="flex h-full flex-col bg-gray-50/50 animate-in slide-in-from-right-8 duration-300 ease-out">
      <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-3 flex items-center">
        <button
          onClick={() => {
            if (isLegalSubPage) {
              setActiveSubPage("main");
              return;
            }
            onBack();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700" strokeWidth={2.5} />
        </button>
        <h2 className="ml-2 text-[18px] font-black text-[#2D2E3B]">
          {isLegalSubPage ? "Retour aux paramètres" : "Paramètres"}
        </h2>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6 pb-safe">
        {isPrivacySubPage ? (
          <section>
            <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Confidentialité</h2>
            <div className="space-y-6 rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-[22px] font-black tracking-tight text-[#2D2E3B]">Politique de confidentialité</h3>
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">
                Playzi accorde une importance particulière à la protection de tes données personnelles.
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">
                Cette politique explique quelles données sont utilisées, pourquoi, et comment elles sont protégées.
              </p>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Données utilisées</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Nous collectons uniquement les données nécessaires au bon fonctionnement de Playzi, notamment :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>informations de compte (email, pseudo, âge)</li>
                  <li>activités créées ou rejointes</li>
                  <li>interactions dans l’application (messages, participation, feedback)</li>
                </ul>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ces données sont utilisées pour :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>te proposer des activités pertinentes</li>
                  <li>améliorer ton expérience</li>
                  <li>assurer la sécurité de la plateforme</li>
                  <li>prévenir les abus</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Localisation</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ta localisation est utilisée uniquement pour te proposer des activités proches de toi.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ta position exacte n’est jamais affichée publiquement aux autres utilisateurs.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Utilisation des données</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Tes données peuvent être utilisées pour :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>améliorer les fonctionnalités de Playzi</li>
                  <li>analyser l’utilisation de l’application</li>
                  <li>personnaliser l’expérience utilisateur</li>
                  <li>renforcer la sécurité et la modération</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Partage et utilisation des données</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Nous ne vendons pas tes données personnelles à des tiers dans un but commercial direct.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Certaines données peuvent être traitées par des services techniques nécessaires au fonctionnement de Playzi (hébergement, authentification, base de données, etc.).
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Dans le cadre du développement de Playzi, certaines données peuvent être utilisées pour :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>améliorer les services</li>
                  <li>proposer du contenu ou des fonctionnalités pertinentes</li>
                  <li>développer de nouvelles offres ou partenariats</li>
                </ul>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ces utilisations sont faites dans le respect de la confidentialité et des réglementations en vigueur.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Services tiers</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Nous pouvons faire appel à des prestataires techniques pour faire fonctionner l’application (ex : hébergement, base de données, analytics).
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ces services peuvent traiter certaines données uniquement dans le cadre de leur mission.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Tes droits</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Tu peux à tout moment :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>accéder à tes données</li>
                  <li>modifier tes informations</li>
                  <li>demander la suppression de ton compte</li>
                </ul>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  La suppression du compte est disponible dans :
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Paramètres &gt; Compte
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Sécurité</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Nous mettons en place des mesures techniques et organisationnelles pour protéger tes données contre tout accès non autorisé, perte ou utilisation abusive.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Évolution</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Cette politique peut être mise à jour afin de refléter les évolutions de Playzi ou des obligations légales.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Contact</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Pour toute question concernant tes données personnelles, tu peux contacter le support directement depuis l’application.
                </p>
              </div>
            </div>
          </section>
        ) : isTermsSubPage ? (
          <section>
            <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Légal</h2>
            <div className="space-y-6 rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-[22px] font-black tracking-tight text-[#2D2E3B]">Conditions d&apos;utilisation</h3>
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">
                Playzi est une plateforme permettant d&apos;organiser et de rejoindre des activités sportives.
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">
                En utilisant Playzi, tu acceptes les présentes conditions.
              </p>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Accès à l&apos;application</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi est réservé aux personnes âgées de 18 ans et plus.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Tu es responsable des informations que tu fournis lors de la création de ton compte.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Nature du service</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi permet aux utilisateurs de créer et rejoindre des activités sportives.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Deux types d&apos;activités peuvent exister sur la plateforme :
                </p>
                <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                  <p className="text-[13px] font-bold text-[#2D2E3B]">Activités entre utilisateurs</p>
                  <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                    Ces activités sont organisées par les utilisateurs eux-mêmes.
                  </p>
                  <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                    Playzi agit uniquement comme une plateforme de mise en relation et n&apos;intervient pas dans l&apos;organisation ou le déroulement de ces activités.
                  </p>
                </div>
                <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                  <p className="text-[13px] font-bold text-[#2D2E3B]">Activités organisées par Playzi</p>
                  <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                    Certaines activités peuvent être proposées directement par Playzi (ex : événements, sessions organisées, rencontres officielles).
                  </p>
                  <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                    Dans ce cas, Playzi agit comme organisateur, mais les participants restent responsables de leur comportement, de leur condition physique et de leurs décisions pendant l&apos;activité.
                  </p>
                </div>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Certains événements peuvent nécessiter des conditions spécifiques (niveau sportif, équipement, respect des consignes). Les participants s&apos;engagent à respecter ces conditions.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Rencontres et sécurité</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Les activités proposées sur Playzi impliquent des rencontres réelles.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu reconnais que :</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>tu participes aux activités à tes propres risques</li>
                  <li>tu es responsable de ta sécurité et de tes choix</li>
                </ul>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Recommandations :</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>privilégier des lieux publics</li>
                  <li>rester vigilant, surtout lors de rencontres à deux</li>
                  <li>prévenir quelqu&apos;un de ton entourage si nécessaire</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Comportement des utilisateurs</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Tu t&apos;engages à adopter un comportement respectueux envers les autres utilisateurs.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Sont interdits :</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>harcèlement ou intimidation</li>
                  <li>comportements dangereux</li>
                  <li>propos inappropriés</li>
                  <li>non-respect répété des autres participants</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Utilisation du chat</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Le chat doit être utilisé de manière responsable :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>communication respectueuse</li>
                  <li>prévenir en cas de retard ou d&apos;empêchement</li>
                  <li>éviter tout abus ou spam</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Participation aux activités</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Lorsque tu rejoins une activité :</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>tu t&apos;engages à faire ton possible pour être présent</li>
                  <li>en cas d&apos;imprévu, tu dois prévenir le groupe dès que possible</li>
                  <li>tu es responsable de ton comportement pendant l&apos;activité</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Absences et no-show</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ne pas se présenter à une activité sans prévenir peut impacter les autres participants.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi peut appliquer des pénalités ou restrictions en cas de comportements répétés.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Système de progression</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi peut utiliser des systèmes de progression ou de réputation (ex : points, grades).
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ces systèmes peuvent évoluer à tout moment.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Compte utilisateur</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Tu es responsable de ton compte.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu t&apos;engages à ne pas :</p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>partager ton compte</li>
                  <li>usurper l&apos;identité d&apos;un autre utilisateur</li>
                </ul>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Modération et sanctions</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi se réserve le droit de :
                </p>
                <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
                  <li>suspendre ou supprimer un compte</li>
                  <li>limiter certaines fonctionnalités</li>
                  <li>appliquer des sanctions en cas de non-respect</li>
                </ul>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Ces décisions peuvent être prises sans préavis.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Responsabilité</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Pour les activités entre utilisateurs :</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi ne peut être tenu responsable des interactions, incidents ou dommages survenant lors de ces activités.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">Pour les activités organisées par Playzi :</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi met en place des mesures raisonnables pour assurer le bon déroulement des événements, mais ne peut garantir l&apos;absence totale de risques liés à la pratique sportive ou aux interactions entre participants.
                </p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Chaque utilisateur participe sous sa propre responsabilité.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Évolution du service</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Playzi peut modifier les fonctionnalités, règles ou conditions à tout moment.
                </p>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-[14px] font-black text-[#2D2E3B]">Support</p>
                <p className="text-[13px] font-medium leading-relaxed text-gray-600">
                  Pour toute question, contacte le support via l&apos;application.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
        <section>
          <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Compte</h2>
          <div className="overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
            <div className="flex flex-col gap-1.5 border-b border-gray-50 p-4">
              <label className="text-[12px] font-bold text-gray-400">Pseudo</label>
              <input
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="w-full text-[15px] font-bold text-[#2D2E3B] placeholder-gray-300 focus:outline-none"
                placeholder="Ton pseudo"
                disabled={isLoadingAccount || isSavingAccount}
              />
              <button
                type="button"
                onClick={() => void handleSavePseudo()}
                className="mt-2 h-11 w-full rounded-xl bg-playzi-green text-[14px] font-bold text-white disabled:opacity-60"
                disabled={isLoadingAccount || isSavingAccount || !pseudo || !isPseudoChanged}
              >
                {isSavingAccount ? "Enregistrement..." : "Enregistrer le pseudo"}
              </button>
              {accountMessage && <p className="text-[12px] font-semibold text-emerald-600">{accountMessage}</p>}
              {accountError && <p className="text-[12px] font-semibold text-rose-600">{accountError}</p>}
            </div>
            <div className="flex flex-col gap-1.5 border-b border-gray-50 bg-gray-50/50 p-4">
              <label className="text-[12px] font-bold text-gray-400">Email actuel</label>
              <p className="text-[15px] font-medium text-gray-600">{email || "—"}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEmailChangeOpen((prev) => !prev)}
              className="group flex w-full items-center justify-between border-b border-gray-50 p-4 transition-colors active:bg-gray-50"
              disabled={isLoadingAccount}
            >
              <span className="text-[15px] font-bold text-[#2D2E3B]">Modifier l&apos;email</span>
              <ChevronRight className={`h-5 w-5 text-gray-300 transition-transform group-hover:text-gray-400 ${isEmailChangeOpen ? "rotate-90" : ""}`} strokeWidth={2.5} />
            </button>

            {isEmailChangeOpen && (
              <div className="space-y-3 border-b border-gray-50 bg-gray-50/50 p-4">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                  placeholder="Nouvel email"
                  disabled={isLoadingAccount || isSubmittingEmailChange}
                />
                <input
                  type="password"
                  value={emailChangePassword}
                  onChange={(e) => setEmailChangePassword(e.target.value)}
                  placeholder="Mot de passe actuel"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                  disabled={isLoadingAccount || isSubmittingEmailChange}
                />
                <p className="text-[12px] font-medium text-gray-500">
                  Pour votre sécurité, confirmez avec votre mot de passe.
                </p>
                <button
                  type="button"
                  onClick={() => void handleRequestEmailChange()}
                  className="h-10 w-full rounded-xl bg-[#2D2E3B] text-[13px] font-bold text-white disabled:opacity-60"
                  disabled={isLoadingAccount || isSubmittingEmailChange || !newEmail || !emailChangePassword}
                >
                  {isSubmittingEmailChange ? "Envoi..." : "Mettre à jour l'email"}
                </button>
                {emailChangeMessage && <p className="text-[12px] font-semibold text-emerald-600">{emailChangeMessage}</p>}
                {emailChangeError && <p className="text-[12px] font-semibold text-rose-600">{emailChangeError}</p>}
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsPasswordOpen((prev) => !prev)}
              className="group flex w-full items-center justify-between p-4 transition-colors active:bg-gray-50"
              disabled={isLoadingAccount}
            >
              <span className="text-[15px] font-bold text-[#2D2E3B]">Modifier le mot de passe</span>
              <ChevronRight className={`h-5 w-5 text-gray-300 transition-transform group-hover:text-gray-400 ${isPasswordOpen ? "rotate-90" : ""}`} strokeWidth={2.5} />
            </button>

            {isPasswordOpen && (
              <div className="space-y-3 border-t border-gray-50 bg-gray-50/50 p-4">
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Mot de passe actuel"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                  disabled={isUpdatingPassword}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                  disabled={isUpdatingPassword}
                />
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <p className="text-[12px] font-semibold text-gray-600">
                    Le mot de passe doit contenir au moins :
                  </p>
                  <p className={`mt-1 text-[12px] font-medium ${passwordRules.hasMinLength ? "text-emerald-600" : "text-gray-500"}`}>
                    {passwordRules.hasMinLength ? "✅" : "❌"} 8 caractères minimum
                  </p>
                  <p className={`text-[12px] font-medium ${passwordRules.hasUppercase ? "text-emerald-600" : "text-gray-500"}`}>
                    {passwordRules.hasUppercase ? "✅" : "❌"} une majuscule
                  </p>
                  <p className={`text-[12px] font-medium ${passwordRules.hasDigit ? "text-emerald-600" : "text-gray-500"}`}>
                    {passwordRules.hasDigit ? "✅" : "❌"} un chiffre
                  </p>
                  <p className={`text-[12px] font-medium ${passwordRules.hasSpecial ? "text-emerald-600" : "text-gray-500"}`}>
                    {passwordRules.hasSpecial ? "✅" : "❌"} un caractère spécial (ex: ! ? . , : ; @ #)
                  </p>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[14px] font-medium text-[#2D2E3B] outline-none focus:border-playzi-green/40"
                  disabled={isUpdatingPassword}
                />
                <button
                  type="button"
                  onClick={() => void handleUpdatePassword()}
                  className="h-10 w-full rounded-xl bg-[#2D2E3B] text-[13px] font-bold text-white disabled:opacity-60"
                  disabled={isUpdatingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  {isUpdatingPassword ? "Mise à jour..." : "Enregistrer le nouveau mot de passe"}
                </button>
              </div>
            )}

            <div className="border-t border-gray-50 p-4">
              <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-[13px] font-semibold text-gray-600">Langue : Français</p>
              </div>
              {passwordMessage && <p className="mt-2 text-[12px] font-semibold text-emerald-600">{passwordMessage}</p>}
              {passwordError && <p className="mt-2 text-[12px] font-semibold text-rose-600">{passwordError}</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Notifications</h2>
          <div className="flex items-center justify-between rounded-[20px] border border-gray-100 bg-white p-4 shadow-sm">
            <span className="text-[15px] font-bold text-[#2D2E3B]">Notifications sportives</span>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className={`relative h-7 w-12 rounded-full transition-colors ${notificationsEnabled ? "bg-playzi-green" : "bg-gray-200"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${notificationsEnabled ? "left-6" : "left-1"}`} />
            </button>
          </div>
          {!notificationsEnabled && (
            <div className="mt-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">Si désactivé, tu ne recevras plus :</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] font-medium text-gray-500">
                <li>les nouvelles activités</li>
                <li>les confirmations de participation</li>
                <li>les messages liés aux activités</li>
                <li>les alertes urgentes</li>
              </ul>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Confidentialité</h2>
          <div className="flex flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 p-4">
              <span className="text-[15px] font-bold text-[#2D2E3B]">Localisation approximative</span>
              <button
                type="button"
                role="switch"
                aria-checked={approximateLocation}
                onClick={() => void handleToggleApproximateLocation(!approximateLocation)}
                className={`relative h-7 w-12 rounded-full transition-colors ${approximateLocation ? "bg-playzi-green" : "bg-gray-200"}`}
                disabled={isLoadingPrivacy || isSavingPrivacy}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${approximateLocation ? "left-6" : "left-1"}`} />
              </button>
            </div>
            <div className="border-b border-gray-50 px-4 py-3">
              <p className="text-[13px] font-medium leading-relaxed text-gray-500">Ta position n’est jamais affichée publiquement.</p>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-500">Elle est utilisée uniquement pour te proposer des activités proches de toi.</p>
              {!approximateLocation && (
                <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-relaxed text-amber-700">
                  La localisation est désactivée. Le filtre de distance ne sera plus utilisé.
                </p>
              )}
            </div>
            <div className="border-b border-gray-50 p-4">
              <button
                type="button"
                onClick={() => setActiveSubPage("privacy_policy")}
                className="inline-flex items-center text-[14px] font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-[#2D2E3B]"
              >
                Politique de confidentialité
              </button>
            </div>
            <div className="p-4">
              <button
                type="button"
                onClick={() => setActiveSubPage("terms_of_use")}
                className="inline-flex items-center text-[14px] font-semibold text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-[#2D2E3B]"
              >
                Conditions d&apos;utilisation
              </button>
            </div>
            {privacyError && (
              <div className="p-4">
                <p className="text-[12px] font-semibold text-rose-600">{privacyError}</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 px-1 text-[13px] font-black uppercase tracking-widest text-gray-400">Sécurité</h2>
          <div className="flex flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm">
            <div className="p-5">
              <h3 className="mb-2 text-[15px] font-bold text-[#2D2E3B]">Utilisateurs bloqués</h3>
              <div className="rounded-xl bg-gray-50 p-4">
                {isLoadingBlockedUsers ? (
                  <p className="text-center text-[13px] font-medium text-gray-400">Chargement...</p>
                ) : blockedUsers.length === 0 ? (
                  <p className="text-center text-[13px] font-medium text-gray-400">Aucun utilisateur bloqué.</p>
                ) : (
                  <div className="space-y-2">
                    {blockedUsers.map((blockedUser) => (
                      <div key={blockedUser.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-[#2D2E3B]">@{blockedUser.pseudo}</p>
                          <p className="truncate text-[11px] font-medium text-gray-500">Nom: {blockedUser.last_name || "—"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleUnblockUser(blockedUser.id)}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-bold text-gray-600 disabled:opacity-60"
                          disabled={isUpdatingBlockedUserId === blockedUser.id}
                        >
                          {isUpdatingBlockedUserId === blockedUser.id ? "..." : "Débloquer"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {blockedUsersFeedback && <p className="mt-3 text-center text-[12px] font-semibold text-gray-600">{blockedUsersFeedback}</p>}
              </div>
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
