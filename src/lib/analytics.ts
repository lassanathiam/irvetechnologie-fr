/**
 * Suivi Google Analytics (gtag) limité aux pages publiques commerciales.
 * L'espace pro, les liens privés (devis, factures, PV, partenaires…) ne sont
 * jamais mesurés : aucune donnée client ne part chez Google.
 */

export const GA_MEASUREMENT_ID = "G-V2S0YLZEHX";

const PREFIXES_PUBLICS = [
  "/a-propos",
  "/bornes",
  "/borne-recharge-professionnels",
  "/calculateur-irve",
  "/demande",
  "/installation-borne-recharge",
  "/zones-intervention",
];

/** Vrai seulement pour les pages publiques du site vitrine. */
export function estPagePubliqueMesuree(pathname: string): boolean {
  const p = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return true;
  return PREFIXES_PUBLICS.some((pre) => p === pre || p.startsWith(`${pre}-`) || p.startsWith(`${pre}/`));
}

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let charge = false;

function initialiser() {
  if (charge || typeof window === "undefined") return;
  charge = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params -- gtag.js attend l'objet arguments
    window.dataLayer!.push(arguments);
  };
  window.gtag("set", "developer_id.dZjgwMW", true);
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

/** À appeler à chaque changement de page (navigateur uniquement). */
export function suivrePageVue(pathname: string) {
  if (typeof window === "undefined" || !estPagePubliqueMesuree(pathname)) return;
  initialiser();
  window.gtag?.("event", "page_view", {
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Demande de devis envoyée : conversion principale du site. */
export function suivreDemandeEnvoyee(profil: string | null | undefined) {
  if (typeof window === "undefined") return;
  initialiser();
  window.gtag?.("event", "generate_lead", { profil_client: profil ?? "inconnu" });
}
