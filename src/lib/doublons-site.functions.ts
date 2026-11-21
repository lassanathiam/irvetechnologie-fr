import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  actionChantier, actionDevis, actionFacture, blocagesChantier, completerClient, memeChantier, memeClient, memeDevis, memeFacture, memePartenaire,
  pairesChantiers, pairesClients, pairesDevis, pairesFactures, pairesPartenaires,
  type ChantierDoublon, type ClientDoublon, type DevisDoublon, type FactureDoublon, type PartenaireDoublon,
} from "./doublons-site";

type Sb = any;
/** Lit toutes les lignes d'une requête, par pages de 1000 (limite de la base). */
async function toutes(fabrique: (de: number, a: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fabrique(de, de + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}
const parPaquets = async (ids: string[], f: (paquet: string[]) => Promise<any[]>) => {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 200) out.push(...(await f(ids.slice(i, i + 200))));
  return out;
};

const CHAMPS_RDV = "id, client_nom, adresse, client_telephone, cp_ville, statut, date_debut, termine_at, created_at";
const LIENS_RDV: { table: string; cle: "attachements" | "devis" | "photos" | "fiches" | "rapports" | "autres" }[] = [
  { table: "attachements_travaux", cle: "attachements" }, { table: "devis", cle: "devis" }, { table: "rendezvous_photos", cle: "photos" },
  { table: "rendezvous_fiches", cle: "fiches" }, { table: "rapports", cle: "rapports" }, { table: "rapport_remplis", cle: "rapports" }, { table: "cri_total", cle: "rapports" },
  { table: "stock_bon_chantiers", cle: "autres" }, { table: "stock_lignes", cle: "autres" }, { table: "stock_sorties", cle: "autres" }, { table: "voirie_autorisations", cle: "autres" },
];

/** Compte, pour chaque chantier, ce qui lui est relié (attachements par en-tête ou par ligne, devis, photos, fiches, rapports, matériel). */
async function liensChantiers(s: Sb, ids: string[]): Promise<Map<string, NonNullable<ChantierDoublon["liens"]>>> {
  const m = new Map(ids.map((id) => [id, { attachements: 0, devis: 0, photos: 0, fiches: 0, rapports: 0, autres: 0 }]));
  if (!ids.length) return m;
  const atts = new Map<string, Set<string>>();
  for (const { table, cle } of LIENS_RDV) {
    const champs = table === "attachements_travaux" ? "id, rendezvous_id, statut" : "rendezvous_id";
    const rows = await parPaquets(ids, (p) => toutes((de, a) => s.from(table).select(champs).in("rendezvous_id", p).range(de, a)));
    for (const r of rows) {
      if (table === "attachements_travaux") { if (r.statut !== "annule") atts.set(r.rendezvous_id, (atts.get(r.rendezvous_id) ?? new Set()).add(r.id)); continue; }
      const x = m.get(r.rendezvous_id); if (x) x[cle] += 1;
    }
  }
  const items = await parPaquets(ids, (p) => toutes((de, a) => s.from("attachement_items").select("rendezvous_id, attachement_id, attachements_travaux!inner(statut)").in("rendezvous_id", p).range(de, a)));
  for (const i of items) if (i.attachements_travaux?.statut !== "annule") atts.set(i.rendezvous_id, (atts.get(i.rendezvous_id) ?? new Set()).add(i.attachement_id));
  for (const [id, set] of atts) { const x = m.get(id); if (x) x.attachements = set.size; }
  return m;
}

/** Factures avec leurs attachements et chantiers. */
async function chargerFactures(s: Sb, ids?: string[]): Promise<FactureDoublon[]> {
  const champs = "id, numero, client_nom, objet, total_ht, statut, sent_at, paid_at, depose_at, attachement_id, bon_commande, date_emission, created_at";
  const facs = ids ? (await s.from("factures").select(champs).in("id", ids)).data ?? [] : await toutes((de, a) => s.from("factures").select(champs).neq("statut", "annulee").range(de, a));
  const fids = facs.map((f: any) => f.id);
  const atts = fids.length ? await parPaquets(fids, (p) => toutes((de, a) => s.from("attachements_travaux").select("id, facture_id, rendezvous_id, attachement_initial_id").in("facture_id", p).range(de, a))) : [];
  const attIds = [...new Set([...atts.map((a: any) => a.id), ...facs.map((f: any) => f.attachement_id).filter(Boolean)])] as string[];
  const items = attIds.length ? await parPaquets(attIds, (p) => toutes((de, a) => s.from("attachement_items").select("attachement_id, rendezvous_id").in("attachement_id", p).not("rendezvous_id", "is", null).range(de, a))) : [];
  const rdvParAtt = new Map<string, Set<string>>();
  for (const a of atts) if (a.rendezvous_id) rdvParAtt.set(a.id, (rdvParAtt.get(a.id) ?? new Set()).add(a.rendezvous_id));
  for (const i of items) rdvParAtt.set(i.attachement_id, (rdvParAtt.get(i.attachement_id) ?? new Set()).add(i.rendezvous_id));
  const estTs = new Map(atts.map((a: any) => [a.id, Boolean(a.attachement_initial_id)]));
  return facs.map((f: any) => {
    const ats = [...new Set([f.attachement_id, ...atts.filter((a: any) => a.facture_id === f.id).map((a: any) => a.id)].filter(Boolean))] as string[];
    const ts = (ats.length > 0 && ats.every((a) => estTs.get(a))) || /^TS\b/i.test(String(f.objet ?? "").trim());
    return { ...f, total_ht: Number(f.total_ht ?? 0), attachements: ats, chantiers: [...new Set(ats.flatMap((a) => [...(rdvParAtt.get(a) ?? [])]))], ts };
  });
}

const CHAMPS_DEVIS = "id, numero, client_nom, objet, total_ttc, statut, sent_at, signed_at, facture_id, date_emission, created_at";

async function chargerPartenaires(s: Sb, ids?: string[]): Promise<PartenaireDoublon[]> {
  let q = s.from("partenaires").select("id, nom, type, actif, email, created_at");
  if (ids) q = q.in("id", ids);
  const { data, error } = await q; if (error) throw new Error(error.message);
  const liste = (data ?? []) as PartenaireDoublon[];
  if (!liste.length) return [];
  const pids = liste.map((p) => p.id);
  const [a, b] = await Promise.all([
    toutes((de, x) => s.from("rendezvous").select("partenaire_id").in("partenaire_id", pids).range(de, x)),
    toutes((de, x) => s.from("rendezvous").select("sous_traitant_id").in("sous_traitant_id", pids).range(de, x)),
  ]);
  const n = new Map<string, number>();
  for (const r of a) n.set(r.partenaire_id, (n.get(r.partenaire_id) ?? 0) + 1);
  for (const r of b) n.set(r.sous_traitant_id, (n.get(r.sous_traitant_id) ?? 0) + 1);
  return liste.map((p) => ({ ...p, chantiers: n.get(p.id) ?? 0 }));
}

/** Tous les doublons possibles du site, avec celui à garder et ce qu'il est permis de faire du doublon. Lecture seule. */
export const listDoublonsSite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase as Sb;
    const rdvs = (await toutes((de, a) => s.from("rendezvous").select(CHAMPS_RDV).neq("statut", "annule").range(de, a))) as ChantierDoublon[];
    const candidats = pairesChantiers(rdvs);
    const ids = [...new Set(candidats.flatMap((p) => [p.garder.id, p.doublon.id]))];
    const liens = await liensChantiers(s, ids);
    const chantiers = pairesChantiers(rdvs.filter((r) => liens.has(r.id)).map((r) => ({ ...r, liens: liens.get(r.id)! })))
      .map((p) => ({ ...p, action: actionChantier(p.doublon), blocages: blocagesChantier(p.doublon) }));
    const factures = pairesFactures(await chargerFactures(s)).map((p) => ({ ...p, action: actionFacture(p.doublon) }));
    const devisListe = (await toutes((de, a) => s.from("devis").select(CHAMPS_DEVIS).range(de, a))).map((d: any) => ({ ...d, total_ttc: Number(d.total_ttc ?? 0) })) as DevisDoublon[];
    const devis = pairesDevis(devisListe).map((p) => ({ ...p, action: actionDevis(p.doublon) }));
    const partenaires = pairesPartenaires(await chargerPartenaires(s)).map((p) => ({ ...p, action: "fusionner" as const }));
    const { data: dos, error } = await s.from("donneurs_ordre").select("*");
    if (error) throw new Error(error.message);
    const clients = pairesClients((dos ?? []) as ClientDoublon[]).map((p) => ({ ...p, action: "fusionner" as const }));
    return { chantiers, factures, devis, partenaires, clients };
  });

