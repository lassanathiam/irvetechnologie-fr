import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STATUTS = ["brouillon", "envoyee", "payee", "annulee"] as const;

export const listFactures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("factures")
      .select(
        "id, numero, client_nom, objet, statut, total_ht, total_ttc, date_emission, date_echeance, sent_at, paid_at, devis_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getFacture = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: facture, error } = await context.supabase
      .from("factures")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!facture) throw new Error("Facture introuvable");
    const { data: items, error: itemsError } = await context.supabase
      .from("facture_items")
      .select("*")
      .eq("facture_id", data.id)
      .order("ordre", { ascending: true });
    if (itemsError) throw new Error(itemsError.message);
    return { facture, items: items ?? [] };
  });

export const updateFactureStatut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; statut: string }) =>
    z.object({ id: z.string().uuid(), statut: z.enum(STATUTS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("factures")
      .update({
        statut: data.statut,
        paid_at: data.statut === "payee" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateFactureDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; date_emission: string; date_echeance: string }) =>
    z
      .object({
        id: z.string().uuid(),
        date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("factures")
      .update({ date_emission: data.date_emission, date_echeance: data.date_echeance })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("factures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const envoyerFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; message?: string | null }) =>
    z
      .object({ id: z.string().uuid(), message: z.string().trim().max(2000).optional().nullable() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: facture, error } = await context.supabase
      .from("factures")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!facture) throw new Error("Facture introuvable");
    if (!facture.client_email) throw new Error("Cette facture n'a pas d'adresse email client.");

    const { data: items } = await context.supabase
      .from("facture_items")
      .select("*")
      .eq("facture_id", data.id)
      .order("ordre", { ascending: true });

    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(
      /\/$/,
      "",
    );
    const lien = `${base}/facture-client/${facture.public_token}`;

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("devis-client", facture.client_email, {
      idempotencyKey: `facture-${facture.id}-${new Date().toISOString()}`,
      replyTo: "contacts@irvetechnologie.fr",
      templateData: {
        type: "facture",
        numero: facture.numero,
        client_nom: facture.client_nom,
        objet: facture.objet,
        date_emission: facture.date_emission,
        date_limite: facture.date_echeance,
        message: data.message || null,
        lien,
        remise_pct: Number(facture.remise_pct),
        total_ht_brut: Number(facture.total_ht_brut),
        total_remise: Number(facture.total_remise),
        total_ht: Number(facture.total_ht),
        total_tva: Number(facture.total_tva),
        total_ttc: Number(facture.total_ttc),
        acompte_pct: 0,
        conditions_paiement: facture.conditions_paiement,
        items: (items ?? []).map((i) => ({
          libelle: i.libelle,
          description: i.description,
          quantite: Number(i.quantite),
          prix_unitaire: Number(i.prix_unitaire),
          tva: Number(i.tva),
        })),
      },
    });

    if (result.sent) {
      await context.supabase
        .from("factures")
        .update({ sent_at: new Date().toISOString(), statut: "envoyee" })
        .eq("id", data.id);
    }
    return result;
  });
