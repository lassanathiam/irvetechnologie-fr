import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normaliserZones, type Signataire, type Zone } from "./documents";

const idSchema = z.object({ id: z.string().uuid() });
const tokenSchema = z.object({ token: z.string().uuid() });
const dataUrl = z.string().regex(/^data:image\/(png|jpeg|jpg);base64,/).max(3_000_000);

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function telecharger(path: string) {
  const sb = await admin();
  const { data, error } = await sb.storage.from("documents").download(path);
  if (error || !data) throw new Error("Fichier introuvable.");
  return new Uint8Array(await data.arrayBuffer());
}

async function deposer(path: string, bytes: Uint8Array) {
  const sb = await admin();
  const { error } = await sb.storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, dossier, nom, mime, taille, statut, sent_at, sent_to, viewed_at, signed_at, created_at, signataires")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const creerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dossier: z.string().trim().min(1).max(120),
        nom: z.string().trim().min(1).max(200),
        storage_path: z.string().min(1).max(400),
        mime: z.string().max(100).nullable(),
        taille: z.number().int().min(0).max(60_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Document introuvable.");
    const sb = await admin();
    const { data: url } = await sb.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
    let urlOriginal: string | null = null;
    if (doc.original_path && doc.original_path !== doc.storage_path) {
      const { data: u2 } = await sb.storage.from("documents").createSignedUrl(doc.original_path, 3600);
      urlOriginal = u2?.signedUrl ?? null;
    }
    return { doc, url: url?.signedUrl ?? null, urlOriginal };
  });

export const supprimerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase.from("documents").select("storage_path, original_path").eq("id", data.id).maybeSingle();
    if (!doc) throw new Error("Document introuvable.");
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    const sb = await admin();
    await sb.storage.from("documents").remove([doc.storage_path, doc.original_path].filter(Boolean) as string[]);
    return { ok: true };
  });

const signataireSchema = z.object({
  role: z.enum(["irve", "client"]),
  cle: z.string().trim().max(40).nullable().optional(),
  token: z.string().uuid().nullable().optional(),
  nom: z.string().trim().max(120),
  email: z.string().trim().max(200).nullable().optional(),
  telephone: z.string().trim().max(40).nullable().optional(),
  signed_at: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
});

export const enregistrerPreparation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nbPages: z.number().int().min(1).max(500),
        zones: z.array(z.any()).max(200),
        signataires: z.array(signataireSchema).max(10),
        dossier: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Chaque signataire client reçoit une cle stable et son lien individuel.
    let n = 0;
    const signataires = data.signataires.map((s) => {
      if (s.role !== "client") return s;
      n += 1;
      return { ...s, cle: s.cle || `c${n}`, token: s.token || crypto.randomUUID() };
    });
    const premierClient = signataires.find((s) => s.role === "client")?.cle ?? null;
    const zones = normaliserZones(data.zones, data.nbPages).map((zn) =>
      zn.role === "client" && !zn.signataire ? { ...zn, signataire: premierClient } : zn,
    );
    const patch: Record<string, unknown> = { zones, signataires };
    if (data.dossier) patch["dossier"] = data.dossier;
    const { error } = await context.supabase.from("documents").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Remplace le fichier de travail par une copie propre (PDF protégé recréé côté navigateur).
 * `repartir` : repart du document d'origine (signature IRVE précédente illisible).
 */
export const remplacerFichierDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), storage_path: z.string().regex(/^propres\/[0-9a-f-]{36}-\d+\.pdf$/), repartir: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("id, storage_path, original_path, signataires, statut").eq("id", data.id).maybeSingle();
    if (error || !doc) throw new Error("Document introuvable.");
    if (doc.statut === "signe") throw new Error("Document déjà signé.");
    if (!data.storage_path.startsWith(`propres/${doc.id}-`)) throw new Error("Fichier invalide.");
    const sigs = ((doc.signataires as unknown as Signataire[]) ?? []).map((s) => (data.repartir && s.role === "irve" ? { ...s, signed_at: null } : s));
    const { error: e2 } = await context.supabase
      .from("documents")
      .update({ storage_path: data.storage_path, original_path: doc.original_path ?? doc.storage_path, signataires: sigs as never, hash: null })
      .eq("id", doc.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** IRVE signe ses zones. Si aucune zone client : le document est finalisé. */
export const signerIrve = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), signature: dataUrl, paraphe: dataUrl.nullable().optional(), nom: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("*").eq("id", data.id).maybeSingle();
    if (error || !doc) throw new Error("Document introuvable.");
    const { appliquerSignatures, ajouterPreuve, sha256 } = await import("./documents.server");
    const zones = (doc.zones as unknown as Zone[]) ?? [];
    if (!zones.some((z) => z.role === "irve")) throw new Error("Aucune zone à signer pour IRVE Technologie.");
    const pdf = await telecharger(doc.storage_path);
    const hash = doc.hash ?? (await sha256(pdf));
    const now = new Date();
    let out = await appliquerSignatures(pdf, zones, "irve", { signature: data.signature, paraphe: data.paraphe, nom: data.nom }, now);
    const sigs = ((doc.signataires as unknown as Signataire[]) ?? []).filter((s) => s.role !== "irve");
    sigs.unshift({ role: "irve", nom: data.nom, signed_at: now.toISOString() });
    const clientRestant = zones.some((z) => z.role === "client");
    if (!clientRestant) out = await ajouterPreuve(out, doc.nom, sigs, hash);
    const path = `signes/${doc.id}-irve-${now.getTime()}.pdf`;
    await deposer(path, out);
    const { error: e2 } = await context.supabase
      .from("documents")
      .update({
        storage_path: path,
        original_path: doc.original_path ?? doc.storage_path,
        hash,
        signataires: sigs as never,
        statut: clientRestant ? doc.statut : "signe",
        signed_at: clientRestant ? doc.signed_at : now.toISOString(),
      })
      .eq("id", doc.id);
    if (e2) throw new Error(e2.message);
    return { ok: true, termine: !clientRestant };
  });

