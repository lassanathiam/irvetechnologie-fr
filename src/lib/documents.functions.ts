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
        dossier: z.string().min(1).max(40),
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
    return { doc, url: url?.signedUrl ?? null };
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
        signataires: z.array(signataireSchema).max(2),
        dossier: z.string().max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const zones = normaliserZones(data.zones, data.nbPages);
    const patch: Record<string, unknown> = { zones, signataires: data.signataires };
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

export const envoyerPourSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), email: z.string().trim().max(200).optional().nullable(), envoyerEmail: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase.from("documents").select("id, nom, zones, public_token, statut, signataires").eq("id", data.id).maybeSingle();
    if (error || !doc) throw new Error("Document introuvable.");
    const zones = (doc.zones as unknown as Zone[]) ?? [];
    if (!zones.some((z) => z.role === "client")) throw new Error("Ajoutez au moins une zone « client » avant l'envoi.");
    const base = process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr";
    const lien = `${base}/signer/${doc.public_token}`;
    let emailEnvoye = false;
    let emailErreur: string | null = null;
    if (data.envoyerEmail && data.email) {
      try {
        const { sendTemplateEmail } = await import("./email-templates/send-email");
        const client = ((doc.signataires as unknown as Signataire[]) ?? []).find((s) => s.role === "client");
        await sendTemplateEmail("document-a-signer", data.email, {
          idempotencyKey: `document-${doc.id}-${Date.now()}`,
          templateData: { nom: client?.nom ?? "", document: doc.nom, lien },
        });
        emailEnvoye = true;
      } catch (e) {
        emailErreur = e instanceof Error ? e.message : "Envoi impossible";
      }
    }
    if (doc.statut === "brouillon" || doc.statut === "refuse") {
      await context.supabase
        .from("documents")
        .update({ statut: "envoye", sent_at: new Date().toISOString(), sent_to: data.email ?? null, refused_at: null, refus_motif: null })
        .eq("id", doc.id);
    }
    return { lien, emailEnvoye, emailErreur };
  });

// ---------- Page publique ----------

export const getDocumentPublic = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: doc } = await sb.from("documents").select("*").eq("public_token", data.token).maybeSingle();
    if (!doc || doc.statut === "brouillon") throw new Error("Ce lien de signature n'est plus valide.");
    const { data: url } = await sb.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
    const now = new Date().toISOString();
    if (doc.statut !== "signe") {
      await sb
        .from("documents")
        .update({ viewed_at: doc.viewed_at ?? now, view_count: Number(doc.view_count ?? 0) + 1, statut: doc.statut === "envoye" ? "consulte" : doc.statut })
        .eq("id", doc.id);
    }
    const client = ((doc.signataires as unknown as Signataire[]) ?? []).find((s) => s.role === "client");
    return {
      nom: doc.nom,
      statut: doc.statut,
      url: url?.signedUrl ?? null,
      zones: ((doc.zones as unknown as Zone[]) ?? []).filter((z) => z.role === "client"),
      clientNom: client?.nom ?? "",
      signedAt: doc.signed_at,
    };
  });

export const signerDocumentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    tokenSchema.extend({ signature: dataUrl, paraphe: dataUrl.nullable().optional(), nom: z.string().trim().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: doc } = await sb.from("documents").select("*").eq("public_token", data.token).maybeSingle();
    if (!doc || doc.statut === "brouillon") throw new Error("Ce lien de signature n'est plus valide.");
    if (doc.statut === "signe") return { ok: true, already: true };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const { appliquerSignatures, ajouterPreuve, sha256 } = await import("./documents.server");
    const zones = (doc.zones as unknown as Zone[]) ?? [];
    const pdf = await telecharger(doc.storage_path);
    const hash = doc.hash ?? (await sha256(pdf));
    const now = new Date();
    let out = await appliquerSignatures(pdf, zones, "client", { signature: data.signature, paraphe: data.paraphe, nom: data.nom }, now);
    const sigs = ((doc.signataires as unknown as Signataire[]) ?? []).filter((s) => s.role !== "client");
    const ancien = ((doc.signataires as unknown as Signataire[]) ?? []).find((s) => s.role === "client");
    sigs.push({ role: "client", nom: data.nom, email: ancien?.email ?? doc.sent_to, signed_at: now.toISOString(), ip });
    out = await ajouterPreuve(out, doc.nom, sigs, hash);
    const path = `signes/${doc.id}-final-${now.getTime()}.pdf`;
    await deposer(path, out);
    await sb
      .from("documents")
      .update({
        storage_path: path,
        original_path: doc.original_path ?? doc.storage_path,
        hash,
        signataires: sigs as never,
        statut: "signe",
        signed_at: now.toISOString(),
      })
      .eq("id", doc.id);
    const { creerNotification } = await import("./notifications.server");
    await creerNotification(sb, {
      type: "document_signe",
      titre: `Document signé : ${doc.nom}`,
      message: `${data.nom} a signé le document en ligne.`,
      lien: `/documents/${doc.id}`,
      meta: { document_id: doc.id },
    });
    return { ok: true, already: false };
  });

export const refuserDocumentPublic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.extend({ motif: z.string().trim().max(500) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: doc } = await sb.from("documents").select("id, nom, statut").eq("public_token", data.token).maybeSingle();
    if (!doc || doc.statut === "signe") throw new Error("Action impossible.");
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
