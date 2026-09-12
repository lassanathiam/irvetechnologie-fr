import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trajetDepuisBase, technicienByNom } from "@/lib/geo";

type SmsOutcome =
  | { status: "sent"; provider: "twilio"; to: string }
  | { status: "sent"; provider: "brevo"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

type EmailOutcome =
  | { status: "sent"; provider: "lovable"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

/** Nombre tolérant : vide, texte invalide ou NaN → valeur par défaut. */
const num = (min: number, max: number, def: number) =>
  z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return def;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : def;
  }, z.number().min(min).max(max)).default(def);


/** États possibles d'un chantier, du programmé au terminé. */
export const STATUTS_CHANTIER = [
  "planifie",
  "confirme",
  "en_cours",
  "termine",
  "realise",
  "annule",
] as const;

const rdvSchema = z.object({
  titre: z.string().trim().min(1).max(160),
  type: z.enum(["visite", "installation", "maintenance", "sav", "controle"]),
  statut: z.enum(STATUTS_CHANTIER).default("planifie"),

  client_nom: z.string().trim().min(1).max(160),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_email: z.string().trim().max(255).optional().nullable(),
  adresse: z.string().trim().min(3).max(300),
  cp_ville: z.string().trim().max(160).optional().nullable(),
  date_debut: z.string().min(10).max(40),
  duree_min: z.coerce.number().int().min(15).max(1440).default(120),
  technicien: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
  demande_id: z.string().uuid().optional().nullable(),
  origine: z.enum(["direct", "sous_traitance"]).default("direct"),
  partenaire: z.string().trim().max(160).optional().nullable(),
  montant_ht: num(0, 1_000_000, 0),
  tva_pct: num(0, 30, 20),
  statut_facturation: z.enum(["a_facturer", "facture", "paye"]).default("a_facturer"),
  designation: z.string().trim().max(200).optional().nullable(),
  etiquettes: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  metrage_m: num(0, 10000, 0),
  puissance_borne: z.string().trim().max(40).optional().nullable(),
  phase_installation: z.string().trim().max(40).optional().nullable(),
  type_pose: z.string().trim().max(80).optional().nullable(),

});


export type RendezVousInput = z.input<typeof rdvSchema>;

function formatNumeroSms(numero: string | null | undefined): string | null {
  if (!numero) return null;
  const brut = numero.trim();
  if (!brut) return null;
  if (brut.startsWith("+")) {
    const keep = `+${brut.slice(1).replace(/[^\d]/g, "")}`;
    return keep.length > 7 ? keep : null;
  }
  const chiffres = brut.replace(/[^\d]/g, "");
  if (!chiffres) return null;
  if (chiffres.startsWith("00")) return `+${chiffres.slice(2)}`;
  if (chiffres.startsWith("221") && chiffres.length >= 11) return `+${chiffres}`;
  if (chiffres.length === 9) return `+221${chiffres}`;
  return chiffres.length > 7 ? `+${chiffres}` : null;
}

function messageSmsConfirmationRdv(rdv: {
  client_nom: string | null;
  date_debut: string;
  adresse: string | null;
  cp_ville: string | null;
  designation: string | null;
  titre: string | null;
}) {
  const dt = new Date(rdv.date_debut);
  const quand = Number.isNaN(dt.getTime())
    ? "date à confirmer"
    : dt.toLocaleString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  const objet = rdv.designation?.trim() || rdv.titre?.trim() || "intervention";
  const lieu = [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", ");
  return `IRVE Technologie: Bonjour ${rdv.client_nom ?? "client"}, votre rendez-vous est confirmé (${objet}) le ${quand}${lieu ? ` à ${lieu}` : ""}.`;
}

async function envoyerSmsRendezVousConfirmation(rdv: {
  client_telephone: string | null;
  client_nom: string | null;
  date_debut: string;
  adresse: string | null;
  cp_ville: string | null;
  designation: string | null;
  titre: string | null;
}): Promise<SmsOutcome> {
  const to = formatNumeroSms(rdv.client_telephone);
  if (!to) return { status: "skipped", reason: "Téléphone client manquant/invalide" };
  const message = messageSmsConfirmationRdv(rdv);

  const provider = (process.env["SMS_PROVIDER"] || "auto").trim().toLowerCase();

  const sendWithBrevo = async (): Promise<SmsOutcome> => {
    const apiKey = process.env["BREVO_API_KEY"]?.trim();
    const sender = process.env["SMS_FROM"]?.trim();
    if (!apiKey || !sender) {
      return { status: "skipped", reason: "Configuration Brevo absente" };
    }
    try {
      const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender,
          recipient: to,
          content: message,
          type: "transactional",
        }),
      });
      if (!res.ok) {
        const details = (await res.text()).slice(0, 180);
        return { status: "failed", reason: `Échec Brevo (${res.status}) ${details}` };
      }
      return { status: "sent", provider: "brevo", to };
    } catch (error) {
      return {
        status: "failed",
        reason: error instanceof Error ? error.message : "Erreur SMS Brevo inconnue",
      };
    }
  };

  const sendWithTwilio = async (): Promise<SmsOutcome> => {
    const accountSid = process.env["SMS_TWILIO_ACCOUNT_SID"]?.trim();
    const authToken = process.env["SMS_TWILIO_AUTH_TOKEN"]?.trim();
    const from = process.env["SMS_FROM"]?.trim();
    if (!accountSid || !authToken || !from) {
      return { status: "skipped", reason: "Configuration Twilio absente" };
    }

    const body = new URLSearchParams({
      To: to,
      From: from,
      Body: message,
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      if (!res.ok) {
        const details = (await res.text()).slice(0, 180);
        return { status: "failed", reason: `Échec Twilio (${res.status}) ${details}` };
      }
      return { status: "sent", provider: "twilio", to };
    } catch (error) {
      return {
        status: "failed",
        reason: error instanceof Error ? error.message : "Erreur SMS Twilio inconnue",
      };
    }
  };

  if (provider === "brevo") return sendWithBrevo();
  if (provider === "twilio") return sendWithTwilio();
  const brevoAttempt = await sendWithBrevo();
  if (brevoAttempt.status === "sent" || brevoAttempt.status === "failed") return brevoAttempt;
  const twilioAttempt = await sendWithTwilio();
  if (twilioAttempt.status === "sent" || twilioAttempt.status === "failed") return twilioAttempt;
  return {
    status: "skipped",
    reason: "Aucun provider SMS configuré (Brevo ou Twilio).",
  }
}

