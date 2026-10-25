import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "@/lib/billing";
import { cleCommande } from "@/lib/attachement-suivi";

const lineSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().positive().max(100000),
  prix_unitaire: z.number().min(0).max(1_000_000),
  rendezvous_id: z.string().uuid().optional().nullable(),
  tes: z.boolean().optional().default(false),
});

const attachmentSchema = z.object({
  client_nom: z.string().trim().min(2).max(160),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_adresse: z.string().trim().max(300).optional().nullable(),
  client_cp_ville: z.string().trim().max(160).optional().nullable(),
  numero_ticket: z.string().trim().min(1, "Le numéro de ticket est obligatoire.").max(120),
  numero_affaire: z.string().trim().max(120).optional().nullable(),
  bon_commande: z.string().trim().max(120).optional().nullable(),
  objet: z.string().trim().max(240).optional().nullable(),
  date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoliquidation: z.boolean(),
  validation_requise: z.boolean(),
  proposition_autorisee: z.boolean().optional().default(true),

  notes: z.string().trim().max(2000).optional().nullable(),
  rendezvous_id: z.string().uuid().optional().nullable(),
  items: z.array(lineSchema).min(1).max(100),
});

async function nextNumber(supabase: any, year: number) {
  const prefix = `AT-${year}-`;
  const { data } = await supabase
    .from("attachements_travaux")
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);
  const previous = data?.[0]?.numero ? Number(String(data[0].numero).slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(previous) ? previous : 0) + 1).padStart(4, "0")}`;
}

const estFiniRdv = (r: any) => Boolean(r.termine_at || r.chantier_valide || ["termine", "realise"].includes(r.statut));

const fr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Lundi de la semaine d'une date (ISO). */
function lundiDe(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const j = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - j);
  return d.toISOString().slice(0, 10);
}

/** Numéro de semaine ISO d'une date. */
function semaineIso(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jP = (premierJeudi.getUTCDay() + 6) % 7;
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - jP + 3);
  return 1 + Math.round((d.getTime() - premierJeudi.getTime()) / (7 * 86400000));
}

/** Message adaptatif : semaine couverte et état des travaux (réalisés / à réaliser). */
async function messageAdaptif(supabase: any, attachment: any) {
  const { data: lignes } = await supabase.from("attachement_items").select("rendezvous_id").eq("attachement_id", attachment.id);
  const ids = [...new Set((lignes ?? []).map((l: any) => l.rendezvous_id).filter(Boolean))] as string[];
  let dates: string[] = [];
  let tousFini = true;
  if (ids.length) {
    const { data: rdvs } = await supabase.from("rendezvous").select("id, date_debut, statut, termine_at, chantier_valide").in("id", ids);
    const rows = rdvs ?? [];
    dates = rows.map((r: any) => String(r.termine_at || r.date_debut || "").slice(0, 10)).filter(Boolean);
    if (rows.length) tousFini = rows.every(estFiniRdv);
  }
  let lundi: string | null = null;
  if (dates.length) {
    lundi = lundiDe(dates.sort()[0]);
  } else {
    // Repli : ticket "S04-2026" sinon semaine de la date d'émission.
    const m = /^S(\d{1,2})-(\d{4})/.exec(attachment.numero_ticket || "");
    if (m) {
      const janvier = new Date(Date.UTC(Number(m[2]), 0, 4));
      const jP = (janvier.getUTCDay() + 6) % 7;
      janvier.setUTCDate(janvier.getUTCDate() - jP + 3);
      janvier.setUTCDate(janvier.getUTCDate() + (Number(m[1]) - 1) * 7);
      lundi = lundiDe(janvier.toISOString().slice(0, 10));
    } else {
      lundi = lundiDe(String(attachment.date_emission).slice(0, 10));
    }
  }
  if (!lundi) lundi = lundiDe(String(attachment.date_emission).slice(0, 10));
  const d = new Date(`${lundi}T12:00:00`);
  d.setDate(d.getDate() + 6);
  const dimanche = d.toISOString().slice(0, 10);
  const etat = tousFini ? "réalisés" : "réalisés ou à réaliser";
  return `Bonjour, merci de trouver sur le lien ci-dessus l'attachement des travaux ${etat} pour la semaine S${semaineIso(lundi)} (du ${fr(lundi)} au ${fr(dimanche)}).`;
}

