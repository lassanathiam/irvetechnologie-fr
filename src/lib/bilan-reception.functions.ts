import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resumeBilan, type LigneBilan } from "./bilan-reception";

/** Relit sous l'identité de l'utilisateur les attachements, chantiers, commandes et factures. */
async function chargerBilan(supabase: any, ids?: string[]): Promise<LigneBilan[]> {
  let q = supabase.from("attachements_travaux")
    .select("id, numero, client_nom, client_email, objet, numero_ticket, total_ht, sent_at, facture_id, bon_commande, rendezvous_id, statut")
    .neq("statut", "annule").order("numero");
  if (ids?.length) q = q.in("id", ids);
  const { data: atts, error } = await q;
  if (error) throw new Error(error.message);
  const liste = (atts ?? []) as any[];
  const attIds = liste.map((a) => a.id);
  if (!attIds.length) return [];
  const [{ data: items, error: e1 }, { data: commandes, error: e2 }] = await Promise.all([
    supabase.from("attachement_items").select("attachement_id, rendezvous_id, quantite, prix_unitaire").in("attachement_id", attIds).not("rendezvous_id", "is", null),
    supabase.from("commandes_importees").select("saisie, created_at").order("created_at", { ascending: true }),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);
  const rdvParAtt = new Map<string, Set<string>>();
  for (const a of liste) if (a.rendezvous_id) rdvParAtt.set(a.id, new Set([a.rendezvous_id]));
  // Montant HT de chaque chantier dans son attachement (un attachement hebdomadaire couvre plusieurs chantiers).
  const montantParAttRdv = new Map<string, number>();
  for (const i of items ?? []) {
    const s = rdvParAtt.get(i.attachement_id) ?? new Set<string>(); s.add(i.rendezvous_id); rdvParAtt.set(i.attachement_id, s);
    const cle = `${i.attachement_id}|${i.rendezvous_id}`;
    montantParAttRdv.set(cle, (montantParAttRdv.get(cle) ?? 0) + Number(i.quantite ?? 0) * Number(i.prix_unitaire ?? 0));
  }
  const rdvIds = [...new Set([...rdvParAtt.values()].flatMap((s) => [...s]))];
  const { data: rdvs, error: e3 } = rdvIds.length
    ? await supabase.from("rendezvous").select("id, client_nom, cp_ville, date_debut, termine_at, receptionne_at, statut").in("id", rdvIds)
    : { data: [], error: null };
  if (e3) throw new Error(e3.message);
  const rdv = new Map((rdvs ?? []).map((r: any) => [r.id, r]));
  // Commande importée la plus récente pour chaque attachement (une commande corrigée remplace l'ancienne).
  const commandeParAtt = new Map<string, string>();
  for (const c of commandes ?? []) { const s = c.saisie as any; if (s?.attId && s?.lu?.numero) commandeParAtt.set(s.attId, String(s.lu.numero)); }
  const factureIds = [...new Set(liste.map((a) => a.facture_id).filter(Boolean))];
  const { data: factures, error: e4 } = factureIds.length
    ? await supabase.from("factures").select("id, numero").in("id", factureIds)
    : { data: [], error: null };
  if (e4) throw new Error(e4.message);
  const fac = new Map((factures ?? []).map((f: any) => [f.id, f.numero]));
  return liste.map((a) => ({
    id: a.id,
    numero: a.numero,
    donneur: a.client_nom ?? "",
    objet: a.objet ?? null,
    ticket: a.numero_ticket ?? null,
    totalHt: Number(a.total_ht ?? 0),
    envoyeLe: a.sent_at ?? null,
    facture: (a.facture_id && fac.get(a.facture_id)) || null,
    commande: commandeParAtt.get(a.id) || (String(a.bon_commande ?? "").trim() || null),
    chantiers: [...(rdvParAtt.get(a.id) ?? [])].map((id) => rdv.get(id)).filter(Boolean).map((r: any) => ({
      id: r.id, nom: r.client_nom ?? "Chantier", ville: r.cp_ville ?? null, date: r.termine_at ?? r.date_debut ?? null, receptionneLe: r.receptionne_at ?? null,
      statut: r.statut ?? null,
      montantHt: montantParAttRdv.has(`${a.id}|${r.id}`)
        ? Math.round(montantParAttRdv.get(`${a.id}|${r.id}`)! * 100) / 100
        : (rdvParAtt.get(a.id)?.size === 1 ? Number(a.total_ht ?? 0) : null),
    })),
  }));
}

export const getBilanReception = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const lignes = await chargerBilan(context.supabase);
    const { data: devis, error } = await context.supabase.from("devis")
      .select("id, numero, client_nom, total_ht, created_at").eq("statut", "envoye").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return { lignes, devisEnAttente: (devis ?? []).map((d) => ({ id: d.id, numero: d.numero, client: d.client_nom, totalHt: Number(d.total_ht ?? 0), envoyeLe: d.created_at })) };
  });

/** Envoie au donneur d'ordre le bilan des attachements cochés. Destinataire relu côté serveur, jamais fourni par le navigateur. */
export const envoyerBilanReception = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    ids: z.array(z.string().uuid()).min(1).max(300),
    envoiId: z.string().uuid(),
    message: z.string().trim().max(2000).default(""),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: atts, error } = await context.supabase.from("attachements_travaux").select("client_email, client_nom").in("id", data.ids).neq("statut", "annule");
    if (error) throw new Error(error.message);
    const emails = new Set((atts ?? []).map((a) => String(a.client_email ?? "").trim().toLowerCase()));
    if (emails.size !== 1 || emails.has("")) throw new Error(emails.size > 1 ? "Cochez seulement les attachements d’un même donneur d’ordre." : "Ajoutez l’email du donneur d’ordre sur les attachements avant l’envoi.");
    const email = [...emails][0];
    const lignes = await chargerBilan(context.supabase, data.ids);
    const donneur = atts?.[0]?.client_nom ?? "";
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { resoudreCopieEnsio } = await import("./copie-ensio.server");
    return sendTemplateEmail("bilan-reception", email, {
      templateData: { donneur, date: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }), lignes, resume: resumeBilan(lignes), message: data.message },
      copieEnsio: await resoudreCopieEnsio(context.supabase, email, donneur),
      idempotencyKey: `bilan-reception-${data.envoiId}`,
    });
  });
