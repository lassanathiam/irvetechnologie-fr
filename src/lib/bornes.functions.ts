import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BORNES_CATALOGUE, type BorneCatalogue } from "@/lib/bornes-catalogue";

export type Borne = {
  id: string;
  slug: string;
  nom: string;
  puissance: string;
  phase: string;
  atout: string;
  usage: string;
  badge: string | null;
  vedette: boolean;
  photo_path: string | null;
  prix_ttc: number | null;
  ordre: number;
  actif: boolean;
};

/** URL publique permanente de la photo d'une borne (bucket privé servi par la route publique). */
export function bornePhotoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath) return null;
  return `/api/public/borne-photo/${photoPath
    .split("/")
    .map((morceau) => encodeURIComponent(morceau))
    .join("/")}`;
}

const borneSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Minuscules, chiffres et tirets uniquement"),
  nom: z.string().min(2).max(120),
  puissance: z.string().min(1).max(20),
  phase: z.string().min(1).max(30),
  atout: z.string().max(160).default(""),
  usage: z.string().max(160).default(""),
  badge: z.string().max(60).nullish(),
  vedette: z.boolean().default(false),
  photo_path: z.string().max(300).nullish(),
  prix_ttc: z.number().min(0).nullish(),
  ordre: z.number().int().min(0).max(9999).default(100),
  actif: z.boolean().default(true),
});

/** Liste publique des bornes visibles, pour le site. */
export const listBornesPubliques = createServerFn({ method: "GET" }).handler(async (): Promise<Borne[]> => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("bornes")
    .select("id, slug, nom, puissance, phase, atout, usage, badge, vedette, photo_path, prix_ttc, ordre, actif")
    .eq("actif", true)
    .order("ordre", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Borne[];
});

/** Liste complète pour l'espace pro (y compris les bornes masquées). */
export const listBornesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Borne[]> => {
    const { data, error } = await context.supabase
      .from("bornes")
      .select("id, slug, nom, puissance, phase, atout, usage, badge, vedette, photo_path, prix_ttc, ordre, actif")
      .order("ordre", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Borne[];
  });

export const createBorne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => borneSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase.from("bornes").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateBorne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), borne: borneSchema.partial() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("bornes").update(data.borne).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBorne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("bornes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Convertit le catalogue statique en forme Borne (secours hors-ligne / premier rendu). */
export function bornesStatiquesEnSecours(): Borne[] {
  return BORNES_CATALOGUE.map((b: BorneCatalogue, index: number) => ({
    id: b.id,
    slug: b.id,
    nom: b.nom,
    puissance: b.puissance,
    phase: b.phase,
    atout: b.atout,
    usage: b.usage,
    badge: b.badge ?? null,
    vedette: b.vedette ?? false,
    photo_path: null,
    prix_ttc: null,
    ordre: index + 1,
    actif: true,
  }));
}

/** Photo d'une borne : URL publique si photo en base, sinon image statique du catalogue d'origine. */
export function borneImage(borne: Borne): string | null {
  const url = bornePhotoUrl(borne.photo_path);
  if (url) return url;
  return BORNES_CATALOGUE.find((b) => b.id === borne.slug)?.img ?? null;
}