export const listAttachements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attachements_travaux")
      .select("id, numero, objet, client_nom, client_email, numero_ticket, numero_affaire, bon_commande, statut, total_ht, total_tva, total_ttc, autoliquidation, date_emission, facture_id, sent_at, viewed_at, last_viewed_at, view_count, public_token")
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((a) => a.id);
    // Suivi TES : nombre de lignes en supplément et leur montant HT, par attachement.
    const { data: lignesTes } = ids.length
      ? await context.supabase.from("attachement_items").select("attachement_id, quantite, prix_unitaire").eq("tes", true).in("attachement_id", ids)
      : { data: [] as { attachement_id: string; quantite: number; prix_unitaire: number }[] };
    const parAtt = new Map<string, { nb: number; ht: number }>();
    for (const l of lignesTes ?? []) {
      const cur = parAtt.get(l.attachement_id) ?? { nb: 0, ht: 0 };
      cur.nb += 1; cur.ht += (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
      parAtt.set(l.attachement_id, cur);
    }
    return (data ?? []).map((a) => ({ ...a, tes_nb: parAtt.get(a.id)?.nb ?? 0, tes_ht: Math.round((parAtt.get(a.id)?.ht ?? 0) * 100) / 100 }));
  });

export const getAttachement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Attachement introuvable.");
    const lines = await context.supabase.from("attachement_items").select("*").eq("attachement_id", data.id).order("ordre");
    if (lines.error) throw new Error(lines.error.message);
    const props = await context.supabase
      .from("attachement_propositions")
      .select("id, signataire_nom, commentaire, total_ht, statut, lignes, created_at, traite_at")
      .eq("attachement_id", data.id)
      .order("created_at", { ascending: false });
    if (props.error) throw new Error(props.error.message);
    const message_suggestion = await messageAdaptif(context.supabase, result.data);
    return { attachement: result.data, items: lines.data ?? [], propositions: props.data ?? [], message_suggestion };
  });

export const traiterPropositionAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ proposition_id: z.string().uuid(), decision: z.enum(["accepter", "refuser"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const prop = await context.supabase.from("attachement_propositions").select("*").eq("id", data.proposition_id).maybeSingle();
    if (prop.error) throw new Error(prop.error.message);
    if (!prop.data) throw new Error("Proposition introuvable.");
    if (prop.data.statut !== "en_attente") throw new Error("Cette proposition a déjà été traitée.");
    const att = await context.supabase.from("attachements_travaux").select("id, facture_id, autoliquidation").eq("id", prop.data.attachement_id).maybeSingle();
    if (att.error) throw new Error(att.error.message);
    if (!att.data) throw new Error("Attachement introuvable.");
    if (att.data.facture_id) throw new Error("Cet attachement est déjà facturé.");
    const cible = att.data;
    const now = new Date().toISOString();
    if (data.decision === "refuser") {
      const upd = await context.supabase.from("attachement_propositions").update({ statut: "refusee", traite_at: now }).eq("id", data.proposition_id);
      if (upd.error) throw new Error(upd.error.message);
      const back = await context.supabase.from("attachements_travaux").update({ statut: "envoye" }).eq("id", cible.id);
      if (back.error) throw new Error(back.error.message);
      return { ok: true, decision: "refuser" as const };
    }
    const lignes = (Array.isArray(prop.data.lignes) ? prop.data.lignes : []) as Array<{ libelle: string; description?: string | null; quantite: number; prix_unitaire: number }>;
    if (!lignes.length) throw new Error("La proposition ne contient aucune ligne.");
    const items = lignes.map((l) => ({ ...l, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire), tva: cible.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", cible.id);
    if (del.error) throw new Error(del.error.message);
    const ins = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: cible.id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      ordre: index + 1,
    })));
    if (ins.error) throw new Error(ins.error.message);
    const upd = await context.supabase.from("attachements_travaux").update({
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      statut: "accepte",
      accepted_at: now,
      refused_at: null,
      signataire_nom: prop.data.signataire_nom,
    }).eq("id", cible.id);
    if (upd.error) throw new Error(upd.error.message);
    const done = await context.supabase.from("attachement_propositions").update({ statut: "acceptee", traite_at: now }).eq("id", data.proposition_id);
    if (done.error) throw new Error(done.error.message);
    return { ok: true, decision: "accepter" as const };
  });


export const createAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attachmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const items = data.items.map((item) => ({ ...item, tva: data.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const numero = await nextNumber(context.supabase, Number(data.date_emission.slice(0, 4)));
    const { items: _items, ...attachmentData } = data;
    const { data: row, error } = await context.supabase.from("attachements_travaux").insert({
      ...attachmentData,
      numero,
      activite: "fibre",
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const { error: lineError } = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: row.id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      rendezvous_id: item.rendezvous_id ?? null,
      tes: Boolean(item.tes),
      ordre: index + 1,
    })));
    if (lineError) throw new Error(lineError.message);
    return { id: row.id };
  });

