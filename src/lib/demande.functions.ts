import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const formuleSchema = z.enum(["essentiel", "confort", "pro"]).nullable().optional();

const submitSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  telephone: z.string().trim().min(4).max(40),
  code_postal: z.string().trim().min(2).max(20),
  type_bien: z.string().trim().max(120).optional().nullable(),
  puissance: z.string().trim().max(120).optional().nullable(),
  type_installation: z.string().trim().max(120).optional().nullable(),
  distance_m: z.number().int().min(0).max(10000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  formule: formuleSchema,
});

export const submitDemande = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("demande_requests")
      .insert({
        nom: data.nom,
        email: data.email,
        telephone: data.telephone,
        code_postal: data.code_postal,
        type_bien: data.type_bien ?? null,
        puissance: data.puissance ?? null,
        type_installation: data.type_installation ?? null,
        distance_m: data.distance_m ?? null,
        notes: data.notes ?? null,
        formule: data.formule ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("submitDemande insert error", error);
      throw new Error("Impossible d'enregistrer la demande. Réessayez dans un instant.");
    }
    return { ok: true as const, id: row.id };
  });
