"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import PlayziLogo from "@/components/PlayziLogo";

function ConsentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [acceptedTerms, setAcceptedTerms] = useState(searchParams.get("accepted_terms") === "1");
  const [marketingOptIn, setMarketingOptIn] = useState(searchParams.get("marketing_opt_in") === "1");
  const [error, setError] = useState<string | null>(null);

  const returnHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", "register");
    params.set("accepted_terms", acceptedTerms ? "1" : "0");
    params.set("marketing_opt_in", marketingOptIn ? "1" : "0");
    const next = searchParams.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      params.set("next", next);
    }
    return `/login?${params.toString()}`;
  }, [acceptedTerms, marketingOptIn, searchParams]);

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-gray-50/40">
      <header className="shrink-0 border-b border-gray-100 bg-white px-4 py-3">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => router.push(returnHref)}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <PlayziLogo />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-6">
        <h1 className="text-[28px] font-black tracking-tight text-[#2D2E3B]">Conditions et confidentialité</h1>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-500">
          Merci de lire et accepter pour continuer
        </p>

        <section id="conditions" className="mt-6 space-y-4 rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-[18px] font-black tracking-tight text-[#2D2E3B]">Conditions d&apos;utilisation</h2>
          <p className="text-[13px] font-medium leading-relaxed text-gray-600">
            Playzi est une plateforme permettant d&apos;organiser et de rejoindre des activités sportives.
          </p>
          <p className="text-[13px] font-medium leading-relaxed text-gray-600">
            En utilisant Playzi, tu acceptes les présentes conditions.
          </p>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Accès à l&apos;application</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi est réservé aux personnes âgées de 18 ans et plus.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu es responsable des informations que tu fournis lors de la création de ton compte.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Nature du service</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi permet aux utilisateurs de créer et rejoindre des activités sportives.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Deux types d&apos;activités peuvent exister sur la plateforme :</p>
            <p className="text-[13px] font-bold text-[#2D2E3B]">Activités entre utilisateurs</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ces activités sont organisées par les utilisateurs eux-mêmes.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Playzi agit uniquement comme une plateforme de mise en relation et n&apos;intervient pas dans l&apos;organisation ou le déroulement de ces activités.
            </p>
            <p className="text-[13px] font-bold text-[#2D2E3B]">Activités organisées par Playzi</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Certaines activités peuvent être proposées directement par Playzi (ex : événements, sessions organisées, rencontres officielles).
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Dans ce cas, Playzi agit comme organisateur, mais les participants restent responsables de leur comportement, de leur condition physique et de leurs décisions pendant l&apos;activité.
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Certains événements peuvent nécessiter des conditions spécifiques (niveau sportif, équipement, respect des consignes). Les participants s&apos;engagent à respecter ces conditions.
            </p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Rencontres et sécurité</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Les activités proposées sur Playzi impliquent des rencontres réelles.</p>
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

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Comportement des utilisateurs</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu t&apos;engages à adopter un comportement respectueux envers les autres utilisateurs.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Sont interdits :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>harcèlement ou intimidation</li>
              <li>comportements dangereux</li>
              <li>propos inappropriés</li>
              <li>non-respect répété des autres participants</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Utilisation du chat</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Le chat doit être utilisé de manière responsable :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>communication respectueuse</li>
              <li>prévenir en cas de retard ou d&apos;empêchement</li>
              <li>éviter tout abus ou spam</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Participation aux activités</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Lorsque tu rejoins une activité :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>tu t&apos;engages à faire ton possible pour être présent</li>
              <li>en cas d&apos;imprévu, tu dois prévenir le groupe dès que possible</li>
              <li>tu es responsable de ton comportement pendant l&apos;activité</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Absences et no-show</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ne pas se présenter à une activité sans prévenir peut impacter les autres participants.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi peut appliquer des pénalités ou restrictions en cas de comportements répétés.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Système de progression</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi peut utiliser des systèmes de progression ou de réputation (ex : points, grades).</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ces systèmes peuvent évoluer à tout moment.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Compte utilisateur</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu es responsable de ton compte.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu t&apos;engages à ne pas :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>partager ton compte</li>
              <li>usurper l&apos;identité d&apos;un autre utilisateur</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Modération et sanctions</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi se réserve le droit de :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>suspendre ou supprimer un compte</li>
              <li>limiter certaines fonctionnalités</li>
              <li>appliquer des sanctions en cas de non-respect</li>
            </ul>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ces décisions peuvent être prises sans préavis.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Responsabilité</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Pour les activités entre utilisateurs :</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Playzi ne peut être tenu responsable des interactions, incidents ou dommages survenant lors de ces activités.
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Pour les activités organisées par Playzi :</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Playzi met en place des mesures raisonnables pour assurer le bon déroulement des événements, mais ne peut garantir l&apos;absence totale de risques liés à la pratique sportive ou aux interactions entre participants.
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Chaque utilisateur participe sous sa propre responsabilité.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Évolution du service</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Playzi peut modifier les fonctionnalités, règles ou conditions à tout moment.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Support</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Pour toute question, contacte le support via l&apos;application.</p>
          </div>
        </section>

        <section id="privacy" className="mt-5 space-y-4 rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="text-[18px] font-black tracking-tight text-[#2D2E3B]">Politique de confidentialité</h2>
          <p className="text-[13px] font-medium leading-relaxed text-gray-600">
            Playzi accorde une importance particulière à la protection de tes données personnelles.
          </p>
          <p className="text-[13px] font-medium leading-relaxed text-gray-600">
            Cette politique explique quelles données sont utilisées, pourquoi, et comment elles sont protégées.
          </p>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Données utilisées</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Nous collectons uniquement les données nécessaires au bon fonctionnement de Playzi, notamment :
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>informations de compte (email, pseudo, âge)</li>
              <li>activités créées ou rejointes</li>
              <li>interactions dans l&apos;application (messages, participation, feedback)</li>
            </ul>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ces données sont utilisées pour :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>te proposer des activités pertinentes</li>
              <li>améliorer ton expérience</li>
              <li>assurer la sécurité de la plateforme</li>
              <li>prévenir les abus</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Localisation</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ta localisation est utilisée uniquement pour te proposer des activités proches de toi.</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Ta position exacte n&apos;est jamais affichée publiquement aux autres utilisateurs.</p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Utilisation des données</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tes données peuvent être utilisées pour :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>améliorer les fonctionnalités de Playzi</li>
              <li>analyser l&apos;utilisation de l&apos;application</li>
              <li>personnaliser l&apos;expérience utilisateur</li>
              <li>renforcer la sécurité et la modération</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Partage et utilisation des données</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Nous ne vendons pas tes données personnelles à des tiers dans un but commercial direct.</p>
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

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Services tiers</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Nous pouvons faire appel à des prestataires techniques pour faire fonctionner l&apos;application (ex : hébergement, base de données, analytics).
            </p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Ces services peuvent traiter certaines données uniquement dans le cadre de leur mission.
            </p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Tes droits</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">Tu peux à tout moment :</p>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] font-medium leading-relaxed text-gray-600">
              <li>accéder à tes données</li>
              <li>modifier tes informations</li>
              <li>demander la suppression de ton compte</li>
            </ul>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Sécurité</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Nous mettons en place des mesures techniques et organisationnelles pour protéger tes données contre tout accès non autorisé, perte ou utilisation abusive.
            </p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Évolution</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Cette politique peut être mise à jour afin de refléter les évolutions de Playzi ou des obligations légales.
            </p>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-4">
            <p className="text-[14px] font-black text-[#2D2E3B]">Contact</p>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Pour toute question concernant tes données personnelles, tu peux contacter le support directement depuis l&apos;application.
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setAcceptedTerms((prev) => !prev);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setAcceptedTerms((prev) => !prev);
                setError(null);
              }
            }}
            className="flex cursor-pointer items-start gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${acceptedTerms ? "border-playzi-green bg-playzi-green text-white scale-100" : "border-gray-300 bg-white text-transparent scale-[0.96]"}`}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              J&apos;accepte les Conditions d&apos;utilisation et la Politique de confidentialité
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => setMarketingOptIn((prev) => !prev)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setMarketingOptIn((prev) => !prev);
              }
            }}
            className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl p-1 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${marketingOptIn ? "border-playzi-green bg-playzi-green text-white scale-100" : "border-gray-300 bg-white text-transparent scale-[0.96]"}`}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Je souhaite recevoir des nouveautés, conseils et offres de Playzi
            </p>
          </div>

          {error && <p className="mt-3 text-[12px] font-semibold text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={() => {
              if (!acceptedTerms) {
                setError("Tu dois accepter les conditions pour continuer.");
                return;
              }
              router.push(returnHref);
            }}
            disabled={!acceptedTerms}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-playzi-green text-[15px] font-black text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition-all active:scale-[0.98] disabled:opacity-65 disabled:active:scale-100"
          >
            Continuer
          </button>
        </section>
      </div>
    </main>
  );
}

export default function ConsentsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex h-[100dvh] w-full max-w-md items-center justify-center bg-gray-50/40 px-6">
          <p className="text-[14px] font-semibold text-gray-500">Chargement...</p>
        </main>
      }
    >
      <ConsentsContent />
    </Suspense>
  );
}
