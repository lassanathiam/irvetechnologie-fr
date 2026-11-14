import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Mail, Search } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { euro } from "@/lib/company";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { CATEGORIES_BILAN, categorieBilan, csvBilan, estReceptionne, resumeBilan, type CleBilan, type LigneBilan } from "@/lib/bilan-reception";
import { envoyerBilanReception, getBilanReception } from "@/lib/bilan-reception.functions";
import { receptionnerChantiers } from "@/lib/planning.functions";

export const Route = createFileRoute("/_authenticated/attachements/bilan")({
  head: () => ({
    meta: [
      { title: "Bilan réceptions et commandes — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Chantiers réceptionnés, commandes reçues ou manquantes et attachements en attente, par donneur d'ordre." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Bilan réceptions et commandes — Borne de l'Ouest" },
      { property: "og:description", content: "Suivi des réceptions et commandes par donneur d'ordre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BilanPage,
});

const dateFr = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
const COULEUR: Record<CleBilan, string> = {
  recu_commande: "border-primary/50 text-primary",
  commande_non_recu: "border-amber-500/60 text-amber-600 dark:text-amber-400",
  recu_sans_commande: "border-amber-500/60 text-amber-600 dark:text-amber-400",
  envoye_sans_commande: "border-destructive/50 text-destructive",
  non_envoye: "border-border text-muted-foreground",
};

function BilanPage() {
  const qc = useQueryClient();
  const lire = useServerFn(getBilanReception);
  const q = useQuery({ queryKey: ["bilan-reception"], queryFn: () => lire() });
  const envoyer = useEnvoiConfirme(envoyerBilanReception, "Envoyer ce bilan au donneur d’ordre par email ?");
  const receptionner = useServerFn(receptionnerChantiers);
  const lignes = q.data?.lignes ?? [];
  const donneurs = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lignes) m.set(l.donneur, (m.get(l.donneur) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([nom]) => nom);
  }, [lignes]);
  const [donneurChoisi, setDonneur] = useState<string | null>(null);
  const donneur = donneurChoisi ?? donneurs[0] ?? "";
  const [du, setDu] = useState(""); const [au, setAu] = useState("");
  const [coches, setCoches] = useState<string[]>([]);
  const [ouverts, setOuverts] = useState<Partial<Record<CleBilan, boolean>>>({});
  const [message, setMessage] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  const visibles = useMemo(() => lignes.filter((l) => {
    if (l.donneur !== donneur) return false;
    const jour = (l.chantiers[0]?.date ?? l.envoyeLe ?? "").slice(0, 10);
    if (du && (!jour || jour < du)) return false;
    if (au && (!jour || jour > au)) return false;
    const t = recherche.trim().toLowerCase();
    if (t && ![l.numero, l.objet, l.commande, l.facture, ...l.chantiers.flatMap((c) => [c.nom, c.ville])].filter(Boolean).join(" ").toLowerCase().includes(t)) return false;
    return true;
  }), [lignes, donneur, du, au, recherche]);
  const toutOuvert = CATEGORIES_BILAN.every((c) => ouverts[c.cle]);
  const basculerTout = () => setOuverts(Object.fromEntries(CATEGORIES_BILAN.map((c) => [c.cle, !toutOuvert])));
  const resume = resumeBilan(visibles);
  const selection = visibles.filter((l) => coches.includes(l.id));
  const totalSel = selection.reduce((t, l) => t + l.totalHt, 0);
  const aReceptionner = [...new Set(selection.flatMap((l) => l.chantiers.filter((c) => !c.receptionneLe).map((c) => c.id)))];
  const basculer = (ids: string[], oui: boolean) => setCoches((c) => (oui ? [...new Set([...c, ...ids])] : c.filter((x) => !ids.includes(x))));

  const telecharger = () => {
    const blob = new Blob([csvBilan(selection.length ? selection : visibles)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bilan-${donneur.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const envoyerSelection = async () => {
    setEnCours("envoi");
    try {
      const r = await envoyer({ data: { ids: selection.map((l) => l.id), envoiId: crypto.randomUUID(), message } });
      if (r.sent) toast.success(`Bilan envoyé à ${donneur} (${selection.length} attachement(s)).`);
      else toast.error("L’email n’est pas parti.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally { setEnCours(null); }
  };
  const receptionnerUn = async (id: string, nom: string, oui: boolean) => {
    if (!oui && !window.confirm(`Retirer la réception du chantier ${nom} ?`)) return;
    setEnCours(id);
    try {
      await receptionner({ data: { ids: [id], receptionne: oui } });
      toast.success(oui ? `${nom} : réceptionné` : `${nom} : réception retirée`);
      await qc.invalidateQueries({ queryKey: ["bilan-reception"] });
      void qc.invalidateQueries({ queryKey: ["attachements"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réception impossible.");
    } finally { setEnCours(null); }
  };
  const receptionnerSelection = async () => {
    setEnCours("reception");
    try {
      const r = await receptionner({ data: { ids: aReceptionner, receptionne: true } });
      toast.success(`${r.nb} chantier(s) réceptionné(s)`);
      await qc.invalidateQueries({ queryKey: ["bilan-reception"] });
      void qc.invalidateQueries({ queryKey: ["attachements"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réception impossible.");
    } finally { setEnCours(null); }
  };

  return <ProShell><div className="space-y-5">
    <header className="flex flex-wrap items-center gap-3">
      <Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Attachements</Link>
      <h1 className="text-xl font-bold">Bilan réceptions et commandes</h1>
    </header>
    {q.isLoading ? <Loader2 className="animate-spin text-primary" /> : q.error ? <p className="text-destructive">Bilan indisponible, rechargez la page.</p> : <>
    <section className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
      <strong className="block">Où trouver quoi ?</strong>
      <ol className="mt-1 grid gap-1 text-xs sm:grid-cols-3">
        <li><strong>1. Noms et montants</strong> : cliquez sur une catégorie ci-dessous (ou « Tout déplier ») — chaque chantier apparaît avec nom, ville, date et montant HT.</li>
        <li><strong>2. Un chantier</strong> : bouton vert « Réceptionner » à droite de son nom.</li>
        <li><strong>3. Plusieurs</strong> : cochez les attachements puis « Réceptionner », « Télécharger » ou « Envoyer au client ».</li>
      </ol>
    </section>
    <section className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
      <label className="text-xs text-muted-foreground">Donneur d’ordre
        <select className="mt-1.5 block min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm" value={donneur} onChange={(e) => { setDonneur(e.target.value); setCoches([]); }}>
          {donneurs.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">Chantiers du<Input className="mt-1.5" type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
      <label className="text-xs text-muted-foreground">au<Input className="mt-1.5" type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
      {(du || au) && <Button variant="ghost" size="sm" onClick={() => { setDu(""); setAu(""); }}>Toute la période</Button>}
      <label className="min-w-[220px] flex-1 text-xs text-muted-foreground">Chercher un nom, une ville, une facture, une commande
        <span className="relative mt-1.5 block"><Search className="absolute left-2.5 top-2.5 h-4 w-4" /><Input className="pl-8" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Ex. MALEZIEUX, F-2026-0047, CST…" /></span>
      </label>
      <Button variant="outline" size="sm" onClick={basculerTout}>{toutOuvert ? "Tout replier" : "Tout déplier"}</Button>
    </section>

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {[
        ["Chantiers", resume.chantiers], ["Réceptionnés", resume.receptionnes], ["Non réceptionnés", resume.nonReceptionnes],
        ["Commandes reçues", resume.commandesRecues], ["Commandes manquantes", resume.commandesManquantes], ["Facturés", resume.factures],
      ].map(([label, n]) => <div key={String(label)} className="rounded-md border border-border bg-card p-3"><div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div><div className="text-2xl font-bold">{n}</div></div>)}
    </section>

    <section className="sticky top-2 z-10 space-y-2 rounded-md border-2 border-primary/40 bg-card p-3 text-sm shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-5 w-5" checked={visibles.length > 0 && visibles.every((l) => coches.includes(l.id))} onChange={(e) => basculer(visibles.map((l) => l.id), e.target.checked)} /> Tout cocher ({visibles.length})</label>
        <span>{selection.length} coché(s) · <strong className="font-mono">{euro(totalSel)} HT</strong></span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!aReceptionner.length || !!enCours} onClick={() => void receptionnerSelection()}>{enCours === "reception" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Réceptionner ({aReceptionner.length})</Button>
          <Button size="sm" variant="outline" disabled={!visibles.length} onClick={telecharger}><Download /> Télécharger {selection.length ? `(${selection.length})` : "tout"}</Button>
          <Button size="sm" disabled={!selection.length || !!enCours} onClick={() => void envoyerSelection()}>{enCours === "envoi" ? <Loader2 className="animate-spin" /> : <Mail />} Envoyer au client ({selection.length})</Button>
        </div>
      </div>
      <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message pour le client (facultatif) — le bilan détaillé est ajouté automatiquement" />
    </section>

    {CATEGORIES_BILAN.map((cat) => {
      const rs = visibles.filter((l) => categorieBilan(l) === cat.cle);
      const ouvert = (ouverts[cat.cle] ?? false) || (recherche.trim() !== "" && rs.length > 0);
      return <section key={cat.cle} className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 p-3">
          <input type="checkbox" aria-label={`Cocher ${cat.label}`} className="h-5 w-5" disabled={!rs.length} checked={rs.length > 0 && rs.every((l) => coches.includes(l.id))} onChange={(e) => basculer(rs.map((l) => l.id), e.target.checked)} />
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={ouvert} onClick={() => setOuverts((o) => ({ ...o, [cat.cle]: !ouvert }))}>
            {ouvert ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${COULEUR[cat.cle]}`}>{rs.length}</span>
            <span className="min-w-0"><strong className="block">{cat.label}</strong><span className="block text-xs text-muted-foreground">{cat.aide}</span></span>
          </button>
          <strong className="font-mono text-sm">{euro(resume.parCategorie[cat.cle].ht)} HT</strong>
        </div>
        {ouvert && rs.length > 0 && <ul className="divide-y divide-border border-t border-border">{rs.map((l) => <LigneBilanVue key={l.id} l={l} coche={coches.includes(l.id)} onCoche={(v) => basculer([l.id], v)} enCours={enCours} onReception={(id, nom, oui) => void receptionnerUn(id, nom, oui)} />)}</ul>}
        {ouvert && !rs.length && <p className="border-t border-border p-3 text-sm text-muted-foreground">Aucun attachement dans cette catégorie.</p>}
      </section>;
    })}

    {(q.data?.devisEnAttente ?? []).length > 0 && <DevisEnAttente devis={q.data!.devisEnAttente} />}
    <p className="text-xs text-muted-foreground">Une ligne = un attachement. « Réceptionné » = tous ses chantiers ont été validés avec le client. La commande est celle importée dans « Bons de commande » ou saisie sur l’attachement. Ce bilan ne change jamais les attachements, les factures ni les paiements.</p>
    </>}
  </div></ProShell>;
}

const STATUT_PLANNING: Record<string, string> = { planifie: "planifié", en_pause: "en pause", en_cours: "en cours", annule: "annulé", a_planifier: "à planifier" };

function LigneBilanVue({ l, coche, onCoche, enCours, onReception }: { l: LigneBilan; coche: boolean; onCoche: (v: boolean) => void; enCours: string | null; onReception: (id: string, nom: string, oui: boolean) => void }) {
  return <li className="flex flex-wrap items-start gap-3 p-3 text-sm">
    <input type="checkbox" aria-label={`Cocher ${l.numero}`} className="mt-0.5 h-5 w-5" checked={coche} onChange={(e) => onCoche(e.target.checked)} />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/attachements/$id" params={{ id: l.id }} className="font-semibold hover:underline">{l.numero}</Link>
        <span className="text-xs text-muted-foreground">{l.chantiers.length > 1 ? `${l.chantiers.length} chantiers` : l.chantiers.length ? "1 chantier" : l.objet || "aucun chantier du Planning relié"}</span>
        <strong className="ml-auto font-mono">{euro(l.totalHt)} HT</strong>
      </div>
      <span className="mt-1 flex flex-wrap gap-1 text-xs">
        <span className="rounded-full border border-border px-2 py-0.5">{l.envoyeLe ? `Envoyé le ${dateFr(l.envoyeLe)}` : "Pas envoyé"}</span>
        <span className={`rounded-full border px-2 py-0.5 ${l.commande ? "border-primary/50 text-primary" : "border-amber-500/60 text-amber-600 dark:text-amber-400"}`}>{l.commande ? `Commande ${l.commande}` : "Commande manquante"}</span>
        {l.facture ? <span className="rounded-full border border-primary/50 px-2 py-0.5 text-primary">Facture {l.facture}</span> : <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">Pas encore facturé</span>}
      </span>
      {l.chantiers.length > 0 && <ul className="mt-2 divide-y divide-border rounded-md border border-border">
        {l.chantiers.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="min-w-0 flex-1">
            <strong className="block">{c.nom}</strong>
            <span className="block text-xs text-muted-foreground">{[c.ville, dateFr(c.date)].filter(Boolean).join(" · ")}</span>
            {c.statut && c.statut !== "termine" && c.statut !== "realise" && <span className="block text-xs font-semibold text-amber-600 dark:text-amber-400">Encore « {STATUT_PLANNING[c.statut] ?? c.statut} » au Planning</span>}
          </span>
          <span className="font-mono text-sm">{c.montantHt != null ? `${euro(c.montantHt)} HT` : "—"}</span>
          {c.receptionneLe
            ? <span className="flex items-center gap-2 text-xs text-primary">Réceptionné le {dateFr(c.receptionneLe)}<button type="button" className="text-muted-foreground underline" disabled={enCours === c.id} onClick={() => onReception(c.id, c.nom, false)}>retirer</button></span>
            : <Button size="sm" variant="outline" className="border-2 border-primary font-bold text-primary" disabled={enCours === c.id} onClick={() => onReception(c.id, c.nom, true)}>{enCours === c.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Réceptionner</Button>}
        </li>)}
      </ul>}
    </div>
  </li>;
}

function DevisEnAttente({ devis }: { devis: { id: string; numero: string; client: string; totalHt: number; envoyeLe: string }[] }) {
  const [ouvert, setOuvert] = useState(false);
  return <section className="overflow-hidden rounded-md border border-border bg-card">
    <button type="button" className="flex w-full items-center gap-2 p-3 text-left" aria-expanded={ouvert} onClick={() => setOuvert((o) => !o)}>
      {ouvert ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      <strong>Devis particuliers envoyés, pas encore signés ({devis.length})</strong>
      <span className="ml-auto font-mono text-sm">{euro(devis.reduce((t, d) => t + d.totalHt, 0))} HT</span>
    </button>
    {ouvert && <ul className="divide-y divide-border border-t border-border">{devis.map((d) => <li key={d.id}><Link to="/devis/$id" params={{ id: d.id }} className="flex flex-wrap gap-3 p-3 text-sm hover:bg-muted/40"><strong>{d.numero}</strong><span>{d.client}</span><span className="text-muted-foreground">{dateFr(d.envoyeLe)}</span><span className="ml-auto font-mono">{euro(d.totalHt)} HT</span></Link></li>)}</ul>}
  </section>;
}
