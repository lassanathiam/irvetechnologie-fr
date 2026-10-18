export type RapportEcart = {
  numero: string; attachement: string; donneur: string; client: string; ticket: string;
  date: string; commandeHt: number; attachementHt: number; ecartHt: number; commentaire: string;
  lignes: { libelle: string; description: string | null; quantite: number; prixUnitaire: number; totalHt: number }[];
};

/** Écart positif : complément à demander au donneur d’ordre. */
export function ecartCommande(attachementHt: number, commandeHt: number) {
  return Math.round((Math.round(attachementHt * 100) - Math.round(commandeHt * 100))) / 100;
}

export function choisirAttachementCommande(lu: { attachement: string | null; client: string | null }, atts: { id: string; numero: string; texte: string; client_nom: string }[], normaliser: (s: string) => string) {
  if (lu.attachement) return atts.find((a) => a.numero.toUpperCase() === lu.attachement?.toUpperCase())?.id ?? "";
  const nom = lu.client ? normaliser(lu.client) : "";
  if (!nom) return "";
  const correspondances = atts.filter((a) => normaliser(`${a.client_nom} ${a.texte}`).includes(nom));
  return correspondances.length === 1 ? correspondances[0]?.id ?? "" : "";
}