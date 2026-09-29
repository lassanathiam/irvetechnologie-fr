import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type TarifsSite = {
  installation_ttc: number;
  maintenance_ttc: number;
  depannage_ttc: number;
};

export const TARIFS_SITE_DEFAUT: TarifsSite = {
  installation_ttc: 1290,
  maintenance_ttc: 149,
  depannage_ttc: 150,
};

const CLE = "tarifs_site_public";
const schema = z.object({
  installation_ttc: z.coerce.number().min(0).max(100_000),
  maintenance_ttc: z.coerce.number().min(0).max(100_000),
  depannage_ttc: z.coerce.number().min(0).max(100_000),
});

function lireTarifs(valeur: string | null | undefined): TarifsSite {
  if (!valeur) return TARIFS_SITE_DEFAUT;
  try {
    const parsed = schema.safeParse(JSON.parse(valeur));
    return parsed.success ? parsed.data : TARIFS_SITE_DEFAUT;
  } catch {
    return TARIFS_SITE_DEFAUT;
  }
}

export const getTarifsSitePublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("app_settings")
    .select("valeur")
    .eq("cle", CLE)
    .maybeSingle();
  if (error) return TARIFS_SITE_DEFAUT;
  return lireTarifs(data?.valeur);
});

export const getTarifsSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("valeur")
      .eq("cle", CLE)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return lireTarifs(data?.valeur);
  });

export const updateTarifsSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ cle: CLE, valeur: JSON.stringify(data) }, { onConflict: "cle" });
    if (error) throw new Error(error.message);
    return data;
  });