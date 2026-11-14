import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "@/lib/billing";
import { cleCommande } from "@/lib/attachement-suivi";
import { blocageAnnulation } from "@/lib/attachement-statut";
import { preparerLignesTs } from "@/lib/attachement-ts";

const lineSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().positive().max(100000),
  prix_unitaire: z.number().min(0).max(1_000_000),
  rendezvous_id: z.string().uuid().optional().nullable(),
  tes: z.boolean().optional().default(false),
});

const attachmentSchema = z.object({
  client_nom: z.string().trim().min(2).max(160),
  client_email: z.string().trim().email().max(255).optional().nullable(),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_adresse: z.string().trim().max(300).optional().nullable(),
  client_cp_ville: z.string().trim().max(160).optional().nullable(),
  numero_ticket: z.string().trim().min(1, "Le numéro de ticket est obligatoire.").max(120),
  numero_affaire: z.string().trim().max(120).optional().nullable(),
  bon_commande: z.string().trim().max(120).optional().nullable(),
  objet: z.string().trim().max(240).optional().nullable(),
  date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoliquidation: z.boolean(),
  validation_requise: z.boolean(),
  proposition_autorisee: z.boolean().optional().default(true),

  notes: z.string().trim().max(2000).optional().nullable(),
  rendezvous_id: z.string().uuid().optional().nullable(),
  items: z.array(lineSchema).min(1).max(100),
});

async function nextNumber(supabase: any, year: number) {
  const prefix = `AT-${year}-`;
  const { data } = await supabase
    .from("attachements_travaux")
    .select("numero")
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1);
  const previous = data?.[0]?.numero ? Number(String(data[0].numero).slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(previous) ? previous : 0) + 1).padStart(4, "0")}`;
}

const estFiniRdv = (r: any) => Boolean(r.termine_at || r.chantier_valide || ["termine", "realise"].includes(r.statut));

const fr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Lundi de la semaine d'une date (ISO). */
function lundiDe(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  const j = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - j);
  return d.toISOString().slice(0, 10);
}

/** Numéro de semaine ISO d'une date. */
function semaineIso(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour + 3);
  const premierJeudi = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const jP = (premierJeudi.getUTCDay() + 6) % 7;
  premierJeudi.setUTCDate(premierJeudi.getUTCDate() - jP + 3);
  return 1 + Math.round((d.getTime() - premierJeudi.getTime()) / (7 * 86400000));
}

/** Message adaptatif : semaine couverte et état des travaux (réalisés / à réaliser). */
async function messageAdaptif(supabase: any, attachment: any) {
  const { data: lignes } = await supabase.from("attachement_items").select("rendezvous_id").eq("attachement_id", attachment.id);
  const ids = [...new Set((lignes ?? []).map((l: any) => l.rendezvous_id).filter(Boolean))] as string[];
  let dates: string[] = [];
  let tousFini = true;
  if (ids.length) {
    const { data: rdvs } = await supabase.from("rendezvous").select("id, date_debut, statut, termine_at, chantier_valide").in("id", ids);
    const rows = rdvs ?? [];
    dates = rows.map((r: any) => String(r.termine_at || r.date_debut || "").slice(0, 10)).filter(Boolean);
    if (rows.length) tousFini = rows.every(estFiniRdv);
  }
  let lundi: string | null = null;
  if (dates.length) {
    lundi = lundiDe(dates.sort()[0]);
  } else {
    // Repli : ticket "S04-2026" sinon semaine de la date d'émission.
    const m = /^S(\d{1,2})-(\d{4})/.exec(attachment.numero_ticket || "");
    if (m) {
      const janvier = new Date(Date.UTC(Number(m[2]), 0, 4));
      const jP = (janvier.getUTCDay() + 6) % 7;
      janvier.setUTCDate(janvier.getUTCDate() - jP + 3);
      janvier.setUTCDate(janvier.getUTCDate() + (Number(m[1]) - 1) * 7);
      lundi = lundiDe(janvier.toISOString().slice(0, 10));
    } else {
      lundi = lundiDe(String(attachment.date_emission).slice(0, 10));
    }
  }
  if (!lundi) lundi = lundiDe(String(attachment.date_emission).slice(0, 10));
  const d = new Date(`${lundi}T12:00:00`);
  d.setDate(d.getDate() + 6);
  const dimanche = d.toISOString().slice(0, 10);
  const etat = tousFini ? "réalisés" : "réalisés ou à réaliser";
  return `Bonjour, merci de trouver sur le lien ci-dessus l'attachement des travaux ${etat} pour la semaine S${semaineIso(lundi)} (du ${fr(lundi)} au ${fr(dimanche)}).`;
}

