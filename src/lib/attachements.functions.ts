import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "@/lib/billing";

const lineSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().positive().max(100000),
  prix_unitaire: z.number().min(0).max(1_000_000),
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

export const listAttachements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attachements_travaux")
      .select("id, numero, client_nom, numero_ticket, numero_affaire, bon_commande, statut, total_ht, total_tva, total_ttc, autoliquidation, date_emission, facture_id")
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);
    return data ?? [];
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
    return { attachement: result.data, items: lines.data ?? [] };
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
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", id);
    if (del.error) throw new Error(del.error.message);
    const { error: lineError } = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
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
    const result = await sendTemplateEmail("attachement-travaux", attachment.client_email, {
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
        message: data.message ?? null,
        lien: link,
      },
    });
    if (result.sent) {
      await context.supabase.from("attachements_travaux").update({ sent_at: new Date().toISOString(), statut: "envoye" }).eq("id", attachment.id);
    }
    return { ...result, lien: link };
  });

export const convertirAttachementEnFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
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
      created_by: context.userId,
    }).select("id").single();
    if (invoiceError) throw new Error(invoiceError.message);
    if ((items ?? []).length) {
      const inserted = await context.supabase.from("facture_items").insert((items ?? []).map((item, index) => ({
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
  });
