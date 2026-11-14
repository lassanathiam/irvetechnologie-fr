import { createFileRoute } from "@tanstack/react-router";
import { traiterWebhookSorank } from "@/lib/sorank/webhook";
import { CHEMINS_PAGES_CODEES } from "@/lib/sorank/pages-publiques";

const NON_CACHE = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

export const Route = createFileRoute("/api/public/sorank/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creerStoreSorank } = await import("@/lib/sorank/store.server");
        return traiterWebhookSorank(request, {
          secret: process.env["SORANK_WEBHOOK_SECRET"],
          store: creerStoreSorank(supabaseAdmin),
          pagesCodees: CHEMINS_PAGES_CODEES,
        });
      },
      GET: async () => new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: NON_CACHE }),
    },
  },
});
