import { createFileRoute } from "@tanstack/react-router";

const jourParis = (d: Date) => d.toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

export const Route = createFileRoute("/api/public/hooks/rappels-rdv")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { creerNotification } = await import("@/lib/notifications.server");
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { COMPANY } = await import("@/lib/company");
        const { estLivraisonDirecte, NOTE_LIVRAISON_DKV } = await import("@/lib/reseau-client");

        const demain = jourParis(new Date(Date.now() + 86400_000));
        const { data: rows } = await supabaseAdmin
          .from("rendezvous")
          .select("id, client_nom, cp_ville, date_debut, technicien, reseau_client")
          .eq("archive", false)
          .neq("statut", "annule")
          .gte("date_debut", new Date(Date.now()).toISOString())
          .lte("date_debut", new Date(Date.now() + 2 * 86400_000).toISOString())
          .order("date_debut");
        const liste = (rows ?? []).filter((r) => jourParis(new Date(r.date_debut)) === demain);
        if (!liste.length) return Response.json({ ok: true, nb: 0 });

        // Idempotent : une seule notification par jour.
        const { data: deja } = await supabaseAdmin
          .from("notifications")
          .select("id")
          .eq("type", "rappel_rdv")
          .contains("meta", { jour: demain })
          .limit(1);
        if (deja?.length) return Response.json({ ok: true, deja: true });

        const dateTxt = new Date(liste[0].date_debut).toLocaleDateString("fr-FR", {
          timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long",
        });
        const lignes = liste.map((r) => ({
          heure: new Date(r.date_debut).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
          client: estLivraisonDirecte(r.reseau_client) ? `${r.client_nom} [DKV : ${NOTE_LIVRAISON_DKV}]` : r.client_nom,
          lieu: r.cp_ville ?? "",
          technicien: r.technicien ?? "",
        }));
        await creerNotification(supabaseAdmin, {
          type: "rappel_rdv",
          titre: `${liste.length} rendez-vous demain (${dateTxt})`,
          message: lignes.map((l) => `${l.heure} ${l.client}${l.technicien ? ` (${l.technicien})` : ""}`).join(" · "),
          lien: "/planning",
          meta: { jour: demain },
        });
        const dkv = liste.filter((r) => estLivraisonDirecte(r.reseau_client));
        if (dkv.length) {
          await creerNotification(supabaseAdmin, {
            type: "rappel_rdv",
            titre: `DKV demain : ${NOTE_LIVRAISON_DKV}`,
            message: dkv.map((r) => `${r.client_nom}${r.cp_ville ? ` (${r.cp_ville})` : ""}`).join(" · "),
            lien: "/planning",
            meta: { jour: demain, dkv: true },
          });
        }
        try {
          await sendTemplateEmail("rappel-rdv", COMPANY.email, {
            templateData: { date: dateTxt, lignes },
            idempotencyKey: `rappel-rdv-${demain}`,
          });
        } catch (e) {
          console.error("Rappel RDV email:", e instanceof Error ? e.message : e);
        }
        return Response.json({ ok: true, nb: liste.length });
      },
    },
  },
});
