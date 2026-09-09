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

/** Suppression définitive d'une demande (refusée ou classée sans suite). */
export const supprimerDemande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("demande_requests")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Purge groupée des demandes refusées / classées de plus de N mois. */
export const purgerDemandesRefusees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { mois?: number }) =>
    z.object({ mois: z.number().int().min(1).max(60).default(6) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limite = new Date();
    limite.setMonth(limite.getMonth() - data.mois);
    const { data: rows, error } = await context.supabase
      .from("demande_requests")
      .delete()
      .in("status", ["refuse", "clos"])
      .lt("created_at", limite.toISOString())
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true, nb: rows?.length ?? 0 };
  });