async function envoyerEmailRendezVousConfirmation(rdv: {
  id: string;
  client_email: string | null;
  client_nom: string | null;
  date_debut: string;
  adresse: string | null;
  cp_ville: string | null;
  designation: string | null;
  titre: string | null;
}): Promise<EmailOutcome> {
  const email = rdv.client_email?.trim();
  if (!email) return { status: "skipped", reason: "Email client manquant" };
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("rdv-confirme", email, {
      idempotencyKey: `rdv-confirme-${rdv.id}-${rdv.date_debut}`,
      replyTo: "contacts@irvetechnologie.fr",
      templateData: {
        client_nom: rdv.client_nom ?? "Client",
        date_debut: rdv.date_debut,
        adresse: rdv.adresse,
        cp_ville: rdv.cp_ville,
        objet: rdv.designation || rdv.titre || "Intervention IRVE",
      },
    });
    if (!result.sent) {
      return {
        status: "skipped",
        reason:
          result.reason === "email_not_configured"
            ? "Configuration email absente"
            : "Destinataire en suppression email",
      };
    }
    return { status: "sent", provider: "lovable", to: email };
  } catch (error) {
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Erreur email inconnue",
    };
  }
}

/** Géocodage via l'API Adresse (data.gouv.fr) — gratuite et sans clé. */
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const c = json.features?.[0]?.geometry?.coordinates;
    if (!c) return null;
    return { lng: c[0], lat: c[1] };
  } catch {
    return null;
  }
}

export const listRendezVous = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rendezvous")
      .select("*")
      .order("date_debut", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: RendezVousInput) => rdvSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const geo = await geocode([data.adresse, data.cp_ville].filter(Boolean).join(" "));
    const tech = technicienByNom(data.technicien);
    const trajet = geo
      ? trajetDepuisBase(geo.lat, geo.lng, tech ? { lat: tech.lat, lng: tech.lng } : undefined)
      : null;

    const { data: row, error } = await context.supabase
      .from("rendezvous")
      .insert({
        ...data,
        user_id: context.userId,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        distance_km: trajet?.distance_km ?? null,
        duree_trajet_min: trajet?.duree_trajet_min ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, geocode: Boolean(geo) };
  });

export const updateStatutRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; statut: string }) =>
    z
      .object({
        id: z.string().uuid(),
        statut: z.enum(STATUTS_CHANTIER),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: avant, error: readErr } = await context.supabase
      .from("rendezvous")
      .select("id, statut, client_telephone, client_email, client_nom, date_debut, adresse, cp_ville, designation, titre")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const { error } = await context.supabase
      .from("rendezvous")
      .update({ statut: data.statut })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let sms: SmsOutcome | null = null;
    let email: EmailOutcome | null = null;
    const passeEnConfirme = data.statut === "confirme" && avant?.statut !== "confirme";
    if (passeEnConfirme) {
      email = await envoyerEmailRendezVousConfirmation({
        id: avant.id,
        client_email: avant.client_email,
        client_nom: avant.client_nom,
        date_debut: avant.date_debut,
        adresse: avant.adresse,
        cp_ville: avant.cp_ville,
        designation: avant.designation,
        titre: avant.titre,
      });
      sms = await envoyerSmsRendezVousConfirmation({
        client_telephone: avant.client_telephone,
        client_nom: avant.client_nom,
        date_debut: avant.date_debut,
        adresse: avant.adresse,
        cp_ville: avant.cp_ville,
        designation: avant.designation,
        titre: avant.titre,
      });
    }

    return { ok: true, sms, email };
  });

/** Modification de l'adresse d'un rendez-vous : re-géocodage + recalcul du trajet. */
export const updateAdresseRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; adresse: string; cp_ville?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        adresse: z.string().trim().min(3).max(300),
        cp_ville: z.string().trim().max(160).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: current, error: readErr } = await context.supabase
      .from("rendezvous")
      .select("technicien")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const geo = await geocode([data.adresse, data.cp_ville].filter(Boolean).join(" "));
    const tech = technicienByNom(current?.technicien);
    const trajet = geo
      ? trajetDepuisBase(geo.lat, geo.lng, tech ? { lat: tech.lat, lng: tech.lng } : undefined)
      : null;

    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        adresse: data.adresse,
        cp_ville: data.cp_ville ?? null,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        distance_km: trajet?.distance_km ?? null,
        duree_trajet_min: trajet?.duree_trajet_min ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, geocode: Boolean(geo) };
  });

/**
 * Archive (ou sort des archives) un chantier clôturé, sans le supprimer.
 * À l'archivage, envoie automatiquement le bilan et les photos au client
 * et au partenaire donneur d'ordre (une seule fois par chantier).
 */
