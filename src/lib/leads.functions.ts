import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeTotals, CONDITIONS_DEFAUT } from "@/lib/billing";

/** Offre de borne prête à envoyer (prix forfaitaire, câble inclus). */
export type OffreExpress = {
  id: string;
  libelle: string;
  descriptif: string;
  prix_ht: number;
};

export type ReponseExpressConfig = {
  offres: OffreExpress[];
  metrage_inclus_m: number;
  prix_metre_ht: number;
  option_libelle: string;
  option_descriptif: string;
  option_prix_ht: number;
  /** Message d'accompagnement de l'e-mail. */
  message: string;
};

const CLE = "reponse_express";

export const CONFIG_DEFAUT: ReponseExpressConfig = {
  metrage_inclus_m: 5,
  prix_metre_ht: 18,
  option_libelle: "Option anti-déclenchement Schneider (EVA2HPC1)",
  option_descriptif:
    "Système anti-déclenchement monophasé jusqu'à 100 A pour borne de recharge — fourniture, pose et paramétrage.",
  option_prix_ht: 90,
  message:
    "Suite à votre demande, voici notre proposition d'installation de borne de recharge, réalisée par un électricien qualifié IRVE (P1/P2/P3). Nous restons disponibles pour tout ajustement.",
  offres: [
    {
      id: "hager-74",
      libelle: "Option 1 — Borne HAGER Witty 7,4 kW monophasé",
      descriptif:
        "Fourniture et pose de la borne HAGER Witty (7,4 kW monophasé, Type 2, contrôle d'accès)\n\n— Création d'une ligne d'alimentation dédiée : câble 3G10 mm² (5 m inclus)\n— Fourniture et pose des protections électriques dédiées Hager adaptées\n— Gaine / fourreau et accessoires de cheminement\n— Raccordement au tableau électrique\n— Mise en service, essais et contrôles\n— Rapport de fin de chantier et dossier technique",
      prix_ht: 0,
    },
    {
      id: "schneider-charge",
      libelle: "Option 2 — Borne SCHNEIDER Charge 7,4 kW évolutive",
      descriptif:
        "Fourniture et pose de la borne SCHNEIDER Charge\n(7,4 kW monophasé, évolutive jusqu'à 11/22 kW selon référence, Type 2, gestion dynamique de la puissance, compatibilité TIC Linky selon configuration)\n\n— Création d'une ligne d'alimentation dédiée : câble 3G10 mm² (5 m inclus)\n— Fourniture et pose des protections électriques dédiées Hager adaptées\n— Gaine / fourreau et accessoires de cheminement\n— Raccordement au tableau électrique\n— Configuration de la gestion dynamique\n— Mise en service, essais et contrôles\n— Rapport de fin de chantier et dossier technique",
      prix_ht: 1250,
    },
    {
      id: "borne-22",
      libelle: "Option 3 — Borne 22 kW triphasé",
      descriptif:
        "Fourniture et pose d'une borne 22 kW triphasé (Type 2, gestion de puissance)\n\n— Création d'une ligne d'alimentation dédiée triphasée : câble 5G6 mm² (5 m inclus)\n— Fourniture et pose des protections électriques dédiées adaptées\n— Gaine / fourreau et accessoires de cheminement\n— Raccordement au tableau électrique\n— Mise en service, essais et contrôles\n— Rapport de fin de chantier et dossier technique",
      prix_ht: 0,
    },
  ],
};

const offreSchema = z.object({
  id: z.string().trim().min(1).max(40),
  libelle: z.string().trim().min(1).max(200),
  descriptif: z.string().trim().max(2000),
  prix_ht: z.number().min(0).max(1_000_000),
});

const configSchema = z.object({
  offres: z.array(offreSchema).min(1).max(6),
  metrage_inclus_m: z.number().min(0).max(200),
  prix_metre_ht: z.number().min(0).max(1000),
  option_libelle: z.string().trim().max(200),
  option_descriptif: z.string().trim().max(1000),
  option_prix_ht: z.number().min(0).max(100_000),
  message: z.string().trim().max(2000),
});

function fusionner(brut: unknown): ReponseExpressConfig {
  const parsed = configSchema.safeParse(brut);
  return parsed.success ? parsed.data : CONFIG_DEFAUT;
}

export const getReponseExpressConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_settings")
      .select("valeur")
      .eq("cle", CLE)
      .maybeSingle();
    if (!data?.valeur) return CONFIG_DEFAUT;
    try {
      return fusionner(JSON.parse(data.valeur));
    } catch {
      return CONFIG_DEFAUT;
    }
  });

