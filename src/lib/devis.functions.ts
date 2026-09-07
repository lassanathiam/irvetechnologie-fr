import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeTotals, CONDITIONS_DEFAUT } from "@/lib/billing";

export { computeTotals };
export type { BillingTotals as DevisTotals } from "@/lib/billing";

const itemSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().min(0).max(10000),
  prix_unitaire: z.number().min(0).max(1_000_000),
  tva: z.number().min(0).max(100),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)");

const devisSchema = z.object({
  client_nom: z.string().trim().min(1).max(160),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_adresse: z.string().trim().max(300).optional().nullable(),
  client_cp_ville: z.string().trim().max(160).optional().nullable(),
  objet: z.string().trim().max(200).optional().nullable(),
  date_emission: isoDate,
  date_expiration: isoDate,
  remise_pct: z.number().min(0).max(100),
  acompte_pct: z.number().min(0).max(100),
  conditions_paiement: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(itemSchema).min(1).max(50),
  rendezvous_id: z.string().uuid().optional().nullable(),
});

export type DevisInput = z.infer<typeof devisSchema>;

const STATUTS = [
  "brouillon",
  "a_valider",
  "envoye",
  "accepte",
  "refuse",
  "expire",
] as const;

export const listPrestations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prestations")
      .select("*")
      .eq("actif", true)
      .order("ordre", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listDevis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("devis")
      .select(
        "id, numero, client_nom, objet, statut, total_ht, total_ttc, date_emission, date_expiration, sent_at, facture_id, rendezvous_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDevis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: devis, error } = await context.supabase
      .from("devis")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!devis) throw new Error("Devis introuvable");
    const { data: items, error: itemsError } = await context.supabase
      .from("devis_items")
      .select("*")
      .eq("devis_id", data.id)
      .order("ordre", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);
    return { devis, items: items ?? [] };
  });

