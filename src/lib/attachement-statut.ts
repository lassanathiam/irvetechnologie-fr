/**
 * Règle d'annulation d'un attachement : un attachement reste toujours modifiable,
 * on n'écrase jamais un attachement déjà parti chez le client.
 * Renvoie le message de blocage, ou null si l'annulation est autorisée.
 */
export function blocageAnnulation(a: { facture_id?: string | null; sent_at?: string | null }): string | null {
  if (a.facture_id) return "Cet attachement est déjà facturé : annulez plutôt la facture.";
  if (a.sent_at) return "Cet attachement a déjà été envoyé au client : il ne peut pas être annulé. Modifiez-le puis renvoyez-le.";
  return null;
}
