import type { LigneSuivi } from "./etape-chantier";

/** Ce que l'on attend du client pour un chantier : sa commande (étapes 3 et 4) ou sa réception (étape 6). */
export type MotifRappel = "commande" | "reception";

export const ETAPES_RAPPEL = [3, 4, 6] as const;

export function motifRappel(l: Pick<LigneSuivi, "etape">): MotifRappel | null {
  if (l.etape === 3 || l.etape === 4) return "commande";
  if (l.etape === 6) return "reception";
  return null;
}

export type LigneRappel = Pick<LigneSuivi, "cle" | "attId" | "attNumero" | "client" | "ville" | "date" | "montantHt" | "commande" | "factureNumero" | "envoyeLe" | "donneur">;

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Trie les chantiers cochés en « commandes attendues » et « réceptions attendues ». Les autres étapes sont ignorées. */
export function preparerRappel(lignes: LigneSuivi[], cles: string[]) {
  const voulues = new Set(cles);
  const commandes: LigneRappel[] = []; const receptions: LigneRappel[] = []; let ignores = 0;
  for (const l of lignes) {
    if (!voulues.has(l.cle)) continue;
    const m = l.attId ? motifRappel(l) : null;
    if (!m) { ignores += 1; continue; }
    const r: LigneRappel = { cle: l.cle, attId: l.attId, attNumero: l.attNumero, client: l.client, ville: l.ville, date: l.date, montantHt: l.montantHt, commande: l.commande, factureNumero: l.factureNumero, envoyeLe: l.envoyeLe, donneur: l.donneur };
    (m === "commande" ? commandes : receptions).push(r);
  }
  const tous = [...commandes, ...receptions];
  return {
    commandes, receptions, ignores,
    attIds: [...new Set(tous.map((l) => l.attId).filter(Boolean))] as string[],
    donneurs: [...new Set(tous.map((l) => l.donneur))],
    totalCommandes: arrondi(commandes.reduce((t, l) => t + l.montantHt, 0)),
    totalReceptions: arrondi(receptions.reduce((t, l) => t + l.montantHt, 0)),
  };
}
