import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { concerneEnsio, copieDistincte } from "./copie-ensio";

export async function resoudreCopieEnsio(supabase: SupabaseClient<Database>, principal: string, identite?: string | null) {
  if (!concerneEnsio(principal, identite)) return null;
  const { data, error } = await supabase.from("partenaires").select("email_copie")
    .eq("actif", true).eq("type", "donneur_ordre").ilike("nom", "ENSIO").maybeSingle();
  if (error) throw new Error(error.message);
  return copieDistincte(principal, data?.email_copie);
}