import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/installer")({
  head: () => ({
    meta: [
      { title: "Installer l'application — Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Installez l'application Borne de l'Ouest sur votre téléphone en quelques secondes pour accéder à l'espace pro hors navigateur.",
      },
      { property: "og:title", content: "Installer l'application Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Ajoutez l'espace pro IRVE Technologie sur l'écran d'accueil de votre mobile.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Installer,
});

type PromptEvent = Event & { prompt: () => Promise<void> };

function Installer() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [installee, setInstallee] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstallee(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstallee(true);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="px-4 pb-10 pt-32">
      <div className="mx-auto max-w-2xl space-y-8">
        <nav className="flex flex-wrap items-center gap-3 text-mono text-xs">
          <Link to="/" className="text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
            Accueil
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/espace" className="text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
            Espace pro
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <img
            src="/app-icon-192.png"
            alt="Icône de l'application Borne de l'Ouest"
            width={72}
            height={72}
            className="rounded-2xl border border-border"
          />
          <div>
            <h1 className="text-2xl font-semibold">Installer l'application</h1>
            <p className="text-sm text-muted-foreground">
              Borne de l'Ouest — marque de la société IRVE Technologie
            </p>
            <p className="mt-1 text-xs font-semibold text-primary">Qualifications IRVE P1 · P2 · P3</p>
          </div>
        </div>

        {installee ? (
          <p className="rounded-sm border border-border bg-card p-4 text-sm">
            L'application est déjà installée sur cet appareil. Ouvrez-la depuis votre écran
            d'accueil.
          </p>
        ) : promptEvent ? (
          <button
            type="button"
            onClick={() => promptEvent.prompt()}
            className="inline-flex items-center justify-center rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Installer maintenant
          </button>
        ) : ios ? (
          <p className="rounded-sm border border-primary/40 bg-card p-4 text-sm">
            Sur iPhone, l'application ne se télécharge pas comme dans l'App Store : ouvrez cette
            page dans Safari, touchez Partager, puis « Sur l'écran d'accueil ».
          </p>
        ) : null}

        <section className="rounded-sm border border-border bg-card p-6 space-y-3">
          <h2 className="font-semibold">Sur iPhone / iPad (Safari)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Ouvrez cette page dans Safari.</li>
            <li>Touchez le bouton Partager (le carré avec la flèche vers le haut).</li>
            <li>Choisissez « Sur l'écran d'accueil », puis « Ajouter ».</li>
          </ol>
        </section>

        <section className="rounded-sm border border-border bg-card p-6 space-y-3">
          <h2 className="font-semibold">Sur Android (Chrome)</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Ouvrez cette page dans Chrome.</li>
            <li>Touchez le menu (trois points) en haut à droite.</li>
            <li>Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».</li>
          </ol>
        </section>

        <section className="rounded-sm border border-border bg-card p-6 space-y-3">
          <h2 className="font-semibold">Sur ordinateur (Chrome / Edge)</h2>
          <p className="text-sm text-muted-foreground">
            Cliquez sur l'icône d'installation dans la barre d'adresse, à droite.
          </p>
        </section>

        <p className="text-sm text-muted-foreground">
          Une fois installée, l'application s'ouvre directement sur l'espace pro.{" "}
          <Link to="/espace" className="underline">
            Ouvrir l'espace pro
          </Link>
        </p>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
