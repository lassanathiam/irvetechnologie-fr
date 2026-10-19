type Commande = {
  id: string;
  attId: string;
  factureId?: string;
  lu: { numero: string | null; montantHt: number | null };
  choix: "" | "commande" | "attachement";
};
type Attachement = { id: string; total_ht: number };

export function erreurValidationCommande(commande: Commande, commandes: Commande[], attachements: Attachement[]): string | null {
  if (commande.factureId) return "Cette commande est déjà validée et facturée.";
  const attachement = attachements.find((att) => att.id === commande.attId);
  if (!attachement || !commande.lu.numero || commande.lu.numero.trim().length < 3 || commande.lu.montantHt === null || !Number.isFinite(commande.lu.montantHt) || commande.lu.montantHt < 0 || commande.lu.montantHt > 1_000_000) return "Vérifiez le numéro, le montant HT et l’attachement.";
  if (Math.abs(commande.lu.montantHt - attachement.total_ht) >= 0.01 && !commande.choix) return "Choisissez le montant à retenir pour cet écart avant de facturer.";
  if (commandes.some((autre) => autre.id !== commande.id && autre.attId === commande.attId)) return "Deux commandes ciblent le même attachement : vérifiez l’association.";
  return null;
}

export function commandesAValider<T extends Commande>(commandes: T[], attachements: Attachement[], id?: string): T[] {
  return commandes.filter((commande) => (!id || commande.id === id) && !erreurValidationCommande(commande, commandes, attachements));
}