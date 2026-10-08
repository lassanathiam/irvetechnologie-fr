/** Déplace l'élément d'index `i` d'un cran vers le haut (-1) ou le bas (+1). */
export function deplacer<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return arr;
  const out = arr.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

/** Sépare « parent/sous-dossier » en ses deux parties. */
export function decouperDossier(dossier: string): { parent: string; sous: string | null } {
  const k = dossier.indexOf("/");
  return k < 0 ? { parent: dossier, sous: null } : { parent: dossier.slice(0, k), sous: dossier.slice(k + 1) || null };
}

/** Déplace l'élément d'index `from` à la position `to` (glisser-déposer). */
export function deplacerVers<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const out = arr.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x!);
  return out;
}