/** Chantier du Planning tel qu'affiché dans le détail d'un attachement. */
export type ChantierRdv = { id: string; statut: string; client_nom: string | null; adresse: string | null; cp_ville: string | null; date_debut: string | null; termine_at: string | null; reseau_client: string | null; receptionne_at?: string | null };
/** Chantier avec le montant HT qui lui est rattaché dans un attachement. */
export type ChantierLigne = ChantierRdv & { etat: "fait" | "a_faire"; montant_ht: number };
/** Ligne d'un attachement qui n'est reliée à aucun chantier du Planning. */
export type SansChantierLigne = { id: string; numero: string; objet: string | null; emis: string; statut: string; ht: number; lignes: { libelle: string; montant: number }[] };

export const listAttachements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("attachements_travaux")
      .select("id, numero, objet, client_nom, client_email, numero_ticket, numero_affaire, bon_commande, statut, total_ht, total_tva, total_ttc, autoliquidation, date_emission, facture_id, sent_at, viewed_at, last_viewed_at, view_count, public_token, rendezvous_id, attachement_initial_id, attachement_initial_numero, depose_at, envoye_facturation_at, paye_at")
      .order("created_at", { ascending: false })
      .limit(250);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((a) => a.id);
    // Suivi TES : nombre de lignes en supplément et leur montant HT, par attachement.
    const { data: lignesTes } = ids.length
      ? await context.supabase.from("attachement_items").select("id, attachement_id, libelle, description, quantite, prix_unitaire, rendezvous_id").eq("tes", true).in("attachement_id", ids).order("ordre")
      : { data: [] as { id: string; attachement_id: string; libelle: string; description: string | null; quantite: number; prix_unitaire: number; rendezvous_id: string | null }[] };
    const parAtt = new Map<string, { nb: number; ht: number; lignes: { id: string; libelle: string; description: string | null; quantite: number; prix_unitaire: number; rendezvous_id: string | null }[] }>();
    for (const l of lignesTes ?? []) {
      const cur = parAtt.get(l.attachement_id) ?? { nb: 0, ht: 0, lignes: [] };
      cur.nb += 1; cur.ht += (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
      cur.lignes.push({ id: l.id, libelle: l.libelle, description: l.description, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire), rendezvous_id: l.rendezvous_id ?? null });
      parAtt.set(l.attachement_id, cur);
    }
    // Texte de recherche : noms des résidents, adresses et villes présents dans les lignes.
    const { data: toutesLignes } = ids.length
      ? await context.supabase.from("attachement_items").select("attachement_id, libelle, description, quantite, prix_unitaire, rendezvous_id").in("attachement_id", ids)
      : { data: [] as { attachement_id: string; libelle: string; description: string | null; quantite: number; prix_unitaire: number; rendezvous_id: string | null }[] };
    // Avancement réel : montant HT des lignes selon l'état du chantier lié (fait / à faire / sans chantier).
    const rdvIds = [...new Set([...(toutesLignes ?? []).map((l) => l.rendezvous_id), ...(data ?? []).map((a) => a.rendezvous_id)].filter((v): v is string => !!v))];
    const { data: rdvs } = rdvIds.length ? await context.supabase.from("rendezvous").select("id, statut, client_nom, adresse, cp_ville, date_debut, termine_at, reseau_client, receptionne_at").in("id", rdvIds) : { data: [] as ChantierRdv[] };
    const rdv = new Map((rdvs ?? []).map((r) => [r.id, r]));
    const attRdv = new Map((data ?? []).map((a) => [a.id, a.rendezvous_id as string | null]));
    const avancement = new Map<string, { fait: number; a_faire: number; sans: number; sansLignes: { libelle: string; montant: number }[]; parRdv: Map<string, ChantierLigne> }>();
    for (const l of toutesLignes ?? []) {
      const cur = avancement.get(l.attachement_id) ?? { fait: 0, a_faire: 0, sans: 0, sansLignes: [] as { libelle: string; montant: number }[], parRdv: new Map<string, ChantierLigne>() };
      const montant = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
      const cle = l.rendezvous_id ?? attRdv.get(l.attachement_id) ?? "";
      const r = rdv.get(cle);
      const st = r?.statut;
      if (!st) { cur.sans += montant; cur.sansLignes.push({ libelle: l.libelle ?? "Ligne sans nom", montant }); }
      else {
        const fini = st === "termine" || st === "realise";
        if (fini) cur.fait += montant; else cur.a_faire += montant;
        const c: ChantierLigne = cur.parRdv.get(cle) ?? { ...r, etat: fini ? "fait" : "a_faire", montant_ht: 0 };
        c.montant_ht = Math.round((c.montant_ht + montant) * 100) / 100;
        cur.parRdv.set(cle, c);
      }
      avancement.set(l.attachement_id, cur);
    }
    // Facture née de l'attachement : numéro et paiement affichés directement dans la liste.
    const factureIds = [...new Set((data ?? []).map((a) => a.facture_id).filter((v): v is string => Boolean(v)))];
    const { data: facturesLiees } = factureIds.length
      ? await context.supabase.from("factures").select("id, numero, statut, paid_at").in("id", factureIds)
      : { data: [] as { id: string; numero: string; statut: string; paid_at: string | null }[] };
    const fac = new Map((facturesLiees ?? []).map((f) => [f.id, f]));
    const texte = new Map<string, string>();
    for (const l of toutesLignes ?? []) texte.set(l.attachement_id, `${texte.get(l.attachement_id) ?? ""} ${l.libelle ?? ""} ${l.description ?? ""}`);
    return (data ?? []).map((a) => ({ ...a, recherche: texte.get(a.id) ?? "", facture_numero: fac.get(a.facture_id ?? "")?.numero ?? null, facture_payee: Boolean(fac.get(a.facture_id ?? "")?.paid_at), tes_nb: parAtt.get(a.id)?.nb ?? 0, tes_ht: Math.round((parAtt.get(a.id)?.ht ?? 0) * 100) / 100, tes_lignes: parAtt.get(a.id)?.lignes ?? [], ht_fait: Math.round((avancement.get(a.id)?.fait ?? 0) * 100) / 100, ht_a_faire: Math.round((avancement.get(a.id)?.a_faire ?? 0) * 100) / 100, ht_sans_chantier: Math.round((avancement.get(a.id)?.sans ?? 0) * 100) / 100, lignes_sans: (avancement.get(a.id)?.sansLignes ?? []).sort((x, y) => y.montant - x.montant), chantiers: [...(avancement.get(a.id)?.parRdv.values() ?? [])].sort((x, y) => String(y.date_debut ?? "").localeCompare(String(x.date_debut ?? ""))) }));
  });

