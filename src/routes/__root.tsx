import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { memoriserOrigineLead } from "../lib/lead-source";
import { suivrePageVue } from "../lib/analytics";
import { BandeauConsentement } from "../components/BandeauConsentement";
import { COMPANY_CONFIG, operatingBaseGeo } from "../config/company";
import { CHEMINS_PAGES_CODEES, normaliserChemin } from "../lib/sorank/pages-publiques";
import { lireSurchargeSeo } from "../lib/blog.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce lien n'existe pas ou a été déplacé.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function estSessionExpiree(error: Error): boolean {
  const message = `${error?.message ?? ""} ${(error as { statusText?: string })?.statusText ?? ""}`;
  const status = (error as { status?: number; statusCode?: number })?.status ??
    (error as { statusCode?: number })?.statusCode;
  if (status === 401 || status === 403) return true;
  return /unauthorized|non autoris|401|jwt|token (expired|invalide)|invalid claim/i.test(message);
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const sessionExpiree = estSessionExpiree(error as Error);

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // Session expirée : on nettoie la session locale et on renvoie vers la connexion.
  useEffect(() => {
    if (!sessionExpiree || typeof window === "undefined") return;
    let annule = false;
    void (async () => {
      try {
        const { supabase } = await import("../integrations/supabase/client");
        await supabase.auth.signOut();
      } catch {
        // ignoré : on redirige quand même vers la page de connexion
      }
      if (!annule) window.location.replace("/auth");
    })();
    return () => {
      annule = true;
    };
  }, [sessionExpiree]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {sessionExpiree ? "Votre session a expiré" : "Cette page n'a pas pu être chargée"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sessionExpiree
            ? "Reconnectez-vous pour retrouver votre espace professionnel. Redirection en cours…"
            : "Une erreur s'est produite. Vous pouvez réessayer sans quitter cette page."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {sessionExpiree ? (
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Se reconnecter
            </Link>
          ) : (
            <button
              onClick={() => {
                router.invalidate();
                reset();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Réessayer
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Corrections SEO Sorank des pages publiques codées (titre, description, JSON-LD).
  // Jamais bloquant : en cas d'échec, la page garde ses balises d'origine.
  loader: async ({ location, context }) => {
    const path = normaliserChemin(location.pathname);
    if (!CHEMINS_PAGES_CODEES.has(path)) return { seoSurcharge: null };
    try {
      const seoSurcharge = await context.queryClient.ensureQueryData({
        queryKey: ["seo-surcharge", path],
        queryFn: () => lireSurchargeSeo({ data: { path } }),
        staleTime: 5 * 60_000,
      });
      return { seoSurcharge };
    } catch {
      return { seoSurcharge: null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Borne de l'Ouest — IRVE Technologie, bornes de recharge" },
      { name: "description", content: "Installation, raccordement et maintenance de bornes de recharge autour de Nantes : Grand Ouest élargi et interventions étudiées jusqu'à environ 250 km selon la rentabilité." },
      { name: "author", content: "IRVE Technologie" },
      { property: "og:title", content: "Borne de l'Ouest — IRVE Technologie" },
      { property: "og:description", content: "Interventions IRVE autour de Nantes dans le Grand Ouest élargi, avec extension possible selon distance, trajet et rentabilité du chantier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Borne de l'Ouest — IRVE Technologie" },
      { name: "twitter:description", content: "Interventions IRVE autour de Nantes dans le Grand Ouest élargi, extension possible jusqu'à ~250 km selon la nature du projet." },
      { name: "theme-color", content: "#1f2a3d" },
      { name: "google-site-verification", content: "GjobKfL3N-ClKGz9w-1NSj7ykWCpIeM3GKOuuEiLbUs" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Borne Ouest" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400..700&family=Outfit:wght@500;600;700;800;900&family=Figtree:wght@400;500;600;700&family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Electrician",
          name: COMPANY_CONFIG.brandName,
          alternateName: COMPANY_CONFIG.legalName,
          legalName: COMPANY_CONFIG.legalName,
          url: "https://irvetechnologie.fr",
          telephone: "+33768084367",
          email: COMPANY_CONFIG.email,
          vatID: "FR89989533724",
          taxID: "98953372400013",
          priceRange: "€€",
          address: {
            "@type": "PostalAddress",
            streetAddress: COMPANY_CONFIG.operatingBase.street,
            postalCode: COMPANY_CONFIG.operatingBase.postalCode,
            addressLocality: COMPANY_CONFIG.operatingBase.city,
            addressRegion: "Pays de la Loire",
            addressCountry: "FR",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: operatingBaseGeo.lat,
            longitude: operatingBaseGeo.lng,
          },
          openingHoursSpecification: COMPANY_CONFIG.openingHours.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [...h.days],
            opens: h.opens,
            closes: h.closes,
          })),
          hasCredential: COMPANY_CONFIG.qualifications,
          ...(COMPANY_CONFIG.sameAs.length > 0 ? { sameAs: [...COMPANY_CONFIG.sameAs] } : {}),
          subOrganization: {
            "@type": "Organization",
            name: COMPANY_CONFIG.legalName,
            address: {
              "@type": "PostalAddress",
              streetAddress: COMPANY_CONFIG.headOffice.street,
              postalCode: COMPANY_CONFIG.headOffice.postalCode,
              addressLocality: COMPANY_CONFIG.headOffice.city,
              addressCountry: "FR",
            },
          },
          areaServed: [
            "Nantes et son bassin",
            "Grand Ouest élargi",
            "Loire-Atlantique (44)",
            "Maine-et-Loire (49)",
            "Vendée (85)",
            "Mayenne (53)",
            "Sarthe (72)",
            "Ille-et-Vilaine (35)",
            "Morbihan (56)",
            "Côtes-d'Armor (22)",
            "Finistère (29)",
            "Deux-Sèvres (79)",
            "Vienne (86)",
            "Charente (16)",
            "Charente-Maritime (17)",
            "Indre-et-Loire (37)",
            "Loir-et-Cher (41)",
            "Orne (61)",
            "Calvados (14)",
            "Cher (18)",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Borne de l'Ouest",
          alternateName: "IRVE Technologie",
          url: "https://irvetechnologie.fr",
          inLanguage: "fr-FR",
          publisher: {
            "@type": "Organization",
            name: "IRVE Technologie",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Langue de la page : celle de l'article de blog affiché, sinon le français.
  const lang = useRouterState({
    select: (s) => {
      for (const m of s.matches) {
        const l = (m.loaderData as { htmlLang?: unknown } | undefined)?.htmlLang;
        if (typeof l === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l)) return l;
      }
      return "fr";
    },
  });
  return (
    <html lang={lang}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Mémorise d'où vient le visiteur (Google, publicité…) pour le suivi des demandes.
  useEffect(() => {
    memoriserOrigineLead();
  }, []);

  // Statistiques Google : pages publiques du site uniquement.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    suivrePageVue(pathname);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <BandeauConsentement pathname={pathname} />
      <Toaster />
    </QueryClientProvider>
  );
}
