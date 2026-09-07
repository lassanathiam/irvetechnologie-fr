import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";

const formuleSchema = z
  .enum(["serenite", "premium", "pro", "essentiel", "confort"])
  .nullable()
  .optional();

const submitSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  telephone: z.string().trim().min(4).max(40),
  code_postal: z.string().trim().min(2).max(20),
  type_bien: z.string().trim().max(120).optional().nullable(),
  puissance: z.string().trim().max(120).optional().nullable(),
  type_installation: z.string().trim().max(120).optional().nullable(),
  distance_m: z.number().int().min(0).max(10000).optional().nullable(),
  abonnement_kva: z.string().trim().max(40).optional().nullable(),
  type_compteur: z.string().trim().max(60).optional().nullable(),
  phase: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  formule: formuleSchema,
  // Honeypot — must stay empty. Bots usually fill every field.
  website: z.string().max(0).optional().nullable(),
  // Time spent on the form in ms — humans take >1.5s
  elapsed_ms: z.number().int().min(0).max(86_400_000).optional().nullable(),
});

const SHORT_WINDOW_MS = 10 * 60 * 1000; // 10 min
const SHORT_LIMIT = 3;
const LONG_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const LONG_LIMIT = 10;
const MIN_ELAPSED_MS = 1500;

function getClientIp(): string {
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) return ip;
  } catch {}
  const fwd = getRequestHeader("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

export const submitDemande = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    // Honeypot: silently reject (pretend success to avoid signaling bots)
    if (data.website && data.website.length > 0) {
      console.warn("submitDemande honeypot triggered");
      return { ok: true as const, id: "honeypot" };
    }

    // Time-trap: forms submitted too fast are almost certainly bots
    if (typeof data.elapsed_ms === "number" && data.elapsed_ms < MIN_ELAPSED_MS) {
      console.warn("submitDemande time-trap triggered", data.elapsed_ms);
      return { ok: true as const, id: "timetrap" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = getClientIp();
    const now = Date.now();

    // Rate limit check
    const { data: recent, error: rlError } = await supabaseAdmin
      .from("demande_rate_limits")
      .select("created_at")
      .eq("ip", ip)
      .gte("created_at", new Date(now - LONG_WINDOW_MS).toISOString());

    if (rlError) {
      console.error("rate limit read error", rlError);
    } else if (recent) {
      const shortCount = recent.filter(
        (r) => new Date(r.created_at).getTime() > now - SHORT_WINDOW_MS,
      ).length;
      if (shortCount >= SHORT_LIMIT) {
        throw new Error(
          "Trop de demandes envoyées récemment depuis votre connexion. Réessayez dans quelques minutes.",
        );
      }
      if (recent.length >= LONG_LIMIT) {
        throw new Error(
          "Limite quotidienne atteinte. Contactez-nous directement par téléphone si besoin.",
        );
      }
    }

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
        abonnement_kva: data.abonnement_kva ?? null,
        type_compteur: data.type_compteur ?? null,
        phase: data.phase ?? null,
        notes: data.notes ?? null,
        formule: data.formule ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("submitDemande insert error", error);
      throw new Error("Impossible d'enregistrer la demande. Réessayez dans un instant.");
    }

    // Record the attempt (best-effort; ignore failures)
    await supabaseAdmin
      .from("demande_rate_limits")
      .insert({ ip })
      .then((r) => {
        if (r.error) console.error("rate limit write error", r.error);
      });

    return { ok: true as const, id: row.id };
  });
