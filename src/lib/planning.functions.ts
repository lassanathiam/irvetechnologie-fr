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

/** Archive (ou sort des archives) un chantier clôturé, sans le supprimer. */
export const archiverRendezVous = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string; archive: boolean }) =>
    z.object({ id: z.string().uuid(), archive: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        archive: data.archive,
        archive_at: data.archive ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
        "id, client_nom, client_email, adresse, cp_ville, titre, designation, partenaire, demarre_at",
      )
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const fin = new Date();
    const debut = rdv.demarre_at ? new Date(rdv.demarre_at) : null;
    const dureeMin = debut ? Math.max(1, Math.round((fin.getTime() - debut.getTime()) / 60000)) : null;

    const { error } = await context.supabase
      .from("rendezvous")
      .update({
        termine_at: fin.toISOString(),
        statut: "termine",
        chantier_valide: true,
        chantier_valide_at: fin.toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    let notifie = false;
    if (data.notifier) {
      try {
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { COMPANY } = await import("@/lib/company");
        const destinataire = rdv.client_email?.trim() || COMPANY.email;
        const res = await sendTemplateEmail("chantier-termine", destinataire, {
          templateData: {
            client_nom: rdv.client_nom,
            adresse: [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", "),
            objet: rdv.designation || rdv.titre,
            partenaire: rdv.partenaire,
            termine_at: fin.toISOString(),
            duree_min: dureeMin,
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
