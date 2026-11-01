/** Étapes de suivi du dépôt sur la plateforme du donneur d'ordre (indépendantes du statut de facturation interne). */
export type EtapeSuivi = "sans_attachement" | "attachement" | "depose" | "envoye_facturation" | "paye";
export type ChampSuivi = "depose_at" | "envoye_facturation_at" | "paye_at";

export const ETAPES_SUIVI: { cle: EtapeSuivi; label: string }[] = [
  { cle: "sans_attachement", label: "Sans attachement" },
  { cle: "attachement", label: "Attachement fait" },
  { cle: "depose", label: "Déposé plateforme" },
  { cle: "envoye_facturation", label: "Envoyé en facturation" },
  { cle: "paye", label: "Payé" },
];

type Att = { depose_at?: string | null; envoye_facturation_at?: string | null; paye_at?: string | null } | null | undefined;

/** Étape la plus avancée atteinte par un attachement. */
export function etapeAttachement(a: Att): EtapeSuivi {
  if (!a) return "sans_attachement";
  if (a.paye_at) return "paye";
  if (a.envoye_facturation_at) return "envoye_facturation";
  if (a.depose_at) return "depose";
  return "attachement";
}

/** Prochaine case à cocher pour faire avancer le dossier. */
export function prochainChamp(e: EtapeSuivi): { champ: ChampSuivi; label: string } | null {
  if (e === "attachement") return { champ: "depose_at", label: "Marquer déposé" };
  if (e === "depose") return { champ: "envoye_facturation_at", label: "Envoyé en facturation" };
  if (e === "envoye_facturation") return { champ: "paye_at", label: "Marquer payé" };
  return null;
}

/** Étapes de dépôt d'une facture sur la plateforme du client (indépendantes du statut interne). */
export type EtapeDepotFacture = "a_deposer" | "deposee" | "payee";

type Fact = {
  depose_at?: string | null;
  paid_at?: string | null;
  statut?: string | null;
} | null | undefined;

/** Où en est une facture dans son dépôt chez le client. */
export function etapeDepotFacture(f: Fact): EtapeDepotFacture {
  if (f?.paid_at || f?.statut === "payee") return "payee";
  if (f?.depose_at) return "deposee";
  return "a_deposer";
}

/** Une facture en brouillon ou annulée ne se dépose pas sur la plateforme du client. */
export function peutDeposerFacture(f: { statut?: string | null } | null | undefined): boolean {
  return Boolean(f) && f!.statut !== "annulee" && f!.statut !== "brouillon";
}

