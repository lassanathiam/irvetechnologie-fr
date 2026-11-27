/**
 * Pixel Meta (Facebook / Instagram) du compte IRVE TECHNOLOGIE.
 * Chargé uniquement sur les pages publiques mesurées ET après l'accord « Publicité »
 * du visiteur. Aucune coordonnée (nom, email, téléphone) n'est envoyée à Meta :
 * pas de correspondance avancée, seulement la page vue et la demande envoyée.
 */
export const META_PIXEL_ID = "1771305547988447";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: Fbq;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

let initialise = false;
let accorde = false;

function creerFile(): Fbq {
  if (window.fbq) return window.fbq;
  const f = function fbqShim(...args: unknown[]) {
    if (f.callMethod) f.callMethod.apply(f, args);
    else f.queue!.push(args);
  } as Fbq;
  if (!window._fbq) window._fbq = f;
  f.push = f;
  f.loaded = true;
  f.version = "2.0";
  f.queue = [];
  window.fbq = f;
  return f;
}

/** Applique l'accord publicité : charge le pixel s'il est accordé, le coupe sinon. */
export function appliquerPixelMeta(publicite: boolean) {
  if (typeof window === "undefined") return;
  if (!publicite) {
    if (initialise && accorde) window.fbq?.("consent", "revoke");
    accorde = false;
    return;
  }
  const fbq = creerFile();
  if (!initialise) {
    initialise = true;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    fbq("consent", "grant");
    fbq("init", META_PIXEL_ID, {}, { agent: "lovable" });
  } else if (!accorde) {
    fbq("consent", "grant");
  }
  accorde = true;
}

export function pixelMetaPageVue() {
  if (accorde) window.fbq?.("track", "PageView");
}

/** Demande de devis réellement enregistrée ; l'identifiant de la demande évite un double comptage. */
export function pixelMetaDemande(demandeId: string) {
  if (accorde && demandeId) window.fbq?.("track", "Lead", {}, { eventID: `demande-${demandeId}` });
}