export const archiverRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; archive: boolean; notifier?: boolean }) =>
    z
      .object({
        id: z.string().uuid(),
        archive: z.boolean(),
        notifier: z.boolean().default(true),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const maintenant = new Date().toISOString();
    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        archive: data.archive,
        archive_at: data.archive ? maintenant : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (!data.archive || !data.notifier) return { ok: true, envois: 0 };

    let envois = 0;
    try {
      const { data: rdv } = await context.supabase
        .from("rendezvous")
        .select(
          "id, client_nom, client_email, adresse, cp_ville, titre, designation, partenaire, partenaire_id, date_debut, demarre_at, termine_at, metrage_m, puissance_borne, phase_installation, type_pose, montant_ht, notif_archive_at",
        )
        .eq("id", data.id)
        .single();
      if (!rdv || rdv.notif_archive_at) return { ok: true, envois: 0 };

      // Photos du chantier : liens signés valables 7 jours.
      const { data: photos } = await context.supabase
        .from("rendezvous_photos")
        .select("path")
        .eq("rendezvous_id", data.id)
        .order("created_at", { ascending: true })
        .limit(6);
      let urls: string[] = [];
      if (photos?.length) {
        const { data: signed } = await context.supabase.storage
          .from("chantier-photos")
          .createSignedUrls(
            photos.map((p) => p.path),
            60 * 60 * 24 * 7,
          );
        urls = (signed ?? [])
          .map((s) => s.signedUrl)
          .filter((u): u is string => Boolean(u));
      }

      const debut = rdv.demarre_at ? new Date(rdv.demarre_at) : null;
      const fin = rdv.termine_at ? new Date(rdv.termine_at) : null;
      const dureeMin =
        debut && fin ? Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 60000)) : null;

      const base = {
        client_nom: rdv.client_nom,
        adresse: [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", "),
        objet: rdv.designation || rdv.titre,
        partenaire: rdv.partenaire,
        date_debut: rdv.date_debut,
        demarre_at: rdv.demarre_at,
        termine_at: rdv.termine_at,
        duree_min: dureeMin,
        metrage_m: rdv.metrage_m,
        puissance_borne: rdv.puissance_borne,
        phase_installation: rdv.phase_installation,
        type_pose: rdv.type_pose,
        photos: urls,
      };

      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");

      // 1) Le client : bilan sans montant.
      const emailClient = rdv.client_email?.trim();
      if (emailClient) {
        try {
          const res = await sendTemplateEmail("chantier-archive", emailClient, {
            templateData: { ...base, destinataire: "client" },
            idempotencyKey: `chantier-archive-client-${data.id}`,
          });
          if (res.sent) envois += 1;
        } catch {
          /* échec d'envoi : l'archivage reste valable */
        }
      }

      // 2) Le partenaire donneur d'ordre : bilan complet avec le montant.
      let emailPartenaire: string | null = null;
      if (rdv.partenaire_id) {
        const { data: p } = await context.supabase
          .from("partenaires")
          .select("email")
          .eq("id", rdv.partenaire_id)
          .maybeSingle();
        emailPartenaire = p?.email?.trim() || null;
      }
      if (emailPartenaire && emailPartenaire !== emailClient) {
        try {
          const res = await sendTemplateEmail("chantier-archive", emailPartenaire, {
            templateData: { ...base, destinataire: "partenaire", montant_ht: rdv.montant_ht },
            idempotencyKey: `chantier-archive-partenaire-${data.id}`,
          });
          if (res.sent) envois += 1;
        } catch {
          /* échec d'envoi : l'archivage reste valable */
        }
      }

      if (envois > 0) {
        await context.supabase
          .from("rendezvous")
          .update({ notif_archive_at: maintenant })
          .eq("id", data.id);
      }
    } catch {
      /* le bilan n'a pas pu partir : le chantier est tout de même archivé */
    }
    return { ok: true, envois };
  });

export const deleteRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rendezvous").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const [demandes, devis, rapports, rdv, factures] = await Promise.all([
      s
        .from("demande_requests")
        .select("id, nom, email, telephone, code_postal, formule, status, created_at")
        .order("created_at", { ascending: false })
        .limit(40),
      s.from("devis").select("id, numero, client_nom, total_ttc, statut, created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      s.from("rapports").select("id, numero, type, client_nom, date_intervention")
        .order("created_at", { ascending: false })
        .limit(5),
      s
        .from("rendezvous")
        .select("*")
        .eq("archive", false)
        .order("date_debut", { ascending: true })
        .limit(200),
      s.from("factures").select("id, numero, client_nom, total_ttc, statut, date_emission, paid_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const now = Date.now();
    const rows = rdv.data ?? [];
    const aVenir = rows.filter(
      (r) => new Date(r.date_debut).getTime() >= now && r.statut !== "annule",
    );
    const devisRows = devis.data ?? [];
    const demandeRows = demandes.data ?? [];
    const factureRows = factures.data ?? [];
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const caEncaisse = factureRows
      .filter((f) => f.statut === "payee")
      .reduce((t, f) => t + Number(f.total_ttc ?? 0), 0);
    const caEnAttente = factureRows
      .filter((f) => f.statut !== "payee" && f.statut !== "annulee")
      .reduce((t, f) => t + Number(f.total_ttc ?? 0), 0);
    const caMois = factureRows
      .filter((f) => f.paid_at && new Date(f.paid_at).getTime() >= debutMois.getTime())
      .reduce((t, f) => t + Number(f.total_ttc ?? 0), 0);

    return {
      demandes: demandeRows,
      devis: devisRows,
      rapports: rapports.data ?? [],
      rendezvous: rows,
      factures: factureRows.slice(0, 6),
      stats: {
        rdvAVenir: aVenir.length,
        rdvSemaine: aVenir.filter(
          (r) => new Date(r.date_debut).getTime() <= now + 7 * 864e5,
        ).length,
        installations: rows.filter((r) => r.statut === "realise").length,
        chantiersValides: rows.filter((r) => r.chantier_valide).length,
        kmPlanifies: aVenir.reduce((t, r) => t + Number(r.distance_km ?? 0), 0),
        caDevis: devisRows.reduce((t, d) => t + Number(d.total_ttc ?? 0), 0),
        caEncaisse,
        caEnAttente,
        caMois,
        demandesNouvelles: demandeRows.filter((d) => d.status === "nouveau").length,
        demandesAcceptees: demandeRows.filter((d) => d.status === "accepte").length,
        demandesTotal: demandeRows.length,
      },
    };
  });


