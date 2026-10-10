// Titre lisible d'un attachement : numéro interne conservé + nom du client final (ENSIO/NCO).
export function clientFinalAttachement(a: { objet?: string | null }): string | null {
  const objet = a.objet ?? "";
  if (!/^semaine\s/i.test(objet)) return null;
  const i = objet.lastIndexOf(" — ");
  if (i < 0) return null;
  const nom = objet.slice(i + 3).trim();
  return nom || null;
}

export function titreAttachement(a: { numero: string; objet?: string | null }): string {
  const c = clientFinalAttachement(a);
  return c ? `${a.numero} — ${c}` : a.numero;
}
