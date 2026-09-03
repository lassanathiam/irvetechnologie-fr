import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const checkState = z.enum(["ok", "nc", "na"]);

const rapportSchema = z.object({
  type: z.enum(["controle", "conformite", "assurance"]),
  date_intervention: z.string().min(4).max(20),
  client_nom: z.string().trim().min(1).max(160),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_email: z.string().trim().max(255).optional().nullable(),
  chantier_adresse: z.string().trim().max(300).optional().nullable(),
  chantier_cp_ville: z.string().trim().max(160).optional().nullable(),
  borne_marque: z.string().trim().max(120).optional().nullable(),
  borne_modele: z.string().trim().max(120).optional().nullable(),
  borne_puissance: z.string().trim().max(60).optional().nullable(),
  borne_serie: z.string().trim().max(120).optional().nullable(),
  technicien: z.string().trim().max(160).optional().nullable(),
  mesures: z.record(z.string(), z.string().max(60)),
  checklist: z.record(z.string(), checkState),
  observations: z.string().trim().max(4000).optional().nullable(),
  reserves: z.string().trim().max(4000).optional().nullable(),
  signature_technicien: z.string().max(400_000).optional().nullable(),
  signature_client: z.string().max(400_000).optional().nullable(),
  signataire_client: z.string().trim().max(160).optional().nullable(),
});

export type RapportInput = z.infer<typeof rapportSchema>;

export const listRapports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rapports")
      .select("id, numero, type, client_nom, chantier_cp_ville, date_intervention, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getRapport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rapport, error } = await context.supabase
      .from("rapports")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rapport) throw new Error("Rapport introuvable");
    return rapport;
  });

export const createRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rapportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const year = new Date().getFullYear();
    const prefix =
      data.type === "controle" ? `RC-${year}-` : data.type === "assurance" ? `RA-${year}-` : `RI-${year}-`;
    const { data: last } = await context.supabase
      .from("rapports")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    const lastNum = last?.[0]?.numero ? Number(last[0].numero.slice(prefix.length)) : 0;
    const numero = `${prefix}${String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, "0")}`;

    const { data: inserted, error } = await context.supabase
      .from("rapports")
      .insert({
        user_id: context.userId,
        numero,
        type: data.type,
        date_intervention: data.date_intervention,
        client_nom: data.client_nom,
        client_telephone: data.client_telephone ?? null,
        client_email: data.client_email ?? null,
        chantier_adresse: data.chantier_adresse ?? null,
        chantier_cp_ville: data.chantier_cp_ville ?? null,
        borne_marque: data.borne_marque ?? null,
        borne_modele: data.borne_modele ?? null,
        borne_puissance: data.borne_puissance ?? null,
        borne_serie: data.borne_serie ?? null,
        technicien: data.technicien ?? null,
        mesures: data.mesures,
        checklist: data.checklist,
        observations: data.observations ?? null,
        reserves: data.reserves ?? null,
        signature_technicien: data.signature_technicien ?? null,
        signature_client: data.signature_client ?? null,
        signataire_client: data.signataire_client ?? null,
      })
      .select("id, numero")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const deleteRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rapports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const photoSchema = z.object({
  rapport_id: z.string().uuid(),
  kind: z.enum(["borne", "raccordement", "tableau", "etiquette"]),
  data_url: z.string().max(4_500_000),
});

function decodeDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image non supporté.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > 3_500_000) throw new Error("Photo trop lourde.");
  return { bytes, contentType };
}

/** Ajoute une photo justificative au rapport (bucket privé). */
export const uploadRapportPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => photoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rapport, error: readError } = await context.supabase
      .from("rapports")
      .select("id, photos")
      .eq("id", data.rapport_id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!rapport) throw new Error("Rapport introuvable");

    const existing = Array.isArray(rapport.photos)
      ? (rapport.photos as { kind: string; path: string }[])
      : [];
    if (existing.length >= 12) throw new Error("Nombre de photos maximum atteint.");

    const { bytes, contentType } = decodeDataUrl(data.data_url);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${data.rapport_id}/${data.kind}-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("rapport-photos")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) throw new Error("Envoi de la photo impossible.");

    const photos = [...existing.filter((p) => p.kind !== data.kind), { kind: data.kind, path }];
    const { error: updateError } = await context.supabase
      .from("rapports")
      .update({ photos })
      .eq("id", data.rapport_id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const, path };
  });

/** URLs signées pour afficher les photos du rapport. */
export const getRapportPhotoUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ paths: z.array(z.string().max(300)).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!data.paths.length) return [] as { path: string; url: string }[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("rapport-photos")
      .createSignedUrls(data.paths, 60 * 60);
    if (error) throw new Error(error.message);
    return (signed ?? [])
      .filter((s) => s.signedUrl)
      .map((s) => ({ path: s.path ?? "", url: s.signedUrl! }));
  });
