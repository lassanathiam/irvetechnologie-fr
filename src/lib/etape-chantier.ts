/**
 * Circuit unique d'un chantier, du travail fait jusqu'au dépôt (navigateur et serveur), dans l'ordre voulu par l'équipe :
 * 1 Travaux terminés -> 2 Attachement à envoyer -> 3 Envoyé, pas encore consulté -> 4 Consulté, commande à intégrer
 * -> 5 Commande reçue, à facturer -> 6 Facturé, à réceptionner -> 7 Réceptionné, à déposer -> 8 Terminé (déposé / payé).
 * Lecture seule : cette règle classe, elle ne modifie jamais statut, facture ni paiement.
 */
export type EtapeChantier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const ETAPE_TERMINEE: EtapeChantier = 8;

export const ETAPES_CHANTIER: { n: EtapeChantier; label: string; court: string; aide: string }[] = [
  { n: 1, label: "Travaux terminés · attachement à faire", court: "Attachement à faire", aide: "Tous les chantiers terminés sans attachement, rangés par client : faites l’attachement." },
  { n: 2, label: "Attachement fait · à envoyer", court: "À envoyer", aide: "L’attachement est prêt : envoyez-le au client." },
  { n: 3, label: "Envoyé · pas encore consulté", court: "Pas consulté", aide: "Envoyé, mais le client ne l’a pas encore ouvert : relancez-le si besoin." },
  { n: 4, label: "Consulté · commande à intégrer", court: "Commande attendue", aide: "Le client a ouvert l’attachement : dès que sa commande arrive, saisissez son numéro ou importez le bon de commande." },
  { n: 5, label: "Commande reçue · à facturer", court: "À facturer", aide: "La commande est intégrée : convertissez l’attachement en facture." },
  { n: 6, label: "Facturé · à réceptionner", court: "À réceptionner", aide: "Facture créée : réceptionnez le chantier avec le client." },
  { n: 7, label: "Réceptionné · à déposer dans le système client", court: "À déposer", aide: "Chantier réceptionné : déposez la facture dans le système du client, puis cochez « Déposée »." },
  { n: 8, label: "Terminé · déposé ou payé", court: "Terminé", aide: "Facture déposée chez le client ou payée : plus rien à faire, sauf noter le paiement." },
];

export type EtatChantier = {
  attachement: boolean;
  envoye: boolean;
  /** Le client a ouvert l'attachement (lien consulté) ou l'a validé. */
  consulte?: boolean;
  commande: boolean;
  receptionne: boolean;
  facture: boolean;
  depose: boolean;
  paye: boolean;
  /** Ligne sans chantier du Planning (ex. fibre) : rien à réceptionner. */
  sansReception?: boolean;
};

/** Étape unique d'une ligne de suivi. La commande vient avant la facture ; la réception après la facture. */
export function etapeChantier(e: EtatChantier): EtapeChantier {
  const recu = e.receptionne || Boolean(e.sansReception);
  if (e.paye) return 8;
  if (!e.attachement) return 1;
  // Une commande reçue prouve que l'attachement est parti chez le client.
  if (!e.envoye && !e.commande && !e.facture) return 2;
  if (!e.commande) {
    // Facturé sans commande : la commande manque encore, il reste à l'intégrer.
    if (e.depose && e.facture) return 8;
    return e.consulte || e.facture ? 4 : 3;
  }
  if (!e.facture) return 5;
  if (!recu) return 6;
  return e.depose ? 8 : 7;
}

/** Réceptionné alors que la commande manque : reste avant la facture, signalé pour ne rien perdre. */
export function recuSansCommande(e: Pick<EtatChantier, "receptionne" | "commande" | "facture">): boolean {
  return e.receptionne && !e.commande && !e.facture;
}

/** Le client a ouvert l'attachement par son lien, ou l'a validé. */
export function attachementConsulte(a: { viewed_at?: string | null; view_count?: number | null; accepted_at?: string | null; statut?: string | null }): boolean {
  return Boolean(a.viewed_at || Number(a.view_count ?? 0) > 0 || a.accepted_at) || ["accepte", "valide"].includes(String(a.statut ?? ""));
}

/** Statuts d'attachement qui prouvent un envoi au client, même sans date d'envoi enregistrée. */
export function attachementEnvoye(a: { sent_at?: string | null; statut?: string | null; accepted_at?: string | null }): boolean {
  return Boolean(a.sent_at || a.accepted_at) || ["envoye", "accepte", "valide", "facture"].includes(String(a.statut ?? ""));
}

