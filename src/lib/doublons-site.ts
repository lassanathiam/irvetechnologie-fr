/**
 * Doublons partout dans le site (navigateur, sans base) : chantiers du Planning, factures, devis et fiches partenaires.
 * Ce module ne supprime rien : il repère les paires, propose laquelle garder et dit ce qu'il est permis de faire du doublon.
 * Le serveur réapplique ces mêmes règles avant toute action.
 */
import { estDoublon, nomNorm } from "./doublons-import";
import { nomDonneur } from "./etape-chantier";

export type TypeDoublon = "chantier" | "facture" | "devis" | "partenaire";
export type ActionDoublon = "supprimer" | "annuler" | "fusionner" | null;
export type Paire<T> = { garder: T; doublon: T };

const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const texteNorm = (s: string | null | undefined) => sansAccent(String(s ?? "")).replace(/[^a-z0-9]+/g, " ").trim();
const jour = (v: string | null | undefined) => { const d = String(v ?? "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T12:00:00Z`) : null; };
const ancien = (a: { created_at?: string | null }, b: { created_at?: string | null }) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) <= 0;

/** Parcourt toutes les paires et garde, pour chaque paire, l'élément au poids le plus fort (puis le plus ancien). */
function paires<T extends { id: string; created_at?: string | null }>(liste: T[], meme: (a: T, b: T) => boolean, poids: (x: T) => number): Paire<T>[] {
  const out: Paire<T>[] = [];
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i]!, b = liste[j]!;
    if (!meme(a, b)) continue;
    const pa = poids(a), pb = poids(b);
    const aDabord = pa !== pb ? pa > pb : ancien(a, b);
    out.push(aDabord ? { garder: a, doublon: b } : { garder: b, doublon: a });
  }
  return out;
}

// ---------- Chantiers du Planning ----------
export type ChantierDoublon = {
  id: string; client_nom: string | null; adresse: string | null; client_telephone: string | null; cp_ville: string | null;
  statut: string | null; date_debut: string | null; termine_at: string | null; created_at?: string | null;
  /** Documents et preuves reliés (renseignés par le serveur). */
  liens?: { attachements: number; devis: number; photos: number; fiches: number; rapports: number; autres: number };
};
/** Même client (2 repères sur 3 : nom, adresse, téléphone) et dates à moins de 45 jours : une vraie visite de retour plus tard n'est pas un doublon. */
export function memeChantier(a: ChantierDoublon, b: ChantierDoublon): boolean {
  if (a.id === b.id || a.statut === "annule" || b.statut === "annule") return false;
  if (!estDoublon(a, b)) return false;
  const da = jour(a.date_debut), db = jour(b.date_debut);
  return da === null || db === null || Math.abs(da - db) <= 45 * 86400000;
}
const poidsChantier = (c: ChantierDoublon) => {
  const l = c.liens; const fini = c.statut === "termine" || c.statut === "realise" ? 20 : 0;
  return fini + (l ? l.attachements * 100 + l.devis * 40 + l.rapports * 30 + l.photos * 5 + l.fiches * 5 + l.autres * 5 : 0);
};
export const pairesChantiers = (liste: ChantierDoublon[]) => paires(liste, memeChantier, poidsChantier);
/** Raisons qui empêchent de supprimer un chantier : rien de relié ne doit être perdu. */
export function blocagesChantier(c: ChantierDoublon): string[] {
  const l = c.liens; if (!l) return [];
  return [
    l.attachements ? `${l.attachements} attachement(s)` : "", l.devis ? `${l.devis} devis` : "", l.rapports ? `${l.rapports} rapport(s) / PV` : "",
    l.photos ? `${l.photos} photo(s)` : "", l.fiches ? `${l.fiches} fiche(s) technique(s)` : "", l.autres ? "du matériel ou une demande de voirie" : "",
  ].filter(Boolean);
}
export const actionChantier = (c: ChantierDoublon): ActionDoublon => (blocagesChantier(c).length ? null : "supprimer");

// ---------- Factures ----------
export type FactureDoublon = {
  id: string; numero: string; client_nom: string | null; objet: string | null; total_ht: number | null; statut: string | null;
  sent_at: string | null; paid_at: string | null; depose_at: string | null; attachement_id: string | null; bon_commande: string | null;
  date_emission: string | null; created_at?: string | null;
  /** Attachements et chantiers de la facture (renseignés par le serveur). */
  attachements: string[]; chantiers: string[];
  /** Facture de travaux supplémentaires (tous ses attachements sont des TS). */
  ts?: boolean;
};
const commandeNorm = (c: string | null | undefined) => sansAccent(String(c ?? "")).replace(/[^a-z0-9]/g, "");
export function memeFacture(a: FactureDoublon, b: FactureDoublon): boolean {
  if (a.id === b.id || a.statut === "annulee" || b.statut === "annulee") return false;
  if (nomDonneur(a.client_nom) !== nomDonneur(b.client_nom)) return false;
  const attB = new Set(b.attachements);
  if (a.attachements.some((x) => attB.has(x))) return true;
  // Deux commandes différentes = deux travaux différents (ex. factures fibre récurrentes au même montant).
  const ca = commandeNorm(a.bon_commande), cb = commandeNorm(b.bon_commande);
  if (ca.length >= 5 && cb.length >= 5) return ca === cb;
  // Un TS partage légitimement le chantier de l'attachement initial.
  const chB = new Set(b.chantiers);
  if (!a.ts && !b.ts && a.chantiers.some((x) => chB.has(x))) return true;
  if (a.chantiers.length && b.chantiers.length) return false;
  const oa = texteNorm(a.objet);
  return oa.length >= 6 && oa === texteNorm(b.objet) && Math.abs(Number(a.total_ht ?? 0) - Number(b.total_ht ?? 0)) < 0.01;
}
const factureEnvoyee = (f: FactureDoublon) => Boolean(f.sent_at) || (f.statut !== null && f.statut !== "brouillon");
const poidsFacture = (f: FactureDoublon) => (f.paid_at || f.statut === "payee" ? 100 : 0) + (f.depose_at ? 50 : 0) + (commandeNorm(f.bon_commande).length >= 5 ? 20 : 0) + (factureEnvoyee(f) ? 10 : 0);
export const pairesFactures = (liste: FactureDoublon[]) => paires(liste, memeFacture, poidsFacture);
/** Une facture brouillon jamais envoyée peut être supprimée ; une facture émise est annulée (jamais effacée) ; une facture payée reste. */
export function actionFacture(f: FactureDoublon): ActionDoublon {
  if (f.paid_at || f.statut === "payee") return null;
  return factureEnvoyee(f) ? "annuler" : "supprimer";
}