/**
 * Traite un doublon après confirmation : les règles sont relues côté serveur sur les deux éléments.
 * Chantier/devis : suppression seulement si rien n'est relié. Facture : brouillon supprimé, facture émise annulée (jamais effacée), payée intouchable.
 * Fiches : fusion (chantiers déplacés ou champs complétés), puis suppression du doublon.
 */
export const traiterDoublon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    type: z.enum(["chantier", "facture", "devis", "partenaire", "client"]),
    id: z.string().uuid(), garderId: z.string().uuid(),
  }).refine((d) => d.id !== d.garderId, "Choisissez deux éléments différents.").parse(raw))
  .handler(async ({ data, context }) => {
    const s = context.supabase as Sb;
    const verifier = (ok: boolean) => { if (!ok) throw new Error("Ces deux éléments ne sont plus des doublons : rechargez la page."); };

    if (data.type === "chantier") {
      const { data: rows, error } = await s.from("rendezvous").select(CHAMPS_RDV).in("id", [data.id, data.garderId]);
      if (error) throw new Error(error.message);
      const d = rows?.find((r: any) => r.id === data.id), g = rows?.find((r: any) => r.id === data.garderId);
      verifier(Boolean(d && g && memeChantier(d, g)));
      const liens = await liensChantiers(s, [data.id]);
      const bloque = blocagesChantier({ ...d, liens: liens.get(data.id)! });
      if (bloque.length) throw new Error(`Ce chantier a ${bloque.join(", ")} : il ne peut pas être supprimé. Gardez plutôt celui-ci.`);
      const { error: e } = await s.from("rendezvous").delete().eq("id", data.id);
      if (e) throw new Error(e.message);
      return { fait: "supprime" as const };
    }

    if (data.type === "facture") {
      const fs = await chargerFactures(s, [data.id, data.garderId]);
      const d = fs.find((f) => f.id === data.id), g = fs.find((f) => f.id === data.garderId);
      verifier(Boolean(d && g && memeFacture(d, g)));
      const action = actionFacture(d!);
      if (!action) throw new Error(`${d!.numero} est payée : elle ne peut être ni supprimée ni annulée. Faites un avoir.`);
      // Attachements de la facture en double : rattachés à la facture gardée, annulés s'ils répètent ses chantiers, sinon remis « à facturer ».
      const chGarder = new Set(g!.chantiers);
      for (const attId of d!.attachements) {
        if (g!.attachements.includes(attId)) { await s.from("attachements_travaux").update({ facture_id: g!.id }).eq("id", attId); continue; }
        const { data: its } = await s.from("attachement_items").select("rendezvous_id").eq("attachement_id", attId).not("rendezvous_id", "is", null);
        const { data: att } = await s.from("attachements_travaux").select("rendezvous_id").eq("id", attId).maybeSingle();
        const ch = [...new Set([att?.rendezvous_id, ...(its ?? []).map((i: any) => i.rendezvous_id)].filter(Boolean))] as string[];
        if (ch.length && ch.every((c) => chGarder.has(c))) await s.from("attachements_travaux").update({ statut: "annule", facture_id: null }).eq("id", attId);
        else await s.from("attachements_travaux").update({ facture_id: null, statut: "accepte" }).eq("id", attId).eq("statut", "facture");
        await s.from("attachements_travaux").update({ facture_id: null }).eq("id", attId).eq("facture_id", d!.id);
      }
      const { error: e } = action === "supprimer"
        ? await s.from("factures").delete().eq("id", data.id)
        : await s.from("factures").update({ statut: "annulee" }).eq("id", data.id);
      if (e) throw new Error(e.message);
      return { fait: action === "supprimer" ? ("supprime" as const) : ("annule" as const) };
    }

    if (data.type === "devis") {
      const { data: rows, error } = await s.from("devis").select(CHAMPS_DEVIS).in("id", [data.id, data.garderId]);
      if (error) throw new Error(error.message);
      const d = rows?.find((r: any) => r.id === data.id), g = rows?.find((r: any) => r.id === data.garderId);
      verifier(Boolean(d && g && memeDevis(d, g)));
      if (!actionDevis(d)) throw new Error(`${d.numero} est signé, accepté ou facturé : il ne peut pas être supprimé.`);
      const { error: e } = await s.from("devis").delete().eq("id", data.id);
      if (e) throw new Error(e.message);
      return { fait: "supprime" as const };
    }

    if (data.type === "partenaire") {
      const ps = await chargerPartenaires(s, [data.id, data.garderId]);
      const d = ps.find((p) => p.id === data.id), g = ps.find((p) => p.id === data.garderId);
      verifier(Boolean(d && g && memePartenaire(d, g)));
      const a = await s.from("rendezvous").update({ partenaire_id: g!.id, partenaire: g!.nom }).eq("partenaire_id", d!.id);
      if (a.error) throw new Error(a.error.message);
      const b = await s.from("rendezvous").update({ sous_traitant_id: g!.id }).eq("sous_traitant_id", d!.id);
      if (b.error) throw new Error(b.error.message);
      const { error: e } = await s.from("partenaires").delete().eq("id", d!.id);
      if (e) throw new Error(e.message);
      return { fait: "fusionne" as const, chantiers: d!.chantiers ?? 0 };
    }

    const { data: rows, error } = await s.from("donneurs_ordre").select("*").in("id", [data.id, data.garderId]);
    if (error) throw new Error(error.message);
    const d = rows?.find((r: any) => r.id === data.id) as ClientDoublon | undefined, g = rows?.find((r: any) => r.id === data.garderId) as ClientDoublon | undefined;
    verifier(Boolean(d && g && memeClient(d, g)));
    const patch = completerClient(g!, d!);
    if (Object.keys(patch).length) { const u = await s.from("donneurs_ordre").update(patch).eq("id", g!.id); if (u.error) throw new Error(u.error.message); }
    const { error: e } = await s.from("donneurs_ordre").delete().eq("id", d!.id);
    if (e) throw new Error(e.message);
    return { fait: "fusionne" as const, completes: Object.keys(patch).length };
  });