/** Modifie le montant d'une ligne TES puis recalcule les totaux de l'attachement (refusé si déjà facturé). */
export const modifierMontantTes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ligne_id: z.string().uuid(), montant: z.number().min(0).max(1_000_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const ligne = await context.supabase.from("attachement_items").select("id, attachement_id, quantite").eq("id", data.ligne_id).maybeSingle();
    if (ligne.error) throw new Error(ligne.error.message);
    if (!ligne.data) throw new Error("Ligne introuvable.");
    const att = await context.supabase.from("attachements_travaux").select("id, facture_id, autoliquidation").eq("id", ligne.data.attachement_id).maybeSingle();
    if (att.error) throw new Error(att.error.message);
    if (!att.data) throw new Error("Attachement introuvable.");
    if (att.data.facture_id) throw new Error("Cet attachement est déjà facturé : modifiez la facture.");
    const qte = Number(ligne.data.quantite) || 1;
    const prix = Math.round((data.montant / qte) * 10000) / 10000;
    const up = await context.supabase.from("attachement_items").update({ prix_unitaire: prix }).eq("id", data.ligne_id);
    if (up.error) throw new Error(up.error.message);
    const toutes = await context.supabase.from("attachement_items").select("quantite, prix_unitaire").eq("attachement_id", att.data.id);
    if (toutes.error) throw new Error(toutes.error.message);
    const tva = att.data.autoliquidation ? 0 : 20;
    const totals = computeTotals((toutes.data ?? []).map((l: any) => ({ libelle: "", quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire), tva })) as any, 0);
    const maj = await context.supabase.from("attachements_travaux").update({ total_ht: totals.total_ht, total_tva: totals.total_tva, total_ttc: totals.total_ttc }).eq("id", att.data.id);
    if (maj.error) throw new Error(maj.error.message);
    return { ok: true };
  });