// ---------- Devis ----------
export type DevisDoublon = {
  id: string; numero: string; client_nom: string | null; objet: string | null; total_ttc: number | null; statut: string | null;
  sent_at: string | null; signed_at: string | null; facture_id: string | null; date_emission: string | null; created_at?: string | null;
};
export function memeDevis(a: DevisDoublon, b: DevisDoublon): boolean {
  if (a.id === b.id || a.statut === "annule" || b.statut === "annule" || a.statut === "refuse" || b.statut === "refuse") return false;
  const na = nomNorm(a.client_nom);
  if (!na || na !== nomNorm(b.client_nom)) return false;
  return Math.abs(Number(a.total_ttc ?? 0) - Number(b.total_ttc ?? 0)) < 0.01 && texteNorm(a.objet) === texteNorm(b.objet);
}
const poidsDevis = (d: DevisDoublon) => (d.signed_at || d.statut === "accepte" ? 100 : 0) + (d.facture_id ? 50 : 0) + (d.sent_at ? 10 : 0);
export const pairesDevis = (liste: DevisDoublon[]) => paires(liste, memeDevis, poidsDevis);
/** Un devis signé, accepté ou déjà facturé n'est jamais supprimé. */
export const actionDevis = (d: DevisDoublon): ActionDoublon => (d.signed_at || d.facture_id || d.statut === "accepte" ? null : "supprimer");

// ---------- Fiches partenaires / clients ----------
export type PartenaireDoublon = { id: string; nom: string; type: string | null; actif: boolean | null; email: string | null; created_at?: string | null; chantiers?: number };
const cleNom = (n: string) => nomDonneur(n).replace(/\s+/g, "");
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length]!;
}
/** Même type de fiche et même nom (accents, casse, espaces, forme juridique ignorés, une faute de frappe tolérée sur un nom long). */
export function memePartenaire(a: PartenaireDoublon, b: PartenaireDoublon): boolean {
  if (a.id === b.id || (a.type ?? "") !== (b.type ?? "")) return false;
  const ka = cleNom(a.nom), kb = cleNom(b.nom);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const n = Math.min(ka.length, kb.length);
  return n >= 6 && distance(ka, kb) <= (n >= 10 ? 2 : 1);
}
const poidsPartenaire = (p: PartenaireDoublon) => (p.chantiers ?? 0) * 10 + (p.actif ? 5 : 0) + (p.email ? 2 : 0);
export const pairesPartenaires = (liste: PartenaireDoublon[]) => paires(liste, memePartenaire, poidsPartenaire);
/** Une fiche en double est fusionnée : ses chantiers passent sur la fiche gardée, puis elle est supprimée. */
export const actionPartenaire = (): ActionDoublon => "fusionner";

// ---------- Fiches clients (donneurs d'ordre : identité de facturation) ----------
export const CHAMPS_CLIENT = ["raison_sociale", "adresse", "cp_ville", "pays", "siret", "tva_intracom", "numero_fournisseur", "adresse_livraison", "charge_affaires_nom", "charge_affaires_email", "charge_affaires_telephone", "notes"] as const;
export type ClientDoublon = { id: string; nom: string; actif: boolean | null; created_at?: string | null } & Partial<Record<(typeof CHAMPS_CLIENT)[number], string | null>>;
const remplis = (c: ClientDoublon) => CHAMPS_CLIENT.filter((k) => String(c[k] ?? "").trim()).length;
export const memeClient = (a: ClientDoublon, b: ClientDoublon) => memePartenaire({ ...a, type: "client", email: null }, { ...b, type: "client", email: null });
export const pairesClients = (liste: ClientDoublon[]) => paires(liste, memeClient, (c) => remplis(c) + (c.actif ? 1 : 0));
/** Champs vides de la fiche gardée complétés par le doublon : rien n'est perdu à la fusion. */
export function completerClient(garder: ClientDoublon, doublon: ClientDoublon): Partial<Record<(typeof CHAMPS_CLIENT)[number], string>> {
  const patch: Partial<Record<(typeof CHAMPS_CLIENT)[number], string>> = {};
  for (const k of CHAMPS_CLIENT) { const v = String(doublon[k] ?? "").trim(); if (v && !String(garder[k] ?? "").trim()) patch[k] = v; }
  return patch;
}