async function nextNumero(
  supabase: { from: (t: string) => any },
  table: "devis" | "factures",
  prefix: string,
  start: number,
) {
  const { data } = await supabase
    .from(table)
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);
  const last = data?.[0]?.numero ? Number(String(data[0].numero).slice(prefix.length)) : start;
  const next = (Number.isFinite(last) ? last : start) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export const createDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => devisSchema.parse(data))
  .handler(async ({ data, context }) => {
    const year = Number(data.date_emission.slice(0, 4));
    const numero = await nextNumero(context.supabase as any, "devis", `D-${year}-`, 277);
    const totals = computeTotals(data.items, data.remise_pct);

    const { data: inserted, error } = await context.supabase
      .from("devis")
      .insert({
        numero,
        client_nom: data.client_nom,
        client_email: data.client_email ?? null,
        client_telephone: data.client_telephone ?? null,
        client_adresse: data.client_adresse ?? null,
        client_cp_ville: data.client_cp_ville ?? null,
        objet: data.objet ?? null,
        date_emission: data.date_emission,
        date_expiration: data.date_expiration,
        remise_pct: data.remise_pct,
        acompte_pct: data.acompte_pct,
        conditions_paiement: data.conditions_paiement || CONDITIONS_DEFAUT,
        notes: data.notes ?? null,
        rendezvous_id: data.rendezvous_id ?? null,
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        created_by: context.userId,
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase.from("devis_items").insert(
      data.items.map((item, index) => ({
        devis_id: inserted.id,
        libelle: item.libelle,
        description: item.description ?? null,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        tva: item.tva,
        ordre: index + 1,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    return { id: inserted.id, numero: inserted.numero };
  });

export const updateDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    devisSchema.extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const totals = computeTotals(data.items, data.remise_pct);
    const { error } = await context.supabase
      .from("devis")
      .update({
        client_nom: data.client_nom,
        client_email: data.client_email ?? null,
        client_telephone: data.client_telephone ?? null,
        client_adresse: data.client_adresse ?? null,
        client_cp_ville: data.client_cp_ville ?? null,
        objet: data.objet ?? null,
        date_emission: data.date_emission,
        date_expiration: data.date_expiration,
        remise_pct: data.remise_pct,
        acompte_pct: data.acompte_pct,
        conditions_paiement: data.conditions_paiement || CONDITIONS_DEFAUT,
        notes: data.notes ?? null,
        rendezvous_id: data.rendezvous_id ?? null,
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("devis_items").delete().eq("devis_id", data.id);
    const { error: itemsError } = await context.supabase.from("devis_items").insert(
      data.items.map((item, index) => ({
        devis_id: data.id,
        libelle: item.libelle,
        description: item.description ?? null,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        tva: item.tva,
        ordre: index + 1,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
    return { id: data.id };
  });

export const updateStatutDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; statut: string }) =>
    z.object({ id: z.string().uuid(), statut: z.enum(STATUTS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("devis")
      .update({ statut: data.statut })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Envoie le devis par email au client depuis la plateforme. */
export const envoyerDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; message?: string | null }) =>
    z
      .object({ id: z.string().uuid(), message: z.string().trim().max(2000).optional().nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: devis, error } = await context.supabase
      .from("devis")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!devis) throw new Error("Devis introuvable");
    if (!devis.client_email) throw new Error("Ce devis n'a pas d'adresse email client.");

    const { data: items } = await context.supabase
      .from("devis_items")
      .select("*")
      .eq("devis_id", data.id)
      .order("ordre", { ascending: true });

    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(
      /\/$/,
      "",
    );
    const lien = `${base}/devis-client/${devis.public_token}`;

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("devis-client", devis.client_email, {
      idempotencyKey: `devis-${devis.id}-${new Date().toISOString()}`,
      replyTo: "contacts@irvetechnologie.fr",
      templateData: {
        type: "devis",
        numero: devis.numero,
        client_nom: devis.client_nom,
        objet: devis.objet,
        date_emission: devis.date_emission,
        date_limite: devis.date_expiration,
        message: data.message || null,
        lien,
        remise_pct: Number(devis.remise_pct),
        total_ht_brut: Number(devis.total_ht_brut),
        total_remise: Number(devis.total_remise),
        total_ht: Number(devis.total_ht),
        total_tva: Number(devis.total_tva),
        total_ttc: Number(devis.total_ttc),
        acompte_pct: Number(devis.acompte_pct),
        conditions_paiement: devis.conditions_paiement,
        items: (items ?? []).map((i) => ({
          libelle: i.libelle,
          description: i.description,
          quantite: Number(i.quantite),
          prix_unitaire: Number(i.prix_unitaire),
          tva: Number(i.tva),
        })),
      },
    });

    await context.supabase.from("devis_envois").insert({
      devis_id: devis.id,
      destinataire: devis.client_email,
      message: data.message || null,
      resultat: result.sent ? "envoye" : "bloque",
      created_by: context.userId,
    });

    if (result.sent) {
      await context.supabase
        .from("devis")
        .update({ sent_at: new Date().toISOString(), statut: "envoye" })
        .eq("id", data.id);
    }
    return { ...result, lien };
  });

/** Historique des envois email d'un devis. */
export const listEnvoisDevis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("devis_envois")
      .select("id, destinataire, message, resultat, created_at")
      .eq("devis_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Convertit un devis accepté en facture (copie des lignes et des totaux). */
export const convertirEnFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: devis, error } = await context.supabase
      .from("devis")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!devis) throw new Error("Devis introuvable");
    if (devis.facture_id) return { id: devis.facture_id as string, existing: true };

    const { data: items } = await context.supabase
      .from("devis_items")
      .select("*")
      .eq("devis_id", data.id)
      .order("ordre", { ascending: true });

    const today = new Date();
    const year = today.getFullYear();
    const numero = await nextNumero(context.supabase as any, "factures", `F-${year}-`, 0);
    const echeance = new Date(today);
    echeance.setDate(echeance.getDate() + 30);

    const { data: facture, error: insertError } = await context.supabase
      .from("factures")
      .insert({
        devis_id: devis.id,
        numero,
        date_emission: today.toISOString().slice(0, 10),
        date_echeance: echeance.toISOString().slice(0, 10),
        client_nom: devis.client_nom,
        client_email: devis.client_email,
        client_telephone: devis.client_telephone,
        client_adresse: devis.client_adresse,
        client_cp_ville: devis.client_cp_ville,
        objet: devis.objet,
        remise_pct: devis.remise_pct,
        acompte_pct: devis.acompte_pct,
        conditions_paiement: devis.conditions_paiement,
        notes: devis.notes,
        total_ht_brut: devis.total_ht_brut,
        total_remise: devis.total_remise,
        total_ht: devis.total_ht,
        total_tva: devis.total_tva,
        total_ttc: devis.total_ttc,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    if ((items ?? []).length > 0) {
      const { error: itemsError } = await context.supabase.from("facture_items").insert(
        (items ?? []).map((item, index) => ({
          facture_id: facture.id,
          libelle: item.libelle,
          description: item.description,
          quantite: item.quantite,
          prix_unitaire: item.prix_unitaire,
          tva: item.tva,
          ordre: index + 1,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    }

    await context.supabase
      .from("devis")
      .update({ facture_id: facture.id, statut: "accepte" })
      .eq("id", devis.id);

    return { id: facture.id as string, existing: false };
  });
