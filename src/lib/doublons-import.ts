/** Browser-safe import helpers: text cleanup after PDF/OCR reading and duplicate detection. */

const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Repairs typical reading defects: "M o n s i e u r" letters, OCR O/l inside phone numbers, odd spaces. */
export function nettoyerTexteLu(texte: string): string {
  let t = texte
    .replace(/[\u00a0\u2007\u202f\t]+/g, (m) => (m.includes("\t") ? "\t" : " "))
    .replace(/\ufb01/g, "fi").replace(/\ufb02/g, "fl")
    .replace(/[’`]/g, "'");
  // Lettres isolées séparées par un espace : on recolle chaque mot (deux espaces ou plus = séparation de mots).
  t = t.split("\n").map((ligne) => ligne.replace(/(?:^|(?<=\s))(?:[\p{L}\p{N}@.'-] ){2,}[\p{L}\p{N}@.'-](?=\s|$)/gu, (m) => m.replace(/ /g, ""))).join("\n");
  // Téléphones lus par OCR avec O à la place de 0 ou l/I à la place de 1.
  t = t.replace(/(?<![\p{L}\d])(?:\+33\s?|[0O])[1-9OIl](?:[ .-]?[\dOoIl]{2}){4}(?![\p{L}\d])/gu, (m) => m.replace(/[Oo]/g, "0").replace(/[Il]/g, "1"));
  return t.replace(/ {2,}/g, " ").replace(/ +\n/g, "\n");
}

export const telNorm = (t: string | null | undefined) => {
  const d = (t ?? "").replace(/\D/g, "").replace(/^33(?=\d{9}$)/, "0");
  return d.length >= 9 ? d.slice(-9) : "";
};

const ABREV: Record<string, string> = { av: "avenue", ave: "avenue", bd: "boulevard", bld: "boulevard", r: "rue", ch: "chemin", che: "chemin", imp: "impasse", all: "allee", pl: "place", rte: "route", st: "saint", ste: "sainte" };
export const adresseNorm = (a: string | null | undefined) =>
  sansAccent(a ?? "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean)
    .map((w) => ABREV[w] ?? w).filter((w) => !["de", "du", "des", "la", "le", "les", "l", "d"].includes(w)).join(" ");

const CIVILITES = new Set(["m", "mr", "mme", "mlle", "monsieur", "madame", "mademoiselle", "mmes", "mrs"]);
export const nomNorm = (n: string | null | undefined) => {
  const mots = sansAccent(n ?? "").replace(/[^a-z]+/g, " ").trim().split(" ").filter((w) => w && !CIVILITES.has(w));
  return mots.sort().join(" ");
};

export type ChantierComparable = { client_nom?: string | null; adresse?: string | null; client_telephone?: string | null };

/** Duplicate when at least two of name / address / phone match, so one misread field never hides or creates a duplicate. */
export function estDoublon(a: ChantierComparable, b: ChantierComparable): boolean {
  const na = nomNorm(a.client_nom), nb = nomNorm(b.client_nom);
  const nomOk = !!na && na !== "client preciser" && na === nb;
  const aa = adresseNorm(a.adresse), ab = adresseNorm(b.adresse);
  const adrOk = aa.length >= 5 && aa === ab;
  const ta = telNorm(a.client_telephone), tb = telNorm(b.client_telephone);
  const telOk = !!ta && ta === tb;
  return [nomOk, adrOk, telOk].filter(Boolean).length >= 2;
}

/** Returns, for each imported line, the reason it is a duplicate (existing appointment or earlier line), or null. */
export function reperesDoublons<T extends ChantierComparable>(lignes: T[], existants: (ChantierComparable & { statut?: string | null })[]): (string | null)[] {
  const actifs = existants.filter((e) => e.statut !== "annule");
  return lignes.map((l, i) => {
    const ex = actifs.find((e) => estDoublon(l, e));
    if (ex) return `Déjà dans le planning (${ex.client_nom ?? "client"})`;
    const j = lignes.slice(0, i).findIndex((p) => estDoublon(l, p));
    return j >= 0 ? `Identique à l'intervention ${j + 1}` : null;
  });
}
