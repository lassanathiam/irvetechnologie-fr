/** Lecture des bons de commande ENSIO (texte extrait du PDF). Sans dépendance navigateur. */
export type CommandeLue = {
  numero: string | null; // ex. « CST 02048127 »
  attachement: string | null; // ex. « AT-2026-0021 »
  client: string | null;
  montantHt: number | null;
};

function nombre(s: string): number {
  return Number(s.replace(/[\s.\u00a0\u202f]/g, "").replace(",", "."));
}

export function lireCommande(texte: string): CommandeLue {
  const t = texte.replace(/\s+/g, " ");
  const num = t.match(/CST\s*(\d{6,})/i);
  const at = t.match(/AT-\d{4}-\d{3,}/i);
  const client = t.match(/IRVE\s*-\s*([^-]+?)\s*-\s*Semaine/i);
  let montant: number | null = null;
  const apres = t.split(/Montant HT \(EUR\)/i)[1];
  const m = apres?.match(/\d{1,3}(?:[\s.\u00a0\u202f]\d{3})*,\d{2}(?!\d)/);
  if (m) montant = nombre(m[0]);
  else {
    const tous = [...t.matchAll(/\d{1,3}(?:[\s.\u00a0\u202f]\d{3})*,\d{2}(?!\d)/g)].map((x) => nombre(x[0]));
    if (tous.length) montant = Math.max(...tous);
  }
  return {
    numero: num ? `CST ${num[1]}` : null,
    attachement: at ? at[0].toUpperCase() : null,
    client: client ? client[1].trim() : null,
    montantHt: montant,
  };
}

/** Normalise un nom pour comparer (majuscules, sans accents). */
export function cleNom(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
}
