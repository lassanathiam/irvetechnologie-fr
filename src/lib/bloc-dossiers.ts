// Bloc de dossiers à déposer sur la plateforme du donneur d'ordre (navigateur, sans base).
// Un dossier = une commande reçue + sa facture (+ l'attachement). Jamais de changement d'état.

export type CommandeBloc = { id: string; numero: string | null; client: string | null; attId: string; factureId?: string | null };

/** Nom de dossier lisible et sûr pour un ZIP : « CST02048127_ALAGON-Geoffrey ». */
export function nomDossier(numero: string, client: string): string {
  const sansAccent = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const n = sansAccent(numero).replace(/[^A-Za-z\d_-]+/g, "");
  const c = sansAccent(client).trim().replace(/[^A-Za-z\d]+/g, "-").replace(/^-+|-+$/g, "");
  return c ? `${n}_${c}` : n;
}

/** Une seule entrée par facture : la dernière commande importée remplace les précédentes (commande rectifiée). */
export function dossiersUniques<T extends CommandeBloc>(commandes: T[]): T[] {
  const parFacture = new Map<string, T>();
  for (const c of commandes) if (c.factureId && c.numero?.trim()) parFacture.set(c.factureId, c);
  return [...parFacture.values()].sort((a, b) => String(a.numero).localeCompare(String(b.numero)));
}

/** Coché par défaut : seulement les dossiers dont tous les chantiers sont réceptionnés. */
export function selectionParDefaut<T extends CommandeBloc>(dossiers: T[], recus: Map<string, boolean>): string[] {
  return dossiers.filter((d) => recus.get(d.attId) === true).map((d) => d.id);
}

/** Numéros de commande collés depuis le tableau du donneur d'ordre (« CST02048127 », « CST 02048127 », un par ligne ou séparés). */
export function numerosColles(texte: string): string[] {
  return [...new Set((texte.toUpperCase().match(/CST\s*\d{6,}/g) ?? []).map((n) => n.replace(/\s+/g, "")))];
}

/** Dossiers correspondant aux numéros collés, en ignorant les espaces. */
export function selectionParNumeros<T extends CommandeBloc>(dossiers: T[], numeros: string[]): string[] {
  const voulus = new Set(numeros);
  return dossiers.filter((d) => voulus.has(String(d.numero ?? "").toUpperCase().replace(/\s+/g, ""))).map((d) => d.id);
}
