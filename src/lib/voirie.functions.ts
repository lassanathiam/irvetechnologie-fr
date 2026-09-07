import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "voirie-docs";
const MAX_BYTES = 8_000_000;

export const VOIRIE_STATUTS = [
  { v: "non_necessaire", l: "Non nécessaire" },
  { v: "en_attente", l: "En attente" },
  { v: "obtenue", l: "Obtenue" },
  { v: "refusee", l: "Refusée" },
] as const;

const saveSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  rendezvous_id: z.string().uuid(),
  statut: z.enum(["non_necessaire", "en_attente", "obtenue", "refusee"]).default("en_attente"),
  reference: z.string().trim().max(120).optional().nullable(),
  autorite: z.string().trim().max(160).optional().nullable(),
  date_demande: z.string().trim().max(20).optional().nullable(),
  date_obtention: z.string().trim().max(20).optional().nullable(),
  date_fin: z.string().trim().max(20).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  /** data:<mime>;base64,... — remplace le document joint (PDF ou image). */
  data_url: z.string().max(11_000_000).optional().nullable(),
  file_name: z.string().trim().max(200).optional().nullable(),
});

export type VoirieInput = z.input<typeof saveSchema>;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(application\/pdf|image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl,
  );
  if (!match) throw new Error("Format non supporté. Joignez un PDF, JPG, PNG ou WEBP.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > MAX_BYTES) throw new Error("Document trop lourd (8 Mo maximum).");
  return { bytes, contentType };
}

const emptyToNull = (v: string | null | undefined) => (v && v.length ? v : null);

/** Autorisations de voirie de tous les chantiers, avec lien de téléchargement signé. */
export const listVoirie = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("voirie_autorisations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const paths = rows.map((r) => r.document_path).filter(Boolean) as string[];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await context.supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 60 * 60 * 12);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    return rows.map((r) => ({
      ...r,
      url: r.document_path ? (urls.get(r.document_path) ?? null) : null,
    }));
  });

/** Création ou mise à jour d'une autorisation de voirie. */
export const saveVoirie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    let documentPath: string | undefined;
    if (data.data_url) {
      const { bytes, contentType } = decodeDataUrl(data.data_url);
      const ext = EXT[contentType] ?? "bin";
      documentPath = `${data.rendezvous_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await context.supabase.storage
        .from(BUCKET)
        .upload(documentPath, bytes, { contentType, upsert: false });
      if (upErr) throw new Error(`Envoi du document impossible : ${upErr.message}`);
    }

    const payload = {
      rendezvous_id: data.rendezvous_id,
      statut: data.statut,
      reference: emptyToNull(data.reference),
      autorite: emptyToNull(data.autorite),
      date_demande: emptyToNull(data.date_demande),
      date_obtention: emptyToNull(data.date_obtention),
      date_fin: emptyToNull(data.date_fin),
      notes: emptyToNull(data.notes),
      ...(documentPath ? { document_path: documentPath } : {}),
    };

    if (data.id) {
      const { data: prev } = await context.supabase
        .from("voirie_autorisations")
        .select("document_path")
        .eq("id", data.id)
        .maybeSingle();
      const { error } = await context.supabase
        .from("voirie_autorisations")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      if (documentPath && prev?.document_path) {
        await context.supabase.storage.from(BUCKET).remove([prev.document_path]);
      }
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("voirie_autorisations")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteVoirie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("voirie_autorisations")
      .select("document_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase
      .from("voirie_autorisations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.document_path) {
      await context.supabase.storage.from(BUCKET).remove([row.document_path]);
    }
    return { ok: true };
  });
