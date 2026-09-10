import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trajetDepuisBase, technicienByNom } from "@/lib/geo";

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
    const { error } = await context.supabase
      .from("rendezvous")
      .update({ statut: data.statut })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
