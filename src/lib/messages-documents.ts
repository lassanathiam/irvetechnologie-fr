/** Messages d'accompagnement préparés pour l'envoi des devis et factures. */
type Ligne = { libelle: string; quantite: number | string };
type Doc = {
  numero: string;
  client_nom?: string | null;
  objet?: string | null;
  total_ttc: number | string;
};

const eur = (n: number | string) =>
  Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const dateFr = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : null);

function detail(items: Ligne[]) {
  return items
    .filter((i) => i.libelle?.trim())
    .slice(0, 8)
    .map((i) => `• ${Number(i.quantite) !== 1 ? `${Number(i.quantite)} × ` : ""}${i.libelle.trim()}`)
    .join("\n");
}

const SIGNATURE = "Cordialement,\nL'équipe Borne de l'Ouest — IRVE Technologie";

export function messageDevis(d: Doc & { date_expiration?: string | null }, items: Ligne[]) {
  const lignes = detail(items);
  const validite = dateFr(d.date_expiration);
  return [
    `Bonjour${d.client_nom ? ` ${d.client_nom}` : ""},`,
    `Vous trouverez ci-joint notre devis n° ${d.numero}${d.objet ? ` concernant : ${d.objet}` : " pour les travaux demandés"}.`,
    lignes ? `Prestations prévues :\n${lignes}` : null,
    `Montant total : ${eur(d.total_ttc)} TTC.${validite ? ` Ce devis est valable jusqu'au ${validite}.` : ""}`,
    "Vous pouvez le consulter, le télécharger et l'accepter en ligne grâce au bouton ci-dessous. Nous restons à votre disposition pour toute question.",
    SIGNATURE,
  ].filter(Boolean).join("\n\n");
}

export function messageFacture(d: Doc & { date_echeance?: string | null }, items: Ligne[]) {
  const lignes = detail(items);
  const ech = dateFr(d.date_echeance);
  return [
    `Bonjour${d.client_nom ? ` ${d.client_nom}` : ""},`,
    `Vous trouverez ci-joint la facture n° ${d.numero} relative aux travaux effectués${d.objet ? ` : ${d.objet}` : ""}.`,
    lignes ? `Travaux réalisés :\n${lignes}` : null,
    `Montant à régler : ${eur(d.total_ttc)} TTC${ech ? `, avant le ${ech}` : ""}.`,
    "Nous vous remercions de votre confiance et restons à votre disposition pour toute question.",
    SIGNATURE,
  ].filter(Boolean).join("\n\n");
}
