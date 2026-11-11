// Règles de la prospection B2B (navigateur et serveur).
// Les mails sont envoyés par l'équipe depuis sa propre messagerie, jamais par l'envoi d'emails de l'application.

export const PROSPECTION_TELEPHONE = "07 68 08 43 67";
export const PROSPECTION_EMAIL = "contacts@irvetechnologie.fr";
export const PROSPECTION_SITE = "irvetechnologie.fr";
export const LIGNE_STOP = "Si vous ne souhaitez plus recevoir de message de notre part, répondez simplement STOP.";
export const JOURS_AVANT_RELANCE = 7;

export type MetierProspect = "bornes" | "fibre";
export type StatutProspect = "a_envoyer" | "envoye" | "relance" | "repondu" | "interesse" | "pas_interesse" | "stop";

export const STATUT_LIBELLE: Record<StatutProspect, string> = {
  a_envoyer: "À envoyer",
  envoye: "Envoyé",
  relance: "Relancé",
  repondu: "A répondu",
  interesse: "Intéressé",
  pas_interesse: "Pas intéressé",
  stop: "STOP — ne plus contacter",
};

export const METIER_LIBELLE: Record<MetierProspect, string> = { bornes: "Bornes", fibre: "Fibre optique" };

export function signatureProspection(): string {
  return [
    "Bien cordialement,",
    "",
    "Lassana Thiam",
    "IRVE Technologie — Borne de l'Ouest",
    "Installateur qualifié IRVE P1 · P2 · P3",
    `Tél. ${PROSPECTION_TELEPHONE}`,
    PROSPECTION_EMAIL,
    PROSPECTION_SITE,
  ].join("\n");
}

/** Ajoute la signature et la ligne STOP si elles manquent. */
export function finaliserCorps(corps: string): string {
  let texte = corps.trim();
  if (!texte.includes(PROSPECTION_TELEPHONE)) texte += `\n\n${signatureProspection()}`;
  if (!/STOP/.test(texte)) texte += `\n\n${LIGNE_STOP}`;
  return texte;
}

export function mailParDefaut(metier: MetierProspect, entreprise: string): { objet: string; corps: string } {
  if (metier === "fibre") {
    return {
      objet: "Équipe de raccordement fibre disponible — Bretagne / Pays de la Loire",
      corps: `Bonjour,\n\nNous sommes une petite équipe de techniciens basée dans l'Ouest, disponible pour du raccordement fibre en sous-traitance (raccordements abonnés, reprises, petits volumes réguliers) en Bretagne et Pays de la Loire.\n\nSi ${entreprise} cherche des renforts fiables sur ce secteur, je serais ravi d'échanger quelques minutes.`,
    };
  }
  return {
    objet: "Installation de bornes de recharge — installateur qualifié IRVE",
    corps: `Bonjour,\n\nJe suis installateur de bornes de recharge qualifié IRVE (P1, P2, P3), dans l'Ouest. Nous posons des bornes pour les professionnels (parkings clients, véhicules d'entreprise) et intervenons aussi en sous-traitance pour les électriciens.\n\nSi ${entreprise} a un projet, même pour une seule borne, je peux vous faire un devis rapide.`,
  };
}

/** Lien mailto prêt à ouvrir dans la messagerie de l'utilisateur. Null si pas d'email ou STOP. */
export function lienMailto(p: { email: string | null; statut: StatutProspect; objet: string; corps: string }): string | null {
  if (!p.email || p.statut === "stop") return null;
  const q = `subject=${encodeURIComponent(p.objet)}&body=${encodeURIComponent(finaliserCorps(p.corps))}`;
  return `mailto:${encodeURIComponent(p.email.trim())}?${q}`;
}

export function dateRelance(depuis: Date): string {
  const d = new Date(depuis);
  d.setDate(d.getDate() + JOURS_AVANT_RELANCE);
  return d.toISOString().slice(0, 10);
}

// ---------- Suivi des envois (éviter les doubles envois) ----------

export type CanalEnvoi = "mail" | "formulaire" | "telephone";
export const CANAL_LIBELLE: Record<CanalEnvoi, string> = { mail: "par mail", formulaire: "par formulaire", telephone: "par téléphone" };

export type ProspectSuivi = {
  id: string;
  entreprise: string;
  statut: StatutProspect;
  email: string | null;
  telephone: string | null;
  site_web: string | null;
  envoye_le: string | null;
  relance_le: string | null;
  nb_envois: number;
  mail_ouvert_le: string | null;
};

/**
 * jamais : jamais contacté · a_confirmer : mail ouvert, envoi pas encore confirmé ·
 * deja_envoye : contacté, relance pas encore due · a_relancer : relance due · clos : réponse, refus ou STOP.
 */
export type EtatEnvoi = "jamais" | "a_confirmer" | "deja_envoye" | "a_relancer" | "clos";

export function etatEnvoi(p: ProspectSuivi, aujourdhui: string): EtatEnvoi {
  if (p.statut === "stop" || p.statut === "pas_interesse" || p.statut === "repondu" || p.statut === "interesse") return "clos";
  if (p.mail_ouvert_le && (!p.envoye_le || p.mail_ouvert_le > p.envoye_le)) return "a_confirmer";
  if (p.nb_envois <= 0 && !p.envoye_le) return "jamais";
  if (p.relance_le && p.relance_le <= aujourdhui) return "a_relancer";
  return "deja_envoye";
}

/** On ne propose d'envoyer que si jamais contacté ou si la relance est due. */
export function envoiPermis(p: ProspectSuivi, aujourdhui: string): boolean {
  const e = etatEnvoi(p, aujourdhui);
  return e === "jamais" || e === "a_relancer" || e === "a_confirmer";
}

function cleEmail(e: string | null) { return e?.trim().toLowerCase() || null; }
function cleTel(t: string | null) { const d = (t ?? "").replace(/\D/g, "").replace(/^33/, "0"); return d.length >= 9 ? d : null; }
function cleSite(s: string | null) {
  if (!s) return null;
  try { return new URL(s.startsWith("http") ? s : `https://${s}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

/** Autres fiches qui désignent la même entreprise (même email, téléphone ou site). */
export function memesContacts<T extends ProspectSuivi>(p: T, tous: T[]): T[] {
  const e = cleEmail(p.email), t = cleTel(p.telephone), s = cleSite(p.site_web);
  return tous.filter((o) => o.id !== p.id && (
    (e && cleEmail(o.email) === e) || (t && cleTel(o.telephone) === t) || (s && cleSite(o.site_web) === s)
  ));
}

/** Bloque l'envoi si la même entreprise a demandé STOP ou a déjà été contactée via une autre fiche. */
export function blocageDoublon<T extends ProspectSuivi>(p: T, tous: T[]): { type: "stop" | "deja_contacte"; autre: T } | null {
  const autres = memesContacts(p, tous);
  const stop = autres.find((o) => o.statut === "stop");
  if (stop) return { type: "stop", autre: stop };
  const contacte = autres.find((o) => o.nb_envois > 0 || !!o.envoye_le);
  if (contacte) return { type: "deja_contacte", autre: contacte };
  return null;
}

export function objetPourEnvoi(objet: string, nbEnvois: number): string {
  if (nbEnvois <= 0 || /^relance/i.test(objet.trim())) return objet;
  return `Relance — ${objet}`;
}
