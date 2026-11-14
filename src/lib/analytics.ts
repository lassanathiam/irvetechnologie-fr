/**
 * Suivi Google (Analytics + Google Ads) limité aux pages publiques commerciales,
 * et seulement après l'accord du visiteur (bandeau de consentement).
 * L'espace pro et les liens privés (devis, factures, PV, partenaires…) ne sont
 * jamais mesurés : aucune donnée client ne part chez Google.
 */
import { EVENEMENT_CONSENTEMENT, mesureAutorisee, publiciteAutorisee } from "./consentement";

export const GA_MEASUREMENT_ID = "G-V2S0YLZEHX";
/** Balise Google Ads du compte 849-204-3839 (identifiant vérifié dans Google Ads). */
export const GOOGLE_ADS_ID = "AW-18562358792";
/** Comptage « Demande de devis envoyée (site) ». */
export const GOOGLE_ADS_DEVIS_SEND_TO = "AW-18562358792/9gC1CM-j67UdEIi8nJNF";

const PREFIXES_PUBLICS = [
  "/a-propos",
  "/bornes",
  "/borne-recharge-professionnels",
  "/calculateur-irve",
  "/confidentialite",
  "/demande",
  "/devis-borne-recharge",
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

let scriptCharge = false;
let gaConfigure = false;
let adsConfigure = false;
let ecouteInstallee = false;

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtagShim() {
      // eslint-disable-next-line prefer-rest-params -- gtag.js attend l'objet arguments
      window.dataLayer!.push(arguments);
    };
    // Par défaut tout est refusé : rien n'est stocké tant que le visiteur n'a pas accepté.
    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
  }
  window.gtag(...args);
}

/** Charge Google seulement si au moins un accord existe, puis configure ce qui est accepté. */
function appliquerConsentement() {
  if (typeof window === "undefined") return;
  const mesure = mesureAutorisee();
  const pub = publiciteAutorisee();
  if (!mesure && !pub && !scriptCharge) return;

  gtag("consent", "update", {
    analytics_storage: mesure ? "granted" : "denied",
    ad_storage: pub ? "granted" : "denied",
    ad_user_data: pub ? "granted" : "denied",
    ad_personalization: pub ? "granted" : "denied",
  });
  if (!pub) gtag("set", "user_data", null);

  if (!scriptCharge) {
    scriptCharge = true;
    gtag("set", "developer_id.dZjgwMW", true);
    gtag("js", new Date());
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${mesure ? GA_MEASUREMENT_ID : GOOGLE_ADS_ID}`;
    document.head.appendChild(s);
  }
  if (mesure && !gaConfigure) {
    gaConfigure = true;
    gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  }
  if (pub && !adsConfigure) {
    adsConfigure = true;
    gtag("config", GOOGLE_ADS_ID);
  }
}

/** À appeler une fois au démarrage (navigateur) : applique le choix enregistré et suit ses changements. */
export function initialiserSuivi() {
  if (typeof window === "undefined") return;
  if (!ecouteInstallee) {
    ecouteInstallee = true;
    window.addEventListener(EVENEMENT_CONSENTEMENT, appliquerConsentement);
  }
  appliquerConsentement();
}

/** À appeler à chaque changement de page (navigateur uniquement). */
export function suivrePageVue(pathname: string) {
  if (typeof window === "undefined" || !estPagePubliqueMesuree(pathname)) return;
  initialiserSuivi();
  if (!mesureAutorisee()) return;
  gtag("event", "page_view", {
    send_to: GA_MEASUREMENT_ID,
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/**
 * Demande de devis réellement enregistrée : conversion principale du site.
 * `demandeId` = identifiant de la demande en base (évite de compter deux fois).
 */
export function suivreDemandeEnvoyee(profil: string | null | undefined, demandeId: string) {
  if (typeof window === "undefined" || !demandeId) return;
  initialiserSuivi();
  if (mesureAutorisee()) {
    gtag("event", "generate_lead", { send_to: GA_MEASUREMENT_ID, profil_client: profil ?? "inconnu" });
  }
  if (publiciteAutorisee()) {
    gtag("event", "conversion", {
      send_to: GOOGLE_ADS_DEVIS_SEND_TO,
      transaction_id: demandeId,
    });
  }
}
