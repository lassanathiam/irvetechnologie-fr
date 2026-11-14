/**
 * Chantiers dont la commande du donneur d'ordre est reçue (même règle que « Suivi chantiers ») :
 * commande importée, bon de commande saisi sur l'attachement ou sur sa facture.
 * Sert à n'autoriser la réception qu'une fois la commande là.
 */
export async function chantiersAvecCommande(supabase: any, rdvIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(rdvIds)];
  if (!ids.length) return new Set();
  const [direct, lignes] = await Promise.all([
    supabase.from("attachements_travaux").select("id, rendezvous_id").in("rendezvous_id", ids).neq("statut", "annule"),
    supabase.from("attachement_items").select("attachement_id, rendezvous_id").in("rendezvous_id", ids),
  ]);
  if (direct.error) throw new Error(direct.error.message);
  if (lignes.error) throw new Error(lignes.error.message);
  const rdvParAtt = new Map<string, Set<string>>();
  const lier = (att: string, rdv: string) => { const s = rdvParAtt.get(att) ?? new Set<string>(); s.add(rdv); rdvParAtt.set(att, s); };
  for (const a of direct.data ?? []) if (a.rendezvous_id) lier(a.id, a.rendezvous_id);
  for (const l of lignes.data ?? []) if (l.rendezvous_id) lier(l.attachement_id, l.rendezvous_id);
  const attIds = [...rdvParAtt.keys()];
  if (!attIds.length) return new Set();
  const [atts, commandes] = await Promise.all([
    supabase.from("attachements_travaux").select("id, bon_commande, facture_id, statut").in("id", attIds).neq("statut", "annule"),
    supabase.from("commandes_importees").select("saisie"),
  ]);
  if (atts.error) throw new Error(atts.error.message);
  if (commandes.error) throw new Error(commandes.error.message);
  const importees = new Set<string>();
  for (const c of commandes.data ?? []) { const s = c.saisie as any; if (s?.attId && s?.lu?.numero) importees.add(String(s.attId)); }
  const factureIds = (atts.data ?? []).map((a: any) => a.facture_id).filter(Boolean);
  const { data: facs, error: ef } = factureIds.length
    ? await supabase.from("factures").select("id, bon_commande, statut").in("id", factureIds)
    : { data: [], error: null };
  if (ef) throw new Error(ef.message);
  const bcFacture = new Map((facs ?? []).filter((f: any) => f.statut !== "annulee").map((f: any) => [f.id, String(f.bon_commande ?? "").trim()]));
  const ok = new Set<string>();
  for (const a of atts.data ?? []) {
    const commande = importees.has(a.id) || String(a.bon_commande ?? "").trim() !== "" || Boolean(a.facture_id && bcFacture.get(a.facture_id));
    if (commande) for (const r of rdvParAtt.get(a.id) ?? []) ok.add(r);
  }
  return ok;
}

export const MESSAGE_SANS_COMMANDE = "Commande pas encore reçue : importez-la dans « Bons de commande », puis réceptionnez depuis « Suivi chantiers ».";
