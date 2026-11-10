/**
 * Consentement des visiteurs du site public (mesure d'audience + publicité).
 * Module sans dépendance navigateur au chargement : les accès à localStorage
 * se font uniquement dans les fonctions, appelées depuis des effets ou des clics.
 */

/** Version de la notice affichée : la changer redemande l'accord à tout le monde. */
export const VERSION_NOTICE_CONSENTEMENT = "2026-11-10";
export const CLE_CONSENTEMENT = "bdo_consentement";
export const EVENEMENT_CONSENTEMENT = "bdo-consentement-change";
export const EVENEMENT_OUVRIR_REGLAGES = "bdo-consentement-ouvrir";

export interface ChoixConsentement {
  version: string;
  /** Date ISO du choix (preuve : quand et sur quelle notice). */
  date: string;
  mesure: boolean;
  publicite: boolean;
}

/** Lit un choix enregistré ; un choix d'une autre version de notice est ignoré. */
export function analyserChoix(brut: string | null | undefined): ChoixConsentement | null {
  if (!brut) return null;
  try {
    const c = JSON.parse(brut) as Partial<ChoixConsentement>;
    if (c.version !== VERSION_NOTICE_CONSENTEMENT || typeof c.date !== "string") return null;
    return { version: c.version, date: c.date, mesure: c.mesure === true, publicite: c.publicite === true };
  } catch {
    return null;
  }
}

/** Mesure d'audience autorisée seulement sur acceptation explicite. */
export function autoriseMesure(choix: ChoixConsentement | null): boolean {
  return choix?.mesure === true;
}

/** Publicité autorisée seulement sur acceptation explicite, et jamais avec Global Privacy Control. */
export function autorisePublicite(choix: ChoixConsentement | null, gpc: boolean): boolean {
  return !gpc && choix?.publicite === true;
}

function gpcActif(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true
  );
}

export function lireChoixConsentement(): ChoixConsentement | null {
  if (typeof window === "undefined") return null;
  try {
    return analyserChoix(window.localStorage.getItem(CLE_CONSENTEMENT));
  } catch {
    return null;
  }
}

export function mesureAutorisee(): boolean {
  return autoriseMesure(lireChoixConsentement());
}

export function publiciteAutorisee(): boolean {
  return autorisePublicite(lireChoixConsentement(), gpcActif());
}

export function navigateurRefusePublicite(): boolean {
  return gpcActif();
}

/** Efface les cookies Google déjà posés quand l'accord correspondant est retiré. */
function effacerCookies(prefixes: string[]) {
  const domaines = ["", window.location.hostname, `.${window.location.hostname.replace(/^www\./, "")}`];
  for (const morceau of document.cookie.split(";")) {
    const nom = morceau.split("=")[0]?.trim();
    if (!nom || !prefixes.some((p) => nom.startsWith(p))) continue;
    for (const d of domaines) {
      document.cookie = `${nom}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  }
}

export function enregistrerChoixConsentement(mesure: boolean, publicite: boolean): ChoixConsentement {
  const choix: ChoixConsentement = {
    version: VERSION_NOTICE_CONSENTEMENT,
    date: new Date().toISOString(),
    mesure,
    publicite: publicite && !gpcActif(),
  };
  try {
    window.localStorage.setItem(CLE_CONSENTEMENT, JSON.stringify(choix));
  } catch {
    /* stockage indisponible : le choix vaut pour cette page seulement */
  }
  if (!choix.mesure) effacerCookies(["_ga"]);
  if (!choix.publicite) effacerCookies(["_gcl", "_gac"]);
  window.dispatchEvent(new CustomEvent(EVENEMENT_CONSENTEMENT, { detail: choix }));
  return choix;
}

/** Rouvre le bandeau (lien « Gérer les cookies »). */
export function ouvrirReglagesConsentement() {
  window.dispatchEvent(new Event(EVENEMENT_OUVRIR_REGLAGES));
}
