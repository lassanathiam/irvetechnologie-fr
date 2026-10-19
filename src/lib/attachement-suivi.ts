export type AttachementSuivi = { id: string; numero: string; bon_commande?: string | null; facture_id?: string | null; statut?: string; client_nom: string };

export function cleCommande(numero?: string | null): string {
  return (numero ?? "").toUpperCase().replace(/[\s\u00a0\u202f]+/g, "");
}

export function rapprocherAttachement<T extends AttachementSuivi>(lu: { attachement: string | null; numero?: string | null }, atts: T[]): T | undefined {
  const parAttachement = lu.attachement ? atts.find((a) => a.numero.toUpperCase() === lu.attachement?.toUpperCase()) : undefined;
  const numero = cleCommande(lu.numero);
  const parCommande = numero ? atts.filter((a) => cleCommande(a.bon_commande) === numero) : [];
  if (parAttachement) {
    if (parCommande.some((a) => a.id !== parAttachement.id)) return undefined;
    return parAttachement;
  }
  return parCommande.length === 1 ? parCommande[0] : undefined;
}