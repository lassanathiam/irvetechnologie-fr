import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileText, Loader2, Mail, Receipt, Search, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { euro } from "@/lib/company";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { csvSuivi, ETAPES_CHANTIER, resumeEtapes, type EtapeChantier, type LigneSuivi } from "@/lib/etape-chantier";
import { getSuiviChantiers } from "@/lib/suivi-chantiers.functions";
import { receptionnerChantiers } from "@/lib/planning.functions";
import { convertirAttachementEnFacture, marquerAttachementsEnvoyes } from "@/lib/attachements.functions";
import { updateFactureDepot, updateFactureStatut } from "@/lib/factures.functions";
import { envoyerBilanReception } from "@/lib/bilan-reception.functions";

export const Route = createFileRoute("/_authenticated/suivi")({
  validateSearch: (s: Record<string, unknown>): { etape?: number } => {
    const n = Number(s.etape);
    return n >= 1 && n <= 6 ? { etape: n } : {};
  },
  head: () => ({
    meta: [
      { title: "Suivi chantiers — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Un seul circuit : chantier fait, attachement, commande, réception, facture, dépôt et paiement." },
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
const ACTION: Record<EtapeChantier, string | null> = { 1: "Marquer envoyé", 2: "Importer la commande", 3: "Réceptionner", 4: "Créer la facture", 5: "Marquer déposée", 6: "Marquer payée" };

function SuiviPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const etape = (search.etape ?? 3) as EtapeChantier;
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["suivi-chantiers"], queryFn: useServerFn(getSuiviChantiers) });
  const receptionner = useServerFn(receptionnerChantiers);
  const facturer = useServerFn(convertirAttachementEnFacture);
  const envoyes = useServerFn(marquerAttachementsEnvoyes);
  const deposer = useServerFn(updateFactureDepot);
  const payer = useServerFn(updateFactureStatut);
  const envoyerBilan = useEnvoiConfirme(envoyerBilanReception, "Envoyer ce bilan au donneur d’ordre par email ?");

  const [donneur, setDonneur] = useState("");
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
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
  const lignes = filtrees.filter((l) => l.etape === etape);
  const alertes = etape === 2 ? lignes.filter((l) => l.recuSansCommande) : [];
  const selection = lignes.filter((l) => coches.includes(l.cle));
  const totalSel = selection.reduce((t, l) => t + l.montantHt, 0);
  const totalEtape = lignes.reduce((t, l) => t + l.montantHt, 0);
  const basculer = (cles: string[], oui: boolean) => setCoches((c) => (oui ? [...new Set([...c, ...cles])] : c.filter((x) => !cles.includes(x))));
  const changerEtape = (n: EtapeChantier) => { setCoches([]); void navigate({ search: { etape: n } }); };

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
      if (n === 1) {
        const ids = [...new Set(ls.map((l) => l.attId).filter(Boolean))] as string[];
        if (!ids.length) { toast.error("Créez d’abord l’attachement de ce chantier (page Attachements)."); return; }
        const r = await envoyes({ data: { ids } });
        toast.success(`${r.nb} attachement(s) marqué(s) envoyé(s), sans email.`);
      } else if (n === 3) {
        const ids = [...new Set(ls.map((l) => l.rdvId).filter(Boolean))] as string[];
        if (!ids.length) { toast.error("Aucun chantier du Planning relié."); return; }
        const r = await receptionner({ data: { ids, receptionne: true } });
        toast.success(`${r.nb} chantier(s) réceptionné(s).`);
      } else if (n === 4) {
        const ids = [...new Set(ls.map((l) => l.attId).filter(Boolean))] as string[];
        let ok = 0; const echecs: string[] = [];
        for (const id of ids) { try { await facturer({ data: { id } }); ok += 1; } catch (e) { echecs.push(e instanceof Error ? e.message : String(e)); } }
        if (ok) toast.success(`${ok} facture(s) créée(s). Rien n’est envoyé au client.`);
        if (echecs.length) toast.error(`${echecs.length} échec(s) : ${echecs[0]}`);
      } else if (n === 5 || n === 6) {
        const ids = [...new Set(ls.map((l) => l.factureId).filter(Boolean))] as string[];
        for (const id of ids) {
          if (n === 5) await deposer({ data: { id, valeur: true } });
          else await payer({ data: { id, statut: "payee" } });
        }
        toast.success(`${ids.length} facture(s) marquée(s) ${n === 5 ? "déposée(s)" : "payée(s)"}.`);
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
  const telecharger = () => {
    const blob = new Blob([csvSuivi(selection.length ? selection : filtrees)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suivi-chantiers-${(donneur || "tous").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  const envoyerAuClient = async () => {
    const ids = [...new Set(selection.map((l) => l.attId).filter(Boolean))] as string[];
    if (!ids.length) { toast.error("Cochez des chantiers qui ont un attachement."); return; }
    setEnCours("envoi");
    try {
      const r = await envoyerBilan({ data: { ids, envoiId: crypto.randomUUID(), message } });
      if (r.sent) toast.success("Bilan envoyé au donneur d’ordre."); else toast.error("L’email n’est pas parti.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  };

  const info = ETAPES_CHANTIER[etape - 1];
  return <ProShell><div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold">Suivi chantiers</h1>
      <p className="text-sm text-muted-foreground">Un seul chemin, toujours dans le même ordre. Chaque chantier est à une seule étape.</p>
    </header>
    {q.isLoading ? <Loader2 className="animate-spin text-primary" /> : q.error ? <p className="text-destructive">Suivi indisponible, rechargez la page.</p> : <>
      <nav aria-label="Étapes" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {ETAPES_CHANTIER.map((e) => {
          const actif = e.n === etape;
          return <button key={e.n} type="button" onClick={() => changerEtape(e.n)} aria-current={actif ? "step" : undefined}
            className={`rounded-lg border-2 p-3 text-left transition ${actif ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
            <span className="flex items-center gap-2 text-sm font-bold"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${actif ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{e.n}</span>{e.label}</span>
            <span className="mt-1 block text-2xl font-extrabold text-dashboard-green">{euro(resume[e.n].ht)}</span>
            <span className="block text-xs text-muted-foreground">{resume[e.n].nb} chantier(s) · HT</span>
          </button>;
        })}
      </nav>

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
            <h2 className="text-lg font-bold">{etape}. {info.label} <span className="text-dashboard-green">· {euro(totalEtape)} HT</span></h2>
            <p className="text-xs text-muted-foreground">{info.aide}</p>
          </div>
          {etape === 2 && <Button asChild size="sm" variant="outline"><Link to="/attachements/commandes"><Upload /> Importer les commandes</Link></Button>}
        </div>
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-card p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={lignes.length > 0 && lignes.every((l) => coches.includes(l.cle))} onChange={(e) => basculer(lignes.map((l) => l.cle), e.target.checked)} /> Tout cocher ({lignes.length})</label>
          <span>{selection.length} coché(s) · <strong className="text-base text-dashboard-green">{euro(totalSel)} HT</strong></span>
          <div className="ml-auto flex flex-wrap gap-2">
            {ACTION[etape] && etape !== 2 && <Button size="sm" disabled={!selection.length || !!enCours} onClick={() => void avancer(selection, "lot")}>{enCours === "lot" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} {ACTION[etape]} ({selection.length})</Button>}
            <Button size="sm" variant="outline" disabled={!filtrees.length} onClick={telecharger}><Download /> Télécharger {selection.length ? `(${selection.length})` : "tout"}</Button>
            <Button size="sm" variant="outline" disabled={!selection.length || !!enCours} onClick={() => void envoyerAuClient()}>{enCours === "envoi" ? <Loader2 className="animate-spin" /> : <Mail />} Envoyer le bilan au client</Button>
          </div>
          {selection.length > 0 && <Textarea rows={2} className="basis-full" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message pour le client (facultatif) — le bilan détaillé est ajouté automatiquement" />}
        </div>
        {alertes.length > 0 && <p className="flex items-start gap-2 border-b border-border bg-amber-500/10 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><span><strong>{alertes.length} chantier(s) réceptionné(s) mais commande à recevoir.</strong> Ils restent ici tant que la commande n’est pas importée.</span></p>}
        {!lignes.length ? <p className="p-6 text-center text-sm text-muted-foreground">Aucun chantier à cette étape.</p> :
          <ul className="divide-y divide-border">{lignes.map((l) => <Ligne key={l.cle} l={l} coche={coches.includes(l.cle)} onCoche={(v) => basculer([l.cle], v)} enCours={enCours === l.cle} onAvancer={() => void avancer([l], l.cle)} onRetirer={() => void retirerReception(l)} />)}</ul>}
      </section>
      <p className="text-xs text-muted-foreground">Montants HT issus des attachements. Un attachement hebdomadaire est réparti par chantier ; créer sa facture ou la déposer traite tout l’attachement en une seule fois. Cette page ne modifie rien sans clic de votre part et n’envoie rien sans confirmation.</p>
    </>}
  </div></ProShell>;
}

function Ligne({ l, coche, onCoche, enCours, onAvancer, onRetirer }: { l: LigneSuivi; coche: boolean; onCoche: (v: boolean) => void; enCours: boolean; onAvancer: () => void; onRetirer: () => void }) {
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
        {l.donneur && <span className="font-semibold">{l.donneur}</span>}
        {l.ville && <span>{l.ville}</span>}
        {l.date && <span>{dateFr(l.date)}</span>}
        {l.attId ? <Link to="/attachements/$id" params={{ id: l.attId }} className="inline-flex items-center gap-1 hover:underline"><FileText className="h-3 w-3" />{l.attNumero}</Link> : <span className="text-amber-600 dark:text-amber-400">Pas d’attachement</span>}
        {l.commande && <span>Commande {l.commande}</span>}
        {l.receptionneLe && <span className="text-primary">Réceptionné le {dateFr(l.receptionneLe)} {l.etape <= 5 && <button type="button" className="underline" onClick={onRetirer}>retirer</button>}</span>}
        {l.factureId && l.etape === 3 && <span className="font-semibold text-primary">Déjà facturé</span>}
        {l.factureId && <Link to="/factures/$id" params={{ id: l.factureId }} className="inline-flex items-center gap-1 hover:underline"><Receipt className="h-3 w-3" />{l.factureNumero}</Link>}
        {l.deposeLe && <span>Déposée le {dateFr(l.deposeLe)}</span>}
        {l.payeLe && <span className="text-primary">Payée le {dateFr(l.payeLe)}</span>}
      </div>
      {pasTermine && <span className="mt-0.5 block text-xs font-semibold text-amber-600 dark:text-amber-400">Encore « {STATUT_PLANNING[l.statutPlanning!] ?? l.statutPlanning} » au Planning</span>}
      {l.recuSansCommande && <span className="mt-0.5 block text-xs font-semibold text-amber-600 dark:text-amber-400">Réceptionné mais commande à recevoir</span>}
    </div>
    <strong className="text-xl font-extrabold text-dashboard-green">{euro(l.montantHt)} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
    {l.etape === 2 ? <Button asChild size="sm" variant="outline"><Link to="/attachements/commandes"><Upload /> Importer la commande</Link></Button>
      : l.etape === 1 && !l.attId ? <Button asChild size="sm" variant="outline"><Link to="/attachements"><FileText /> Faire l’attachement</Link></Button>
      : l.etape === 6 && l.payeLe ? <span className="text-sm font-bold text-primary">Payée</span>
      : action && <Button size="sm" variant={l.etape === 3 ? "default" : "outline"} className="min-h-10 font-bold" disabled={enCours} onClick={onAvancer}>{enCours ? <Loader2 className="animate-spin" /> : l.etape === 1 ? <Send /> : <CheckCircle2 />} {action}</Button>}
  </li>;
}