/** Validation de chantier : confirme qu'une intervention a bien été réalisée. */
export const validerChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; valide: boolean; commentaire?: string | null; par?: string | null }) =>
    z
      .object({
        id: z.string().uuid(),
        valide: z.boolean(),
        commentaire: z.string().trim().max(2000).optional().nullable(),
        par: z.string().trim().max(160).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        chantier_valide: data.valide,
        chantier_valide_at: data.valide ? new Date().toISOString() : null,
        chantier_valide_par: data.valide ? (data.par ?? null) : null,
        chantier_commentaire: data.commentaire ?? null,
        ...(data.valide ? { statut: "realise" } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Liste courte des chantiers, pour rattacher un devis à une intervention. */
export const listChantiersLight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rendezvous")
      .select("id, titre, client_nom, adresse, cp_ville, date_debut, statut")
      .order("date_debut", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Mise à jour des informations commerciales d'une intervention. */
export const updateFacturationRdv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: {
    id: string;
    origine: "direct" | "sous_traitance";
    partenaire?: string | null;
    montant_ht: number;
    tva_pct?: number;
    statut_facturation: "a_facturer" | "facture" | "paye";
    designation?: string | null;
    etiquettes?: string[];
    metrage_m?: number;
    puissance_borne?: string | null;
    phase_installation?: string | null;
    type_pose?: string | null;
  }) =>
    z
      .object({
        id: z.string().uuid(),
        origine: z.enum(["direct", "sous_traitance"]),
        partenaire: z.string().trim().max(160).optional().nullable(),
        montant_ht: num(0, 1_000_000, 0),
        tva_pct: num(0, 30, 20),
        statut_facturation: z.enum(["a_facturer", "facture", "paye"]),
        designation: z.string().trim().max(200).optional().nullable(),
        etiquettes: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
        metrage_m: num(0, 10000, 0),
        puissance_borne: z.string().trim().max(40).optional().nullable(),
        phase_installation: z.string().trim().max(40).optional().nullable(),
        type_pose: z.string().trim().max(80).optional().nullable(),
      })
      .parse(raw),
  )

  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("rendezvous").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Suivi en direct du chantier : démarrage, fin, notification         */
/* ------------------------------------------------------------------ */

/** Démarrage des travaux : le chantier passe « en cours » avec l'heure d'arrivée. */
export const demarrerChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; demarre: boolean }) =>
    z.object({ id: z.string().uuid(), demarre: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rendezvous")
      .update(
        data.demarre
          ? { demarre_at: new Date().toISOString(), termine_at: null, statut: "en_cours" }
          : { demarre_at: null, statut: "confirme" },
      )
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Fin de chantier : enregistre l'heure de fin, passe le chantier en « terminé »
 * et prévient par email le client (ou le partenaire donneur d'ordre).
 */
export const terminerChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; notifier?: boolean }) =>
    z.object({ id: z.string().uuid(), notifier: z.boolean().default(true) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rdv, error: readErr } = await context.supabase
      .from("rendezvous")
      .select(
        "id, client_nom, client_email, adresse, cp_ville, titre, designation, partenaire, partenaire_id, demarre_at, metrage_inclus_m, metrage_reel_m, retour_observations, retour_delestage, delai_paiement_jours, montant_ht",
      )
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    // Retour de travaux : les photos essentielles doivent être présentes.
    const { data: photosRows } = await context.supabase
      .from("rendezvous_photos")
      .select("categorie, path")
      .eq("rendezvous_id", data.id);
    const presentes = new Set((photosRows ?? []).map((p) => p.categorie));
    const manquantes = RETOUR_CATEGORIES_OBLIGATOIRES.filter((c) => !presentes.has(c));
    if (manquantes.length) {
      throw new Error(
        `Retour de travaux incomplet — photos manquantes : ${manquantes
          .map((c) => RETOUR_CATEGORIES_LABELS[c] ?? c)
          .join(", ")}.`,
      );
    }

    const fin = new Date();
    const debut = rdv.demarre_at ? new Date(rdv.demarre_at) : null;
    const dureeMin = debut ? Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 60000)) : null;

    // Délai de paiement : celui du chantier, sinon celui convenu avec le partenaire, sinon 30 jours.
    let delai = rdv.delai_paiement_jours == null ? null : Number(rdv.delai_paiement_jours);
    if (delai == null && rdv.partenaire_id) {
      const { data: part } = await context.supabase
        .from("partenaires")
        .select("delai_paiement_jours")
        .eq("id", rdv.partenaire_id)
        .maybeSingle();
      if (part?.delai_paiement_jours != null) delai = Number(part.delai_paiement_jours);
    }
    if (delai == null) delai = 30;
    const echeance = new Date(fin);
    echeance.setDate(echeance.getDate() + delai);

    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        termine_at: fin.toISOString(),
        statut: "termine",
        chantier_valide: true,
        chantier_valide_at: fin.toISOString(),
        delai_paiement_jours: delai,
        echeance_paiement: echeance.toISOString().slice(0, 10),
        statut_facturation: "a_facturer",
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let notifie = false;
    if (data.notifier) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { COMPANY } = await import("@/lib/company");
        const destinataire = rdv.client_email?.trim() || COMPANY.email;
        // Photos du retour de travaux, en liens signés 7 jours.
        const chemins = (photosRows ?? []).map((p) => p.path).slice(0, 8);
        let photos: { url: string; libelle: string }[] = [];
        if (chemins.length) {
          const { data: signed } = await context.supabase.storage
            .from("chantier-photos")
            .createSignedUrls(chemins, 60 * 60 * 24 * 7);
          photos = (signed ?? [])
            .map((sg, i) => ({
              url: sg?.signedUrl ?? "",
              libelle:
                RETOUR_CATEGORIES_LABELS[(photosRows ?? [])[i]?.categorie ?? ""] ?? "Photo de chantier",
            }))
            .filter((p) => p.url);
        }
        const inclus = Number(rdv.metrage_inclus_m ?? 5);
        const reel = rdv.metrage_reel_m == null ? null : Number(rdv.metrage_reel_m);
        const res = await sendTemplateEmail("chantier-termine", destinataire, {
          templateData: {
            client_nom: rdv.client_nom,
            adresse: [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", "),
            objet: rdv.designation || rdv.titre,
            partenaire: rdv.partenaire,
            termine_at: fin.toISOString(),
            duree_min: dureeMin,
            metrage_inclus_m: inclus,
            metrage_reel_m: reel,
            supplement_m: reel == null ? null : Math.max(0, reel - inclus),
            observations: rdv.retour_observations,
            delestage: rdv.retour_delestage,
            photos,
          },
          idempotencyKey: `chantier-termine-${data.id}`,
        });
        notifie = res.sent;
      } catch {
        notifie = false;
      }
      await context.supabase
        .from("rendezvous")
        .update({ notif_fin_at: notifie ? fin.toISOString() : null })
        .eq("id", data.id);
    }
    return { ok: true, notifie, duree_min: dureeMin };
  });

