import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EmailReceipt = {
  timestamp: string;
  event_type: string;
  status: string | null;
};

/**
 * Accusé d'envoi : événements de distribution (envoyé, refusé, rebond,
 * plainte, désinscription, bloqué) pour une adresse destinataire.
 */
export const getEmailReceipts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ events: EmailReceipt[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { events: [] };
    try {
      const { listEmailLogs } = await import("@lovable.dev/email-js");
      const res = await listEmailLogs({ recipient: data.email, limit: 20 }, { apiKey });
      return {
        events: (res.data ?? []).map((e) => ({
          timestamp: e.timestamp,
          event_type: e.event_type,
          status: e.status ?? null,
        })),
      };
    } catch (e) {
      console.error("Journal d'emails indisponible:", e);
      return { events: [] };
    }
  });
