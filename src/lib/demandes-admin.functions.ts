import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEMANDE_STATUTS = ["nouveau", "en_cours", "accepte", "refuse", "clos"] as const;

/** Change le statut d'une demande client (nouveau → accepté → devisé…). */
export const updateStatutDemande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; status: string }) =>
    z.object({ id: z.string().uuid(), status: z.enum(DEMANDE_STATUTS) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("demande_requests")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Récupère les coordonnées d'une demande pour préremplir un devis. */
export const getDemandeClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("demande_requests")
      .select(
        "id, nom, email, telephone, code_postal, type_bien, puissance, type_installation, distance_m, abonnement_kva, type_compteur, phase, notes, formule, status",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Demande introuvable.");
    return row;
  });
