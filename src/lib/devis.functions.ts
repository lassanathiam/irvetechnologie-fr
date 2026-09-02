import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type DevisTotals = {
  total_ht: number;
  remise: number;
  total_ht_net: number;
  total_tva: number;
  total_ttc: number;
};

const itemSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().min(0).max(10000),
  prix_unitaire: z.number().min(0).max(1_000_000),
  tva: z.number().min(0).max(100),
});

const devisSchema = z.object({
  client_nom: z.string().trim().min(1).max(160),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_adresse: z.string().trim().max(300).optional().nullable(),
  client_cp_ville: z.string().trim().max(160).optional().nullable(),
  objet: z.string().trim().max(200).optional().nullable(),
  remise_pct: z.number().min(0).max(100),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(itemSchema).min(1).max(50),
});

export function computeTotals(
  items: { quantite: number; prix_unitaire: number; tva: number }[],
  remisePct: number,
): DevisTotals {
  const round = (n: number) => Math.round(n * 100) / 100;
  const total_ht = round(items.reduce((s, i) => s + i.quantite * i.prix_unitaire, 0));
  const remise = round((total_ht * remisePct) / 100);
  const total_ht_net = round(total_ht - remise);
  const factor = total_ht > 0 ? total_ht_net / total_ht : 1;
  const total_tva = round(
    items.reduce((s, i) => s + i.quantite * i.prix_unitaire * factor * (i.tva / 100), 0),
  );
  return { total_ht, remise, total_ht_net, total_tva, total_ttc: round(total_ht_net + total_tva) };
}

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
      .select("id, numero, client_nom, objet, statut, total_ttc, date_emission, sent_at")
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

export const createDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => devisSchema.parse(data))
  .handler(async ({ data, context }) => {
    const year = new Date().getFullYear();
    const prefix = `D-${year}-`;
    const { data: last } = await context.supabase
      .from("devis")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    const lastNum = last?.[0]?.numero ? Number(last[0].numero.slice(prefix.length)) : 277;
    const numero = `${prefix}${String((Number.isFinite(lastNum) ? lastNum : 277) + 1).padStart(4, "0")}`;

    const totals = computeTotals(data.items, data.remise_pct);
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30);

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
        remise_pct: data.remise_pct,
        notes: data.notes ?? null,
        date_expiration: expiration.toISOString().slice(0, 10),
        total_ht: totals.total_ht_net,
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

export const deleteDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
