import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const KINDS = ["tableau", "linky", "cheminement", "borne"] as const;

const uploadSchema = z.object({
  demande_id: z.string().uuid(),
  kind: z.enum(KINDS),
  /** data:image/jpeg;base64,... — compressed client-side */
  data_url: z.string().max(4_500_000),
});

const MAX_PHOTOS_PER_DEMANDE = 12;
const UPLOAD_WINDOW_MS = 60 * 60 * 1000; // photos acceptées jusqu'à 1h après la demande

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image non supporté.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > 3_500_000) throw new Error("Photo trop lourde.");
  return { bytes, contentType };
}

/** Upload public (le client vient de créer sa demande) — contrôlé côté serveur. */
export const uploadDemandePhoto = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: demande, error: demandeError } = await supabaseAdmin
      .from("demande_requests")
      .select("id, created_at")
      .eq("id", data.demande_id)
      .maybeSingle();
    if (demandeError) throw new Error("Envoi impossible.");
    if (!demande) throw new Error("Demande introuvable.");
    if (Date.now() - new Date(demande.created_at).getTime() > UPLOAD_WINDOW_MS) {
      throw new Error("Délai d'envoi des photos dépassé.");
    }

    const { count } = await supabaseAdmin
      .from("demande_photos")
      .select("id", { count: "exact", head: true })
      .eq("demande_id", data.demande_id);
    if ((count ?? 0) >= MAX_PHOTOS_PER_DEMANDE) throw new Error("Nombre de photos maximum atteint.");

    const { bytes, contentType } = decodeDataUrl(data.data_url);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${data.demande_id}/${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("demande-photos")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) {
      console.error("photo upload error", uploadError);
      throw new Error("Envoi de la photo impossible.");
    }

    const { error: insertError } = await supabaseAdmin
      .from("demande_photos")
      .insert({ demande_id: data.demande_id, kind: data.kind, path });
    if (insertError) console.error("photo row error", insertError);

    return { ok: true as const, path };
  });

/** Boîte de réception interne : demandes + nombre de photos. */
export const listDemandes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("demande_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const { data: photos } = await context.supabase
      .from("demande_photos")
      .select("demande_id, kind, path, created_at");
    return rows.map((r) => ({
      ...r,
      photos: (photos ?? []).filter((p) => p.demande_id === r.id),
    }));
  });

/** URLs signées (bucket privé) pour afficher/télécharger les photos. */
export const getPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paths: z.array(z.string().max(300)).max(50) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!data.paths.length) return [] as { path: string; url: string }[];
    const { data: signed, error } = await context.supabase.storage
      .from("demande-photos")
      .createSignedUrls(data.paths, 60 * 60);
    if (error) throw new Error(error.message);
    return (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => ({ path: s.path ?? "", url: s.signedUrl! }));
  });