export const updateReponseExpressConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => configSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ cle: CLE, valeur: JSON.stringify(data) }, { onConflict: "cle" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const envoiSchema = z.object({
  prenom: z.string().trim().max(80).optional().nullable(),
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().nullable(),
  telephone: z.string().trim().max(40).optional().nullable(),
  adresse: z.string().trim().max(300).optional().nullable(),
  cp_ville: z.string().trim().max(160).optional().nullable(),
  offre_id: z.string().trim().min(1).max(40),
  metrage_m: z.number().min(0).max(200),
  option: z.boolean().default(false),
  message: z.string().trim().max(2000).optional().nullable(),
});

/** Lignes du devis express, calculées à partir de la configuration. */
export function lignesExpress(
  config: ReponseExpressConfig,
  offre: OffreExpress,
  metrage: number,
  option: boolean,
) {
  const lignes = [
    {
      libelle: offre.libelle,
      description: offre.descriptif || null,
      quantite: 1,
      prix_unitaire: offre.prix_ht,
      tva: 20,
    },
  ];
  const sup = Math.max(0, Math.round((metrage - config.metrage_inclus_m) * 100) / 100);
  if (sup > 0 && config.prix_metre_ht > 0) {
    lignes.push({
      libelle: `Câble et cheminement supplémentaires — ${sup} m`,
      description: `Au-delà des ${config.metrage_inclus_m} m inclus dans le forfait.`,
      quantite: sup,
      prix_unitaire: config.prix_metre_ht,
      tva: 20,
    });
  }
  if (option && config.option_prix_ht > 0) {
    lignes.push({
      libelle: config.option_libelle,
      description: config.option_descriptif || null,
      quantite: 1,
      prix_unitaire: config.option_prix_ht,
      tva: 20,
    });
  }
  return lignes;
}

async function prochainNumero(supabase: any, prefix: string) {
  const { data } = await supabase
    .from("devis")
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);
  const last = data?.[0]?.numero ? Number(String(data[0].numero).slice(prefix.length)) : 277;
  const next = (Number.isFinite(last) ? last : 277) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/**
 * Crée le devis correspondant à l'offre choisie puis l'envoie au prospect
 * via le circuit d'envoi habituel des devis (domaine vérifié et signé).
 */
export const envoyerReponseExpress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => envoiSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: settings } = await context.supabase
      .from("app_settings")
      .select("valeur")
      .eq("cle", CLE)
      .maybeSingle();
    let config = CONFIG_DEFAUT;
    if (settings?.valeur) {
      try {
        config = fusionner(JSON.parse(settings.valeur));
      } catch {
        config = CONFIG_DEFAUT;
      }
    }

    const offre = config.offres.find((o) => o.id === data.offre_id);
    if (!offre) throw new Error("Cette borne n'existe plus dans vos offres rapides.");
    if (!(offre.prix_ht > 0)) {
      throw new Error(
        "Le prix de cette borne n'est pas encore renseigné. Complétez-le dans les réglages de la réponse express.",
      );
    }

    const items = lignesExpress(config, offre, data.metrage_m, data.option);
    const totals = computeTotals(items, 0);
    const emission = new Date().toISOString().slice(0, 10);
    const expiration = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const numero = await prochainNumero(context.supabase, `D-${emission.slice(0, 4)}-`);
    const nomComplet = [data.prenom?.trim(), data.nom.trim()].filter(Boolean).join(" ");

    const { data: devis, error } = await context.supabase
      .from("devis")
      .insert({
        numero,
        client_nom: nomComplet,
        client_email: data.email || null,
        client_telephone: data.telephone || null,
        client_adresse: data.adresse || null,
        client_cp_ville: data.cp_ville || null,
        objet: `Installation d'une borne de recharge — ${offre.libelle}`,
        date_emission: emission,
        date_expiration: expiration,
        remise_pct: 0,
        acompte_pct: 30,
        conditions_paiement: CONDITIONS_DEFAUT,
        notes: `Métrage de câble estimé : ${data.metrage_m} m (${config.metrage_inclus_m} m inclus dans le forfait).`,
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        created_by: context.userId,
      })
      .select("id, numero, public_token")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase.from("devis_items").insert(
      items.map((item, index) => ({
        devis_id: devis.id,
        libelle: item.libelle,
        description: item.description ?? null,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        tva: item.tva,
        ordre: index + 1,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);

    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(
      /\/$/,
      "",
    );
    const lien = `${base}/devis-client/${devis.public_token}`;

    if (!data.email) {
      return {
        id: devis.id as string,
        numero: devis.numero as string,
        lien,
        sent: false as const,
        reason: "sans_email" as const,
        total_ttc: totals.total_ttc,
      };
    }

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("devis-client", data.email, {
      idempotencyKey: `devis-${devis.id}`,
      replyTo: "contacts@irvetechnologie.fr",
      templateData: {
        type: "devis",
        numero: devis.numero,
        client_nom: nomComplet,
        objet: `Installation d'une borne de recharge — ${offre.libelle}`,
        date_emission: emission,
        date_limite: expiration,
        message: data.message || config.message,
        lien,
        remise_pct: 0,
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        acompte_pct: 30,
        conditions_paiement: CONDITIONS_DEFAUT,
        items,
      },
    });

    await context.supabase.from("devis_envois").insert({
      devis_id: devis.id,
      destinataire: data.email,
      message: data.message || config.message,
      resultat: result.sent ? "envoye" : "bloque",
      created_by: context.userId,
    });

    if (result.sent) {
      await context.supabase
        .from("devis")
        .update({ sent_at: new Date().toISOString(), statut: "envoye" })
        .eq("id", devis.id);
    }

    return {
      id: devis.id as string,
      numero: devis.numero as string,
      lien,
      sent: result.sent,
      reason: result.sent ? null : ("reason" in result ? result.reason : null),
      total_ttc: totals.total_ttc,
    };
  });
