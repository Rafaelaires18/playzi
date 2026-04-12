"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import PlayziLogo from "@/components/PlayziLogo";
import PlayziLoader from "@/components/PlayziLoader";

function sanitizeNextPath(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const value = rawValue.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function ConsentCheckPage() {
  const router = useRouter();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/discover";
    const query = new URLSearchParams(window.location.search);
    return sanitizeNextPath(query.get("next")) || "/discover";
  }, []);
  const legalHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("mode", "register");
    params.set("accepted_terms", acceptedTerms ? "1" : "0");
    params.set("marketing_opt_in", marketingOptIn ? "1" : "0");
    if (nextPath.startsWith("/") && !nextPath.startsWith("//")) {
      params.set("next", nextPath);
    }
    return `/login/consents?${params.toString()}`;
  }, [acceptedTerms, marketingOptIn, nextPath]);

  useEffect(() => {
    let cancelled = false;
    const loadConsents = async () => {
      try {
        const res = await fetch(`/api/profile/consents?t=${Date.now()}`, { cache: "no-store" });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(body?.error || "Impossible de charger les consentements.");
        }
        if (cancelled) return;
        if (!body?.data?.requires_update) {
          router.replace(nextPath);
          return;
        }
        setMarketingOptIn(body?.data?.marketing_opt_in === true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Impossible de charger les consentements.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadConsents();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("Tu dois accepter les conditions pour continuer.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/profile/consents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accepted_terms: acceptedTerms,
          marketing_opt_in: marketingOptIn,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        if (body?.details) {
          const messages = Object.values(body.details).flatMap((value) => value as string[]);
          throw new Error(messages[0] || body?.error || "Impossible d'enregistrer les consentements.");
        }
        throw new Error(body?.error || "Impossible d'enregistrer les consentements.");
      }
      router.replace(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer les consentements.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <PlayziLoader message="Chargement des consentements..." />;
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-gray-50 px-6 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <PlayziLogo />
      </div>

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.04)]">
        <h1 className="text-[26px] font-black tracking-tight text-[#2D2E3B]">Mise à jour des conditions</h1>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-500">
          Pour continuer à utiliser Playzi, tu dois accepter les{" "}
          <button
            type="button"
            onClick={() => router.push(`${legalHref}#conditions`)}
            className="font-semibold text-playzi-green underline decoration-playzi-green/40 underline-offset-2 transition-colors active:opacity-70 hover:decoration-playzi-green"
          >
            Conditions d&apos;utilisation
          </button>{" "}
          et la{" "}
          <button
            type="button"
            onClick={() => router.push(`${legalHref}#privacy`)}
            className="font-semibold text-playzi-green underline decoration-playzi-green/40 underline-offset-2 transition-colors active:opacity-70 hover:decoration-playzi-green"
          >
            Politique de confidentialité
          </button>
          .
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-[12px] font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
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
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-playzi-green/30"
          >
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${marketingOptIn ? "border-playzi-green bg-playzi-green text-white scale-100" : "border-gray-300 bg-white text-transparent scale-[0.96]"}`}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">
              Je souhaite recevoir des nouveautés, conseils et offres de Playzi
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !acceptedTerms}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-playzi-green text-[15px] font-black text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)] transition-all active:scale-[0.98] disabled:opacity-65 disabled:active:scale-100"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuer"}
          </button>
        </form>
      </section>
    </main>
  );
}
