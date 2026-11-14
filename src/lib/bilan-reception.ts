/**
 * Bilan de réception d'un donneur d'ordre (navigateur et serveur).
 * Une ligne = un attachement non annulé, avec ses chantiers, sa commande et sa réception.
 * Lecture seule : ne change jamais statut, facturation ni paiement.
 */
export type LigneBilan = {
  id: string;
  numero: string;
  donneur: string;
  objet: string | null;
  ticket: string | null;
  totalHt: number;
  envoyeLe: string | null;
  facture: string | null;
  commande: string | null;
  chantiers: { id: string; nom: string; ville: string | null; date: string | null; receptionneLe: string | null }[];
};

export type CleBilan = "recu_commande" | "commande_non_recu" | "recu_sans_commande" | "envoye_sans_commande" | "non_envoye";

export const CATEGORIES_BILAN: { cle: CleBilan; label: string; aide: string }[] = [
  { cle: "recu_commande", label: "Réceptionnés · commande reçue", aide: "Tout est en ordre : chantier validé et commande reçue." },
  { cle: "commande_non_recu", label: "Commande reçue · pas encore réceptionnés", aide: "La commande est là, il manque la réception du chantier." },
  { cle: "recu_sans_commande", label: "Réceptionnés · commande pas reçue", aide: "Chantier validé, la commande reste à recevoir." },
  { cle: "envoye_sans_commande", label: "Attachement envoyé · ni commande ni réception", aide: "Envoyé au client, en attente de sa validation." },
  { cle: "non_envoye", label: "Pas encore envoyés au client", aide: "Attachements préparés mais jamais envoyés depuis la plateforme." },
];

/** Réceptionné = au moins un chantier lié et tous ses chantiers réceptionnés. */
export function estReceptionne(l: Pick<LigneBilan, "chantiers">): boolean {
  return l.chantiers.length > 0 && l.chantiers.every((c) => Boolean(c.receptionneLe));
}

export function categorieBilan(l: LigneBilan): CleBilan {
  const recu = estReceptionne(l);
  const commande = Boolean(l.commande?.trim());
  if (recu && commande) return "recu_commande";
  if (commande) return "commande_non_recu";
  if (recu) return "recu_sans_commande";
  if (l.envoyeLe) return "envoye_sans_commande";
  return "non_envoye";
}

export type ResumeBilan = {
  attachements: number;
  chantiers: number;
  receptionnes: number;
  nonReceptionnes: number;
  commandesRecues: number;
  commandesManquantes: number;
  factures: number;
  totalHt: number;
  parCategorie: Record<CleBilan, { nb: number; ht: number }>;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function resumeBilan(lignes: LigneBilan[]): ResumeBilan {
  const parCategorie = Object.fromEntries(CATEGORIES_BILAN.map((c) => [c.cle, { nb: 0, ht: 0 }])) as ResumeBilan["parCategorie"];
  const chantiers = new Map<string, boolean>();
  for (const l of lignes) {
    const cat = parCategorie[categorieBilan(l)];
    cat.nb += 1;
    cat.ht = arrondi(cat.ht + l.totalHt);
    for (const c of l.chantiers) chantiers.set(c.id, Boolean(c.receptionneLe) || Boolean(chantiers.get(c.id)));
  }
  const receptionnes = [...chantiers.values()].filter(Boolean).length;
  const commandesRecues = lignes.filter((l) => Boolean(l.commande?.trim())).length;
  return {
    attachements: lignes.length,
    chantiers: chantiers.size,
    receptionnes,
    nonReceptionnes: chantiers.size - receptionnes,
    commandesRecues,
    commandesManquantes: lignes.length - commandesRecues,
    factures: lignes.filter((l) => Boolean(l.facture)).length,
    totalHt: arrondi(lignes.reduce((t, l) => t + l.totalHt, 0)),
    parCategorie,
  };
}

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");

/** Tableur (séparateur « ; », ouvrable dans Excel) des lignes sélectionnées, classées par catégorie. */
export function csvBilan(lignes: LigneBilan[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const entete = ["Catégorie", "Attachement", "Chantier(s)", "Ville", "Date chantier", "Montant HT", "Envoyé le", "Commande", "Réceptionné le", "Facture"];
  const ordre = CATEGORIES_BILAN.map((c) => c.cle);
  const tri = [...lignes].sort((a, b) => ordre.indexOf(categorieBilan(a)) - ordre.indexOf(categorieBilan(b)) || a.numero.localeCompare(b.numero));
  const lignesCsv = tri.map((l) => [
    CATEGORIES_BILAN.find((c) => c.cle === categorieBilan(l))!.label,
    l.numero,
    l.chantiers.map((c) => c.nom).join(" / ") || l.objet || "",
    l.chantiers.map((c) => c.ville ?? "").filter(Boolean).join(" / "),
    l.chantiers.map((c) => dateFr(c.date)).filter(Boolean).join(" / "),
    l.totalHt.toFixed(2).replace(".", ","),
    dateFr(l.envoyeLe),
    l.commande ?? "",
    l.chantiers.map((c) => dateFr(c.receptionneLe)).filter(Boolean).join(" / "),
    l.facture ?? "",
  ]);
  return "\uFEFF" + [entete, ...lignesCsv].map((r) => r.map(cell).join(";")).join("\n");
}
