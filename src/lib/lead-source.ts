/**
 * Origine d'un lead (demande client) : règle pure + mémorisation navigateur.
 * La première page d'arrivée et la source sont gardées pour toute la visite,
 * afin que la demande envoyée plus tard indique d'où vient le client.
 */

export type LeadSource = "google_ads" | "google" | "reseaux_sociaux" | "autre_site" | "direct";

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  google_ads: "Publicité Google",
  google: "Recherche Google",
  reseaux_sociaux: "Réseaux sociaux",
  autre_site: "Autre site",
  direct: "Accès direct",
};

export interface LeadOrigine {
  source: LeadSource;
  campagne: string | null;
  page: string;
}

/** Détermine la source à partir de l'adresse d'arrivée et du site précédent. */
export function detecterSourceLead(url: string, referrer: string | null | undefined): LeadOrigine {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { source: "direct", campagne: null, page: "/" };
  }
  const p = u.searchParams;
  const medium = (p.get("utm_medium") ?? "").toLowerCase();
  const utmSource = (p.get("utm_source") ?? "").toLowerCase();
  const campagne = p.get("utm_campaign")?.slice(0, 120) || null;
  const page = u.pathname.slice(0, 200) || "/";

  if (p.get("gclid") || p.get("gbraid") || p.get("wbraid") || ["cpc", "ppc", "paid", "ads"].includes(medium)) {
    return { source: "google_ads", campagne, page };
  }
  const ref = (referrer ?? "").toLowerCase();
  let refHost = "";
  try {
    refHost = ref ? new URL(ref).hostname : "";
  } catch {
    refHost = "";
  }
  const social = /(facebook|instagram|linkedin|tiktok|twitter|x\.com|t\.co|youtube|pinterest|whatsapp)/;
  if (social.test(utmSource) || social.test(refHost)) return { source: "reseaux_sociaux", campagne, page };
  if (utmSource.includes("google") || /(^|\.)google\./.test(refHost)) return { source: "google", campagne, page };
  if (refHost && refHost !== u.hostname && !refHost.endsWith("irvetechnologie.fr")) {
    return { source: "autre_site", campagne, page };
  }
  return { source: "direct", campagne, page };
}

const CLE = "bdo_lead_origine";

/** À appeler au chargement : garde la première origine de la visite. */
export function memoriserOrigineLead() {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(CLE)) return;
    const o = detecterSourceLead(window.location.href, document.referrer);
    window.sessionStorage.setItem(CLE, JSON.stringify(o));
  } catch {
    /* stockage indisponible : ignoré */
  }
}

export function lireOrigineLead(): LeadOrigine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CLE);
    return raw ? (JSON.parse(raw) as LeadOrigine) : null;
  } catch {
    return null;
  }
}
