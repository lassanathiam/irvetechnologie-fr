import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachementEnvoye, etapeChantier, recuSansCommande, type LigneSuivi } from "./etape-chantier";

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Une ligne = la part d'un chantier dans un attachement (ou un chantier terminé sans attachement). Lecture seule, sous l'identité de l'utilisateur. */
export const getSuiviChantiers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s = context.supabase;
    const [atts, items, commandes, termines] = await Promise.all([
      s.from("attachements_travaux").select("id, numero, client_nom, objet, total_ht, sent_at, accepted_at, statut, facture_id, bon_commande, rendezvous_id, depose_at, paye_at, attachement_initial_id, date_emission").neq("statut", "annule"),
      s.from("attachement_items").select("attachement_id, rendezvous_id, quantite, prix_unitaire"),
      s.from("commandes_importees").select("saisie, created_at").order("created_at", { ascending: true }),
      s.from("rendezvous").select("id").in("statut", ["termine", "realise"]).eq("archive", false),
    ]);
    for (const r of [atts, items, commandes, termines]) if (r.error) throw new Error(r.error.message);
    const listeAtt = (atts.data ?? []) as any[];
    const attIds = new Set(listeAtt.map((a) => a.id));

    // Montant par (attachement, chantier) et lignes sans chantier.
    const parts = new Map<string, Map<string | null, number>>();
    for (const i of (items.data ?? []) as any[]) {
      if (!attIds.has(i.attachement_id)) continue;
      const m = parts.get(i.attachement_id) ?? new Map<string | null, number>();
      const k = i.rendezvous_id ?? null;
      m.set(k, (m.get(k) ?? 0) + Number(i.quantite ?? 0) * Number(i.prix_unitaire ?? 0));
      parts.set(i.attachement_id, m);
    }
    const commandeParAtt = new Map<string, string>();
    for (const c of (commandes.data ?? []) as any[]) { const sa = c.saisie as any; if (sa?.attId && sa?.lu?.numero) commandeParAtt.set(sa.attId, String(sa.lu.numero)); }

    const rdvIds = new Set<string>((termines.data ?? []).map((r: any) => r.id));
    for (const a of listeAtt) if (a.rendezvous_id) rdvIds.add(a.rendezvous_id);
    for (const m of parts.values()) for (const k of m.keys()) if (k) rdvIds.add(k);
    const idsRdv = [...rdvIds];
    const rdvs: any[] = [];
    for (let i = 0; i < idsRdv.length; i += 300) {
      const { data, error } = await s.from("rendezvous").select("id, client_nom, cp_ville, adresse, date_debut, termine_at, receptionne_at, statut, partenaire, montant_ht").in("id", idsRdv.slice(i, i + 300));
      if (error) throw new Error(error.message);
      rdvs.push(...(data ?? []));
    }
    const rdv = new Map(rdvs.map((r) => [r.id, r]));
    const factureIds = [...new Set(listeAtt.map((a) => a.facture_id).filter(Boolean))];
    const { data: facs, error: ef } = factureIds.length
      ? await s.from("factures").select("id, numero, statut, depose_at, paid_at, bon_commande").in("id", factureIds)
      : { data: [], error: null };
    if (ef) throw new Error(ef.message);
    const fac = new Map((facs ?? []).map((f: any) => [f.id, f]));

    const lignes: LigneSuivi[] = [];
    const avecAttachement = new Set<string>();
    for (const a of listeAtt) {
      const f = a.facture_id ? fac.get(a.facture_id) : null;
      const factureActive = f && f.statut !== "annulee" ? f : null;
      const commande = commandeParAtt.get(a.id) || (String(a.bon_commande ?? "").trim() || null) || (factureActive ? String(factureActive.bon_commande ?? "").trim() || null : null);
      const m = new Map(parts.get(a.id) ?? []);
      if (a.rendezvous_id && !m.has(a.rendezvous_id)) {
        // Attachement d'un seul chantier : sa part = le total hors lignes déjà réparties.
        const reparti = [...m.values()].reduce((t, v) => t + v, 0);
        m.set(a.rendezvous_id, Math.max(0, Number(a.total_ht ?? 0) - reparti));
        m.delete(null);
      }
      const chantiers = [...m.keys()].filter((k): k is string => Boolean(k) && rdv.has(k as string));
      const reste = arrondi(Number(a.total_ht ?? 0) - chantiers.reduce((t, k) => t + (m.get(k) ?? 0), 0));
      const cibles: (string | null)[] = chantiers.length ? [...chantiers] : [null];
      if (chantiers.length && reste > 0.01) cibles.push(null);
      for (const k of cibles) {
        const r = k ? rdv.get(k) : null;
        if (k) avecAttachement.add(k);
        const montant = k ? m.get(k) ?? 0 : chantiers.length ? reste : Number(a.total_ht ?? 0);
        const etat = {
          attachement: true, envoye: attachementEnvoye(a), commande: Boolean(commande), receptionne: Boolean(r?.receptionne_at),
          facture: Boolean(factureActive), sansReception: !k, depose: Boolean(factureActive?.depose_at || a.depose_at), paye: Boolean(factureActive?.paid_at || factureActive?.statut === "payee" || a.paye_at),
        };
        lignes.push({
          cle: `${a.id}|${k ?? "-"}`, rdvId: k, attId: a.id, attNumero: a.numero, ts: Boolean(a.attachement_initial_id),
          client: r?.client_nom || (k ? "Chantier" : chantiers.length ? `Autres lignes de ${a.numero}` : a.objet || a.numero),
          donneur: a.client_nom ?? "", ville: r?.cp_ville ?? null, date: r ? r.termine_at ?? r.date_debut : a.date_emission,
          montantHt: arrondi(montant), commande, receptionneLe: r?.receptionne_at ?? null,
          factureId: factureActive?.id ?? null, factureNumero: factureActive?.numero ?? null,
          deposeLe: factureActive?.depose_at ?? a.depose_at ?? null, payeLe: factureActive?.paid_at ?? a.paye_at ?? null,
          envoyeLe: a.sent_at ?? null, statutPlanning: r?.statut ?? null,
          etape: etapeChantier(etat), recuSansCommande: recuSansCommande(etat),
        });
      }
    }
    // Chantiers terminés sans aucun attachement : étape 1.
    for (const id of (termines.data ?? []).map((r: any) => r.id)) {
      if (avecAttachement.has(id)) continue;
      const r = rdv.get(id);
      if (!r) continue;
      lignes.push({
        cle: `-|${id}`, rdvId: id, attId: null, attNumero: null, ts: false, client: r.client_nom || "Chantier",
        donneur: r.partenaire ?? "", ville: r.cp_ville ?? null, date: r.termine_at ?? r.date_debut, montantHt: arrondi(Number(r.montant_ht ?? 0)),
        commande: null, receptionneLe: r.receptionne_at ?? null, factureId: null, factureNumero: null, deposeLe: null, payeLe: null, envoyeLe: null,
        statutPlanning: r.statut, etape: 1, recuSansCommande: false,
      });
    }
    lignes.sort((x, y) => String(y.date ?? "").localeCompare(String(x.date ?? "")));
    return { lignes };
  });