export type LigneSuivi = {
  cle: string;
  rdvId: string | null;
  attId: string | null;
  attNumero: string | null;
  ts: boolean;
  client: string;
  donneur: string;
  ville: string | null;
  date: string | null;
  montantHt: number;
  commande: string | null;
  receptionneLe: string | null;
  factureId: string | null;
  factureNumero: string | null;
  deposeLe: string | null;
  payeLe: string | null;
  envoyeLe: string | null;
  /** Première ouverture de l'attachement par le client, dernière ouverture et nombre d'ouvertures. */
  consulteLe: string | null;
  derniereConsultation: string | null;
  vues: number;
  valideLe: string | null;
  statutPlanning: string | null;
  etape: EtapeChantier;
  recuSansCommande: boolean;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function resumeEtapes(lignes: Pick<LigneSuivi, "etape" | "montantHt">[]): Record<EtapeChantier, { nb: number; ht: number }> {
  const r = Object.fromEntries(ETAPES_CHANTIER.map((e) => [e.n, { nb: 0, ht: 0 }])) as Record<EtapeChantier, { nb: number; ht: number }>;
  for (const l of lignes) { r[l.etape].nb += 1; r[l.etape].ht = arrondi(r[l.etape].ht + l.montantHt); }
  return r;
}

/**
 * Tous les chantiers réceptionnés, quelle que soit leur étape actuelle (facturés, déposés et payés compris).
 * nb = chantiers distincts (un chantier avec son TS compte une fois) ; ht = somme de tous ses documents.
 */
export function totalReceptionnes(lignes: Pick<LigneSuivi, "receptionneLe" | "montantHt" | "rdvId" | "cle">[]): { nb: number; ht: number } {
  const chantiers = new Set<string>(); let ht = 0;
  for (const l of lignes) if (l.receptionneLe) { chantiers.add(l.rdvId ?? l.cle); ht = arrondi(ht + l.montantHt); }
  return { nb: chantiers.size, ht };
}

/**
 * Doublons possibles : un même chantier présent dans plusieurs attachements qui ne sont pas des TS.
 * Renvoie, pour chaque ligne concernée, les numéros des autres attachements du même chantier.
 */
export function doublonsChantier(lignes: Pick<LigneSuivi, "cle" | "rdvId" | "attId" | "attNumero" | "ts">[]): Map<string, string[]> {
  const parRdv = new Map<string, { cle: string; att: string; num: string }[]>();
  for (const l of lignes) {
    if (!l.rdvId || !l.attId || l.ts) continue;
    const liste = parRdv.get(l.rdvId) ?? [];
    if (!liste.some((x) => x.att === l.attId)) liste.push({ cle: l.cle, att: l.attId, num: l.attNumero ?? "" });
    parRdv.set(l.rdvId, liste);
  }
  const r = new Map<string, string[]>();
  for (const liste of parRdv.values()) {
    if (liste.length < 2) continue;
    for (const x of liste) r.set(x.cle, liste.filter((y) => y.att !== x.att).map((y) => y.num));
  }
  return r;
}

/** Numéro de commande crédible : contient un chiffre et n'est pas un numéro d'attachement mal lu (ex. « AT-2026-0082 », « GLAIS »). */
export function numeroCommandeValide(n: unknown): string | null {
  const v = String(n ?? "").trim();
  if (!v || !/\d/.test(v) || /^AT-\d/i.test(v)) return null;
  return v;
}

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");

/** Tableur (« ; », ouvrable dans Excel) des lignes de suivi, dans l'ordre des étapes. */
export function csvSuivi(lignes: LigneSuivi[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const entete = ["Étape", "Client", "Donneur d'ordre", "Ville", "Date chantier", "Montant HT", "Attachement", "Envoyé le", "Consulté le", "Commande", "Réceptionné le", "Facture", "Déposée le", "Payée le"];
  const tri = [...lignes].sort((a, b) => a.etape - b.etape || a.client.localeCompare(b.client));
  const rows = tri.map((l) => [
    `${l.etape}. ${ETAPES_CHANTIER[l.etape - 1].label}`, l.client, l.donneur, l.ville ?? "", dateFr(l.date),
    l.montantHt.toFixed(2).replace(".", ","), l.attNumero ?? "", dateFr(l.envoyeLe), dateFr(l.consulteLe), l.commande ?? "", dateFr(l.receptionneLe),
    l.factureNumero ?? "", dateFr(l.deposeLe), dateFr(l.payeLe),
  ]);
  return "\uFEFF" + [entete, ...rows].map((r) => r.map(cell).join(";")).join("\n");
}

const FORMES_JURIDIQUES = /\b(SAS|SASU|SARL|SA|EURL|SNC|SCI)\b/g;

/**
 * Nom unique d'un donneur d'ordre pour regrouper ses chantiers : « ENSIO SAS », « Ensio » et « ENSIO » = « ENSIO ».
 * Ignore majuscules, accents, ponctuation et forme juridique. Affichage seulement, ne modifie aucune fiche.
 */
export function nomDonneur(nom: string | null | undefined): string {
  const v = String(nom ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ").replace(FORMES_JURIDIQUES, " ").replace(/\s+/g, " ").trim();
  return v;
}

/**
 * Chantiers réceptionnés sans aucune commande : un chantier a sa commande si au moins un de ses documents en porte une
 * (son TS hérite de la commande de l'attachement initial). Une ligne sans chantier du Planning n'est jamais comptée.
 */
export function receptionnesSansCommande<T extends Pick<LigneSuivi, "rdvId" | "receptionneLe" | "commande">>(lignes: T[]): Set<string> {
  const avec = new Set<string>(); const recus = new Set<string>();
  for (const l of lignes) {
    if (!l.rdvId || !l.receptionneLe) continue;
    recus.add(l.rdvId);
    if (l.commande) avec.add(l.rdvId);
  }
  return new Set([...recus].filter((id) => !avec.has(id)));
}
