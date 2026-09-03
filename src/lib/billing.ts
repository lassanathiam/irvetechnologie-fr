/** Calculs de facturation partagés client + serveur (règles françaises). */

export type BillingLine = {
  quantite: number;
  prix_unitaire: number;
  tva: number;
};

export type BillingTotals = {
  total_ht_brut: number;
  total_remise: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  /** Répartition de la TVA par taux, après remise. */
  tva_par_taux: { taux: number; base: number; montant: number }[];
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(lines: BillingLine[], remisePct: number): BillingTotals {
  const remise = Math.min(Math.max(Number(remisePct) || 0, 0), 100);
  const total_ht_brut = round2(
    lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0),
  );
  const total_remise = round2((total_ht_brut * remise) / 100);
  const total_ht = round2(total_ht_brut - total_remise);
  const factor = 1 - remise / 100;

  const buckets = new Map<number, number>();
  for (const l of lines) {
    const taux = Number(l.tva) || 0;
    const base = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * factor;
    buckets.set(taux, (buckets.get(taux) ?? 0) + base);
  }

  const tva_par_taux = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, base]) => ({
      taux,
      base: round2(base),
      montant: round2((base * taux) / 100),
    }));

  const total_tva = round2(tva_par_taux.reduce((s, t) => s + t.montant, 0));
  return {
    total_ht_brut,
    total_remise,
    total_ht,
    total_tva,
    total_ttc: round2(total_ht + total_tva),
    tva_par_taux,
  };
}

export const acompteAmount = (totalTtc: number, acomptePct: number) =>
  round2((totalTtc * (Number(acomptePct) || 0)) / 100);

export const CONDITIONS_DEFAUT =
  "Acompte à la commande, solde à la fin des travaux. Paiement par virement bancaire à réception de facture. Pénalités de retard : taux directeur BCE + 10 points. Indemnité forfaitaire pour frais de recouvrement : 40 €.";

export const MENTIONS_DEVIS = [
  "Devis gratuit — valable jusqu'à la date d'expiration indiquée.",
  "Bon pour accord : date, signature et mention « devis accepté » du client.",
  "Installation réalisée par un électricien qualifié IRVE conformément à la NF C 15-100 et au décret n° 2017-26.",
];

export const MENTIONS_FACTURE = [
  "TVA acquittée sur les débits.",
  "En cas de retard de paiement : intérêts au taux directeur BCE majoré de 10 points, plus 40 € d'indemnité forfaitaire (art. L441-10 du Code de commerce).",
  "Garantie 12 mois pièces, main-d'œuvre et déplacement sur l'installation réalisée.",
];
