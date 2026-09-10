import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trajetDepuisBase } from "@/lib/geo";

/**
 * Espace partenaire : un lien secret par partenaire (ex. Pure Énergie).
 * Le partenaire saisit ses dossiers (client, adresse, montant, date ou
 * « rendez-vous à prendre ») et ne voit QUE ses propres dossiers.
 * Aucune authentification : le jeton du partenaire fait office de clé.
 */

const tokenSchema = z.object({
  token: z.string().uuid(),
  /** Session ouverte après saisie du code à 6 chiffres. */
  session: z.string().uuid().optional().nullable(),
});

/** Champ texte facultatif : chaîne vide enregistrée comme absente. */
const texteOptionnel = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(max).nullable(),
    )
    .default(null);

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(query)}`,
      { headers: { accept: "application/json" }, signal: controller.signal },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const c = json.features?.[0]?.geometry?.coordinates;
    return c ? { lng: c[0], lat: c[1] } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------- Côté équipe ------------------------------ */

export const listPartenaires = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("partenaires")
      .select("id, nom, raison_sociale, adresse, cp_ville, pays, siret, tva_intracom, contact_nom, telephone, token, actif, notes, couleur, email, delai_paiement_jours, created_at, pin_defini_at, dernier_acces_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p) => p.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: rows } = await context.supabase
        .from("rendezvous")
        .select("partenaire_id")
        .in("partenaire_id", ids)
        .limit(2000);
      for (const r of rows ?? []) {
        if (r.partenaire_id) counts.set(r.partenaire_id, (counts.get(r.partenaire_id) ?? 0) + 1);
      }
    }
    return (data ?? []).map((p) => ({ ...p, dossiers: counts.get(p.id) ?? 0 }));
  });

export const savePartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (raw: {
      id?: string | null;
      nom: string;
      actif?: boolean;
      notes?: string | null;
      couleur?: string | null;
      email?: string | null;
      delai_paiement_jours?: number | string | null;
      raison_sociale?: string | null;
      adresse?: string | null;
      cp_ville?: string | null;
      pays?: string | null;
      siret?: string | null;
      tva_intracom?: string | null;
      contact_nom?: string | null;
      telephone?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional().nullable(),
          nom: z.string().trim().min(2).max(160),
          actif: z.boolean().default(true),
          notes: z.string().trim().max(1000).optional().nullable(),
          couleur: z
            .string()
            .trim()
            .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide")
            .default("#0284c7"),
          email: z
            .preprocess(
              (v) => (typeof v === "string" && v.trim() === "" ? null : v),
              z.string().trim().email("Adresse email invalide").max(255).nullable(),
            )
            .default(null),
          delai_paiement_jours: z
            .preprocess((v) => {
              if (v === null || v === undefined || v === "") return 30;
              const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
              return Number.isFinite(n) ? Math.round(n) : 30;
            }, z.number().int().min(0).max(365))
            .default(30),
          raison_sociale: texteOptionnel(200),
          adresse: texteOptionnel(240),
          cp_ville: texteOptionnel(120),
          pays: z
            .preprocess(
              (v) => (typeof v === "string" && v.trim() === "" ? "France" : v),
              z.string().trim().max(80),
            )
            .default("France"),
          siret: texteOptionnel(30),
          tva_intracom: texteOptionnel(30),
          contact_nom: texteOptionnel(160),
          telephone: texteOptionnel(40),
        })
        .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("partenaires")
        .update({
          nom: data.nom,
          actif: data.actif,
          notes: data.notes ?? null,
          couleur: data.couleur,
          email: data.email ?? null,
          delai_paiement_jours: data.delai_paiement_jours,
          raison_sociale: data.raison_sociale ?? null,
          adresse: data.adresse ?? null,
          cp_ville: data.cp_ville ?? null,
          pays: data.pays,
          siret: data.siret ?? null,
          tva_intracom: data.tva_intracom ?? null,
          contact_nom: data.contact_nom ?? null,
          telephone: data.telephone ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("partenaires")
      .insert({
        nom: data.nom,
        actif: data.actif,
        notes: data.notes ?? null,
        couleur: data.couleur,
        email: data.email ?? null,
        delai_paiement_jours: data.delai_paiement_jours,
        raison_sociale: data.raison_sociale ?? null,
        adresse: data.adresse ?? null,
        cp_ville: data.cp_ville ?? null,
        pays: data.pays,
        siret: data.siret ?? null,
        tva_intracom: data.tva_intracom ?? null,
        contact_nom: data.contact_nom ?? null,
        telephone: data.telephone ?? null,
        owner_user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });


export const deletePartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("partenaires").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------- Code d'accès à 6 chiffres ------------------------ */

const PBKDF2_ITERATIONS = 90_000;
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return b64(new Uint8Array(bits));
}

async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${await derive(pin, salt)}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const attendu = parts[3]!;
  const obtenu = await derive(pin, fromB64(parts[2]!));
  if (obtenu.length !== attendu.length) return false;
  let diff = 0;
  for (let i = 0; i < obtenu.length; i++) diff |= obtenu.charCodeAt(i) ^ attendu.charCodeAt(i);
  return diff === 0;
}

const pinSchema = z.object({
  token: z.string().uuid(),
  pin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Le code doit contenir exactement 6 chiffres."),
});

/* ----------------------------- Côté partenaire ---------------------------- */

/**
 * Charge le partenaire à partir de son lien.
 * Dès qu'un code à 6 chiffres est défini, une session valide est exigée.
 */
async function loadPartenaire(data: { token: string; session?: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: partenaire, error } = await supabaseAdmin
    .from("partenaires")
    .select("id, nom, actif, owner_user_id, delai_paiement_jours, pin_hash")
    .eq("token", data.token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!partenaire || !partenaire.actif) throw new Error("Ce lien de saisie n'est plus valide.");

  if (partenaire.pin_hash) {
    if (!data.session) throw new Error("Code d'accès requis.");
    const { data: sess } = await supabaseAdmin
      .from("partenaire_sessions")
      .select("id, expires_at")
      .eq("token", data.session)
      .eq("partenaire_id", partenaire.id)
      .maybeSingle();
    if (!sess || new Date(sess.expires_at).getTime() < Date.now()) {
      throw new Error("Code d'accès requis.");
    }
  }
  return { partenaire, supabaseAdmin };
}

async function ouvrirSession(partenaireId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("partenaire_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const { data, error } = await supabaseAdmin
    .from("partenaire_sessions")
    .insert({ partenaire_id: partenaireId })
    .select("token, expires_at")
    .single();
  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("partenaires")
    .update({ dernier_acces_at: new Date().toISOString() })
    .eq("id", partenaireId);
  return { session: data.token as string, expires_at: data.expires_at as string };
}

/** État du lien : le code est-il déjà créé, la session est-elle encore valide ? */
export const getAccesPartenaire = createServerFn({ method: "GET" })
  .inputValidator((raw: { token: string; session?: string | null }) => tokenSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partenaire } = await supabaseAdmin
      .from("partenaires")
      .select("id, nom, actif, pin_hash")
      .eq("token", data.token)
      .maybeSingle();
    if (!partenaire || !partenaire.actif) throw new Error("Ce lien de saisie n'est plus valide.");

    let session_valide = false;
    if (data.session) {
      const { data: sess } = await supabaseAdmin
        .from("partenaire_sessions")
        .select("expires_at")
        .eq("token", data.session)
        .eq("partenaire_id", partenaire.id)
        .maybeSingle();
      session_valide = Boolean(sess && new Date(sess.expires_at).getTime() > Date.now());
    }
    return {
      nom: partenaire.nom,
      pin_defini: Boolean(partenaire.pin_hash),
      session_valide,
    };
  });

/** Première visite : le partenaire choisit lui-même son code à 6 chiffres. */
export const definirPinPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => pinSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partenaire } = await supabaseAdmin
      .from("partenaires")
      .select("id, actif, pin_hash")
      .eq("token", data.token)
      .maybeSingle();
    if (!partenaire || !partenaire.actif) throw new Error("Ce lien de saisie n'est plus valide.");
    if (partenaire.pin_hash) {
      throw new Error("Un code est déjà défini pour cet accès. Saisissez-le ou demandez une réinitialisation.");
    }
    if (/^(\d)\1{5}$/.test(data.pin) || data.pin === "123456") {
      throw new Error("Choisissez un code moins évident.");
    }
    const { error } = await supabaseAdmin
      .from("partenaires")
      .update({ pin_hash: await hashPin(data.pin), pin_defini_at: new Date().toISOString() })
      .eq("id", partenaire.id);
    if (error) throw new Error(error.message);
    return await ouvrirSession(partenaire.id);
  });

/** Visites suivantes : saisie du code à 6 chiffres. */
export const connexionPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => pinSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: partenaire } = await supabaseAdmin
      .from("partenaires")
      .select("id, actif, pin_hash")
      .eq("token", data.token)
      .maybeSingle();
    if (!partenaire || !partenaire.actif) throw new Error("Ce lien de saisie n'est plus valide.");
    if (!partenaire.pin_hash) throw new Error("Aucun code défini : créez votre code d'accès.");
    if (!(await verifyPin(data.pin, partenaire.pin_hash))) {
      throw new Error("Code incorrect.");
    }
    return await ouvrirSession(partenaire.id);
  });

/** Déconnexion depuis l'appareil du partenaire. */
export const deconnexionPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: { session: string }) =>
    z.object({ session: z.string().uuid() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("partenaire_sessions").delete().eq("token", data.session);
    return { ok: true as const };
  });

/* --------- Côté équipe : réinitialisation du code et rotation du lien -------- */

/** Le partenaire a oublié son code : il en recrée un à sa prochaine visite. */
export const reinitialiserPinPartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("partenaires")
      .update({ pin_hash: null, pin_defini_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("partenaire_sessions").delete().eq("partenaire_id", data.id);
    return { ok: true as const };
  });

/** Fuite ou départ : nouveau lien, l'ancien devient inutilisable. */
export const regenererLienPartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await context.supabase
      .from("partenaires")
      .update({ token: crypto.randomUUID(), pin_hash: null, pin_defini_at: null })
      .eq("id", data.id)
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("partenaire_sessions").delete().eq("partenaire_id", data.id);
    return { token: row.token as string };
  });

export const getEspacePartenaire = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string; session?: string | null }) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);
    const { data: dossiers } = await supabaseAdmin
      .from("rendezvous")
      .select(
        "id, titre, designation, client_nom, client_telephone, adresse, cp_ville, date_debut, date_a_confirmer, statut, montant_ht, notes, metrage_m, puissance_borne, phase_installation, type_pose, materiel_statut, materiel_maj_at, demarre_at, termine_at, created_at, metrage_inclus_m, metrage_reel_m, retour_delestage, retour_observations, statut_facturation, echeance_paiement, montant_propose_ht, montant_propose_note, montant_propose_at, montant_valide_at",
      )
      .eq("partenaire_id", partenaire.id)
      .order("created_at", { ascending: false })
      .limit(200);
    return {
      nom: partenaire.nom,
      delai_paiement_jours: partenaire.delai_paiement_jours ?? 30,
      dossiers: dossiers ?? [],
    };
  });

/** Suivi du matériel côté partenaire. */
export const MATERIEL_STATUTS = ["en_cours", "envoye", "sur_place"] as const;

export const MATERIEL_LABELS: Record<(typeof MATERIEL_STATUTS)[number], string> = {
  en_cours: "Matériel en cours",
  envoye: "Matériel envoyé",
  sur_place: "Matériel sur place",
};

const dossierSchema = tokenSchema.extend({
  client_nom: z.string().trim().min(2).max(160),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_email: z.string().trim().max(255).optional().nullable(),
  adresse: z.string().trim().min(3).max(300),
  cp_ville: z.string().trim().max(160).optional().nullable(),
  designation: z.string().trim().max(200).optional().nullable(),
  metrage_m: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, z.number().min(0).max(10000).nullable()).optional(),
  puissance_borne: z.enum(["3,7 kW", "7,4 kW", "11 kW", "22 kW", "À définir"]).optional().nullable(),
  phase_installation: z.enum(["Monophasé", "Triphasé", "À définir"]).optional().nullable(),
  type_pose: z.enum(["Intérieure", "Extérieure", "Sur pied", "À définir"]).optional().nullable(),
  /** Date/heure souhaitée ; vide = rendez-vous à prendre. */
  date_debut: z.string().trim().max(40).optional().nullable(),
  montant_ht: z
    .preprocess((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }, z.number().min(0).max(1_000_000))
    .default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  materiel_statut: z.enum(MATERIEL_STATUTS).default("en_cours"),
});

export const creerDossierPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => dossierSchema.parse(raw))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);
    if (!partenaire.owner_user_id) {
      throw new Error("Ce lien n'est pas encore configuré. Contactez Borne de l'Ouest.");
    }

    const dateSaisie = data.date_debut ? new Date(data.date_debut) : null;
    const dateValide = dateSaisie && !Number.isNaN(dateSaisie.getTime()) ? dateSaisie : null;

    const geo = await geocode([data.adresse, data.cp_ville].filter(Boolean).join(" "));
    const trajet = geo ? trajetDepuisBase(geo.lat, geo.lng) : null;

    const { data: dossier, error } = await supabaseAdmin.from("rendezvous").insert({
      user_id: partenaire.owner_user_id,
      partenaire_id: partenaire.id,
      partenaire: partenaire.nom,
      origine: "sous_traitance",
      titre: data.designation?.trim() || `Intervention ${partenaire.nom}`,
      designation: data.designation ?? null,
      metrage_m: data.metrage_m ?? null,
      puissance_borne: data.puissance_borne ?? null,
      phase_installation: data.phase_installation ?? null,
      type_pose: data.type_pose ?? null,
      type: "installation",
      statut: "planifie",
      client_nom: data.client_nom,
      client_telephone: data.client_telephone ?? null,
      client_email: data.client_email ?? null,
      adresse: data.adresse,
      cp_ville: data.cp_ville ?? null,
      date_debut: (dateValide ?? new Date()).toISOString(),
      date_a_confirmer: !dateValide,
      duree_min: 120,
      montant_ht: data.montant_ht,
      statut_facturation: "a_facturer",
      materiel_statut: data.materiel_statut,
      materiel_maj_at: new Date().toISOString(),
      notes: data.notes ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      distance_km: trajet?.distance_km ?? null,
      duree_trajet_min: trajet?.duree_trajet_min ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: dossier.id, geocode: Boolean(geo) };
  });

/* --------------------- Photos déposées par le partenaire -------------------- */

/** Catégories d'étude déposées par le partenaire. */
export const PHOTO_CATEGORIES = [
  "emplacement_borne",
  "cheminement_cable",
  "emplacement_tableau",
  "autre",
] as const;

export const PHOTO_CATEGORIES_LABELS: Record<(typeof PHOTO_CATEGORIES)[number], string> = {
  emplacement_borne: "Emplacement de la borne",
  cheminement_cable: "Cheminement du câble",
  emplacement_tableau: "Emplacement du tableau",
  autre: "Autre",
};

const photoSchema = tokenSchema.extend({
  rendezvous_id: z.string().uuid(),
  /** data:image/jpeg;base64,… — compressée dans le navigateur. */
  data_url: z.string().max(4_500_000),
  legende: z.string().trim().max(160).optional().nullable(),
  categorie: z.enum(PHOTO_CATEGORIES).default("autre"),
});

const MAX_PHOTOS_PAR_DOSSIER = 20;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("Format d'image non supporté.");
  const contentType = match[1]!;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length > 3_500_000) throw new Error("Photo trop lourde.");
  return { bytes, contentType };
}

/** Le partenaire dépose une photo sur l'un de SES dossiers (jeton vérifié). */
export const uploadPhotoPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => photoSchema.parse(raw))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);

    const { data: dossier } = await supabaseAdmin
      .from("rendezvous")
      .select("id")
      .eq("id", data.rendezvous_id)
      .eq("partenaire_id", partenaire.id)
      .maybeSingle();
    if (!dossier) throw new Error("Dossier introuvable.");

    const { count } = await supabaseAdmin
      .from("rendezvous_photos")
      .select("id", { count: "exact", head: true })
      .eq("rendezvous_id", data.rendezvous_id);
    if ((count ?? 0) >= MAX_PHOTOS_PAR_DOSSIER) {
      throw new Error("Nombre de photos maximum atteint pour ce dossier.");
    }

    const { bytes, contentType } = decodeDataUrl(data.data_url);
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `${data.rendezvous_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("chantier-photos")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) throw new Error("Envoi de la photo impossible.");

    const { error: insErr } = await supabaseAdmin.from("rendezvous_photos").insert({
      rendezvous_id: data.rendezvous_id,
      path,
      source: "partenaire",
      categorie: data.categorie,
      legende: data.legende ?? null,
    });
    if (insErr) throw new Error("Enregistrement de la photo impossible.");

    return { ok: true as const, path };
  });

