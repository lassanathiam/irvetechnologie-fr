import { euro } from "@/lib/company";

/** Lit un montant saisi (« 1 299,50 ») ; vide = null. */
export function lireNombre(v: string): number | null {
  const t = v.replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const versChamp = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

export const montant = (n: number | null | undefined) => (n == null ? "—" : euro(n));

export const PHASE_LIBELLE: Record<string, string> = {
  mono: "Monophasé",
  tri: "Triphasé",
  mono_tri: "Mono ou triphasé",
};

export const CONNECTEUR_LIBELLE: Record<string, string> = {
  prise_t2: "Prise Type 2",
  cable: "Câble attaché",
};

export const ouiNon = (v: boolean | null | undefined) => (v == null ? "À vérifier" : v ? "Oui" : "Non");