export const getAttachement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Attachement introuvable.");
    const lines = await context.supabase.from("attachement_items").select("*").eq("attachement_id", data.id).order("ordre");
    if (lines.error) throw new Error(lines.error.message);
    const props = await context.supabase
      .from("attachement_propositions")
      .select("id, signataire_nom, commentaire, total_ht, statut, lignes, created_at, traite_at")
      .eq("attachement_id", data.id)
      .order("created_at", { ascending: false });
    if (props.error) throw new Error(props.error.message);
    const message_suggestion = await messageAdaptif(context.supabase, result.data);
    const supplements = await context.supabase.from("attachements_travaux")
      .select("id, numero, statut, total_ht").eq("attachement_initial_id", data.id).order("created_at", { ascending: false });
    if (supplements.error) throw new Error(supplements.error.message);
    // Facture née de l'attachement : son numéro est affiché dans l'en-tête de la fiche.
    let facture: { id: string; numero: string; statut: string; paid_at: string | null } | null = null;
    if (result.data.facture_id) {
      const f = await context.supabase.from("factures").select("id, numero, statut, paid_at").eq("id", result.data.facture_id).maybeSingle();
      if (f.error) throw new Error(f.error.message);
      facture = (f.data ?? null) as typeof facture;
    }
    // Chantiers du Planning présents dans l'attachement : permet de les réceptionner depuis la fiche.
    const rdvIds = [...new Set([result.data.rendezvous_id, ...(lines.data ?? []).map((l) => l.rendezvous_id)].filter((v): v is string => Boolean(v)))];
    let chantiers: { id: string; client_nom: string; adresse: string | null; cp_ville: string | null; date_debut: string; termine_at: string | null; statut: string; receptionne_at: string | null }[] = [];
    if (rdvIds.length) {
      const r = await context.supabase.from("rendezvous").select("id, client_nom, adresse, cp_ville, date_debut, termine_at, statut, receptionne_at").in("id", rdvIds);
      if (r.error) throw new Error(r.error.message);
      chantiers = (r.data ?? []) as typeof chantiers;
    }
    return { attachement: result.data, items: lines.data ?? [], propositions: props.data ?? [], message_suggestion, supplements: supplements.data ?? [], facture, chantiers };
  });

export const creerAttachementTs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    initial_id: z.string().uuid(), document_id: z.string().uuid(),
    bon_commande: z.string().trim().max(120).nullable(),
    items: z.array(lineSchema).min(1).max(100),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("creer_attachement_ts", {
      _initial_id: data.initial_id, _document_id: data.document_id,
      _bon_commande: data.bon_commande ?? "", _lignes: preparerLignesTs(data.items),
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data };
  });

export const traiterPropositionAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ proposition_id: z.string().uuid(), decision: z.enum(["accepter", "refuser"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const prop = await context.supabase.from("attachement_propositions").select("*").eq("id", data.proposition_id).maybeSingle();
    if (prop.error) throw new Error(prop.error.message);
    if (!prop.data) throw new Error("Proposition introuvable.");
    if (prop.data.statut !== "en_attente") throw new Error("Cette proposition a déjà été traitée.");
    const att = await context.supabase.from("attachements_travaux").select("id, facture_id, autoliquidation").eq("id", prop.data.attachement_id).maybeSingle();
    if (att.error) throw new Error(att.error.message);
    if (!att.data) throw new Error("Attachement introuvable.");
    if (att.data.facture_id) throw new Error("Cet attachement est déjà facturé.");
    const cible = att.data;
    const now = new Date().toISOString();
    if (data.decision === "refuser") {
      const upd = await context.supabase.from("attachement_propositions").update({ statut: "refusee", traite_at: now }).eq("id", data.proposition_id);
      if (upd.error) throw new Error(upd.error.message);
      const back = await context.supabase.from("attachements_travaux").update({ statut: "envoye" }).eq("id", cible.id);
      if (back.error) throw new Error(back.error.message);
      return { ok: true, decision: "refuser" as const };
    }
    const lignes = (Array.isArray(prop.data.lignes) ? prop.data.lignes : []) as Array<{ libelle: string; description?: string | null; quantite: number; prix_unitaire: number }>;
    if (!lignes.length) throw new Error("La proposition ne contient aucune ligne.");
    const items = lignes.map((l) => ({ ...l, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire), tva: cible.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", cible.id);
    if (del.error) throw new Error(del.error.message);
    const ins = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: cible.id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      ordre: index + 1,
    })));
    if (ins.error) throw new Error(ins.error.message);
    const upd = await context.supabase.from("attachements_travaux").update({
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      statut: "accepte",
      accepted_at: now,
      refused_at: null,
      signataire_nom: prop.data.signataire_nom,
    }).eq("id", cible.id);
    if (upd.error) throw new Error(upd.error.message);
    const done = await context.supabase.from("attachement_propositions").update({ statut: "acceptee", traite_at: now }).eq("id", data.proposition_id);
    if (done.error) throw new Error(done.error.message);
    return { ok: true, decision: "accepter" as const };
  });


