/** Liens de contact d'un client : appel téléphonique direct ou WhatsApp. */

/** Numéro nettoyé pour un lien `tel:` (espaces et ponctuation retirés). */
export function telLien(numero?: string | null): string | null {
  if (!numero) return null;
  const brut = numero.replace(/[^\d+]/g, "");
  return brut.length >= 6 ? `tel:${brut}` : null;
}

/** Numéro au format international (France par défaut) pour WhatsApp. */
export function whatsappLien(numero?: string | null, message?: string): string | null {
  if (!numero) return null;
  let n = numero.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = `33${n.slice(1)}`;
  if (n.length < 8) return null;
  const texte = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${n}${texte}`;
}

/** Lien Waze : ouvre directement la navigation vers l'adresse. */
export function wazeLien(adresse?: string | null, cpVille?: string | null, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const q = [adresse, cpVille].filter(Boolean).join(", ");
  return `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`;
}
