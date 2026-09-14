import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const NOTIF_LABELS: Record<string, string> = {
  devis_accepte: "Devis accepté",
  rdv_confirme: "Rendez-vous confirmé",
  rdv_refuse: "Créneau refusé",
  demande: "Nouvelle demande",
  partenaire_dossier: "Dossier partenaire",
  partenaire_montant: "Montant proposé",
  chantier_termine: "Chantier terminé",
  photos_telechargees: "Photos téléchargées",
};

/** Liste la boîte de réception de l'équipe (100 derniers événements). */
export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { type?: string | null; non_lues?: boolean }) =>
    z
      .object({
        type: z.string().trim().max(40).optional().nullable(),
        non_lues: z.boolean().default(false),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .select("id, type, titre, message, lien, montant, lu_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.type) query = query.eq("type", data.type);
    if (data.non_lues) query = query.is("lu_at", null);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Nombre d'événements non lus, pour la pastille du menu. */
export const compterNotificationsNonLues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("lu_at", null);
    return { nb: count ?? 0 };
  });

export const marquerNotificationLue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; lu: boolean }) =>
    z.object({ id: z.string().uuid(), lu: z.boolean().default(true) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ lu_at: data.lu ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const marquerToutesNotificationsLues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ lu_at: new Date().toISOString() })
      .is("lu_at", null);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Adresse e-mail de rappel (facultative) pour recevoir aussi les alertes. */
export const getEmailRappel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("valeur")
      .eq("cle", "email_rappel")
      .maybeSingle();
    return { email: data?.valeur ?? "" };
  });

export const setEmailRappel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { email: string }) =>
    z
      .object({
        email: z.union([z.literal(""), z.string().trim().email().max(160)]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ cle: "email_rappel", valeur: data.email || null }, { onConflict: "cle" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