/**
 * Annule la ou les signatures posées par erreur : le document repart du fichier
 * d'origine (sans cachet ni signature), les signataires repassent en attente.
 */
export const annulerSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("*").eq("id", data.id).maybeSingle();
    if (error || !doc) throw new Error("Document introuvable.");
    const sigs = ((doc.signataires as unknown as Signataire[]) ?? []).map((s) => ({ ...s, signed_at: null, ip: null }));
    const retour = doc.original_path && doc.original_path !== doc.storage_path ? doc.original_path : doc.storage_path;
    const { error: e2 } = await context.supabase
      .from("documents")
      .update({
        storage_path: retour,
        hash: null,
        signataires: sigs as never,
        statut: doc.sent_at ? "envoye" : "brouillon",
        signed_at: null,
      })
      .eq("id", doc.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const envoyerPourSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), email: z.string().trim().max(200).optional().nullable(), envoyerEmail: z.boolean(), cle: z.string().max(40).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("id, nom, zones, public_token, statut, signataires").eq("id", data.id).maybeSingle();
    if (error || !doc) throw new Error("Document introuvable.");
    const zones = (doc.zones as unknown as Zone[]) ?? [];
    if (!zones.some((z) => z.role === "client")) throw new Error("Ajoutez au moins une zone « client » avant l'envoi.");
    const sigs = (doc.signataires as unknown as Signataire[]) ?? [];
    // Signataire visé : celui demandé, sinon le premier client pas encore signé.
    const cible =
      sigs.find((s) => s.role === "client" && data.cle && s.cle === data.cle) ??
      sigs.find((s) => s.role === "client" && !s.signed_at) ??
      sigs.find((s) => s.role === "client");
    if (!cible) throw new Error("Renseignez d'abord le nom du signataire (étape 2).");
    if (cible.signed_at) throw new Error(`${cible.nom || "Ce signataire"} a déjà signé.`);
    const base = process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr";
    const lien = `${base}/signer/${cible.token ?? doc.public_token}`;
    const destinataire = data.email || cible.email || null;
    let emailEnvoye = false;
    let emailErreur: string | null = null;
    if (data.envoyerEmail && destinataire) {
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        await sendTemplateEmail("document-a-signer", destinataire, {
          idempotencyKey: `document-${doc.id}-${cible.cle ?? "c"}-${Date.now()}`,
          templateData: { nom: cible.nom ?? "", document: doc.nom, lien },
        });
        emailEnvoye = true;
      } catch (e) {
        emailErreur = e instanceof Error ? e.message : "Envoi impossible";
      }
    }
    if (doc.statut === "brouillon" || doc.statut === "refuse") {
      await context.supabase
        .from("documents")
        .update({ statut: "envoye", sent_at: new Date().toISOString(), sent_to: destinataire, refused_at: null, refus_motif: null })
        .eq("id", doc.id);
    }
    return { lien, emailEnvoye, emailErreur, nom: cible.nom ?? "" };
  });

// ---------- Page publique ----------

/** Retrouve le document et le signataire à partir d'un lien (token signataire ou token du document). */
async function trouverParLien(token: string) {
  const sb = await admin();
  // Lien individuel d'un signataire ?
  const { data: parSignataire } = await sb
    .from("documents")
    .select("*")
    .contains("signataires", JSON.stringify([{ token }]))
    .maybeSingle();
  if (parSignataire) {
    const sig = ((parSignataire.signataires as unknown as Signataire[]) ?? []).find((s) => s.token === token) ?? null;
    return { sb, doc: parSignataire, signataire: sig };
  }
  const { data: doc } = await sb.from("documents").select("*").eq("public_token", token).maybeSingle();
  if (!doc) return { sb, doc: null, signataire: null };
  const sig = ((doc.signataires as unknown as Signataire[]) ?? []).find((s) => s.role === "client") ?? null;
  return { sb, doc, signataire: sig };
}

