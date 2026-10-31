import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CATEGORIES_TOTAL } from "./cri-total";

export const getCriTotal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { rdvId: string }) => z.object({ rdvId: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const [rdvQ, criQ, photosQ] = await Promise.all([
      context.supabase.from("rendezvous")
        .select("id, client_nom, adresse, cp_ville, date_debut, termine_at, reseau_client, partenaire, phase_installation, puissance_borne, notes")
        .eq("id", data.rdvId).maybeSingle(),
      context.supabase.from("cri_total").select("*").eq("rendezvous_id", data.rdvId).maybeSingle(),
      context.supabase.from("rendezvous_photos").select("id, path, categorie, created_at")
        .eq("rendezvous_id", data.rdvId).in("categorie", CATEGORIES_TOTAL).order("created_at", { ascending: true }),
    ]);
    if (rdvQ.error) throw new Error("Chantier introuvable.");
    if (!rdvQ.data) throw new Error("Chantier introuvable ou accès refusé.");
    const liste = photosQ.data ?? [];
    let urls: Record<string, string> = {};
    if (liste.length) {
      const { data: signed } = await context.supabase.storage.from("chantier-photos").createSignedUrls(liste.map((p) => p.path), 3600);
      urls = Object.fromEntries((signed ?? []).map((s, i) => [liste[i]!.id, s.signedUrl ?? ""]));
    }
    return {
      rdv: rdvQ.data,
      cri: criQ.data ?? null,
      photos: liste.map((p) => ({ id: p.id, categorie: p.categorie as string, url: urls[p.id] ?? "" })),
    };
  });

export const enregistrerCriTotal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { rdvId: string; valeurs: Record<string, string>; signature_technicien?: string | null; signature_client?: string | null }) =>
    z.object({
      rdvId: z.string().uuid(),
      valeurs: z.record(z.string().max(60), z.string().max(2000)),
      signature_technicien: z.string().max(400_000).nullable().optional(),
      signature_client: z.string().max(400_000).nullable().optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("cri_total").upsert({
      rendezvous_id: data.rdvId,
      valeurs: data.valeurs,
      signature_technicien: data.signature_technicien ?? null,
      signature_client: data.signature_client ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Enregistrement du compte-rendu impossible.");
    return { ok: true as const };
  });
