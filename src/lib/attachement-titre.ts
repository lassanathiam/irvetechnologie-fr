// Titre lisible d'un attachement : numéro interne conservé + nom du client final (ENSIO/NCO).
// Le nom du client final est la dernière mention « — » de l'objet, sur les attachements
// hebdomadaires (initials « Semaine 42 (…) — DUPONT » et documents TS « TS · … — AT-… —
// Semaine 42 (…) — DUPONT »). Les segments qui ne sont pas un nom (dates, numéros) sont rejetés.
const SEGMENT_NON_CLIENT = /^(du\s|au\s|s\d|at-|semaine\b|attache)/i;

function dernierSegment(objet: string): string | null {
  const i = objet.lastIndexOf(" — ");
  if (i < 0) return null;
  const nom = objet.slice(i + 3).trim();
  if (!nom) return null;
  if (SEGMENT_NON_CLIENT.test(nom)) return null;
  // Une plage de dates « 12/10/2026 au 18/10/2026 » ou un entre-deux-parenthèses n'est pas un client.
  if (nom.includes("/")) return null;
  return nom;
}

export function clientFinalAttachement(a: { objet?: string | null }): string | null {
  const objet = a.objet ?? "";
  if (!/semaine\s*\d/i.test(objet)) return null;
  return dernierSegment(objet);
}

export function titreAttachement(a: { numero: string; objet?: string | null }): string {
  const c = clientFinalAttachement(a);
  return c ? `${a.numero} — ${c}` : a.numero;
}