export const createAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attachmentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const items = data.items.map((item) => ({ ...item, tva: data.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const numero = await nextNumber(context.supabase, Number(data.date_emission.slice(0, 4)));
    const { items: _items, ...attachmentData } = data;
    const { data: row, error } = await context.supabase.from("attachements_travaux").insert({
      ...attachmentData,
      numero,
      activite: "fibre",
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const unique = chantierUnique(items, [data.rendezvous_id]);
    const { error: lineError } = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: row.id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      rendezvous_id: item.rendezvous_id ?? unique,
      tes: Boolean(item.tes),
      ordre: index + 1,
    })));
    if (lineError) throw new Error(lineError.message);
    return { id: row.id };
  });

/** Lignes saisies à la main : si l'attachement ne concerne qu'un seul chantier, elles y sont rattachées. */
function chantierUnique(items: { rendezvous_id?: string | null }[], extra: (string | null | undefined)[] = []) {
  const ids = new Set([...items.map((i) => i.rendezvous_id), ...extra].filter(Boolean) as string[]);
  return ids.size === 1 ? [...ids][0] : null;
}

export const updateAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => attachmentSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { id, items: rawItems, ...attachmentData } = data;
    const existing = await context.supabase.from("attachements_travaux").select("facture_id").eq("id", id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (existing.data.facture_id) throw new Error("Cet attachement est déjà facturé : modifiez la facture.");
    const items = rawItems.map((item) => ({ ...item, tva: data.autoliquidation ? 0 : 20 }));
    const totals = computeTotals(items, 0);
    const { error } = await context.supabase.from("attachements_travaux").update({
      ...attachmentData,
      total_ht: totals.total_ht,
      total_tva: totals.total_tva,
      total_ttc: totals.total_ttc,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    const anciens = await context.supabase.from("attachement_items").select("libelle, description, rendezvous_id").eq("attachement_id", id);
    const liens = new Map((anciens.data ?? []).filter((l: any) => l.rendezvous_id).map((l: any) => [`${l.libelle}|${l.description ?? ""}`, l.rendezvous_id as string]));
    const unique = chantierUnique(items, [...(anciens.data ?? []).map((l: any) => l.rendezvous_id), data.rendezvous_id]);
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", id);
    if (del.error) throw new Error(del.error.message);
    const { error: lineError } = await context.supabase.from("attachement_items").insert(items.map((item, index) => ({
      attachement_id: id,
      libelle: item.libelle,
      description: item.description ?? null,
      quantite: item.quantite,
      prix_unitaire: item.prix_unitaire,
      rendezvous_id: item.rendezvous_id ?? liens.get(`${item.libelle}|${item.description ?? ""}`) ?? unique,
      tes: Boolean(item.tes),
      ordre: index + 1,
    })));
    if (lineError) throw new Error(lineError.message);
    return { id };
  });

export const supprimerAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("attachements_travaux").select("facture_id").eq("id", data.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (existing.data.facture_id) throw new Error("Impossible de supprimer un attachement déjà facturé.");
    const del = await context.supabase.from("attachement_items").delete().eq("attachement_id", data.id);
    if (del.error) throw new Error(del.error.message);
    const { error } = await context.supabase.from("attachements_travaux").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const envoyerAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), message: z.string().trim().max(2000).optional().nullable() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: attachment, error } = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Attachement introuvable.");
    if (!attachment.numero_ticket?.trim()) throw new Error("Ajoutez le numéro de ticket avant l’envoi.");
    if (!attachment.client_email) throw new Error("Ajoutez l’adresse e-mail du destinataire avant l’envoi.");
    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
    const link = `${base}/attachement/${attachment.public_token}`;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const result = await sendTemplateEmail("attachement-travaux", attachment.client_email, {
      copieEnsio: await resoudreCopieEnsio(context.supabase, attachment.client_email, attachment.client_nom),
      idempotencyKey: `attachement-${attachment.id}-${new Date().toISOString()}`,
      templateData: {
        client_nom: attachment.client_nom,
        numero: attachment.numero,
        numero_ticket: attachment.numero_ticket,
        numero_affaire: attachment.numero_affaire,
        bon_commande: attachment.bon_commande,
        objet: attachment.objet,
        total_ht: Number(attachment.total_ht),
        autoliquidation: attachment.autoliquidation,
        validation_requise: attachment.validation_requise,
        message: (data.message?.trim() ? data.message : await messageAdaptif(context.supabase, attachment)),
        lien: link,
      },
    });
    if (result.sent) {
      await context.supabase.from("attachements_travaux").update({ sent_at: new Date().toISOString(), statut: "envoye" }).eq("id", attachment.id);
    }
    return { ...result, lien: link };
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function convertirEnFacture(context: { supabase: any; userId: string }, data: { id: string }): Promise<{ id: string; existing: boolean }> {
    const { data: attachment, error } = await context.supabase.from("attachements_travaux").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Attachement introuvable.");
    if (attachment.facture_id) return { id: attachment.facture_id, existing: true };
    const { data: items, error: itemsError } = await context.supabase.from("attachement_items").select("*").eq("attachement_id", data.id).order("ordre");
    if (itemsError) throw new Error(itemsError.message);
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `F-${year}-`;
    const { data: numbers } = await context.supabase.from("factures").select("numero").like("numero", `${prefix}%`).order("numero", { ascending: false }).limit(1);
    const last = numbers?.[0]?.numero ? Number(String(numbers[0].numero).slice(prefix.length)) : 0;
    const numero = `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0")}`;
    const due = new Date(today); due.setDate(due.getDate() + 30);
    const { data: invoice, error: invoiceError } = await context.supabase.from("factures").insert({
      attachement_id: attachment.id,
      numero,
      date_emission: today.toISOString().slice(0, 10),
      date_echeance: due.toISOString().slice(0, 10),
      client_nom: attachment.client_nom,
      client_email: attachment.client_email,
      client_telephone: attachment.client_telephone,
      client_adresse: attachment.client_adresse,
      client_cp_ville: attachment.client_cp_ville,
      objet: attachment.objet || `Travaux fibre — ticket ${attachment.numero_ticket}`,
      remise_pct: 0,
      acompte_pct: 0,
      conditions_paiement: "Paiement par virement à réception de facture. Indemnité forfaitaire de recouvrement : 40 €.",
      notes: attachment.notes,
      total_ht_brut: attachment.total_ht,
      total_remise: 0,
      total_ht: attachment.total_ht,
      total_tva: attachment.total_tva,
      total_ttc: attachment.total_ttc,
      activite: "fibre",
      numero_ticket: attachment.numero_ticket,
      numero_affaire: attachment.numero_affaire,
      bon_commande: attachment.bon_commande,
      autoliquidation: attachment.autoliquidation,
      statut: "validee",
      created_by: context.userId,
    }).select("id").single();
    if (invoiceError) throw new Error(invoiceError.message);
    if ((items ?? []).length) {
      const inserted = await context.supabase.from("facture_items").insert((items ?? []).map((item: any, index: number) => ({
        facture_id: invoice.id,
        libelle: item.libelle,
        description: item.description,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        tva: attachment.autoliquidation ? 0 : 20,
        ordre: index + 1,
      })));
      if (inserted.error) throw new Error(inserted.error.message);
    }
    await context.supabase.from("attachements_travaux").update({ facture_id: invoice.id, statut: "facture" }).eq("id", attachment.id);
    return { id: invoice.id, existing: false };
}

