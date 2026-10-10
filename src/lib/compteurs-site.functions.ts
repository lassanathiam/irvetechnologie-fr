import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CompteursBase = { b2c: number; b2b: number; maintenance: number };
export const COMPTEURS_BASE_DEFAUT: CompteursBase = { b2c: 0, b2b: 0, maintenance: 0 };
const CLE = "compteurs_site_base";
const schema = z.object({ b2c: z.coerce.number().int().min(0).max(100000), b2b: z.coerce.number().int().min(0).max(100000), maintenance: z.coerce.number().int().min(0).max(100000) });

function lire(v: string | null | undefined): CompteursBase {
  try { const p = schema.safeParse(JSON.parse(v ?? "")); return p.success ? p.data : COMPTEURS_BASE_DEFAUT; } catch { return COMPTEURS_BASE_DEFAUT; }
}

/** Règle de comptage : chantier terminé ou réalisé ; installation = B2C sauf étiquette « B2B » ; maintenance/SAV/contrôle = maintenance. */
export function compter(rows: { type: string; statut: string; etiquettes: string[] | null }[], base: CompteursBase) {
  const faits = rows.filter((r) => r.statut === "termine" || r.statut === "realise");
  const inst = faits.filter((r) => r.type === "installation");
  const b2b = inst.filter((r) => (r.etiquettes ?? []).some((e) => e.toUpperCase() === "B2B")).length;
  return {
    b2c: base.b2c + inst.length - b2b,
    b2b: base.b2b + b2b,
    maintenance: base.maintenance + faits.filter((r) => ["maintenance", "sav", "controle"].includes(r.type)).length,
  };
}

/** Chiffres publics : seuls des totaux sortent, jamais de données de chantier. */
export const getCompteursPublics = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: rows }, { data: reg }] = await Promise.all([
    supabaseAdmin.from("rendezvous").select("type, statut, etiquettes").in("statut", ["termine", "realise"]).limit(10000),
    supabaseAdmin.from("app_settings").select("valeur").eq("cle", CLE).maybeSingle(),
  ]);
  return compter(rows ?? [], lire(reg?.valeur));
});

export const getCompteursBase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("app_settings").select("valeur").eq("cle", CLE).maybeSingle();
    return lire(data?.valeur);
  });

export const updateCompteursBase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff");
    if (!staff) throw new Error("Accès réservé à l'équipe.");
    const { error } = await context.supabase.from("app_settings").upsert({ cle: CLE, valeur: JSON.stringify(data) }, { onConflict: "cle" });
    if (error) throw new Error(error.message);
    return data;
  });
