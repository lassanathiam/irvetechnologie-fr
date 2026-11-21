// État d'envoi d'un attachement, lisible par l'équipe (navigateur, sans base).
// Un seul parcours : 1 Pas encore envoyé → 2 Envoyé, en attente de validation → 3 Validé par le client → 4 Facturé.
import { estAttachementCloture } from "./attachement-classement";
import { clientFinalAttachement } from "./attachement-titre";

export type EtatEnvoi = "a_envoyer" | "envoye" | "valide" | "refuse" | "facture" | "annule";

type A = { statut?: string | null; sent_at?: string | null; accepted_at?: string | null; facture_id?: string | null };

export function etatEnvoi(a: A): EtatEnvoi {
  if (a.statut === "annule") return "annule";
  if (estAttachementCloture(a)) return "facture";
  if (a.statut === "accepte" || a.accepted_at) return "valide";
  if (a.statut === "refuse") return "refuse";
  if (a.sent_at || ["envoye", "propose"].includes(a.statut ?? "")) return "envoye";
  return "a_envoyer";
}

export const LIBELLE_ENVOI: Record<EtatEnvoi, string> = {
  a_envoyer: "Pas encore envoyé",
  envoye: "Envoyé · en attente de validation",
  valide: "Validé par le client",
  refuse: "Refusé par le client",
  facture: "Facturé",
  annule: "Annulé",
};

/** Noms des clients finaux (résidents) d'un attachement : chantiers liés, sinon objet, sinon numéro. */
export function nomsAttachement(a: { numero: string; objet?: string | null; chantiers?: { client_nom?: string | null }[] }): string {
  const noms = [...new Set((a.chantiers ?? []).map((c) => (c.client_nom ?? "").trim()).filter(Boolean))];
  if (noms.length) return noms.join(" · ");
  return clientFinalAttachement(a) ?? a.numero;
}
