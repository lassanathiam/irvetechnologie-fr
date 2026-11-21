import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, BellRing, CheckCircle2, ChevronDown, Download, Eye, EyeOff, FileText, Loader2, Mail, Receipt, Search, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { euro } from "@/lib/company";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { csvSuivi, doublonsChantier, ETAPE_TERMINEE, ETAPES_CHANTIER, receptionnesSansCommande, resumeEtapes, totalReceptionnes, type EtapeChantier, type LigneSuivi } from "@/lib/etape-chantier";
import { getSuiviChantiers } from "@/lib/suivi-chantiers.functions";
import { receptionnerChantiers } from "@/lib/planning.functions";
import { convertirAttachementEnFacture, enregistrerCommandeAttachement, envoyerAttachementsGroupes, marquerAttachementsEnvoyes } from "@/lib/attachements.functions";
import { updateFactureDepot, updateFactureStatut } from "@/lib/factures.functions";
import { envoyerBilanReception } from "@/lib/bilan-reception.functions";
import { envoyerRappelClient } from "@/lib/rappel-client.functions";
import { motifRappel } from "@/lib/rappel-client";

export const Route = createFileRoute("/_authenticated/suivi")({
  validateSearch: (s: Record<string, unknown>): { etape?: number; vue?: "receptionnes" } => {
    if (s.vue === "receptionnes") return { vue: "receptionnes" };
    const n = Number(s.etape);
    return n >= 1 && n <= 8 ? { etape: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Suivi chantiers — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Un seul circuit en 7 étapes : travaux terminés, attachement, envoi et consultation, commande, facture, réception, dépôt." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Suivi chantiers — Borne de l'Ouest" },
      { property: "og:description", content: "Du chantier fait jusqu'au paiement, étape par étape." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuiviPage,
});

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "");
const STATUT_PLANNING: Record<string, string> = { planifie: "planifié", en_pause: "en pause", en_cours: "en cours", annule: "annulé", a_planifier: "à planifier" };
const ACTION: Record<EtapeChantier, string | null> = { 1: null, 2: "Marquer envoyé (sans email)", 3: null, 4: null, 5: "Créer la facture", 6: "Réceptionner", 7: "Marquer déposée", 8: "Marquer payée" };

function SuiviPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const vueRecus = search.vue === "receptionnes";
  const etape = (search.etape ?? 1) as EtapeChantier;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["suivi-chantiers"], queryFn: useServerFn(getSuiviChantiers) });
  const receptionner = useServerFn(receptionnerChantiers);
  const facturer = useServerFn(convertirAttachementEnFacture);
  const envoyes = useServerFn(marquerAttachementsEnvoyes);
  const deposer = useServerFn(updateFactureDepot);
  const payer = useServerFn(updateFactureStatut);
  const integrerCommande = useServerFn(enregistrerCommandeAttachement);
  const envoyerBilan = useEnvoiConfirme(envoyerBilanReception, "Envoyer ce bilan au donneur d’ordre par email ? Vous en recevez une copie.");
  const envoyerAtts = useEnvoiConfirme(envoyerAttachementsGroupes, "Envoyer maintenant les attachements cochés au donneur d’ordre, en un seul email avec un lien par chantier ? Vous en recevez une copie.");
  const rappelClient = useEnvoiConfirme(envoyerRappelClient, "Envoyer un rappel au donneur d’ordre pour les chantiers cochés (commande ou réception attendue) ? Vous et le chargé d’affaires êtes en copie.");
  const bilanPourMoi = useEnvoiConfirme(envoyerBilanReception, "M’envoyer une copie de ce bilan ? Le client ne reçoit rien.");

  const [donneur, setDonneur] = useState("");
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
  const [sansCommande, setSansCommande] = useState(false);
  const [coches, setCoches] = useState<string[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const toutes = q.data?.lignes ?? [];
  const donneurs = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of toutes) if (l.donneur) m.set(l.donneur, (m.get(l.donneur) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [toutes]);
  const filtrees = useMemo(() => toutes.filter((l) => {
    if (donneur && l.donneur !== donneur) return false;
    const j = (l.date ?? "").slice(0, 10);
    if (du && (!j || j < du)) return false;
    if (au && (!j || j > au)) return false;
    const t = recherche.trim().toLowerCase();
    if (t && ![l.client, l.ville, l.attNumero, l.commande, l.factureNumero, l.donneur].filter(Boolean).join(" ").toLowerCase().includes(t)) return false;
    return true;
  }), [toutes, donneur, du, au, recherche]);
  const resume = resumeEtapes(filtrees);
  const idsSansCommande = useMemo(() => receptionnesSansCommande(filtrees), [filtrees]);
  const recus = filtrees.filter((l) => l.receptionneLe && (!sansCommande || (l.rdvId && idsSansCommande.has(l.rdvId))));
  const totauxRecus = totalReceptionnes(filtrees);
  const totalRecus = totauxRecus.ht;
  const doublons = useMemo(() => doublonsChantier(toutes), [toutes]);
  const groupesRecus = useMemo(() => {
    const m = new Map<string, LigneSuivi[]>();
    for (const l of recus) { const k = l.rdvId ?? l.cle; m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m.values()].sort((a, b) => (b[0].receptionneLe ?? "").localeCompare(a[0].receptionneLe ?? ""));
  }, [recus]);
  const lignes = vueRecus
    ? [...recus].sort((a, b) => (b.receptionneLe ?? "").localeCompare(a.receptionneLe ?? ""))
    : filtrees.filter((l) => l.etape === etape);
  const alertes = !vueRecus && etape <= 5 ? lignes.filter((l) => l.recuSansCommande) : [];
  const groupes = useMemo(() => {
    const m = new Map<string, LigneSuivi[]>();
    for (const l of lignes) { const k = l.donneur || "Sans client"; m.set(k, [...(m.get(k) ?? []), l]); }
    return [...m].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [lignes]);
  const selection = lignes.filter((l) => coches.includes(l.cle));
  const totalSel = selection.reduce((t, l) => t + l.montantHt, 0);
  const totalEtape = lignes.reduce((t, l) => t + l.montantHt, 0);
  const basculer = (cles: string[], oui: boolean) => setCoches((c) => (oui ? [...new Set([...c, ...cles])] : c.filter((x) => !cles.includes(x))));
  const changerEtape = (n: EtapeChantier) => { setCoches([]); void navigate({ search: { etape: n } }); };
  const voirRecus = () => { setCoches([]); void navigate({ search: { vue: "receptionnes" } }); };

  const rafraichir = async () => {
    await qc.invalidateQueries({ queryKey: ["suivi-chantiers"] });
    for (const k of ["dashboard", "attachements", "factures", "bilan-reception"]) void qc.invalidateQueries({ queryKey: [k] });
  };

  /** Fait avancer les lignes à l'étape suivante. Une facture ou un attachement couvrant plusieurs chantiers n'est traité qu'une fois. */
  const avancer = async (ls: LigneSuivi[], cle: string) => {
    if (!ls.length) return;
    setEnCours(cle);
    try {
      const n = ls[0].etape;
      if (n === 2) {
        const ids = [...new Set(ls.map((l) => l.attId).filter(Boolean))] as string[];
        const r = await envoyes({ data: { ids } });
        toast.success(`${r.nb} attachement(s) marqué(s) envoyé(s), sans email.`);
      } else if (n === 6) {
        const ids = [...new Set(ls.map((l) => l.rdvId).filter(Boolean))] as string[];
        if (!ids.length) { toast.error("Aucun chantier du Planning relié."); return; }
        const r = await receptionner({ data: { ids, receptionne: true } });
        toast.success(`${r.nb} chantier(s) réceptionné(s).`);
        if (r.sansCommande) toast.warning(`${r.sansCommande} chantier(s) sans commande reçue : pas réceptionné(s).`);
      } else if (n === 5) {
        const ids = [...new Set(ls.map((l) => l.attId).filter(Boolean))] as string[];
        let ok = 0; const echecs: string[] = [];
        for (const id of ids) { try { await facturer({ data: { id } }); ok += 1; } catch (e) { echecs.push(e instanceof Error ? e.message : String(e)); } }
        if (ok) toast.success(`${ok} facture(s) créée(s). Rien n’est envoyé au client.`);
        if (echecs.length) toast.error(`${echecs.length} échec(s) : ${echecs[0]}`);
      } else if (n === 7 || n === 8) {
        const ids = [...new Set(ls.filter((l) => n === 7 || !l.payeLe).map((l) => l.factureId).filter(Boolean))] as string[];
        for (const id of ids) {
          if (n === 7) await deposer({ data: { id, valeur: true } });
          else await payer({ data: { id, statut: "payee" } });
        }
        toast.success(`${ids.length} facture(s) marquée(s) ${n === 7 ? "déposée(s)" : "payée(s)"}.`);
      }
      setCoches([]);
      await rafraichir();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible.");
    } finally { setEnCours(null); }
  };
  const retirerReception = async (l: LigneSuivi) => {
    if (!l.rdvId || !window.confirm(`Retirer la réception de ${l.client} ?`)) return;
    setEnCours(l.cle);
    try { await receptionner({ data: { ids: [l.rdvId], receptionne: false } }); toast.success(`${l.client} : réception retirée`); await rafraichir(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible."); } finally { setEnCours(null); }
  };
  const saisirCommande = async (l: LigneSuivi, numero: string) => {
    if (!l.attId) return;
    const n = numero.trim();
    if (n.length < 3) { toast.error("Saisissez le numéro de commande reçu (ex. CST 02048734)."); return; }
    setEnCours(l.cle);
    try { await integrerCommande({ data: { id: l.attId, bon_commande: n } }); toast.success(`Commande ${n} intégrée sur ${l.attNumero}. Le chantier passe à « À facturer ».`); await rafraichir(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Commande non intégrée."); } finally { setEnCours(null); }
  };
  const telecharger = () => {
    const blob = new Blob([csvSuivi(selection.length ? selection : filtrees)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suivi-chantiers-${(donneur || "tous").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const envoyerPourMoi = async () => {
    const ids = [...new Set(selection.map((l) => l.attId).filter(Boolean))] as string[];
    if (!ids.length) { toast.error("Cochez des chantiers qui ont un attachement."); return; }
    setEnCours("moi");
    try {
      const r = await bilanPourMoi({ data: { ids, envoiId: crypto.randomUUID(), message, pourMoi: true } });
      if (r.sent) toast.success("Copie du bilan envoyée sur votre boîte (le client ne reçoit rien)."); else toast.error("L’email n’est pas parti.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  };
  /** Envoie directement les attachements (un seul email par donneur d'ordre), sans bilan. */
  const envoyerAttachements = async (ls: LigneSuivi[], cle: string) => {
    const ids = [...new Set(ls.map((l) => l.attId).filter(Boolean))] as string[];
    if (!ids.length) { toast.error("Cochez des chantiers qui ont un attachement."); return; }
    if (new Set(ls.filter((l) => l.attId).map((l) => l.donneur)).size > 1) { toast.error("Cochez les chantiers d’un seul donneur d’ordre à la fois."); return; }
    setEnCours(cle);
    try {
      const r = await envoyerAtts({ data: { ids } });
      if (r.sent) { toast.success(`${ids.length} attachement(s) envoyé(s) au donneur d’ordre en un seul email.`); setCoches([]); await rafraichir(); }
      else toast.error("L’email n’est pas parti.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  };
  /** Rappel au client : commande attendue (étapes 3-4) ou réception attendue (étape 6). */
  const envoyerRappel = async () => {
    const ls = selection.filter((l) => l.attId && motifRappel(l));
    if (!ls.length) { toast.error("Cochez des chantiers en attente de commande ou de réception."); return; }
    if (new Set(ls.map((l) => l.donneur)).size > 1) { toast.error("Cochez les chantiers d’un seul donneur d’ordre à la fois."); return; }
    setEnCours("rappel");
    try {
      const r = await rappelClient({ data: { cles: ls.map((l) => l.cle), envoiId: crypto.randomUUID(), message } });
      if (r.sent) {
        toast.success(`Rappel envoyé : ${[r.commandes ? `${r.commandes} commande(s) attendue(s)` : "", r.receptions ? `${r.receptions} réception(s) attendue(s)` : ""].filter(Boolean).join(", ")}.`);
        setCoches([]); setMessage(""); await rafraichir();
      } else toast.error("L’email n’est pas parti.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  };
  const etapeRappel = !vueRecus && (etape === 3 || etape === 4 || etape === 6);
  const envoyerAuClient = async () => {
    const ids = [...new Set(selection.map((l) => l.attId).filter(Boolean))] as string[];
    if (!ids.length) { toast.error("Cochez des chantiers qui ont un attachement."); return; }
    setEnCours("envoi");
    try {
      const r = await envoyerBilan({ data: { ids, envoiId: crypto.randomUUID(), message } });
      if (r.sent) toast.success("Bilan envoyé au donneur d’ordre."); else toast.error("L’email n’est pas parti.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  };

  const info = vueRecus
    ? { label: "Tous les chantiers réceptionnés", aide: "Liste complète des réceptions, de la plus récente à la plus ancienne. L’étape actuelle de chaque chantier est indiquée." }
    : ETAPES_CHANTIER[etape - 1];
  return <ProShell><div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold">Suivi chantiers</h1>
      <p className="text-sm text-muted-foreground">Un seul chemin en 7 étapes, toujours dans le même ordre, rangé par client. Chaque chantier n’est qu’à une seule étape.</p>
    </header>
    {q.isLoading ? <Loader2 className="animate-spin text-primary" /> : q.error ? <p className="text-destructive">Suivi indisponible, rechargez la page.</p> : <>
      <nav aria-label="Étapes" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ETAPES_CHANTIER.map((e) => {
          const actif = !vueRecus && e.n === etape;
          return <button key={e.n} type="button" onClick={() => changerEtape(e.n)} aria-current={actif ? "step" : undefined}
            className={`rounded-lg border-2 p-3 text-left transition ${actif ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
            <span className="flex items-center gap-2 text-sm font-bold"><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${actif ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{e.n === ETAPE_TERMINEE ? <CheckCircle2 className="h-4 w-4" /> : e.n}</span>{e.label}</span>
            <span className="mt-1 block text-2xl font-extrabold text-dashboard-green">{euro(resume[e.n].ht)}</span>
            <span className="block text-xs text-muted-foreground">{resume[e.n].nb} chantier(s) · HT</span>
          </button>;
        })}
      </nav>
      <button type="button" onClick={voirRecus} aria-current={vueRecus ? "page" : undefined}
        className={`flex w-full flex-wrap items-center gap-3 rounded-lg border-2 p-3 text-left transition ${vueRecus ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
        <CheckCircle2 className="h-6 w-6 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Tous les chantiers réceptionnés</span>
          <span className="block text-xs text-muted-foreground">Tous ceux qui ont été réceptionnés, quelle que soit l’étape où ils sont maintenant (facturés, déposés ou payés compris).</span>
        </span>
        <span className="text-right">
          <span className="block text-2xl font-extrabold text-dashboard-green">{euro(totalRecus)}</span>
          <span className="block text-xs text-muted-foreground">{totauxRecus.nb} chantier(s) · HT</span>
        </span>
      </button>

      <section className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-3">
        <label className="text-xs text-muted-foreground">Client
          <select className="mt-1 block min-w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={donneur} onChange={(e) => { setDonneur(e.target.value); setCoches([]); }}>
            <option value="">Tous</option>
            {donneurs.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">Du<Input className="mt-1" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
        <label className="text-xs text-muted-foreground">au<Input className="mt-1" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
        <label className="min-w-[220px] flex-1 text-xs text-muted-foreground">Chercher un nom, une ville, une facture, une commande
          <span className="relative mt-1 block"><Search className="absolute left-2.5 top-2.5 h-4 w-4" /><Input className="pl-8" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Ex. MALEZIEUX, F-2026-0047, CST…" /></span>
        </label>
        {(du || au || donneur || recherche) && <Button variant="ghost" size="sm" onClick={() => { setDu(""); setAu(""); setDonneur(""); setRecherche(""); }}>Tout effacer</Button>}
      </section>

      <section className="rounded-md border-2 border-primary/40 bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{vueRecus || etape === ETAPE_TERMINEE ? "" : `${etape}. `}{info.label} <span className="text-dashboard-green">· {euro(totalEtape)} HT</span></h2>
            <p className="text-xs text-muted-foreground">{info.aide}</p>
          </div>
          {vueRecus && <Button size="sm" variant={sansCommande ? "default" : "outline"} aria-pressed={sansCommande} onClick={() => { setSansCommande((v) => !v); setCoches([]); }}>
            <AlertTriangle /> Réceptionnés sans commande ({idsSansCommande.size})
          </Button>}
          {!vueRecus && (etape === 3 || etape === 4) && <Button asChild size="sm" variant="outline"><Link to="/attachements/commandes"><Upload /> Importer les bons de commande</Link></Button>}
          {!vueRecus && etape === 1 && lignes.some((l) => l.rdvId) && <Button asChild size="sm"><Link to="/attachements" search={{ rdv: [...new Set((selection.length ? selection : lignes).map((l) => l.rdvId).filter(Boolean))].join(",") }}><FileText /> Faire l’attachement {selection.length ? `(${selection.length})` : "de tous"}</Link></Button>}
        </div>
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={lignes.length > 0 && lignes.every((l) => coches.includes(l.cle))} onChange={(e) => basculer(lignes.map((l) => l.cle), e.target.checked)} /> Tout cocher ({vueRecus ? `${groupesRecus.length} chantiers` : lignes.length})</label>
          <span>{selection.length} coché(s) · <strong className="text-base text-dashboard-green">{euro(totalSel)} HT</strong></span>
          <div className="ml-auto flex flex-wrap gap-2">
            {!vueRecus && ACTION[etape] && <Button size="sm" disabled={!selection.length || !!enCours} onClick={() => void avancer(selection, "lot")}>{enCours === "lot" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {ACTION[etape]} ({selection.length})</Button>}
            <Button size="sm" variant="outline" disabled={!filtrees.length} onClick={telecharger}><Download /> Télécharger {selection.length ? `(${selection.length})` : "tout"}</Button>
            {!vueRecus && etape >= 2 && etape <= 4 && <Button size="sm" className="font-bold" disabled={!selection.some((l) => l.attId) || !!enCours} onClick={() => void envoyerAttachements(selection, "atts")}>{enCours === "atts" ? <Loader2 className="animate-spin" /> : <Send />} {etape === 2 ? "Envoyer les attachements" : "Renvoyer les attachements"} ({new Set(selection.map((l) => l.attId).filter(Boolean)).size})</Button>}
            {etapeRappel && <Button size="sm" className="font-bold" variant="secondary" disabled={!selection.length || !!enCours} onClick={() => void envoyerRappel()}>{enCours === "rappel" ? <Loader2 className="animate-spin" /> : <BellRing />} Faire un rappel au client ({selection.length})</Button>}
            {(vueRecus || etape >= 5) && <Button size="sm" variant="outline" disabled={!selection.length || !!enCours} onClick={() => void envoyerAuClient()}>{enCours === "envoi" ? <Loader2 className="animate-spin" /> : <Mail />} Envoyer le bilan au client</Button>}
            {(vueRecus || etape >= 5) && <Button size="sm" variant="ghost" disabled={!selection.length || !!enCours} onClick={() => void envoyerPourMoi()}>{enCours === "moi" ? <Loader2 className="animate-spin" /> : <Mail />} M’envoyer une copie du bilan</Button>}
          </div>
          {selection.length > 0 && (vueRecus || etape >= 5 || etapeRappel) && <Textarea rows={2} className="basis-full" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={etapeRappel ? "Message pour le client (facultatif) — la liste des chantiers en attente est ajoutée automatiquement" : "Message pour le client (facultatif) — le bilan détaillé est ajouté automatiquement"} />}
        </div>
        {alertes.length > 0 && <p className="flex items-start gap-2 border-b border-border bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong>{alertes.length} chantier(s) déjà réceptionné(s) avant la commande ou la facture.</strong> Ils restent ici tant que l’étape n’est pas faite.</span></p>}
        {vueRecus && sansCommande && !lignes.length ? <p className="p-6 text-center text-sm font-semibold text-dashboard-green">Aucun chantier réceptionné sans commande{donneur ? ` chez ${donneur}` : ""} : chaque réception a bien sa commande.</p> :
          !lignes.length ? <p className="p-6 text-center text-sm text-muted-foreground">Aucun chantier à cette étape.</p> :
          vueRecus
            ? <ul className="divide-y divide-border">{groupesRecus.map((g) => <GroupeRecu key={g[0].cle} g={g} doublons={doublons} coche={g.every((l) => coches.includes(l.cle))} onCoche={(v) => basculer(g.map((l) => l.cle), v)} enCours={enCours === g[0].cle} onRetirer={() => void retirerReception(g[0])} />)}</ul>
            : <div className="divide-y-2 divide-border">{groupes.map(([nom, ls]) => <GroupeClient key={nom} nom={nom} ls={ls} ouvertParDefaut={groupes.length <= 3} coche={ls.every((l) => coches.includes(l.cle))} onCoche={(v) => basculer(ls.map((l) => l.cle), v)}>
                {ls.map((l) => <Ligne key={l.cle} l={l} doublon={doublons.get(l.cle)} coche={coches.includes(l.cle)} onCoche={(v) => basculer([l.cle], v)} enCours={enCours === l.cle} onAvancer={() => void avancer([l], l.cle)} onRetirer={() => void retirerReception(l)} onCommande={(n) => void saisirCommande(l, n)} onEnvoyer={() => void envoyerAttachements([l], l.cle)} />)}
              </GroupeClient>)}</div>}
      </section>
      <p className="text-xs text-muted-foreground">Montants HT issus des attachements. « Consulté » = le client a ouvert le lien de l’attachement. Un attachement hebdomadaire est réparti par chantier ; sa commande, sa facture ou son dépôt traitent tout l’attachement en une seule fois. Cette page ne modifie rien sans clic de votre part et n’envoie rien sans confirmation.</p>
    </>}
  </div></ProShell>;
}

function AlerteDoublon({ autres }: { autres?: string[] }) {
  if (!autres?.length) return null;
  return <span className="mt-1 flex items-start gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Doublon possible : ce chantier est aussi dans {autres.join(", ")} (pas un TS). Vérifiez qu’il n’est pas facturé deux fois.</span>;
}

/** Vue « Tous les réceptionnés » : un chantier = une ligne, avec tous ses documents (attachement initial, TS). */
function GroupeRecu({ g, doublons, coche, onCoche, enCours, onRetirer }: { g: LigneSuivi[]; doublons: Map<string, string[]>; coche: boolean; onCoche: (v: boolean) => void; enCours: boolean; onRetirer: () => void }) {
  const l = g[0];
  const total = g.reduce((t, x) => t + x.montantHt, 0);
  const commandeChantier = g.find((x) => x.commande)?.commande ?? null;
  return <li className="flex flex-wrap items-start gap-3 p-3">
    <input type="checkbox" aria-label={`Cocher ${l.client}`} className="mt-1.5 h-5 w-5" checked={coche} onChange={(e) => onCoche(e.target.checked)} />
    <div className="min-w-0 flex-1">
      {l.rdvId ? <Link to="/planning" search={{ rdv: l.rdvId }} className="text-lg font-extrabold hover:underline">{l.client}</Link> : <strong className="text-lg font-extrabold">{l.client}</strong>}
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {l.donneur && <span className="font-semibold">{l.donneur}</span>}
        {l.ville && <span>{l.ville}</span>}
        {l.date && <span>Chantier du {dateFr(l.date)}</span>}
        <span className="text-primary">Réceptionné le {dateFr(l.receptionneLe)} {!enCours && <button type="button" className="underline" onClick={onRetirer}>retirer</button>}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {g.map((x) => <li key={x.cle} className="rounded-md border border-border px-2 py-1 text-xs">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {x.attId ? <Link to="/attachements/$id" params={{ id: x.attId }} className="inline-flex items-center gap-1 font-semibold hover:underline"><FileText className="h-3 w-3" />{x.attNumero}</Link> : <span>Pas d’attachement</span>}
            {x.ts && <span className="rounded border border-amber-500/60 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">TS</span>}
            {x.commande ? <span>Commande {x.commande}</span> : x.ts && commandeChantier ? <span>TS · commande du chantier {commandeChantier}</span> : <span className="font-bold text-destructive">Sans commande</span>}
            {x.factureId && <Link to="/factures/$id" params={{ id: x.factureId }} className="inline-flex items-center gap-1 hover:underline"><Receipt className="h-3 w-3" />{x.factureNumero}</Link>}
            <span className="rounded-full bg-muted px-2 py-0.5 font-bold">{x.etape === ETAPE_TERMINEE ? "" : `Étape ${x.etape} · `}{ETAPES_CHANTIER[x.etape - 1]?.court}</span>
            <strong className="ml-auto text-sm text-dashboard-green">{euro(x.montantHt)} HT</strong>
          </span>
          <AlerteDoublon autres={doublons.get(x.cle)} />
        </li>)}
      </ul>
    </div>
    <strong className="text-xl font-extrabold text-dashboard-green">{euro(total)} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
  </li>;
}

/** Un client (donneur d'ordre) et ses chantiers à cette étape, avec son total, repliable. */
function GroupeClient({ nom, ls, ouvertParDefaut, coche, onCoche, children }: { nom: string; ls: LigneSuivi[]; ouvertParDefaut: boolean; coche: boolean; onCoche: (v: boolean) => void; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const total = ls.reduce((t, l) => t + l.montantHt, 0);
  return <section>
    <div className="flex flex-wrap items-center gap-3 bg-muted/40 px-3 py-2">
      <input type="checkbox" aria-label={`Cocher tous les chantiers de ${nom}`} className="h-5 w-5" checked={coche} onChange={(e) => onCoche(e.target.checked)} />
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)}>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${ouvert ? "" : "-rotate-90"}`} />
        <span className="text-base font-extrabold">{nom}</span>
        <span className="text-xs text-muted-foreground">{ls.length} chantier(s)</span>
      </button>
      <strong className="text-lg font-extrabold text-dashboard-green">{euro(total)} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
    </div>
    {ouvert && <ul className="divide-y divide-border">{children}</ul>}
  </section>;
}

function Consultation({ l }: { l: LigneSuivi }) {
  if (!l.attId || l.etape < 3 || l.etape > 4) return null;
  if (l.valideLe) return <span className="inline-flex items-center gap-1 font-semibold text-primary"><CheckCircle2 className="h-3 w-3" />Validé le {dateFr(l.valideLe)}</span>;
  if (l.consulteLe || l.vues > 0) return <span className="inline-flex items-center gap-1 font-semibold text-primary"><Eye className="h-3 w-3" />Consulté le {dateFr(l.consulteLe ?? l.derniereConsultation)}{l.vues > 1 ? ` · ${l.vues} fois, dernière le ${dateFr(l.derniereConsultation)}` : ""}</span>;
  return <span className="inline-flex items-center gap-1 font-semibold text-destructive"><EyeOff className="h-3 w-3" />Pas encore consulté{l.envoyeLe ? ` (envoyé le ${dateFr(l.envoyeLe)})` : ""}</span>;
}

function SaisieCommande({ enCours, onCommande }: { enCours: boolean; onCommande: (n: string) => void }) {
  const [n, setN] = useState("");
  return <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); onCommande(n); }}>
    <Input aria-label="Numéro de commande reçu" className="h-10 w-40" value={n} onChange={(e) => setN(e.target.value)} placeholder="N° de commande" />
    <Button type="submit" size="sm" className="min-h-10 font-bold" disabled={enCours || n.trim().length < 3}>{enCours ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Intégrer</Button>
  </form>;
}

function Ligne({ l, coche, onCoche, enCours, onAvancer, onRetirer, onCommande, onEnvoyer, doublon }: { l: LigneSuivi; coche: boolean; onCoche: (v: boolean) => void; enCours: boolean; onAvancer: () => void; onRetirer: () => void; onCommande: (n: string) => void; onEnvoyer: () => void; doublon?: string[] }) {
  const pasTermine = l.statutPlanning && l.statutPlanning !== "termine" && l.statutPlanning !== "realise";
  const action = ACTION[l.etape];
  return <li className="flex flex-wrap items-center gap-3 p-3">
    <input type="checkbox" aria-label={`Cocher ${l.client}`} className="h-5 w-5" checked={coche} onChange={(e) => onCoche(e.target.checked)} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        {l.rdvId ? <Link to="/planning" search={{ rdv: l.rdvId }} className="text-lg font-extrabold hover:underline">{l.client}</Link> : <strong className="text-lg font-extrabold">{l.client}</strong>}
        {l.ts && <span className="rounded border border-amber-500/60 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">TS</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {l.ville && <span>{l.ville}</span>}
        {l.date && <span>{dateFr(l.date)}</span>}
        {l.attId ? <Link to="/attachements/$id" params={{ id: l.attId }} className="inline-flex items-center gap-1 hover:underline"><FileText className="h-3 w-3" />{l.attNumero}</Link> : <span className="text-amber-600 dark:text-amber-400">Pas d’attachement</span>}
        <Consultation l={l} />
        {l.rappelLe && motifRappel(l) && <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400"><BellRing className="h-3 w-3" />Rappel envoyé le {dateFr(l.rappelLe)}{(l.rappels ?? 0) > 1 ? ` · ${l.rappels} rappels` : ""}</span>}
        {l.commande && <span>Commande {l.commande}</span>}
        {l.receptionneLe && <span className="text-primary">Réceptionné le {dateFr(l.receptionneLe)} {l.etape < ETAPE_TERMINEE && <button type="button" className="underline" onClick={onRetirer}>retirer</button>}</span>}
        {l.factureId && l.etape <= 4 && <span className="font-semibold text-destructive">Déjà facturé · commande manquante</span>}
        {l.factureId && <Link to="/factures/$id" params={{ id: l.factureId }} className="inline-flex items-center gap-1 hover:underline"><Receipt className="h-3 w-3" />{l.factureNumero}</Link>}
        {l.deposeLe && <span>Déposée le {dateFr(l.deposeLe)}</span>}
        {l.payeLe && <span className="text-primary">Payée le {dateFr(l.payeLe)}</span>}
      </div>
      {l.attId && !l.rdvId && <Link to="/attachements/$id" params={{ id: l.attId }} className="mt-0.5 block text-xs font-semibold text-destructive underline">Aucun chantier relié à {l.attNumero} : ouvrez-le, « Modifier », puis choisissez le chantier de chaque ligne.</Link>}
      {pasTermine && <span className="mt-0.5 block text-xs font-semibold text-amber-600 dark:text-amber-400">Encore « {STATUT_PLANNING[l.statutPlanning!] ?? l.statutPlanning} » au Planning</span>}
      <AlerteDoublon autres={doublon} />
      {l.recuSansCommande && <span className="mt-0.5 block text-xs font-semibold text-amber-600 dark:text-amber-400">Déjà réceptionné, commande à intégrer</span>}
    </div>
    <strong className="text-xl font-extrabold text-dashboard-green">{euro(l.montantHt)} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
    {l.etape === 1 ? (l.rdvId ? <Button asChild size="sm" className="min-h-10 font-bold"><Link to="/attachements" search={{ rdv: l.rdvId }}><FileText /> Faire l’attachement</Link></Button> : null)
      : l.etape === 2 ? <span className="flex flex-wrap gap-2">
          {l.attId && <Button size="sm" className="min-h-10 font-bold" disabled={enCours} onClick={onEnvoyer}>{enCours ? <Loader2 className="animate-spin" /> : <Send />} Envoyer au client</Button>}
          <Button size="sm" variant="outline" className="min-h-10" disabled={enCours} onClick={onAvancer}>{enCours ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Déjà envoyé</Button>
        </span>
      : (l.etape === 3 || l.etape === 4) && l.attId ? <SaisieCommande enCours={enCours} onCommande={onCommande} />
      : l.etape === ETAPE_TERMINEE && l.payeLe ? <span className="text-sm font-bold text-primary">Payée</span>
      : action && <Button size="sm" variant={l.etape === 6 ? "default" : "outline"} className="min-h-10 font-bold" disabled={enCours} onClick={onAvancer}>{enCours ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {action}</Button>}
  </li>;
}
