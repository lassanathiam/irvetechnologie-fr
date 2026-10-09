import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enregistrerAbonnementPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { endpoint: string; p256dh: string; auth: string; appareil?: string }) =>
    z.object({
      endpoint: z.string().url().max(1000),
      p256dh: z.string().min(10).max(200),
      auth: z.string().min(4).max(100),
      appareil: z.string().max(120).optional(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "endpoint" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const supprimerAbonnementPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { endpoint: string }) => z.object({ endpoint: z.string().max(1000) }).parse(raw))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

export const testerPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { envoyerPushATous } = await import("@/lib/push.server");
    return envoyerPushATous({
      title: "Test de notification",
      body: "Si vous lisez ceci, les rappels de rendez-vous arriveront sur ce téléphone.",
      url: "/notifications",
      tag: "test",
    });
  });