export const convertirAttachementEnFacture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => convertirEnFacture(context, data));

/** Attachements correspondant aux numéros lus sur les bons de commande. */
export const trouverAttachementsCommandes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ numeros: z.array(z.string().max(40)).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux")
      .select("id, numero, objet, client_nom, statut, total_ht, bon_commande, facture_id, date_emission")
      .neq("statut", "annule").order("date_emission", { ascending: false }).limit(400);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: items } = ids.length ? await context.supabase.from("attachement_items").select("attachement_id, description, libelle").in("attachement_id", ids) : { data: [] as { attachement_id: string; description: string | null; libelle: string }[] };
    const textes = new Map<string, string>();
    for (const i of items ?? []) textes.set(i.attachement_id, `${textes.get(i.attachement_id) ?? ""} ${i.libelle} ${i.description ?? ""}`);
    return (rows ?? []).map((r) => ({ ...r, total_ht: Number(r.total_ht), texte: `${r.objet ?? ""} ${textes.get(r.id) ?? ""}` }));
  });

/** Rattache un bon de commande, ajuste le montant si demandé, puis crée la facture. */
export const appliquerCommandeAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    bon_commande: z.string().trim().min(3).max(60),
    montant_ht: z.number().min(0).max(1_000_000).nullable(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase.from("attachements_travaux").select("id, facture_id, total_ht, autoliquidation, client_nom, bon_commande").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!att) throw new Error("Attachement introuvable.");
    const autres = await context.supabase.from("attachements_travaux").select("id, bon_commande").eq("client_nom", att.client_nom).neq("id", att.id).neq("statut", "annule");
    if (autres.error) throw new Error(autres.error.message);
    if (autres.data.some((a) => cleCommande(a.bon_commande) === cleCommande(data.bon_commande))) throw new Error("Ce numéro de commande est déjà rattaché à un autre attachement de ce donneur d’ordre.");
    if (att.facture_id && att.bon_commande && cleCommande(att.bon_commande) !== cleCommande(data.bon_commande)) throw new Error("Cet attachement est déjà facturé avec un autre numéro de commande.");
    if (att.facture_id) {
      await context.supabase.from("attachements_travaux").update({ bon_commande: data.bon_commande }).eq("id", att.id);
      await context.supabase.from("factures").update({ bon_commande: data.bon_commande }).eq("id", att.facture_id);
      return { id: att.facture_id, existing: true };
    }
    const patch: { bon_commande: string; total_ht?: number; total_tva?: number; total_ttc?: number } = { bon_commande: data.bon_commande };
    if (data.montant_ht !== null) {
      const ecart = Math.round((data.montant_ht - Number(att.total_ht)) * 100) / 100;
      if (Math.abs(ecart) >= 0.01) {
        const { data: last } = await context.supabase.from("attachement_items").select("ordre").eq("attachement_id", att.id).order("ordre", { ascending: false }).limit(1);
        const ins = await context.supabase.from("attachement_items").insert({ attachement_id: att.id, libelle: `Ajustement selon bon de commande ${data.bon_commande}`, quantite: 1, prix_unitaire: ecart, tes: true, ordre: (last?.[0]?.ordre ?? 0) + 1 });
        if (ins.error) throw new Error(ins.error.message);
        const ht = Math.round(data.montant_ht * 100) / 100;
        const tva = att.autoliquidation ? 0 : Math.round(ht * 20) / 100;
        Object.assign(patch, { total_ht: ht, total_tva: tva, total_ttc: Math.round((ht + tva) * 100) / 100 });
      }
    }
    const up = await context.supabase.from("attachements_travaux").update(patch).eq("id", att.id);
    if (up.error) throw new Error(up.error.message);
    return convertirEnFacture(context, { id: att.id });
  });

