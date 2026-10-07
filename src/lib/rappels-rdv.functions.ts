import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rendez-vous d'aujourd'hui et de demain (heure de Paris), non annulés ni archivés. */
export const listRappelsRdv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    debut.setTime(debut.getTime() - 3 * 3600_000);
    const fin = new Date(Date.now() + 2 * 86400_000);
    const { data, error } = await context.supabase
      .from("rendezvous")
      .select("id, titre, client_nom, adresse, cp_ville, date_debut, technicien, statut, date_a_confirmer")
      .eq("archive", false)
      .neq("statut", "annule")
      .gte("date_debut", debut.toISOString())
      .lte("date_debut", fin.toISOString())
      .order("date_debut", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
