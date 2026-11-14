/**
 * Circuit unique d'un chantier, du travail fait jusqu'au paiement (navigateur et serveur).
 * 1 Fait -> 2 Attachement envoyé -> 3 Commande reçue -> 4 Réceptionné -> 5 Facturé -> 6 Déposé / payé.
 * Lecture seule : cette règle classe, elle ne modifie jamais statut, facture ni paiement.
 */
export type EtapeChantier = 1 | 2 | 3 | 4 | 5 | 6;

export const ETAPES_CHANTIER: { n: EtapeChantier; label: string; court: string; aide: string }[] = [
  { n: 1, label: "Fait", court: "Fait", aide: "Chantier terminé : attachement à faire ou à envoyer au client." },
  { n: 2, label: "Attachement envoyé", court: "Envoyé", aide: "Envoyé au client, on attend sa commande." },
  { n: 3, label: "Commande reçue · à réceptionner", court: "À réceptionner", aide: "La commande est là : réceptionnez le chantier avec le client (même s’il est déjà facturé)." },
  { n: 4, label: "Réceptionné", court: "Réceptionné", aide: "Chantier validé avec commande : créez la facture." },
  { n: 5, label: "Facturé", court: "Facturé", aide: "Facture créée : déposez-la sur la plateforme du client." },
  { n: 6, label: "Déposé / payé", court: "Déposé / payé", aide: "Facture déposée chez le client ou payée." },
];

export type EtatChantier = {
  attachement: boolean;
  envoye: boolean;
  commande: boolean;
  receptionne: boolean;
  facture: boolean;
  depose: boolean;
  paye: boolean;
  /** Ligne sans chantier du Planning (ex. fibre) : rien à réceptionner. */
  sansReception?: boolean;
};

/** Étape unique d'une ligne de suivi. Sans commande, un chantier n'entre jamais en réception. */
export function etapeChantier(e: EtatChantier): EtapeChantier {
  const recu = e.receptionne || Boolean(e.sansReception);
  if (e.paye) return 6;
  // Facturé avant la réception : il reste à réceptionner dès que la commande est là.
  if (e.facture) return e.commande && !recu ? 3 : e.depose ? 6 : 5;
  if (!e.attachement || !e.envoye) {
    // Une commande déjà reçue prouve que l'attachement est parti chez le client.
    if (e.attachement && e.commande) return recu ? 4 : 3;
    return 1;
  }
  if (!e.commande) return 2;
  return recu ? 4 : 3;
}

/** Réceptionné alors que la commande manque : reste à l'étape 2, signalé pour ne rien perdre. */
export function recuSansCommande(e: Pick<EtatChantier, "receptionne" | "commande" | "facture">): boolean {
  return e.receptionne && !e.commande && !e.facture;
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
  statutPlanning: string | null;
  etape: EtapeChantier;
  recuSansCommande: boolean;
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function resumeEtapes(lignes: Pick<LigneSuivi, "etape" | "montantHt">[]): Record<EtapeChantier, { nb: number; ht: number }> {
  const r = { 1: { nb: 0, ht: 0 }, 2: { nb: 0, ht: 0 }, 3: { nb: 0, ht: 0 }, 4: { nb: 0, ht: 0 }, 5: { nb: 0, ht: 0 }, 6: { nb: 0, ht: 0 } } as Record<EtapeChantier, { nb: number; ht: number }>;
  for (const l of lignes) { r[l.etape].nb += 1; r[l.etape].ht = arrondi(r[l.etape].ht + l.montantHt); }
  return r;
}

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");

/** Tableur (« ; », ouvrable dans Excel) des lignes de suivi, dans l'ordre des étapes. */
export function csvSuivi(lignes: LigneSuivi[]): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const entete = ["Étape", "Client", "Donneur d'ordre", "Ville", "Date chantier", "Montant HT", "Attachement", "Commande", "Réceptionné le", "Facture", "Déposée le", "Payée le"];
  const tri = [...lignes].sort((a, b) => a.etape - b.etape || a.client.localeCompare(b.client));
  const rows = tri.map((l) => [
    `${l.etape}. ${ETAPES_CHANTIER[l.etape - 1].label}`, l.client, l.donneur, l.ville ?? "", dateFr(l.date),
    l.montantHt.toFixed(2).replace(".", ","), l.attNumero ?? "", l.commande ?? "", dateFr(l.receptionneLe),
    l.factureNumero ?? "", dateFr(l.deposeLe), dateFr(l.payeLe),
  ]);
  return "\uFEFF" + [entete, ...rows].map((r) => r.map(cell).join(";")).join("\n");
}