/** Applique un programme de tournées : enregistre les nouvelles dates de passage. */
export const appliquerProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { items: Array<{ id: string; date_debut: string }> }) =>
    z
      .object({
        items: z
          .array(z.object({ id: z.string().uuid(), date_debut: z.string().min(10).max(40) }))
          .min(1)
          .max(60),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    for (const item of data.items) {
      const { error } = await context.supabase
        .from("rendezvous")
        .update({ date_debut: new Date(item.date_debut).toISOString(), date_a_confirmer: false })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, nb: data.items.length };
  });

/* ------------------------------------------------------------------ */
/* Bilan : chantiers réalisés (archives incluses) + photos de chantier */
/* ------------------------------------------------------------------ */

/**
 * Chantiers terminés / réalisés d'un mois donné (archivés compris) :
 * sert la vue « Nos chantiers réalisés » avec son bilan.
 * `mois` au format AAAA-MM ; vide = les 12 derniers mois.
 */
export const listChantiersRealises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { mois?: string | null }) =>
    z
      .object({
        mois: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .nullable(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let debut: Date;
    let fin: Date;
    if (data.mois) {
      const [y, m] = data.mois.split("-").map(Number) as [number, number];
      debut = new Date(Date.UTC(y, m - 1, 1));
      fin = new Date(Date.UTC(y, m, 1));
    } else {
      fin = new Date();
      fin.setUTCMonth(fin.getUTCMonth() + 1, 1);
      debut = new Date(fin);
      debut.setUTCMonth(debut.getUTCMonth() - 12);
    }

    const { data: rows, error } = await context.supabase
      .from("rendezvous")
      .select("*")
      .in("statut", ["termine", "realise"])
      .gte("date_debut", debut.toISOString())
      .lt("date_debut", fin.toISOString())
      .order("date_debut", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    return {
      chantiers: list,
      bilan: {
        nb: list.length,
        montant_ht: list.reduce((t, r) => t + Number(r.montant_ht ?? 0), 0),
        km: Math.round(list.reduce((t, r) => t + Number(r.distance_km ?? 0) * 2, 0)),
        valides: list.filter((r) => r.chantier_valide).length,
      },
    };
  });

/**
 * Programme plusieurs chantiers ensemble : le premier à la date choisie,
 * les suivants enchaînés (même journée) ou au lendemain matin en cas de nuitée.
 */
export const programmerEnsemble = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { ids: string[]; date_debut: string; nuitee?: boolean }) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(6),
        date_debut: z.string().min(10).max(40),
        nuitee: z.boolean().default(false),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const depart = new Date(data.date_debut);
    if (Number.isNaN(depart.getTime())) throw new Error("Date de départ invalide.");

    for (let i = 0; i < data.ids.length; i++) {
      const d = new Date(depart);
      if (i > 0) {
        if (data.nuitee) {
          d.setDate(d.getDate() + i);
          d.setHours(8, 30, 0, 0);
        } else {
          d.setHours(d.getHours() + i * 3);
        }
      }
      const { error } = await context.supabase
        .from("rendezvous")
        .update({ date_debut: d.toISOString(), date_a_confirmer: false, statut: "confirme" })
        .eq("id", data.ids[i]!);
      if (error) throw new Error(error.message);
    }
    return { ok: true, nb: data.ids.length, nuitee: data.nuitee };
  });

/* ------------------------------------------------------------------ *
 * Retour de travaux : photos essentielles + métrage réellement posé
 * ------------------------------------------------------------------ */

/** Photos exigées avant de pouvoir terminer un chantier. */
export const RETOUR_CATEGORIES_OBLIGATOIRES = [
  "borne_posee",
  "raccordement_borne",
  "mise_en_service",
  "tableau_electrique",
  "compteur_linky",
] as const;

/** Photos utiles mais facultatives. */
export const RETOUR_CATEGORIES_OPTIONNELLES = [
  "cheminement_cable",
  "boite_derivation",
  "armoire",
  "vue_ensemble",
  "plaque_serie",
  "autre",
] as const;

export const RETOUR_CATEGORIES = [
  ...RETOUR_CATEGORIES_OBLIGATOIRES,
  ...RETOUR_CATEGORIES_OPTIONNELLES,
] as const;

export type RetourCategorie = (typeof RETOUR_CATEGORIES)[number];

export const RETOUR_CATEGORIES_LABELS: Record<string, string> = {
  borne_posee: "Borne posée / emplacement final",
  raccordement_borne: "Raccordement de la borne",
  mise_en_service: "Mise en service et essai",
  tableau_electrique: "Tableau électrique / protections",
  compteur_linky: "Compteur Linky (délestage)",
  cheminement_cable: "Cheminement du câble",
  boite_derivation: "Boîte de dérivation",
  armoire: "Armoire",
  vue_ensemble: "Vue d'ensemble",
  plaque_serie: "Plaque / numéro de série",
  autre: "Autre",
  emplacement_borne: "Emplacement de la borne",
  emplacement_tableau: "Emplacement du tableau",
};

const MAX_PHOTOS_CHANTIER = 40;

function decodePhoto(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image non supporté.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > 3_500_000) throw new Error("Photo trop lourde.");
  return { bytes, contentType };
}