/** Nombre de photos déjà déposées par dossier (affichage côté partenaire). */
export const comptePhotosPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: { token: string; session?: string | null }) => tokenSchema.parse(raw))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);
    const { data: dossiers } = await supabaseAdmin
      .from("rendezvous")
      .select("id")
      .eq("partenaire_id", partenaire.id)
      .limit(200);
    const ids = (dossiers ?? []).map((d) => d.id);
    const vide: Record<string, ComptePhotos> = {};
    if (!ids.length) return vide;
    const { data: photos } = await supabaseAdmin
      .from("rendezvous_photos")
      .select("rendezvous_id, categorie")
      .in("rendezvous_id", ids)
      .limit(2000);
    const compte: Record<string, ComptePhotos> = {};
    for (const p of photos ?? []) {
      const entree = (compte[p.rendezvous_id] ??= { total: 0, categories: {} });
      entree.total += 1;
      const cat = p.categorie ?? "autre";
      entree.categories[cat] = (entree.categories[cat] ?? 0) + 1;
    }
    return compte;
  });

export type ComptePhotos = { total: number; categories: Record<string, number> };

/** Le partenaire indique si le matériel est déjà envoyé ou encore en cours. */
export const majMaterielPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    tokenSchema
      .extend({
        rendezvous_id: z.string().uuid(),
        materiel_statut: z.enum(MATERIEL_STATUTS),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);
    const { data: dossier } = await supabaseAdmin
      .from("rendezvous")
      .select("id")
      .eq("id", data.rendezvous_id)
      .eq("partenaire_id", partenaire.id)
      .maybeSingle();
    if (!dossier) throw new Error("Dossier introuvable.");
    const { error } = await supabaseAdmin
      .from("rendezvous")
      .update({
        materiel_statut: data.materiel_statut,
        materiel_maj_at: new Date().toISOString(),
      })
      .eq("id", data.rendezvous_id);
    if (error) throw new Error("Mise à jour impossible.");
    return { ok: true as const, materiel_statut: data.materiel_statut };
  });

/* ------------- Valorisation : le partenaire propose un montant révisé ------------- */

const montantSchema = tokenSchema.extend({
  rendezvous_id: z.string().uuid(),
  montant_ht: z.preprocess((v) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, z.number().min(0).max(1_000_000)),
  note: z.string().trim().max(1000).optional().nullable(),
  par: z.string().trim().max(160).optional().nullable(),
});

/**
 * Après les travaux, le partenaire propose le montant valorisé de l'intervention.
 * Le montant n'entre dans les chiffres qu'après validation par l'équipe.
 */
export const proposerMontantPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => montantSchema.parse(raw))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data);

    const { data: dossier } = await supabaseAdmin
      .from("rendezvous")
      .select("id, statut")
      .eq("id", data.rendezvous_id)
      .eq("partenaire_id", partenaire.id)
      .maybeSingle();
    if (!dossier) throw new Error("Dossier introuvable.");

    const { error } = await supabaseAdmin
      .from("rendezvous")
      .update({
        montant_propose_ht: data.montant_ht,
        montant_propose_note: data.note ?? null,
        montant_propose_at: new Date().toISOString(),
        montant_propose_par: data.par?.trim() || partenaire.nom,
        montant_valide_at: null,
      })
      .eq("id", data.rendezvous_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
