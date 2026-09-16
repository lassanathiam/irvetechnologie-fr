import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Euro, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAttachement, listAttachements } from "@/lib/attachements.functions";
import { listBordereau, listDonneurs } from "@/lib/bordereau.functions";
import { euro } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/attachements/")({
  head: () => ({ meta: [{ title: "Attachements travaux — IRVE Technologie" }, { name: "description", content: "Créer, envoyer et facturer les attachements de travaux fibre." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Attachements travaux — IRVE Technologie" }, { property: "og:description", content: "Gestion des attachements de travaux fibre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AttachementsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00`); if (Number.isNaN(d.getTime())) return date; d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const plusJours = (n: number) => addDays(today(), n);
const diffDays = (from: string, to: string) => { const n = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 864e5); return Number.isFinite(n) && n > 0 ? n : 60; };
type Line = { key: string; libelle: string; description: string; quantite: string; prix: string };
const newLine = (init?: Partial<Line>): Line => ({ key: crypto.randomUUID(), libelle: "", description: "", quantite: "1", prix: "", ...init });

function AttachementsPage() {
  const navigate = useNavigate(); const qc = useQueryClient();
  const listFn = useServerFn(listAttachements); const createFn = useServerFn(createAttachement);
  const donneursFn = useServerFn(listDonneurs); const bordereauFn = useServerFn(listBordereau);
  const list = useQuery({ queryKey: ["attachements"], queryFn: () => listFn() });
  const donneurs = useQuery({ queryKey: ["donneurs-ordre"], queryFn: () => donneursFn() });
  const bordereau = useQuery({ queryKey: ["bordereau"], queryFn: () => bordereauFn() });
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState("");
  const [form, setForm] = useState({ client_nom: "", client_email: "", client_telephone: "", client_adresse: "", client_cp_ville: "", numero_ticket: "", numero_affaire: "", bon_commande: "", objet: "Travaux fibre optique", date_emission: today(), date_echeance: plusJours(60), autoliquidation: true, validation_requise: true, notes: "" });
  const [delai, setDelai] = useState(60);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const total = lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const setDateEmission = (value: string) => setForm((f) => ({ ...f, date_emission: value, date_echeance: addDays(value, delai) }));
  const setDelaiJours = (value: number) => { setDelai(value); setForm((f) => ({ ...f, date_echeance: addDays(f.date_emission, value) })); };

  const appliquerDonneur = (id: string) => {
    const d = (donneurs.data ?? []).find((x: any) => x.id === id);
    if (!d) return;
    const jours = Number(d.delai_paiement_jours) || 60;
    setDelai(jours);
    setForm((f) => ({
      ...f,
      client_nom: d.raison_sociale || d.nom,
      client_email: d.charge_affaires_email || "",
      client_telephone: d.charge_affaires_telephone || "",
      client_adresse: d.adresse || "",
      client_cp_ville: d.cp_ville || "",
      autoliquidation: Boolean(d.autoliquidation),
      date_echeance: addDays(f.date_emission, jours),
    }));
  };

  const catalogueOptions = useMemo(() => (bordereau.data ?? []).filter((l: any) => l.actif), [bordereau.data]);
  const ajouterDepuisCatalogue = (id: string) => {
    const ligne = catalogueOptions.find((l: any) => l.id === id);
    if (!ligne) return;
    setLines((current) => {
      const next = [...current.filter((l) => l.libelle.trim() || Number(l.prix) > 0), newLine({ libelle: ligne.libelle, description: `${ligne.section ?? ligne.categorie} — unité ${ligne.unite}`, prix: String(Number(ligne.prix_unitaire)) })];
      return next.length ? next : [newLine()];
    });
    setCatalogue("");
  };

  const create = useMutation({ mutationFn: () => createFn({ data: { ...form, client_email: form.client_email || null, client_telephone: form.client_telephone || null, client_adresse: form.client_adresse || null, client_cp_ville: form.client_cp_ville || null, numero_affaire: form.numero_affaire || null, bon_commande: form.bon_commande || null, notes: form.notes || null, rendezvous_id: null, items: lines.map((l) => ({ libelle: l.libelle, description: l.description || null, quantite: Number(l.quantite), prix_unitaire: Number(l.prix) })) } }), onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["attachements"] }); navigate({ to: "/attachements/$id", params: { id: r.id } }); }, onError: (e) => setError(e instanceof Error ? e.message : "Création impossible.") });
  const rows = useMemo(() => (list.data ?? []).filter((a) => [a.numero, a.client_nom, a.numero_ticket, a.numero_affaire, a.bon_commande].some((v) => v?.toLowerCase().includes(search.toLowerCase()))), [list.data, search]);

  return <ProShell><div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-primary">Fibre optique</p><h1 className="mt-2 text-3xl font-semibold">Attachements travaux</h1><p className="mt-1 text-sm text-muted-foreground">Valorisez les travaux au bordereau, envoyez-les au chargé d’affaires et transformez-les en facture.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/attachements/bordereau"><Euro /> Bordereau &amp; donneurs d’ordre</Link></Button><Button onClick={() => setOpen((v) => !v)}><Plus /> Nouvel attachement</Button></div></header>
  {open && <section className="rounded-md border border-border bg-card p-5 space-y-5">
    <label className="block text-xs text-muted-foreground">Donneur d’ordre enregistré
      <select className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="" onChange={(e) => appliquerDonneur(e.target.value)}>
        <option value="">Choisir pour préremplir (Axians, Infratel…)</option>
        {(donneurs.data ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.nom}{d.charge_affaires_nom ? ` — ${d.charge_affaires_nom}` : ""}</option>)}
      </select>
    </label>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Destinataire *" value={form.client_nom} onChange={(v) => setForm({ ...form, client_nom: v })} /><Field label="E-mail du chargé d’affaires" type="email" value={form.client_email} onChange={(v) => setForm({ ...form, client_email: v })} /><Field label="Téléphone" value={form.client_telephone} onChange={(v) => setForm({ ...form, client_telephone: v })} /><Field label="Adresse" value={form.client_adresse} onChange={(v) => setForm({ ...form, client_adresse: v })} /><Field label="Code postal / ville" value={form.client_cp_ville} onChange={(v) => setForm({ ...form, client_cp_ville: v })} /><Field label="Numéro de ticket *" value={form.numero_ticket} onChange={(v) => setForm({ ...form, numero_ticket: v })} /><Field label="Numéro d’affaire" value={form.numero_affaire} onChange={(v) => setForm({ ...form, numero_affaire: v })} /><Field label="Bon de commande" value={form.bon_commande} onChange={(v) => setForm({ ...form, bon_commande: v })} /><Field label="Objet" value={form.objet} onChange={(v) => setForm({ ...form, objet: v })} /><Field label="Date de l’attachement" type="date" value={form.date_emission} onChange={setDateEmission} /><label className="text-xs text-muted-foreground">Délai de paiement (jours)<Input className="mt-1.5" type="number" min="0" max="365" value={String(delai)} onChange={(e) => setDelaiJours(Number(e.target.value) || 0)} /></label><Field label="Échéance (calculée)" type="date" value={form.date_echeance} onChange={(v) => { setForm({ ...form, date_echeance: v }); setDelai(diffDays(form.date_emission, v)); }} /></div>
    <div className="flex flex-wrap gap-5"><Check label="Autoliquidation de TVA" checked={form.autoliquidation} onChange={(v) => setForm({ ...form, autoliquidation: v })} /><Check label="Demander une validation en ligne" checked={form.validation_requise} onChange={(v) => setForm({ ...form, validation_requise: v })} /></div>
    <label className="block text-xs text-muted-foreground">Ajouter une prestation du bordereau {bordereau.isLoading ? "(chargement…)" : `(${catalogueOptions.length} prix)`}
      <select className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={catalogue} onChange={(e) => ajouterDepuisCatalogue(e.target.value)}>
        <option value="">Rechercher dans le bordereau Axians…</option>
        {catalogueOptions.map((l: any) => <option key={l.id} value={l.id}>{`${l.libelle} — ${euro(Number(l.prix_unitaire))} / ${l.unite}`}</option>)}
      </select>
    </label>
    <div className="space-y-3">{lines.map((line) => <div key={line.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1.4fr_1.5fr_.5fr_.7fr_auto]"><Input aria-label="Travaux" placeholder="Travaux réalisés" value={line.libelle} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, libelle: e.target.value } : l))} /><Input aria-label="Description" placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, description: e.target.value } : l))} /><Input aria-label="Quantité" type="number" min="0.01" step="0.01" placeholder="Qté" value={line.quantite} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, quantite: e.target.value } : l))} /><Input aria-label="Prix HT" type="number" min="0" step="0.01" placeholder="Prix HT" value={line.prix} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, prix: e.target.value } : l))} /><Button variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [newLine()])}><Trash2 /></Button></div>)}<Button variant="outline" onClick={() => setLines([...lines, newLine()])}><Plus /> Ajouter une ligne</Button></div>
    <Textarea placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="flex items-center justify-between"><strong>Total HT : {euro(total)}</strong><Button disabled={create.isPending || !form.numero_ticket.trim() || !form.client_nom.trim() || lines.some((l) => !l.libelle.trim() || Number(l.quantite) <= 0)} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="animate-spin" />} Créer l’attachement</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}</section>}
  <div className="relative max-w-xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher client, ticket, affaire ou commande" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
  <section className="overflow-hidden rounded-md border border-border bg-card divide-y divide-border">{list.isLoading ? <div className="p-6"><Loader2 className="animate-spin" /></div> : rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Aucun attachement de travaux.</p> : rows.map((a) => <Link key={a.id} to="/attachements/$id" params={{ id: a.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40"><ClipboardList className="h-4 w-4 text-primary" /><strong>{a.numero}</strong><span>{a.client_nom}</span><span className="text-sm text-muted-foreground">Ticket {a.numero_ticket}</span><span className="ml-auto font-mono">{euro(Number(a.total_ht))} HT</span><span className="rounded-full border border-border px-2 py-1 text-xs">{a.statut}</span></Link>)}</section></div></ProShell>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-xs text-muted-foreground">{label}<Input className="mt-1.5" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>; }
