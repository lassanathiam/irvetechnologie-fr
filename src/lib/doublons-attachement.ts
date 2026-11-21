/**
 * Doublons d'attachements (navigateur, sans base) : repère deux attachements ordinaires du même client
 * qui portent le même chantier, ou qui sont identiques (même semaine, mêmes lignes, même montant) alors que
 * l'un d'eux n'est relié à aucun chantier. Les TS et les annulés ne sont jamais comparés.
 * Ne supprime rien : propose seulement lequel garder.
 */
import { nomDonneur } from "@/lib/etape-chantier";
import { numeroSemaine } from "@/lib/recherche-periode";

export type LigneDoublon = { libelle: string; quantite: number; prix_unitaire: number; rendezvous_id: string | null };
export type AttPourDoublon = {
  id: string;
  numero: string;
  client_nom: string | null;
  statut: string | null;
  total_ht: number | null;
  numero_ticket: string | null;
  date_emission: string | null;
  facture_id: string | null;
  sent_at: string | null;
  attachement_initial_id: string | null;
  rendezvous_id: string | null;
  created_at?: string | null;
  lignes: LigneDoublon[];
};
export type RaisonDoublon = { type: "chantier"; chantiers: string[] } | { type: "identique" };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Chantiers portés par l'attachement (en-tête et lignes). */
export function chantiersDe(a: Pick<AttPourDoublon, "rendezvous_id" | "lignes">): string[] {
  return [...new Set([a.rendezvous_id, ...a.lignes.map((l) => l.rendezvous_id)].filter((v): v is string => Boolean(v)))];
}

/** Vrai quand au moins une ligne n'est reliée à aucun chantier. */
export function aLigneSansChantier(a: Pick<AttPourDoublon, "rendezvous_id" | "lignes">): boolean {
  return !a.rendezvous_id && a.lignes.some((l) => !l.rendezvous_id);
}

/** Semaine de l'attachement : ticket « S47-2026 » sinon semaine de la date d'émission. */
export function semaineDe(a: Pick<AttPourDoublon, "numero_ticket" | "date_emission">): string {
  const m = /^S(\d{1,2})-(\d{4})/i.exec(String(a.numero_ticket ?? "").trim());
  if (m) return `${m[2]}-${Number(m[1])}`;
  const d = String(a.date_emission ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const date = new Date(`${d}T12:00:00`);
  return `${date.getFullYear()}-${numeroSemaine(date)}`;
}

const signature = (lignes: LigneDoublon[]) =>
  lignes.map((l) => `${norm(l.libelle)}|${Number(l.quantite)}|${Number(l.prix_unitaire)}`).sort().join("\n");

const comparable = (a: AttPourDoublon) => a.statut !== "annule" && !a.attachement_initial_id;

/** Raison pour laquelle deux attachements sont un doublon possible, ou null. */
export function raisonDoublon(a: AttPourDoublon, b: AttPourDoublon): RaisonDoublon | null {
  if (a.id === b.id || !comparable(a) || !comparable(b)) return null;
  if (nomDonneur(a.client_nom) !== nomDonneur(b.client_nom)) return null;
  const cb = new Set(chantiersDe(b));
  const communs = chantiersDe(a).filter((c) => cb.has(c));
  if (communs.length) return { type: "chantier", chantiers: communs };
  if (!aLigneSansChantier(a) && !aLigneSansChantier(b)) return null;
  const sa = semaineDe(a);
  if (!sa || sa !== semaineDe(b)) return null;
  if (Math.abs(Number(a.total_ht ?? 0) - Number(b.total_ht ?? 0)) > 0.005) return null;
  if (!a.lignes.length || signature(a.lignes) !== signature(b.lignes)) return null;
  return { type: "identique" };
}

/** Existants qui font doublon avec un attachement que l'on s'apprête à créer. */
export function doublonsPour(candidat: AttPourDoublon, existants: AttPourDoublon[]) {
  return existants.flatMap((e) => { const r = raisonDoublon(candidat, e); return r ? [{ attachement: e, raison: r }] : []; });
}

const poids = (a: AttPourDoublon) => (a.facture_id ? 100 : 0) + (a.sent_at || (a.statut && a.statut !== "brouillon") ? 50 : 0) + (chantiersDe(a).length ? 10 : 0) - (aLigneSansChantier(a) ? 5 : 0);

/** Celui à garder dans une paire : facturé > envoyé > relié à un chantier > le plus ancien. */
export function aGarder(a: AttPourDoublon, b: AttPourDoublon): AttPourDoublon {
  const pa = poids(a), pb = poids(b);
  if (pa !== pb) return pa > pb ? a : b;
  const ka = String(a.created_at ?? a.numero), kb = String(b.created_at ?? b.numero);
  return ka <= kb ? a : b;
}

/** Un attachement se supprime seulement s'il n'est ni facturé ni envoyé au client. */
export const supprimable = (a: Pick<AttPourDoublon, "facture_id" | "sent_at" | "statut">) => !a.facture_id && !a.sent_at && (a.statut ?? "brouillon") === "brouillon";

/** Toutes les paires de doublons possibles, avec celui à garder et celui proposé à la suppression. */
export function pairesDoublons(liste: AttPourDoublon[]) {
  const out: { garder: AttPourDoublon; doublon: AttPourDoublon; raison: RaisonDoublon }[] = [];
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i]!, b = liste[j]!;
    const raison = raisonDoublon(a, b);
    if (!raison) continue;
    const garder = aGarder(a, b);
    out.push({ garder, doublon: garder === a ? b : a, raison });
  }
  return out;
}