export const changerStatutAttachement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["annuler", "reactiver"]) }).parse(data))
  .handler(async ({ data, context }) => {
    const existing = await context.supabase.from("attachements_travaux").select("id, facture_id, sent_at").eq("id", data.id).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) throw new Error("Attachement introuvable.");
    if (data.action === "annuler") {
      const blocage = blocageAnnulation(existing.data);
      if (blocage) throw new Error(blocage);
    }
    const statut = data.action === "annuler" ? "annule" : (existing.data.sent_at ? "envoye" : "brouillon");
    const { error } = await context.supabase.from("attachements_travaux").update({ statut }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { statut };
  });

/** Construit le contenu de l'email groupé (une ligne par attachement). */
async function preparerEmailGroupe(supabase: any, liste: any[]) {
  const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
  const message = await messageAdaptif(supabase, liste[0]);
  const lignes = await Promise.all(liste.map(async (a: any) => {
    const it = await supabase.from("attachement_items").select("description").eq("attachement_id", a.id).order("ordre").limit(1);
    const desc = String(it.data?.[0]?.description ?? "");
    const client = desc.split(" — ")[0]?.replace(/^\d{2}\/\d{2}\/\d{4} · /, "") || a.objet || a.numero;
    return { client, numero: a.numero, total_ht: Number(a.total_ht), lien: `${base}/attachement/${a.public_token}` };
  }));
  const semaine = /semaine S(\d+)/.exec(message)?.[0] ?? liste[0].numero_ticket;
  return {
    destinataire: liste[0].client_nom,
    semaine: semaine.replace(/^semaine /, "semaine "),
    message: message.replace(/^Bonjour, /, "").replace("l'attachement", "les attachements").replace("sur le lien ci-dessus", "ci-dessous"),
    lignes,
    lien_global: `${base}/attachements-lot/${liste.map((a: any) => a.public_token).join(".")}?m=${encodeURIComponent(message)}`,
    total_ht: lignes.reduce((s, l) => s + l.total_ht, 0),
  };
}

