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

type DevisItemLite = {
  libelle: string | null;
  description?: string | null;
};

const MOTS_BORNE = ["borne", "wallbox", "evlink", "tesla", "schneider", "hager", "legrand"];

function puissanceDepuisTexte(text: string): "3,7 kW" | "7,4 kW" | "11 kW" | "22 kW" | null {
  if (/(?:^|\D)22\s*k\s*w/i.test(text)) return "22 kW";
  if (/(?:^|\D)11\s*k\s*w/i.test(text)) return "11 kW";
  if (/(?:^|\D)7[,.]?4\s*k\s*w/i.test(text)) return "7,4 kW";
  if (/(?:^|\D)3[,.]?7\s*k\s*w/i.test(text)) return "3,7 kW";
  return null;
}

export function estNoteAutoDepuisDevis(note: string | null | undefined): boolean {
  if (!note) return false;
  const n = note.toLowerCase();
  return (
    n.includes("créé automatiquement depuis le devis") ||
    n.includes("cree automatiquement depuis le devis") ||
    n.includes("notes devis :") ||
    n.includes("matériel / prestations du devis") ||
    n.includes("materiel / prestations du devis")
  );
}

export function extraireTechniqueBorneDepuisDevis(items: DevisItemLite[]): {
  designation: string | null;
  puissance: "3,7 kW" | "7,4 kW" | "11 kW" | "22 kW" | null;
} {
  if (!items.length) return { designation: null, puissance: null };
  const line = items.find((i) => {
    const text = `${i.libelle ?? ""} ${i.description ?? ""}`.toLowerCase();
    return MOTS_BORNE.some((mot) => text.includes(mot));
  }) ?? items[0];

  const label = (line?.libelle ?? "").trim() || null;
  const detail = `${line?.libelle ?? ""} ${line?.description ?? ""}`;
  const puissance = puissanceDepuisTexte(detail);
  return { designation: label, puissance };
}
