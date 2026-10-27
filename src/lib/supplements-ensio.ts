export const FORFAIT_ENSIO_M = 15;
export function supplementsEnsio(r: { metrage_m?: number | string | null; metrage_reel_m?: number | string | null }, cableLibelle: string) {
  const quantite = Math.max(0, Math.max(Number(r.metrage_m) || 0, Number(r.metrage_reel_m) || 0) - FORFAIT_ENSIO_M);
  if (!quantite) return [];
  return [
    { libelle: cableLibelle, quantite, prix_unitaire: /5\s*g\s*10/i.test(cableLibelle) ? 3 : 2, tes: true },
    { libelle: "Câble info supplémentaire", quantite, prix_unitaire: 2, tes: true },
  ];
}