/** Un seul email pour tous les attachements de la semaine (un lien par client). */
export const envoyerAttachementsGroupes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux").select("*").in("id", data.ids).order("numero");
    if (error) throw new Error(error.message);
    const liste = rows ?? [];
    if (!liste.length) throw new Error("Aucun attachement à envoyer.");
    const email = liste[0].client_email;
    const emails = new Set(liste.map((a: any) => String(a.client_email ?? "").trim().toLowerCase()));
    if (emails.size > 1) throw new Error("Ces attachements concernent plusieurs destinataires. Cochez seulement ceux d’un même donneur d’ordre.");
    if (!email) throw new Error("Ajoutez l’adresse e-mail du chargé d’affaires ENSIO.");
    const templateData = await preparerEmailGroupe(context.supabase, liste);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const result = await sendTemplateEmail("attachements-semaine", email, {
      copieEnsio: await resoudreCopieEnsio(context.supabase, email, liste[0].client_nom),
      idempotencyKey: `attachements-semaine-${data.ids.join("-").slice(0, 80)}-${new Date().toISOString()}`,
      templateData,
    });
    if (result.sent) {
      const ids = liste.map((a: any) => a.id); const now = new Date().toISOString();
      await context.supabase.from("attachements_travaux").update({ sent_at: now }).in("id", ids);
      // Ne jamais rétrograder un attachement accepté ou facturé lors d'un renvoi groupé.
      await context.supabase.from("attachements_travaux").update({ statut: "envoye" }).in("id", ids).in("statut", ["brouillon", "envoye", "refuse"]);
    }
    return { ...result, nb: templateData.lignes.length };
  });

/** Renvoie à l'équipe (contacts@) la copie d'attachements déjà envoyés. Aucun envoi client, aucun changement de statut. */
export const copieEquipeAttachements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("attachements_travaux").select("*").in("id", data.ids).order("numero");
    if (error) throw new Error(error.message);
    const liste = (rows ?? []).filter((a: any) => a.sent_at);
    if (!liste.length) throw new Error("Aucun attachement envoyé parmi la sélection.");
    const templateData = await preparerEmailGroupe(context.supabase, liste);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("attachements-semaine", "contacts@irvetechnologie.fr", {
      idempotencyKey: `attachements-copie-equipe-${data.ids.join("-").slice(0, 80)}-${new Date().toISOString()}`,
      templateData: { ...templateData, message: `Copie équipe — ${templateData.message}` },
    });
    return { ...result, nb: templateData.lignes.length };
  });

/** Coche / décoche une étape de dépôt sur la plateforme du donneur d'ordre. Ne change ni le statut ni la facture. */
export const marquerSuiviFacturation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100), champ: z.enum(["depose_at", "envoye_facturation_at", "paye_at"]), valeur: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const v = data.valeur ? new Date().toISOString() : null;
    const patch: Record<string, string | null> = { [data.champ]: v };
    // Cocher une étape coche aussi les précédentes ; décocher efface les suivantes.
    if (data.valeur) { if (data.champ !== "depose_at") patch.depose_at = v; if (data.champ === "paye_at") patch.envoye_facturation_at = v; }
    else { if (data.champ === "depose_at") { patch.envoye_facturation_at = null; patch.paye_at = null; } if (data.champ === "envoye_facturation_at") patch.paye_at = null; }
    let q = context.supabase.from("attachements_travaux").update(patch as never).in("id", data.ids);
    if (data.valeur) q = q.is(data.champ, null);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
