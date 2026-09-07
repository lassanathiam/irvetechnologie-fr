import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_BYTES = 3_500_000;

const saveSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  titre: z.string().trim().min(1).max(160),
  lieu: z.string().trim().max(160).default(""),
  description: z.string().trim().max(1200).default(""),
  position: z.number().int().min(0).max(999).default(0),
  publie: z.boolean().default(true),
  /** data:image/jpeg;base64,... compressé côté navigateur (optionnel : remplace la photo) */
  data_url: z.string().max(5_000_000).optional().nullable(),
});

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Format non supporté. Utilisez une image JPG, PNG ou WEBP.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > MAX_BYTES) throw new Error("Photo trop lourde (3,5 Mo maximum après compression).");
  return { bytes, contentType };
}

async function signPaths(
  client: { storage: { from: (b: string) => { createSignedUrls: (p: string[], e: number) => Promise<any> } } },
  paths: string[],
) {
  if (!paths.length) return new Map<string, string>();
  const { data } = await client.storage.from("projet-photos").createSignedUrls(paths, 60 * 60 * 12);
  const map = new Map<string, string>();
  for (const s of data ?? []) if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  return map;
}

/** Galerie publique du site (réalisations publiées uniquement). */
export const listPublicRealisations = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("realisations")
    .select("id, titre, lieu, description, photo_path")
    .eq("publie", true)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(30);
  if (error) {
    console.error("realisations publiques", error);
    return [] as { id: string; titre: string; lieu: string; description: string; url: string }[];
  }
  const rows = data ?? [];
  const urls = await signPaths(supabaseAdmin as never, rows.map((r) => r.photo_path).filter(Boolean) as string[]);
  return rows
    .map((r) => ({
      id: r.id,
      titre: r.titre,
      lieu: r.lieu ?? "",
      description: r.description ?? "",
      url: r.photo_path ? (urls.get(r.photo_path) ?? "") : "",
    }))
    .filter((r) => r.url);
});

/** Liste complète pour l'espace pro. */
export const listRealisations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("realisations")
      .select("*")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const urls = await signPaths(
      context.supabase as never,
      rows.map((r) => r.photo_path).filter(Boolean) as string[],
    );
    return rows.map((r) => ({ ...r, url: r.photo_path ? (urls.get(r.photo_path) ?? "") : "" }));
  });

/** Création ou mise à jour d'une réalisation, avec remplacement optionnel de la photo. */
export const saveRealisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    let photoPath: string | undefined;
    let previousPath: string | null = null;

    if (data.id) {
      const { data: existing } = await context.supabase
        .from("realisations")
        .select("photo_path")
        .eq("id", data.id)
        .maybeSingle();
      previousPath = existing?.photo_path ?? null;
    }

    if (data.data_url) {
      const { bytes, contentType } = decodeDataUrl(data.data_url);
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      photoPath = `realisations/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await context.supabase.storage
        .from("projet-photos")
        .upload(photoPath, bytes, { contentType, upsert: false });
      if (upErr) {
        console.error("upload realisation", upErr);
        throw new Error("Envoi de la photo impossible. Réessayez.");
      }
    }

    if (!data.id && !photoPath) throw new Error("Ajoutez une photo pour publier cette réalisation.");

    const payload = {
      titre: data.titre,
      lieu: data.lieu,
      description: data.description,
      position: data.position,
      publie: data.publie,
      ...(photoPath ? { photo_path: photoPath } : {}),
    };

    if (data.id) {
      const { error } = await context.supabase.from("realisations").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      if (photoPath && previousPath) {
        await context.supabase.storage.from("projet-photos").remove([previousPath]);
      }
      return { ok: true as const, id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("realisations")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: inserted.id };
  });

export const deleteRealisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("realisations")
      .select("photo_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("realisations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (existing?.photo_path) {
      await context.supabase.storage.from("projet-photos").remove([existing.photo_path]);
    }
    return { ok: true as const };
  });