/** L'équipe dépose une photo de retour de travaux sur un chantier. */
export const uploadPhotoChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { rendezvous_id: string; categorie: string; data_url: string; legende?: string | null }) =>
    z
      .object({
        rendezvous_id: z.string().uuid(),
        categorie: z.enum(RETOUR_CATEGORIES),
        data_url: z.string().max(4_500_000),
        legende: z.string().trim().max(160).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("rendezvous_photos")
      .select("id", { count: "exact", head: true })
      .eq("rendezvous_id", data.rendezvous_id);
    if ((count ?? 0) >= MAX_PHOTOS_CHANTIER) throw new Error("Nombre de photos maximum atteint pour ce chantier.");

    const { bytes, contentType } = decodePhoto(data.data_url);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${data.rendezvous_id}/${data.categorie}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const { error: upErr } = await context.supabase.storage
      .from("chantier-photos")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error("Envoi de la photo impossible.");

    const { error } = await context.supabase.from("rendezvous_photos").insert({
      rendezvous_id: data.rendezvous_id,
      path,
      source: "equipe",
      categorie: data.categorie,
      legende: data.legende ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, path };
  });

/** Supprime une photo de chantier (fichier + fiche). */
export const supprimerPhotoChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("rendezvous_photos")
      .select("id, path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true as const };
    await context.supabase.storage.from("chantier-photos").remove([row.path]);
    const { error } = await context.supabase.from("rendezvous_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Enregistre le métrage réellement posé et les observations de fin d'intervention. */
export const enregistrerRetourTravaux = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (raw: {
      id: string;
      metrage_inclus_m?: number | string | null;
      metrage_reel_m?: number | string | null;
      retour_observations?: string | null;
      retour_delestage?: boolean;
      type_pose?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          metrage_inclus_m: num(0, 10000, 5),
          metrage_reel_m: num(0, 10000, 0),
          retour_observations: z.string().trim().max(4000).optional().nullable(),
          retour_delestage: z.boolean().default(false),
          type_pose: z.string().trim().max(80).optional().nullable(),
        })
        .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        metrage_inclus_m: data.metrage_inclus_m,
        metrage_reel_m: data.metrage_reel_m,
        metrage_m: data.metrage_reel_m || undefined,
        retour_observations: data.retour_observations ?? null,
        retour_delestage: data.retour_delestage,
        retour_complete_at: new Date().toISOString(),
        ...(data.type_pose ? { type_pose: data.type_pose } : {}),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const supplement = Math.max(0, (data.metrage_reel_m || 0) - (data.metrage_inclus_m || 0));
    return { ok: true as const, supplement_m: supplement };
  });

/** Photos d'un chantier (déposées par l'équipe ou par le partenaire) : URLs signées. */
export const listPhotosChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { rendezvous_id: string }) =>
    z.object({ rendezvous_id: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rendezvous_photos")
      .select("id, path, source, legende, categorie, created_at")
      .eq("rendezvous_id", data.rendezvous_id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (!list.length) return [];
    const { data: signed } = await context.supabase.storage
      .from("chantier-photos")
      .createSignedUrls(
        list.map((p) => p.path),
        60 * 60,
      );
    return list.map((p, i) => ({ ...p, url: signed?.[i]?.signedUrl ?? null }));
  });

/* ------------------------------------------------------------------ *
 * Facturation des chantiers terminés : échéances, retards, métrages
 * ------------------------------------------------------------------ */

/** Statuts de suivi de règlement d'un chantier. */
export const FACTU_STATUTS = ["a_facturer", "facture", "paye"] as const;

/**
 * Tableau « Chantiers terminés à facturer » :
 * chantiers terminés/réalisés avec leur échéance de règlement, le retard
 * éventuel, le métrage de câble posé et le nombre de bornes du mois.
 */
export const getSuiviFacturation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { mois?: string | null }) =>
    z
      .object({
        mois: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .nullable(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const mois = data.mois ?? now.toISOString().slice(0, 7);
    const [y, m] = mois.split("-").map(Number) as [number, number];
    const debutMois = new Date(Date.UTC(y, m - 1, 1));
    const finMois = new Date(Date.UTC(y, m, 1));

    // Tous les chantiers terminés non encore payés (toutes périodes) + ceux du mois.
    const { data: rows, error } = await context.supabase
      .from("rendezvous")
      .select(
        "id, titre, designation, client_nom, client_email, client_telephone, adresse, cp_ville, partenaire, partenaire_id, origine, date_debut, termine_at, montant_ht, tva_pct, statut, statut_facturation, delai_paiement_jours, echeance_paiement, facture_envoyee_at, paye_at, metrage_inclus_m, metrage_reel_m, metrage_m, puissance_borne, montant_propose_ht, montant_propose_note, montant_propose_at, montant_propose_par, montant_valide_at",
      )
      .in("statut", ["termine", "realise"])
      .order("echeance_paiement", { ascending: true, nullsFirst: false })
      .limit(600);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const aujourdhui = now.toISOString().slice(0, 10);

    // Sous-traitance : la facture part au partenaire. Chantier direct : au client final.
    const partenaireIds = [...new Set(list.map((r) => r.partenaire_id).filter(Boolean))] as string[];
    const partenairesMap = new Map<string, { nom: string; email: string | null }>();
    if (partenaireIds.length > 0) {
      const { data: parts } = await context.supabase
        .from("partenaires")
        .select("id, nom, email")
        .in("id", partenaireIds);
      for (const p of parts ?? []) partenairesMap.set(p.id, { nom: p.nom, email: p.email });
    }

    const enrichis = list.map((r) => {
      const echeance = r.echeance_paiement ?? null;
      const enRetard =
        r.statut_facturation !== "paye" && Boolean(echeance) && echeance! < aujourdhui;
      const joursRestants = echeance
        ? Math.round(
            (new Date(`${echeance}T00:00:00Z`).getTime() -
              new Date(`${aujourdhui}T00:00:00Z`).getTime()) /
              86_400_000,
          )
        : null;
      const inclus = Number(r.metrage_inclus_m ?? 5);
      const reel = r.metrage_reel_m == null ? null : Number(r.metrage_reel_m);
      const part = r.partenaire_id ? partenairesMap.get(r.partenaire_id) : undefined;
      const sousTraitance = r.origine === "sous_traitance" || Boolean(r.partenaire_id);
      return {
        ...r,
        en_retard: enRetard,
        jours_restants: joursRestants,
        supplement_m: reel == null ? null : Math.max(0, reel - inclus),
        facturer_a: (sousTraitance ? "partenaire" : "client") as "partenaire" | "client",
        destinataire_nom: sousTraitance ? (part?.nom ?? r.partenaire ?? null) : r.client_nom,
        destinataire_email: sousTraitance ? (part?.email ?? null) : (r.client_email ?? null),
      };
    });

    const encours = enrichis.filter((r) => r.statut_facturation !== "paye");
    const duMois = enrichis.filter((r) => {
      const ref = r.termine_at ?? r.date_debut;
      return ref >= debutMois.toISOString() && ref < finMois.toISOString();
    });

    const somme = (arr: typeof enrichis, f: (r: (typeof enrichis)[number]) => number) =>
      arr.reduce((t, r) => t + f(r), 0);

    return {
      mois,
      chantiers: enrichis,
      totaux: {
        a_facturer_nb: encours.filter((r) => r.statut_facturation === "a_facturer").length,
        a_facturer_ht: somme(
          encours.filter((r) => r.statut_facturation === "a_facturer"),
          (r) => Number(r.montant_ht ?? 0),
        ),
        facture_nb: encours.filter((r) => r.statut_facturation === "facture").length,
        facture_ht: somme(
          encours.filter((r) => r.statut_facturation === "facture"),
          (r) => Number(r.montant_ht ?? 0),
        ),
        retard_nb: encours.filter((r) => r.en_retard).length,
        retard_ht: somme(
          encours.filter((r) => r.en_retard),
          (r) => Number(r.montant_ht ?? 0),
        ),
        a_valider_nb: enrichis.filter(
          (r) => r.montant_propose_ht != null && r.montant_valide_at == null,
        ).length,
      },
      mois_totaux: {
        nb: duMois.length,
        ht: somme(duMois, (r) => Number(r.montant_ht ?? 0)),
        paye_ht: somme(
          duMois.filter((r) => r.statut_facturation === "paye"),
          (r) => Number(r.montant_ht ?? 0),
        ),
        metrage_reel_m: somme(duMois, (r) => Number(r.metrage_reel_m ?? r.metrage_m ?? 0)),
        metrage_supplement_m: somme(duMois, (r) => Number(r.supplement_m ?? 0)),
        bornes: duMois.length,
      },
    };
  });

/** Met à jour le suivi de règlement d'un chantier (statut, délai, échéance). */
export const updateSuiviPaiement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (raw: {
      id: string;
      statut_facturation?: "a_facturer" | "facture" | "paye";
      delai_paiement_jours?: number | string | null;
      echeance_paiement?: string | null;
      montant_ht?: number | string | null;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          statut_facturation: z.enum(FACTU_STATUTS).optional(),
          delai_paiement_jours: num(0, 365, 30).optional(),
          echeance_paiement: z
            .preprocess(
              (v) => (typeof v === "string" && v.trim() === "" ? null : v),
              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
            )
            .optional(),
          montant_ht: num(0, 1_000_000, 0).optional(),
        })
        .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      montant_ht?: number;
      delai_paiement_jours?: number;
      echeance_paiement?: string | null;
      statut_facturation?: string;
      facture_envoyee_at?: string | null;
      paye_at?: string | null;
    } = {};
    if (data.montant_ht !== undefined) patch.montant_ht = data.montant_ht;
    if (data.delai_paiement_jours !== undefined) patch.delai_paiement_jours = data.delai_paiement_jours;
    if (data.echeance_paiement !== undefined) patch.echeance_paiement = data.echeance_paiement;

    if (data.statut_facturation) {
      patch.statut_facturation = data.statut_facturation;
      const maintenant = new Date();
      if (data.statut_facturation === "facture") {
        patch.facture_envoyee_at = maintenant.toISOString();
        patch.paye_at = null;
        // L'échéance court à partir de la facture si elle n'est pas fixée à la main.
        if (data.echeance_paiement === undefined) {
          const { data: rdv } = await context.supabase
            .from("rendezvous")
            .select("delai_paiement_jours, echeance_paiement")
            .eq("id", data.id)
            .maybeSingle();
          const delai = Number(data.delai_paiement_jours ?? rdv?.delai_paiement_jours ?? 30);
          const ech = new Date(maintenant);
          ech.setDate(ech.getDate() + delai);
          patch.echeance_paiement = ech.toISOString().slice(0, 10);
        }
      } else if (data.statut_facturation === "paye") {
        patch.paye_at = maintenant.toISOString();
      } else {
        patch.paye_at = null;
      }
    }

    const { error } = await context.supabase.from("rendezvous").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Accepte ou refuse le montant révisé proposé par le partenaire. */
