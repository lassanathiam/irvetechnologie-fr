import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chargerSuivi } from "./suivi-chantiers.functions";
import { preparerRappel } from "./rappel-client";

/**
 * Rappel au donneur d'ordre pour les chantiers cochés en attente de commande ou de réception.
 * Les étapes et le destinataire sont recalculés côté serveur ; rien d'autre que la date du rappel n'est modifié.
 */
export const envoyerRappelClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    cles: z.array(z.string().min(3).max(120)).min(1).max(300),
    envoiId: z.string().uuid(),
    message: z.string().trim().max(2000).default(""),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const s = context.supabase;
    const r = preparerRappel(await chargerSuivi(s), data.cles);
    if (!r.attIds.length) throw new Error("Aucun chantier coché n’attend une commande ou une réception du client.");
    const { data: atts, error } = await s.from("attachements_travaux").select("id, client_email, client_nom, public_token, nb_rappels").in("id", r.attIds);
    if (error) throw new Error(error.message);
    const emails = new Set((atts ?? []).map((a) => String(a.client_email ?? "").trim().toLowerCase()));
    if (emails.size !== 1 || emails.has("")) throw new Error(emails.size > 1 ? "Cochez seulement les chantiers d’un même donneur d’ordre." : "Ajoutez l’email du donneur d’ordre sur les attachements avant le rappel.");
    const email = [...emails][0]!;
    const donneur = atts?.[0]?.client_nom ?? r.donneurs[0] ?? "";
    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
    const jeton = new Map((atts ?? []).map((a) => [a.id, a.public_token as string | null]));
    const avecLien = (l: (typeof r.commandes)[number]) => ({ ...l, lien: l.attId && jeton.get(l.attId) ? `${base}/attachement/${jeton.get(l.attId)}` : null });
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { resoudreCopieEnsio } = await import("./copie-ensio.server");
    const result = await sendTemplateEmail("rappel-client", email, {
      templateData: {
        donneur, date: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }), message: data.message,
        commandes: r.commandes.map(avecLien), receptions: r.receptions.map(avecLien), totalCommandes: r.totalCommandes, totalReceptions: r.totalReceptions,
      },
      copieEnsio: await resoudreCopieEnsio(s, email, donneur),
      idempotencyKey: `rappel-client-${data.envoiId}`,
    });
    if (result.sent) {
      const now = new Date().toISOString();
      for (const a of atts ?? []) await s.from("attachements_travaux").update({ rappel_at: now, nb_rappels: Number(a.nb_rappels ?? 0) + 1 }).eq("id", a.id);
    }
    return { ...result, commandes: r.commandes.length, receptions: r.receptions.length, ignores: r.ignores };
  });
