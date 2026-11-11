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