export const getDocumentPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const { sb, doc, signataire } = await trouverParLien(data.token);
    if (!doc || doc.statut === "brouillon") throw new Error("Ce lien de signature n'est plus valide.");
    const { data: url } = await sb.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
    const now = new Date().toISOString();
    if (doc.statut !== "signe") {
      await sb
        .from("documents")
        .update({ viewed_at: doc.viewed_at ?? now, view_count: Number(doc.view_count ?? 0) + 1, statut: doc.statut === "envoye" ? "consulte" : doc.statut })
        .eq("id", doc.id);
    }
    const sigs = (doc.signataires as unknown as Signataire[]) ?? [];
    const cle = signataire?.cle ?? null;
    const zones = ((doc.zones as unknown as Zone[]) ?? []).filter((z) => z.role === "client" && (!cle || !z.signataire || z.signataire === cle));
    const enAttente = sigs.filter((s) => s.role === "client" && !s.signed_at && s.cle !== cle).map((s) => s.nom || "un autre signataire");
    return {
      nom: doc.nom,
      statut: doc.statut,
      url: url?.signedUrl ?? null,
      zones,
      clientNom: signataire?.nom ?? "",
      dejaSigne: Boolean(signataire?.signed_at),
      enAttente,
      signedAt: doc.signed_at,
    };
  });

export const signerDocumentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tokenSchema.extend({ signature: dataUrl, paraphe: dataUrl.nullable().optional(), nom: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sb, doc, signataire } = await trouverParLien(data.token);
    if (!doc || doc.statut === "brouillon") throw new Error("Ce lien de signature n'est plus valide.");
    if (doc.statut === "signe") return { ok: true, already: true, enAttente: [] as string[] };
    if (signataire?.signed_at) return { ok: true, already: true, enAttente: [] as string[] };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const { appliquerSignatures, ajouterPreuve, sha256 } = await import("./documents.server");
    const zones = (doc.zones as unknown as Zone[]) ?? [];
    const cle = signataire?.cle ?? null;
    const pdf = await telecharger(doc.storage_path);
    const hash = doc.hash ?? (await sha256(pdf));
    const now = new Date();
    // On n'incruste que les zones de CE signataire.
    let out = await appliquerSignatures(pdf, zones, "client", { signature: data.signature, paraphe: data.paraphe, nom: data.nom }, now, cle);
    const sigs = ((doc.signataires as unknown as Signataire[]) ?? []).map((s) =>
      s.role === "client" && (cle ? s.cle === cle : true) && !s.signed_at
        ? { ...s, nom: data.nom, email: s.email ?? doc.sent_to, signed_at: now.toISOString(), ip }
        : s,
    );
    if (!sigs.some((s) => s.role === "client")) {
      sigs.push({ role: "client", cle: cle ?? "c1", nom: data.nom, email: doc.sent_to, signed_at: now.toISOString(), ip });
    }
    const restants = sigs.filter((s) => s.role === "client" && !s.signed_at).map((s) => s.nom || "un autre signataire");
    const termine = restants.length === 0;
    if (termine) out = await ajouterPreuve(out, doc.nom, sigs, hash);
    const path = `signes/${doc.id}-${cle ?? "c"}-${now.getTime()}.pdf`;
    await deposer(path, out);
    await sb
      .from("documents")
      .update({
        storage_path: path,
        original_path: doc.original_path ?? doc.storage_path,
        hash,
        signataires: sigs as never,
        statut: termine ? "signe" : doc.statut === "brouillon" ? "envoye" : doc.statut,
        signed_at: termine ? now.toISOString() : doc.signed_at,
      })
      .eq("id", doc.id);
    const { creerNotification } = await import("./notifications.server");
    await creerNotification(sb, {
      type: "document_signe",
      titre: termine ? `Document signé : ${doc.nom}` : `Signature reçue : ${doc.nom}`,
      message: termine
        ? `${data.nom} a signé le document en ligne. Toutes les signatures sont réunies.`
        : `${data.nom} a signé. En attente de : ${restants.join(", ")}.`,
      lien: `/documents/${doc.id}`,
      meta: { document_id: doc.id },
    });
    return { ok: true, already: false, enAttente: restants };
  });

export const refuserDocumentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.extend({ motif: z.string().trim().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { sb, doc } = await trouverParLien(data.token);
    if (!doc || doc.statut === "signe" || doc.statut === "brouillon") throw new Error("Action impossible.");
    await sb.from("documents").update({ statut: "refuse", refused_at: new Date().toISOString(), refus_motif: data.motif || null }).eq("id", doc.id);
    const { creerNotification } = await import("./notifications.server");
    await creerNotification(sb, {
      type: "document_signe",
      titre: `Signature refusée : ${doc.nom}`,
      message: data.motif || "Le client a refusé de signer.",
      lien: `/documents/${doc.id}`,
      meta: { document_id: doc.id },
    });
    return { ok: true };
  });
