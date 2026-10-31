import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { CATEGORIES_TOTAL } from "./cri-total";

const TOTAL = new Set<string>(CATEGORIES_TOTAL);

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
        .eq("rendezvous_id", data.rdvId).order("created_at", { ascending: true }),
    ]);
    if (rdvQ.error) throw new Error("Chantier introuvable.");
    if (!rdvQ.data) throw new Error("Chantier introuvable ou accès refusé.");
    const toutes = photosQ.data ?? [];
    const liste = toutes;
    let urls: Record<string, string> = {};
    if (liste.length) {
      const { data: signed } = await context.supabase.storage.from("chantier-photos").createSignedUrls(liste.map((p) => p.path), 3600);
      urls = Object.fromEntries((signed ?? []).map((s, i) => [liste[i]!.id, s.signedUrl ?? ""]));
    }
    return {
      rdv: rdvQ.data,
      cri: criQ.data ?? null,
      photos: liste.filter((p) => TOTAL.has(p.categorie as string)).map((p) => ({ id: p.id, categorie: p.categorie as string, url: urls[p.id] ?? "" })),
      // Photos déjà prises dans le dossier du chantier (retour travaux, autres étapes), réutilisables dans le PV.
      dossier: (() => {
        const vus = new Set<string>();
        return [...liste].reverse().filter((p) => { if (vus.has(p.path)) return false; vus.add(p.path); return true; })
          .map((p) => ({ id: p.id, categorie: p.categorie as string, url: urls[p.id] ?? "" }));
      })(),
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

/** Place une photo déjà présente dans le dossier du chantier dans une case du PV Total (sans la recopier). */
export const attribuerPhotoCri = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { rdvId: string; photoId: string; categorie: string }) =>
    z.object({ rdvId: z.string().uuid(), photoId: z.string().uuid(), categorie: z.string().refine((c) => TOTAL.has(c)) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: src } = await context.supabase.from("rendezvous_photos").select("path, rendezvous_id")
      .eq("id", data.photoId).eq("rendezvous_id", data.rdvId).maybeSingle();
    if (!src) throw new Error("Photo introuvable dans ce chantier.");
    const { data: deja } = await context.supabase.from("rendezvous_photos").select("id")
      .eq("rendezvous_id", data.rdvId).eq("path", src.path).eq("categorie", data.categorie).maybeSingle();
    if (deja) return { ok: true as const };
    const { error } = await context.supabase.from("rendezvous_photos")
      .insert({ rendezvous_id: data.rdvId, path: src.path, categorie: data.categorie, source: "equipe" });
    if (error) throw new Error("Impossible de placer la photo dans le PV.");
    return { ok: true as const };
  });
