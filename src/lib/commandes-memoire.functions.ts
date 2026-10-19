import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { saisieCommandeSchema } from "./commandes-memoire";

const chemin = z.string().regex(/^commandes\/[0-9a-f-]{36}\/(original|signee)\.pdf$/);
export const listerCommandesImportees = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("commandes_importees").select("id, nom, original_path, signe_path, saisie").order("created_at");
  if (error) throw new Error("Impossible de retrouver les commandes enregistrées.");
  return data ?? [];
});
export const enregistrerCommandeImportee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), nom: z.string().min(1), empreinte: z.string().regex(/^[a-f0-9]{64}$/), original_path: chemin, saisie: saisieCommandeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.original_path !== `commandes/${data.id}/original.pdf`) throw new Error("Fichier de commande invalide.");
    const { data: ligne, error } = await context.supabase.from("commandes_importees").insert({ ...data, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "Cette commande est déjà enregistrée." : "Enregistrement de la commande impossible.");
    return ligne;
  });
export const modifierCommandeImportee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), saisie: saisieCommandeSchema, signe_path: chemin.nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.signe_path && data.signe_path !== `commandes/${data.id}/signee.pdf`) throw new Error("Fichier signé invalide.");
    const { error } = await context.supabase.from("commandes_importees").update({ saisie: data.saisie, signe_path: data.signe_path }).eq("id", data.id).select("id").single();
    if (error) throw new Error("Vos modifications n’ont pas pu être enregistrées.");
    return { ok: true };
  });
export const retirerCommandeImportee = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ligne, error } = await context.supabase.from("commandes_importees").select("original_path, signe_path").eq("id", data.id).single();
    if (error || !ligne) throw new Error("Commande introuvable.");
    const { error: retrait } = await context.supabase.from("commandes_importees").delete().eq("id", data.id);
    if (retrait) throw new Error("Retrait impossible.");
    await context.supabase.storage.from("documents").remove([ligne.original_path, ...(ligne.signe_path ? [ligne.signe_path] : [])]);
    return { ok: true };
  });