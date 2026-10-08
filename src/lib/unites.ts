export const UNITES = [
  { value: "u", label: "Pièce" },
  { value: "h", label: "Heure" },
  { value: "forfait", label: "Forfait" },
  { value: "m", label: "Mètre" },
  { value: "j", label: "Jour" },
] as const;

/** Fractions d'heure proposées : valeur décimale exacte (arrondie à 4 décimales). */
export const FRACTIONS_HEURE = [
  { label: "¼ h", value: 0.25 },
  { label: "⅓ h", value: 0.3333 },
  { label: "½ h", value: 0.5 },
  { label: "¾ h", value: 0.75 },
  { label: "1 h", value: 1 },
  { label: "1 h 30", value: 1.5 },
  { label: "2 h", value: 2 },
];

/** Affiche une quantité avec son unité ; en heures : 1,5 → « 1 h 30 ». */
export function formatQuantite(q: number, unite?: string | null): string {
  const n = Number(q) || 0;
  if (unite === "h") {
    const totalMin = Math.round(n * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m} min`;
    return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  }
  const txt = n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (!unite || unite === "u") return txt;
  if (unite === "forfait") return `${txt} forfait`;
  return `${txt} ${unite}`;
}