export const validerMontantPropose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; accepter: boolean }) =>
    z.object({ id: z.string().uuid(), accepter: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: rdv, error: readErr } = await context.supabase
      .from("rendezvous")
      .select("id, montant_propose_ht")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (rdv.montant_propose_ht == null) throw new Error("Aucun montant proposé sur ce chantier.");

    const patch: {
      montant_ht?: number;
      montant_valide_at?: string | null;
      montant_propose_ht?: number | null;
      montant_propose_note?: string | null;
      montant_propose_at?: string | null;
      montant_propose_par?: string | null;
    } = data.accepter
      ? {
          montant_ht: Number(rdv.montant_propose_ht),
          montant_valide_at: new Date().toISOString(),
        }
      : {
          montant_propose_ht: null,
          montant_propose_note: null,
          montant_propose_at: null,
          montant_propose_par: null,
          montant_valide_at: null,
        };
    const { error } = await context.supabase.from("rendezvous").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, accepte: data.accepter };
  });

/** Numérotation séquentielle des factures (F-AAAA-NNNN). */
async function nextFactureNumero(supabase: { from: (t: string) => any }, prefix: string) {
  const { data } = await supabase
    .from("factures")
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);
  const last = data?.[0]?.numero ? Number(String(data[0].numero).slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
}

