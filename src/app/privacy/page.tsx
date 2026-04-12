import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-white px-6 pb-12 pt-8">
      <Link
        href="/settings"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-600 transition hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux paramètres
      </Link>

      <h1 className="text-[30px] font-black tracking-tight text-[#2D2E3B]">Politique de confidentialité</h1>
      <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-500">
        Playzi protège tes données personnelles et limite le partage aux informations nécessaires au fonctionnement de l&apos;application.
      </p>

      <section className="mt-7 space-y-4 rounded-[22px] border border-gray-100 bg-gray-50/60 p-5">
        <p className="text-[14px] font-semibold text-[#2D2E3B]">Données utilisées</p>
        <p className="text-[13px] font-medium leading-relaxed text-gray-600">
          Nous utilisons tes données de compte, d&apos;activité et de participation uniquement pour fournir les fonctionnalités sociales, sportives et de sécurité de Playzi.
        </p>
        <p className="text-[13px] font-medium leading-relaxed text-gray-600">
          Tu peux ajuster la précision de ta localisation depuis Paramètres &gt; Confidentialité.
        </p>
        <p className="text-[13px] font-medium leading-relaxed text-gray-600">
          Pour toute demande liée à tes données, contacte le support Playzi.
        </p>
      </section>
    </main>
  );
}
