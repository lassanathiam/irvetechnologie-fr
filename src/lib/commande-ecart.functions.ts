import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ecartCommande, type RapportEcart } from "./commande-ecart";

const demandeSchema = z.object({
  id: z.string().uuid(), numero: z.string().trim().min(3).max(60),
  montantHt: z.number().finite().min(0).max(1_000_000), commentaire: z.string().trim().max(2000).default(""),
});

export const preparerRapportEcartCommande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => demandeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase.from("attachements_travaux")
      .select("numero, client_nom, client_email, objet, numero_ticket, total_ht, statut").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!att || att.statut === "annule") throw new Error("Attachement introuvable ou annulé.");
    const { data: items, error: itemsError } = await context.supabase.from("attachement_items")
      .select("libelle, description, quantite, prix_unitaire").eq("attachement_id", data.id).order("ordre");
    if (itemsError) throw new Error(itemsError.message);
    const rapport: RapportEcart = {
      numero: data.numero, attachement: att.numero, donneur: att.client_nom, client: att.objet ?? "", ticket: att.numero_ticket,
      date: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
      commandeHt: data.montantHt, attachementHt: Number(att.total_ht), ecartHt: ecartCommande(Number(att.total_ht), data.montantHt),
      commentaire: data.commentaire,
      lignes: (items ?? []).map((l) => ({ libelle: l.libelle, description: l.description, quantite: Number(l.quantite), prixUnitaire: Number(l.prix_unitaire), totalHt: Math.round(Number(l.quantite) * Number(l.prix_unitaire) * 100) / 100 })),
    };
    return { rapport, destinataire: att.client_email };
  });

export const envoyerRapportEcartCommande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => demandeSchema.extend({ envoiId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Relecture authentifiée : ni destinataire arbitraire, ni montants d’attachement fournis par le navigateur.
    const { data: att, error } = await context.supabase.from("attachements_travaux")
      .select("numero, client_nom, client_email, objet, numero_ticket, total_ht, statut").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!att || att.statut === "annule") throw new Error("Attachement introuvable ou annulé.");
    if (!att.client_email) throw new Error("Ajoutez l’email du donneur d’ordre sur l’attachement avant l’envoi.");
    const { data: items, error: itemsError } = await context.supabase.from("attachement_items")
      .select("libelle, description, quantite, prix_unitaire").eq("attachement_id", data.id).order("ordre");
    if (itemsError) throw new Error(itemsError.message);
    const rapport: RapportEcart = {
      numero: data.numero, attachement: att.numero, donneur: att.client_nom, client: att.objet ?? "", ticket: att.numero_ticket,
      date: new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
      commandeHt: data.montantHt, attachementHt: Number(att.total_ht), ecartHt: ecartCommande(Number(att.total_ht), data.montantHt), commentaire: data.commentaire,
      lignes: (items ?? []).map((l) => ({ libelle: l.libelle, description: l.description, quantite: Number(l.quantite), prixUnitaire: Number(l.prix_unitaire), totalHt: Math.round(Number(l.quantite) * Number(l.prix_unitaire) * 100) / 100 })),
    };
    if (!rapport.ecartHt) throw new Error("Aucun écart de montant sur cet attachement.");
    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const { resoudreCopieEnsio } = await import("./copie-ensio.server");
    return sendTemplateEmail("rapport-ecart-commande", att.client_email, {
      templateData: { rapport }, copieEnsio: await resoudreCopieEnsio(context.supabase, att.client_email, att.client_nom),
      idempotencyKey: `rapport-ecart-${data.id}-${data.envoiId}`,
    });
  });