/**
 * Crée la facture d'un chantier terminé vers le bon destinataire :
 * le partenaire quand le chantier vient de la sous-traitance,
 * le client final quand nous l'avons obtenu nous-mêmes.
 */
export const creerFactureChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: rdv, error } = await context.supabase
      .from("rendezvous")
      .select(
        "id, titre, designation, client_nom, client_email, client_telephone, adresse, cp_ville, partenaire, partenaire_id, origine, montant_ht, tva_pct, delai_paiement_jours, metrage_inclus_m, metrage_reel_m, puissance_borne, statut, statut_facturation, termine_at",
      )
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (rdv.statut !== "termine" && rdv.statut !== "realise") {
      throw new Error("Le chantier doit être terminé avant d'être facturé.");
    }
    const montantHt = Number(rdv.montant_ht ?? 0);
    if (montantHt <= 0) throw new Error("Renseignez d'abord le montant HT du chantier.");

    let partenaire: {
      nom: string;
      email: string | null;
      delai_paiement_jours: number | null;
      raison_sociale: string | null;
      adresse: string | null;
      cp_ville: string | null;
      pays: string | null;
      siret: string | null;
      tva_intracom: string | null;
      telephone: string | null;
    } | null = null;
    if (rdv.partenaire_id) {
      const { data: p } = await context.supabase
        .from("partenaires")
        .select(
          "nom, email, delai_paiement_jours, raison_sociale, adresse, cp_ville, pays, siret, tva_intracom, telephone",
        )
        .eq("id", rdv.partenaire_id)
        .maybeSingle();
      partenaire = p ?? null;
    }
    const sousTraitance = rdv.origine === "sous_traitance" || Boolean(rdv.partenaire_id);

    const destinataireNom = sousTraitance
      ? (partenaire?.raison_sociale || partenaire?.nom || rdv.partenaire || "Partenaire")
      : rdv.client_nom;
    if (sousTraitance && !partenaire?.adresse) {
      throw new Error(
        "Complétez d'abord la fiche du partenaire (adresse de siège) pour émettre une facture conforme.",
      );
    }
    const destinataireEmail = sousTraitance ? (partenaire?.email ?? null) : rdv.client_email;

    const today = new Date();
    const delai = Number(rdv.delai_paiement_jours ?? partenaire?.delai_paiement_jours ?? 30);
    const echeance = new Date(today);
    echeance.setDate(echeance.getDate() + delai);
    const numero = await nextFactureNumero(context.supabase as any, `F-${today.getFullYear()}-`);

    const tva = Number(rdv.tva_pct ?? 20);
    const totalTva = Math.round(montantHt * (tva / 100) * 100) / 100;
    const chantierLieu = [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", ");
    const objet = sousTraitance
      ? `Sous-traitance IRVE — ${rdv.designation || rdv.titre || "intervention"}${
          rdv.client_nom ? ` (client final : ${rdv.client_nom})` : ""
        }`
      : rdv.designation || rdv.titre || "Installation borne de recharge";

    const inclus = Number(rdv.metrage_inclus_m ?? 5);
    const reel = rdv.metrage_reel_m == null ? null : Number(rdv.metrage_reel_m);
    const supplement = reel == null ? 0 : Math.max(0, reel - inclus);
    const description = [
      chantierLieu ? `Chantier : ${chantierLieu}` : null,
      rdv.puissance_borne ? `Borne ${rdv.puissance_borne}` : null,
      reel == null ? null : `Câble posé ${reel} m (forfait ${inclus} m${supplement > 0 ? `, +${supplement} m` : ""})`,
      rdv.termine_at ? `Travaux terminés le ${new Date(rdv.termine_at).toLocaleDateString("fr-FR")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const { data: facture, error: insertError } = await context.supabase
      .from("factures")
      .insert({
        numero,
        date_emission: today.toISOString().slice(0, 10),
        date_echeance: echeance.toISOString().slice(0, 10),
        client_nom: destinataireNom,
        client_email: destinataireEmail,
        client_telephone: sousTraitance ? (partenaire?.telephone ?? null) : rdv.client_telephone,
        client_adresse: sousTraitance ? partenaire?.adresse : rdv.adresse,
        client_cp_ville: sousTraitance
          ? [partenaire?.cp_ville, partenaire?.pays && partenaire.pays !== "France" ? partenaire.pays : null]
              .filter(Boolean)
              .join(" — ") || null
          : rdv.cp_ville,
        objet,
        remise_pct: 0,
        acompte_pct: 0,
        conditions_paiement: `Règlement à ${delai} jours`,
        notes: sousTraitance
          ? [
              partenaire?.siret ? `SIRET client : ${partenaire.siret}` : null,
              partenaire?.tva_intracom ? `TVA intracommunautaire : ${partenaire.tva_intracom}` : null,
              chantierLieu ? `Chantier réalisé : ${chantierLieu}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || null
          : null,
        statut: "brouillon",
        total_ht_brut: montantHt,
        total_remise: 0,
        total_ht: montantHt,
        total_tva: totalTva,
        total_ttc: Math.round((montantHt + totalTva) * 100) / 100,
        created_by: context.userId,
      })
      .select("id, numero")
      .single();
    if (insertError) throw new Error(insertError.message);

    const { error: itemError } = await context.supabase.from("facture_items").insert({
      facture_id: facture.id,
      libelle: objet,
      description: description || null,
      quantite: 1,
      prix_unitaire: montantHt,
      tva,
      ordre: 1,
    });
    if (itemError) throw new Error(itemError.message);

    await context.supabase
      .from("rendezvous")
      .update({
        statut_facturation: "facture",
        facture_envoyee_at: today.toISOString(),
        echeance_paiement: echeance.toISOString().slice(0, 10),
        delai_paiement_jours: delai,
      })
      .eq("id", rdv.id);

    return {
      id: facture.id as string,
      numero: facture.numero as string,
      destinataire: destinataireNom,
      facturer_a: (sousTraitance ? "partenaire" : "client") as "partenaire" | "client",
    };
  });
