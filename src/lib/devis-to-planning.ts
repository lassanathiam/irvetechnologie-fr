type DevisItemLite = {
  libelle: string | null;
  description: string | null;
  quantite: number | null;
};

const MARQUES = ["schneider", "legrand", "hager", "wallbox", "tesla", "abb", "evbox"];

function textLines(notes: string | null | undefined) {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function firstMatch(regex: RegExp, text: string) {
  const m = regex.exec(text);
  return m?.[1] ?? null;
}

export function datePlanificationDepuisDevis(dateExpiration: string | null | undefined) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallback = today.toISOString().slice(0, 10);
  const base = dateExpiration && /^\d{4}-\d{2}-\d{2}$/.test(dateExpiration) ? dateExpiration : fallback;
  const d = new Date(`${base}T09:00:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() < today.getTime()) {
    return `${fallback}T09:00:00.000Z`;
  }
  return d.toISOString();
}

export function buildInterventionProfile(args: {
  devisNumero: string;
  devisObjet: string | null;
  devisNotes: string | null;
  items: DevisItemLite[];
}) {
  const notes = textLines(args.devisNotes);
  const matiere = [
    args.devisObjet ?? "",
    ...notes,
    ...args.items.map((i) => `${i.libelle ?? ""} ${i.description ?? ""}`.trim()),
  ]
    .join(" ")
    .toLowerCase();

  const puissanceRaw = firstMatch(/(?:^|\D)(3[,.]?7|7[,.]?4|11|22)\s*k\s*w/i, matiere);
  const puissance = puissanceRaw ? `${puissanceRaw.replace(".", ",")} kW` : null;
  const phase = /triphas/i.test(matiere) ? "Triphasé" : /monophas/i.test(matiere) ? "Monophasé" : null;
  const typePose = /sur pied|pied|borne sur pied|totem/i.test(matiere)
    ? "Sur pied"
    : /murale|mur|wallbox/i.test(matiere)
      ? "Murale"
      : /exter/i.test(matiere)
        ? "Extérieure"
        : /inter/i.test(matiere)
          ? "Intérieure"
          : null;

  const metrageRaw = firstMatch(/(\d+(?:[.,]\d+)?)\s*m(?:\b|è|e)/i, matiere);
  const metrage = metrageRaw ? Number(metrageRaw.replace(",", ".")) : null;

  const marque = MARQUES.find((m) => matiere.includes(m));
  const marqueLabel = marque ? marque.toUpperCase() : null;
  const resumeItems = args.items
    .slice(0, 8)
    .map((i) => `- ${Math.max(1, Number(i.quantite ?? 1))} × ${i.libelle ?? "Ligne devis"}`)
    .join("\n");

  const notesPlanning = [
    `Créé automatiquement depuis le devis ${args.devisNumero} accepté.`,
    marqueLabel ? `Marque repérée: ${marqueLabel}` : null,
    notes.length ? `Informations client:\n${notes.join("\n")}` : null,
    resumeItems ? `Matériel / prestations du devis:\n${resumeItems}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    puissanceBorne: puissance,
    phaseInstallation: phase,
    typePose,
    metrageM: metrage,
    notesPlanning,
  };
}
