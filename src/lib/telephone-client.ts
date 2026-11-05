import { COMPANY } from "./company";

const chiffres = (s: string) => s.replace(/\D/g, "").replace(/^33/, "0").replace(/^0033/, "0");

/** Numéros de l'entreprise : imprimés sur les fiches donneur d'ordre (« SST IRVE TECHNOLOGIE »), jamais ceux du client. */
const NUMEROS_ENTREPRISE = new Set([COMPANY.telephone, COMPANY.telephone2].map(chiffres));

export function estNumeroEntreprise(tel: string | null | undefined): boolean {
  return !!tel && NUMEROS_ENTREPRISE.has(chiffres(tel));
}

/** Garde un numéro de client seulement s'il n'appartient pas à l'entreprise. */
export function telephoneClient(tel: string | null | undefined): string | null {
  const t = tel?.trim();
  return t && !estNumeroEntreprise(t) ? t : null;
}

/** Premier numéro du texte qui n'est pas celui de l'entreprise. */
export function premierTelephoneClient(texte: string): string | null {
  const tous = texte.match(/(?:\+33\s*(?:\(0\)\s*)?|0)[1-9](?:[ .-]?\d{2}){4}\b/g) ?? [];
  const t = tous.find((n) => !estNumeroEntreprise(n));
  return t ? t.replace(/[ .()-]/g, "").replace(/^\+33/, "0") : null;
}