export const updateAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attachmentSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, items: rawItems, ...attachmentData } = data;
    const existing = await context.supabase.from("attachements_travaux").select("facture_id").eq("id", id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (existing.data.facture_id) throw new Error("Cet attachement est déjà facturé : modifiez la facture.");
    const items = rawItems.map((item) => ({ ...item, tva: data.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const { error } = await context.supabase.from("attachements_travaux").update({
      ...attachmentData,
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    const anciens = await context.supabase.from("attachement_items").select("libelle, description, rendezvous_id").eq("attachement_id", id);
    const liens = new Map((anciens.data ?? []).filter((l: any) => l.rendezvous_id).map((l: any) => [`${l.libelle}|${l.description ?? ""}`, l.rendezvous_id as string]));
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", id);
    if (del.error) throw new Error(del.error.message);
    const { error: lineError } = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      rendezvous_id: item.rendezvous_id ?? liens.get(`${item.libelle}|${item.description ?? ""}`) ?? null,
      tes: Boolean(item.tes),
      ordre: index + 1,
    })));
    if (lineError) throw new Error(lineError.message);
    return { id };
  });

export const supprimerAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("attachements_travaux").select("facture_id").eq("id", data.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (existing.data.facture_id) throw new Error("Impossible de supprimer un attachement déjà facturé.");
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", data.id);
    if (del.error) throw new Error(del.error.message);
    const { error } = await context.supabase.from("attachements_travaux").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const envoyerAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), message: z.string().trim().max(2000).optional().nullable() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: attachment, error } = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Attachement introuvable.");
    if (!attachment.numero_ticket?.trim()) throw new Error("Ajoutez le numéro de ticket avant l’envoi.");
    if (!attachment.client_email) throw new Error("Ajoutez l’adresse e-mail du destinataire avant l’envoi.");
    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
    const link = `${base}/attachement/${attachment.public_token}`;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const result = await sendTemplateEmail("attachement-travaux", attachment.client_email, {
      copieEnsio: await resoudreCopieEnsio(context.supabase, attachment.client_email, attachment.client_nom),
      idempotencyKey: `attachement-${attachment.id}-${new Date().toISOString()}`,
      templateData: {
        client_nom: attachment.client_nom,
        numero: attachment.numero,
        numero_ticket: attachment.numero_ticket,
        numero_affaire: attachment.numero_affaire,
        bon_commande: attachment.bon_commande,
        objet: attachment.objet,
        total_ht: Number(attachment.total_ht),
        autoliquidation: attachment.autoliquidation,
        validation_requise: attachment.validation_requise,
        message: (data.message?.trim() ? data.message : await messageAdaptif(context.supabase, attachment)),
        lien: link,
      },
    });
    if (result.sent) {
      await context.supabase.from("attachements_travaux").update({ sent_at: new Date().toISOString(), statut: "envoye" }).eq("id", attachment.id);
    }
    return { ...result, lien: link };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function convertirEnFacture(context: { supabase: any; userId: string }, data: { id: string }): Promise<{ id: string; existing: boolean }> {
    const { data: attachment, error } = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Attachement introuvable.");
    if (attachment.facture_id) return { id: attachment.facture_id, existing: true };
    const { data: items, error: itemsError } = await context.supabase.from("attachement_items").select("*").eq("attachement_id", data.id).order("ordre");
    if (itemsError) throw new Error(itemsError.message);
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `F-${year}-`;
    const { data: numbers } = await context.supabase.from("factures").select("numero").like("numero", `${prefix}%`).order("numero", { ascending: false }).limit(1);
    const last = numbers?.[0]?.numero ? Number(String(numbers[0].numero).slice(prefix.length)) : 0;
    const numero = `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
    const due = new Date(today); due.setDate(due.getDate() + 30);
    const { data: invoice, error: invoiceError } = await context.supabase.from("factures").insert({
      attachement_id: attachment.id,
      numero,
      date_emission: today.toISOString().slice(0, 10),
      date_echeance: due.toISOString().slice(0, 10),
      client_nom: attachment.client_nom,
      client_email: attachment.client_email,
      client_telephone: attachment.client_telephone,
      client_adresse: attachment.client_adresse,
      client_cp_ville: attachment.client_cp_ville,
      objet: attachment.objet || `Travaux fibre — ticket ${attachment.numero_ticket}`,
      remise_pct: 0,
      acompte_pct: 0,
      conditions_paiement: "Paiement par virement à réception de facture. Indemnité forfaitaire de recouvrement : 40 €.",
      notes: attachment.notes,
      total_ht_brut: attachment.total_ht,
      total_remise: 0,
      total_ht: attachment.total_ht,
      total_tva: attachment.total_tva,
      total_ttc: attachment.total_ttc,
      activite: "fibre",
      numero_ticket: attachment.numero_ticket,
      numero_affaire: attachment.numero_affaire,
      bon_commande: attachment.bon_commande,
      autoliquidation: attachment.autoliquidation,
      statut: "validee",
      created_by: context.userId,
    }).select("id").single();
    if (invoiceError) throw new Error(invoiceError.message);
    if ((items ?? []).length) {
      const inserted = await context.supabase.from("facture_items").insert((items ?? []).map((item: any, index: number) => ({
        facture_id: invoice.id,
        libelle: item.libelle,
        description: item.description,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        tva: attachment.autoliquidation ? 0 : 20,
        ordre: index + 1,
      })));
      if (inserted.error) throw new Error(inserted.error.message);
    }
    await context.supabase.from("attachements_travaux").update({ facture_id: invoice.id, statut: "facture" }).eq("id", attachment.id);
    return { id: invoice.id, existing: false };
}

export const convertirAttachementEnFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => convertirEnFacture(context, data));

/** Attachements correspondant aux numéros lus sur les bons de commande. */
export const trouverAttachementsCommandes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ numeros: z.array(z.string().max(40)).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux")
      .select("id, numero, objet, client_nom, statut, total_ht, bon_commande, facture_id, date_emission")
      .neq("statut", "annule").order("date_emission", { ascending: false }).limit(400);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: items } = ids.length ? await context.supabase.from("attachement_items").select("attachement_id, description, libelle").in("attachement_id", ids) : { data: [] as { attachement_id: string; description: string | null; libelle: string }[] };
    const textes = new Map<string, string>();
    for (const i of items ?? []) textes.set(i.attachement_id, `${textes.get(i.attachement_id) ?? ""} ${i.libelle} ${i.description ?? ""}`);
    return (rows ?? []).map((r) => ({ ...r, total_ht: Number(r.total_ht), texte: `${r.objet ?? ""} ${textes.get(r.id) ?? ""}` }));
  });

/** Rattache un bon de commande, ajuste le montant si demandé, puis crée la facture. */
export const appliquerCommandeAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    bon_commande: z.string().trim().min(3).max(60),
    montant_ht: z.number().min(0).max(1_000_000).nullable(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase.from("attachements_travaux").select("id, facture_id, total_ht, autoliquidation, client_nom, bon_commande").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!att) throw new Error("Attachement introuvable.");
    const autres = await context.supabase.from("attachements_travaux").select("id, bon_commande").eq("client_nom", att.client_nom).neq("id", att.id).neq("statut", "annule");
    if (autres.error) throw new Error(autres.error.message);
    if (autres.data.some((a) => cleCommande(a.bon_commande) === cleCommande(data.bon_commande))) throw new Error("Ce numéro de commande est déjà rattaché à un autre attachement de ce donneur d’ordre.");
    if (att.facture_id && att.bon_commande && cleCommande(att.bon_commande) !== cleCommande(data.bon_commande)) throw new Error("Cet attachement est déjà facturé avec un autre numéro de commande.");
    if (att.facture_id) {
      await context.supabase.from("attachements_travaux").update({ bon_commande: data.bon_commande }).eq("id", att.id);
      await context.supabase.from("factures").update({ bon_commande: data.bon_commande }).eq("id", att.facture_id);
      return { id: att.facture_id, existing: true };
    }
    const patch: { bon_commande: string; total_ht?: number; total_tva?: number; total_ttc?: number } = { bon_commande: data.bon_commande };
    if (data.montant_ht !== null) {
      const ecart = Math.round((data.montant_ht - Number(att.total_ht)) * 100) / 100;
      if (Math.abs(ecart) >= 0.01) {
        const { data: last } = await context.supabase.from("attachement_items").select("ordre").eq("attachement_id", att.id).order("ordre", { ascending: false }).limit(1);
        const ins = await context.supabase.from("attachement_items").insert({ attachement_id: att.id, libelle: `Ajustement selon bon de commande ${data.bon_commande}`, quantite: 1, prix_unitaire: ecart, tes: true, ordre: (last?.[0]?.ordre ?? 0) + 1 });
        if (ins.error) throw new Error(ins.error.message);
        const ht = Math.round(data.montant_ht * 100) / 100;
        const tva = att.autoliquidation ? 0 : Math.round(ht * 20) / 100;
        Object.assign(patch, { total_ht: ht, total_tva: tva, total_ttc: Math.round((ht + tva) * 100) / 100 });
      }
    }
    const up = await context.supabase.from("attachements_travaux").update(patch).eq("id", att.id);
    if (up.error) throw new Error(up.error.message);
    return convertirEnFacture(context, { id: att.id });
  });

export const changerStatutAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["annuler", "reactiver"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("attachements_travaux").select("id, facture_id, sent_at").eq("id", data.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (data.action === "annuler") {
      const blocage = blocageAnnulation(existing.data);
      if (blocage) throw new Error(blocage);
    }
    const statut = data.action === "annuler" ? "annule" : (existing.data.sent_at ? "envoye" : "brouillon");
    const { error } = await context.supabase.from("attachements_travaux").update({ statut }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { statut };
  });

/** Construit le contenu de l'email groupé (une ligne par attachement). */
async function preparerEmailGroupe(supabase: any, liste: any[]) {
  const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
  const message = await messageAdaptif(supabase, liste[0]);
  const lignes = await Promise.all(liste.map(async (a: any) => {
    const it = await supabase.from("attachement_items").select("description").eq("attachement_id", a.id).order("ordre").limit(1);
    const desc = String(it.data?.[0]?.description ?? "");
    const client = desc.split(" — ")[0]?.replace(/^\d{2}\/\d{2}\/\d{4} · /, "") || a.objet || a.numero;
    return { client, numero: a.numero, total_ht: Number(a.total_ht), lien: `${base}/attachement/${a.public_token}` };
  }));
  const semaine = /semaine S(\d+)/.exec(message)?.[0] ?? liste[0].numero_ticket;
  return {
    destinataire: liste[0].client_nom,
    semaine: semaine.replace(/^semaine /, "semaine "),
    message: message.replace(/^Bonjour, /, "").replace("l'attachement", "les attachements").replace("sur le lien ci-dessus", "ci-dessous"),
    lignes,
    lien_global: `${base}/attachements-lot/${liste.map((a: any) => a.public_token).join(".")}?m=${encodeURIComponent(message)}`,
    total_ht: lignes.reduce((s, l) => s + l.total_ht, 0),
  };
}

/** Un seul email pour tous les attachements de la semaine (un lien par client). */
export const envoyerAttachementsGroupes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux").select("*").in("id", data.ids).order("numero");
    if (error) throw new Error(error.message);
    const liste = rows ?? [];
    if (!liste.length) throw new Error("Aucun attachement à envoyer.");
    const email = liste[0].client_email;
    const emails = new Set(liste.map((a: any) => String(a.client_email ?? "").trim().toLowerCase()));
    if (emails.size > 1) throw new Error("Ces attachements concernent plusieurs destinataires. Cochez seulement ceux d’un même donneur d’ordre.");
    if (!email) throw new Error("Ajoutez l’adresse e-mail du chargé d’affaires ENSIO.");
    const templateData = await preparerEmailGroupe(context.supabase, liste);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const result = await sendTemplateEmail("attachements-semaine", email, {
      copieEnsio: await resoudreCopieEnsio(context.supabase, email, liste[0].client_nom),
      idempotencyKey: `attachements-semaine-${data.ids.join("-").slice(0, 80)}-${new Date().toISOString()}`,
      templateData,
    });
    if (result.sent) {
      const ids = liste.map((a: any) => a.id); const now = new Date().toISOString();
      await context.supabase.from("attachements_travaux").update({ sent_at: now }).in("id", ids);
      // Ne jamais rétrograder un attachement accepté ou facturé lors d'un renvoi groupé.
      await context.supabase.from("attachements_travaux").update({ statut: "envoye" }).in("id", ids).in("statut", ["brouillon", "envoye", "refuse"]);
    }
    return { ...result, nb: templateData.lignes.length };
  });

/** Renvoie à l'équipe (contacts@) la copie d'attachements déjà envoyés. Aucun envoi client, aucun changement de statut. */
export const copieEquipeAttachements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux").select("*").in("id", data.ids).order("numero");
    if (error) throw new Error(error.message);
    const liste = (rows ?? []).filter((a: any) => a.sent_at);
    if (!liste.length) throw new Error("Aucun attachement envoyé parmi la sélection.");
    const templateData = await preparerEmailGroupe(context.supabase, liste);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("attachements-semaine", "contacts@irvetechnologie.fr", {
      idempotencyKey: `attachements-copie-equipe-${data.ids.join("-").slice(0, 80)}-${new Date().toISOString()}`,
      templateData: { ...templateData, message: `Copie équipe — ${templateData.message}` },
    });
    return { ...result, nb: templateData.lignes.length };
  });
