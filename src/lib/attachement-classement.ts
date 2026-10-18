type AttachementEtat = { statut?: string | null; facture_id?: string | null };

export function estAttachementCloture(a: AttachementEtat): boolean {
  return Boolean(a.facture_id) || a.statut === "facture";
}

export function statutAttachement(a: AttachementEtat): string {
  if (estAttachementCloture(a)) return "Facturé · Clôturé";
  const labels: Record<string, string> = {
    brouillon: "Brouillon", envoye: "Envoyé", propose: "Valorisation proposée",
    accepte: "Accepté", refuse: "Refusé", annule: "Annulé",
  };
  return labels[a.statut ?? "brouillon"] ?? a.statut ?? "Brouillon";
}