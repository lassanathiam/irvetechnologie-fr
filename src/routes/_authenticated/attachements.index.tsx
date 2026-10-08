import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Euro, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { LignesAttachement, nouvelleLigne, type LigneAtt } from "@/components/LignesAttachement";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createAttachement, listAttachements } from "@/lib/attachements.functions";
import { listBordereau, listChantiersAAttacher, listDonneurs } from "@/lib/bordereau.functions";
import { euro } from "@/lib/company";
import { precisionReseauClient } from "@/lib/reseau-client";
import { ReseauClientBadge } from "@/components/ReseauClientBadge";

export const Route = createFileRoute("/_authenticated/attachements/")({
  head: () => ({ meta: [{ title: "Attachements travaux — IRVE Technologie" }, { name: "description", content: "Créer, envoyer et facturer les attachements de travaux fibre." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Attachements travaux — IRVE Technologie" }, { property: "og:description", content: "Gestion des attachements de travaux fibre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  validateSearch: (s: Record<string, unknown>): { rdv?: string } => ({ rdv: typeof s.rdv === "string" ? s.rdv : undefined }),
  component: AttachementsPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const cleBordereau = (nom: string) => (/ensio/i.test(nom) ? "ensio" : "axians");
/** Lundi et dimanche de la semaine d'une date. */
const semaine = (date: string) => { const d = new Date(`${date}T12:00:00`); const j = (d.getDay() + 6) % 7; d.setDate(d.getDate() - j); const lundi = d.toISOString().slice(0, 10); d.setDate(d.getDate() + 6); return { lundi, dimanche: d.toISOString().slice(0, 10) }; };
const numSemaine = (date: string) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); };
/** « 45 jours fin de mois » : date + délai, puis dernier jour du mois. */
const finDeMois = (date: string) => { const d = new Date(`${date}T12:00:00`); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12).toISOString().slice(0, 10); };
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00`); if (Number.isNaN(d.getTime())) return date; d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const plusJours = (n: number) => addDays(today(), n);
const diffDays = (from: string, to: string) => { const n = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 864e5); return Number.isFinite(n) && n > 0 ? n : 60; };
type Line = LigneAtt;
const newLine = nouvelleLigne;
const estFini = (r: any) => Boolean(r.termine_at || r.chantier_valide || ["termine", "realise"].includes(r.statut));
/** Précision affichée sur la feuille et dans la liste. */
const etatChantier = (r: any) => (estFini(r) ? "Travaux terminés, retour travaux envoyé" : "Travaux planifiés, pas encore réalisés");

function AttachementsPage() {
  const navigate = useNavigate(); const qc = useQueryClient();
  const listFn = useServerFn(listAttachements); const createFn = useServerFn(createAttachement);
  const donneursFn = useServerFn(listDonneurs); const bordereauFn = useServerFn(listBordereau); const chantiersFn = useServerFn(listChantiersAAttacher);
  const [cle, setCle] = useState<"axians" | "ensio">("axians"); const [finMois, setFinMois] = useState(false); const [semaineDu, setSemaineDu] = useState(today()); const [importEnCours, setImportEnCours] = useState(false);
  const list = useQuery({ queryKey: ["attachements"], queryFn: () => listFn() });
  const donneurs = useQuery({ queryKey: ["donneurs-ordre"], queryFn: () => donneursFn() });
  const bordereau = useQuery({ queryKey: ["bordereau"], queryFn: () => bordereauFn() });
  const [search, setSearch] = useState(""); const [open, setOpen] = useState(false); const [error, setError] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState("");
  const [donneurId, setDonneurId] = useState("");
  const [form, setForm] = useState({ client_nom: "", client_email: "", client_telephone: "", client_adresse: "", client_cp_ville: "", numero_ticket: "", numero_affaire: "", bon_commande: "", objet: "Travaux fibre optique", date_emission: today(), date_echeance: plusJours(60), autoliquidation: true, validation_requise: true, proposition_autorisee: true, notes: "" });
  const [delai, setDelai] = useState(60);
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const total = lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const echeance = (date: string, jours: number, fm = finMois) => (fm ? finDeMois(addDays(date, jours)) : addDays(date, jours));
  const setDateEmission = (value: string) => setForm((f) => ({ ...f, date_emission: value, date_echeance: echeance(value, delai) }));
  const setDelaiJours = (value: number) => { setDelai(value); setForm((f) => ({ ...f, date_echeance: echeance(f.date_emission, value) })); };

  const appliquerDonneur = (id: string) => {
    const d = (donneurs.data ?? []).find((x: any) => x.id === id);
    if (!d) return;
    setDonneurId(id);
    const jours = Number(d.delai_paiement_jours) || 60;
    const k = cleBordereau(d.nom); const fm = /fin de mois/i.test(d.notes ?? "");
    setCle(k); setFinMois(fm);
    setDelai(jours);
    if (k === "ensio") choisirSemaine(semaineDu);
    setForm((f) => ({
      ...f,
      client_nom: d.raison_sociale || d.nom,
      client_email: d.charge_affaires_email || "",
      client_telephone: d.charge_affaires_telephone || "",
      client_adresse: d.adresse || "",
      client_cp_ville: d.cp_ville || "",
      autoliquidation: Boolean(d.autoliquidation),
      date_echeance: echeance(f.date_emission, jours, fm),
      ...(k === "ensio" ? { validation_requise: true } : {}),
    }));
  };

  const { rdv: rdvSel } = Route.useSearch();
  const aAttacher = useQuery({ queryKey: ["ensio-a-attacher"], queryFn: () => chantiersFn({ data: { motcle: "ensio" } }) });
  const termines = (aAttacher.data ?? []) as any[];
  const [coches, setCoches] = useState<string[]>([]);
  const formRef = useRef<HTMLElement | null>(null); const dejaFait = useRef<string | null>(null);
  /** Un clic : ENSIO prérempli, semaine choisie, une ligne par chantier avec l’adresse. */
  async function preparer(ids: string[]) {
    const d = (donneurs.data as any[] | undefined)?.find((x) => /ensio/i.test(x.nom));
    if (d) appliquerDonneur(d.id); else { setCle("ensio"); }
    setOpen(true); setLines([]);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    await importerSemaine(ids, "ensio");
  }
  useEffect(() => {
    if (!rdvSel || dejaFait.current === rdvSel || !donneurs.data || !bordereau.data) return;
    dejaFait.current = rdvSel; void preparer(rdvSel.split(",").filter(Boolean));
  }, [rdvSel, donneurs.data, bordereau.data]);
  /** Chantiers terminés regroupés par semaine (vendredi). */
  const parSemaine = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of termines) { const { lundi } = semaine(String(estFini(r) ? (r.termine_at ?? r.date_debut) : r.date_debut).slice(0, 10)); m.set(lundi, [...(m.get(lundi) ?? []), r]); }
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  }, [termines]);
  const catalogueOptions = useMemo(() => (bordereau.data ?? []).filter((l: any) => l.actif && (l.donneur_ordre ?? "axians") === cle), [bordereau.data, cle]);
  function choisirSemaine(date: string) {
    setSemaineDu(date);
    const { lundi, dimanche } = semaine(date);
    const n = numSemaine(date);
    const fr = (x: string) => new Date(`${x}T12:00:00`).toLocaleDateString("fr-FR");
    setForm((f) => ({ ...f, numero_ticket: `S${String(n).padStart(2, "0")}-${lundi.slice(0, 4)}`, objet: `Attachement semaine ${n} — du ${fr(lundi)} au ${fr(dimanche)}` }));
  }
  async function importerSemaine(ids?: string[], cleForce?: "ensio" | "axians") {
    const { dimanche } = semaine(semaineDu);
    setImportEnCours(true); setError(null);
    try {
      const rows = await chantiersFn({ data: ids?.length ? { ids } : { au: dimanche, motcle: cleForce ?? cle } });
      if (!rows.length) { setError("Aucun chantier ENSIO à attacher (tous déjà attachés)."); return; }
      const k = cleForce ?? cle;
      const base = (bordereau.data ?? []).filter((l: any) => l.actif && (l.donneur_ordre ?? "axians") === k);
      const forfait = (p?: string | null) => base.find((l: any) => l.reference === (/(11|22)/.test(p ?? "") ? "1.2" : "1.1"));
      const cable = (p?: string | null) => base.find((l: any) => l.reference === (/(11|22)/.test(p ?? "") ? "2.10" : "2.6"));
      const nouvelles: Line[] = [];
      for (const r of rows) {
        const f = forfait(r.puissance_borne);
        const lieu = [r.client_nom, precisionReseauClient(r.reseau_client), r.adresse, r.cp_ville].filter(Boolean).join(" — ");
        const jour = new Date(r.date_debut).toLocaleDateString("fr-FR");
        nouvelles.push(newLine({ libelle: f ? f.libelle.split(" — ")[0] : "Installation borne", rendezvous_id: r.id, description: `${jour} · ${lieu} — ${etatChantier(r)}`, prix: String(f ? Number(f.prix_unitaire) : Number(r.montant_ht) || 0) }));
        const sup = Math.max(0, Number(r.metrage_reel_m ?? 0) - 15);
        const c = cable(r.puissance_borne);
        if (sup > 0 && c) nouvelles.push(newLine({ libelle: c.libelle, description: `${lieu} — au-delà des 15 m inclus`, quantite: String(sup), prix: String(Number(c.prix_unitaire)) }));
      }
      setLines((cur) => [...cur.filter((l) => l.libelle.trim() || Number(l.prix) > 0), ...nouvelles]);
    } catch (e) { setError(e instanceof Error ? e.message : "Import impossible."); } finally { setImportEnCours(false); }
  }
  const ajouterDepuisCatalogue = (id: string) => {
    const ligne = catalogueOptions.find((l: any) => l.id === id);
    if (!ligne) return;
    setLines((current) => {
      const next = [...current.filter((l) => l.libelle.trim() || Number(l.prix) > 0), newLine({ libelle: ligne.libelle, description: `${ligne.section ?? ligne.categorie} — unité ${ligne.unite}`, prix: String(Number(ligne.prix_unitaire)) })];
      return next.length ? next : [newLine()];
    });
    setCatalogue("");
  };

  const create = useMutation({ mutationFn: () => createFn({ data: { ...form, client_email: form.client_email || null, client_telephone: form.client_telephone || null, client_adresse: form.client_adresse || null, client_cp_ville: form.client_cp_ville || null, numero_affaire: form.numero_affaire || null, bon_commande: form.bon_commande || null, notes: form.notes || null, rendezvous_id: null, items: lines.map((l) => ({ rendezvous_id: l.rendezvous_id ?? null, libelle: l.libelle, description: l.description || null, quantite: Number(l.quantite), prix_unitaire: Number(l.prix) })) } }), onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ["attachements"] }); void qc.invalidateQueries({ queryKey: ["ensio-a-attacher"] }); navigate({ to: "/attachements/$id", params: { id: r.id } }); }, onError: (e) => setError(e instanceof Error ? e.message : "Création impossible.") });
  const rows = useMemo(() => (list.data ?? []).filter((a) => [a.numero, a.client_nom, a.numero_ticket, a.numero_affaire, a.bon_commande].some((v) => v?.toLowerCase().includes(search.toLowerCase()))), [list.data, search]);

  const totaux = useMemo(() => {
    const parStatut = new Map<string, { nb: number; ht: number; tva: number; ttc: number }>();
    for (const a of list.data ?? []) {
      const s = a.statut || "brouillon";
      const cur = parStatut.get(s) ?? { nb: 0, ht: 0, tva: 0, ttc: 0 };
      cur.nb += 1; cur.ht += Number(a.total_ht) || 0; cur.tva += Number(a.total_tva) || 0; cur.ttc += Number(a.total_ttc) || 0;
      parStatut.set(s, cur);
    }
    const ordre = ["brouillon", "envoye", "propose", "accepte", "refuse", "facture", "annule"];
    const lignes = [...parStatut.entries()].sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0]));
    const global = lignes.reduce((acc, [, v]) => ({ nb: acc.nb + v.nb, ht: acc.ht + v.ht, tva: acc.tva + v.tva, ttc: acc.ttc + v.ttc }), { nb: 0, ht: 0, tva: 0, ttc: 0 });
    return { lignes, global };
  }, [list.data]);

  return <ProShell><div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-primary">Fibre optique</p><h1 className="mt-2 text-3xl font-semibold">Attachements travaux</h1><p className="mt-1 text-sm text-muted-foreground">Valorisez les travaux au bordereau, envoyez-les au chargé d’affaires et transformez-les en facture.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/attachements/bordereau"><Euro /> Bordereau &amp; donneurs d’ordre</Link></Button><Button onClick={() => { if (!open) { const ensio = donneurs.data?.find((d) => /ensio/i.test(d.nom)); if (ensio) appliquerDonneur(ensio.id); } setOpen((v) => !v); }}><Plus /> Nouvel attachement</Button></div></header>
  {termines.length > 0 && <section className="rounded-md border-2 border-primary/50 bg-card p-5 space-y-4">
    <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="h-5 w-5 text-primary" /> Attachements ENSIO proposés ({termines.filter(estFini).length} terminé{termines.filter(estFini).length > 1 ? "s" : ""} · {termines.filter((r) => !estFini(r)).length} planifié{termines.filter((r) => !estFini(r)).length > 1 ? "s" : ""})</h2>
      <p className="text-sm text-muted-foreground">Chaque chantier ENSIO, terminé ou planifié, arrive ici, rangé par semaine. Chaque ligne précise « travaux terminés » ou « travaux planifiés ». Un clic prépare la feuille : une ligne par chantier avec l’adresse et le prix du bordereau. Vous ajoutez ensuite vos lignes en plus et les glissez où vous voulez.</p></div>
    {parSemaine.map(([lundi, rs]) => { const ven = addDays(lundi, 4); const ids = rs.map((r: any) => r.id); const sel = ids.filter((i: string) => coches.includes(i)); const aPreparer = sel.length ? sel : ids;
      return <div key={lundi} className="rounded-md border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
          <strong className="text-sm">Semaine {numSemaine(lundi)} — vendredi {new Date(`${ven}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</strong>
          <Button size="sm" onClick={() => { choisirSemaine(lundi); void preparer(aPreparer); }}><ClipboardList /> Préparer l’attachement ({aPreparer.length})</Button>
        </div>
        <ul className="divide-y divide-border">{rs.map((r: any) => <li key={r.id}><label className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={coches.includes(r.id)} onChange={(e) => setCoches((c) => e.target.checked ? [...c, r.id] : c.filter((x) => x !== r.id))} /><span className="font-medium">{r.client_nom}</span><ReseauClientBadge nom={r.reseau_client} /><span className="text-muted-foreground">{[r.adresse, r.cp_ville].filter(Boolean).join(", ")}</span><span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${estFini(r) ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>{estFini(r) ? `Terminé · retour envoyé (${new Date(r.termine_at ?? r.date_debut).toLocaleDateString("fr-FR")})` : `Planifié le ${new Date(r.date_debut).toLocaleDateString("fr-FR")} · pas encore fait`}</span></label></li>)}</ul>
      </div>; })}
    <p className="text-xs text-muted-foreground">Astuce : cochez seulement certains chantiers pour ne préparer qu’eux ; sans coche, toute la semaine est prise.</p>
  </section>}
  {open && <section ref={formRef} className="scroll-mt-4 rounded-md border border-border bg-card p-5 space-y-5">
    <label className="block text-xs text-muted-foreground">Donneur d’ordre enregistré
      <select className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={donneurId} onChange={(e) => appliquerDonneur(e.target.value)}>
        <option value="">Choisir le donneur d’ordre</option>
        {(donneurs.data ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.nom}{d.charge_affaires_nom ? ` — ${d.charge_affaires_nom}` : ""}</option>)}
      </select>
    </label>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Société destinataire *" value={form.client_nom} onChange={(v) => setForm({ ...form, client_nom: v })} /><Field label="E-mail du chargé d’affaires" type="email" value={form.client_email} onChange={(v) => setForm({ ...form, client_email: v })} /><Field label="Téléphone" value={form.client_telephone} onChange={(v) => setForm({ ...form, client_telephone: v })} /><Field label="Adresse" value={form.client_adresse} onChange={(v) => setForm({ ...form, client_adresse: v })} /><Field label="Code postal / ville" value={form.client_cp_ville} onChange={(v) => setForm({ ...form, client_cp_ville: v })} /><Field label="Numéro de ticket *" value={form.numero_ticket} onChange={(v) => setForm({ ...form, numero_ticket: v })} /><Field label="Numéro d’affaire" value={form.numero_affaire} onChange={(v) => setForm({ ...form, numero_affaire: v })} /><Field label="Bon de commande" value={form.bon_commande} onChange={(v) => setForm({ ...form, bon_commande: v })} /><Field label="Objet" value={form.objet} onChange={(v) => setForm({ ...form, objet: v })} /><Field label="Date de l’attachement" type="date" value={form.date_emission} onChange={setDateEmission} /><label className="text-xs text-muted-foreground">Délai de paiement (jours)<Input className="mt-1.5" type="number" min="0" max="365" value={String(delai)} onChange={(e) => setDelaiJours(Number(e.target.value) || 0)} /></label><Field label="Échéance (calculée)" type="date" value={form.date_echeance} onChange={(v) => { setForm({ ...form, date_echeance: v }); setDelai(diffDays(form.date_emission, v)); }} /></div>
    {cle === "ensio" && <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
      <p className="text-sm font-semibold">Attachement de la semaine ENSIO</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">Un jour de la semaine<Input className="mt-1.5" type="date" value={semaineDu} onChange={(e) => choisirSemaine(e.target.value)} /></label>
        <Button type="button" variant="outline" disabled={importEnCours} onClick={() => void importerSemaine()}>{importEnCours ? <Loader2 className="animate-spin" /> : <ClipboardList />} Regrouper les chantiers ENSIO à attacher</Button>
      </div>
      <p className="text-xs text-muted-foreground">Tous les chantiers ENSIO validés ou programmés jusqu’à cette semaine, pas encore attachés, sont regroupés. Chacun devient une ligne au prix du bordereau (+ câble au-delà de 15 m). Échéance : {delai} jours fin de mois.</p>
    </div>}
    <div className="flex flex-wrap gap-5"><Check label="Autoliquidation de TVA" checked={form.autoliquidation} onChange={(v) => setForm({ ...form, autoliquidation: v })} /><Check label="Demander une validation en ligne" checked={form.validation_requise} onChange={(v) => setForm({ ...form, validation_requise: v })} /><Check label="Autoriser le client à proposer une valorisation" checked={form.proposition_autorisee !== false} onChange={(v) => setForm({ ...form, proposition_autorisee: v })} /></div>
    <label className="block text-xs text-muted-foreground">Ajouter une prestation du bordereau {bordereau.isLoading ? "(chargement…)" : `(${catalogueOptions.length} prix)`}
      <select className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={catalogue} onChange={(e) => ajouterDepuisCatalogue(e.target.value)}>
        <option value="">{`Rechercher dans le bordereau ${cle === "ensio" ? "ENSIO" : "Axians"}…`}</option>
        {catalogueOptions.map((l: any) => <option key={l.id} value={l.id}>{`${l.libelle} — ${euro(Number(l.prix_unitaire))} / ${l.unite}`}</option>)}
      </select>
    </label>
    <LignesAttachement lines={lines} setLines={setLines} />
    <Textarea placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /><div className="flex items-center justify-between"><strong>Total HT : {euro(total)}</strong><Button disabled={create.isPending || !form.numero_ticket.trim() || !form.client_nom.trim() || lines.some((l) => !l.libelle.trim() || Number(l.quantite) <= 0)} onClick={() => create.mutate()}>{create.isPending && <Loader2 className="animate-spin" />} Créer l’attachement</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}</section>}
  {totaux.lignes.length > 0 && <section className="overflow-hidden rounded-md border border-border bg-card"><h2 className="border-b border-border p-4 text-sm font-bold uppercase tracking-wide text-primary">Totaux des attachements</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="p-3">Statut</th><th className="p-3 text-right">Nombre</th><th className="p-3 text-right">Total HT</th><th className="p-3 text-right">TVA</th><th className="p-3 text-right">Total TTC</th></tr></thead><tbody className="divide-y divide-border">{totaux.lignes.map(([statut, t]) => <tr key={statut}><td className="p-3 capitalize">{({ envoye: "Envoyé", propose: "Valorisation proposée", accepte: "Accepté", refuse: "Refusé", facture: "Facturé", annule: "Annulé" } as Record<string, string>)[statut] ?? "Brouillon"}</td><td className="p-3 text-right">{t.nb}</td><td className="p-3 text-right font-mono">{euro(t.ht)}</td><td className="p-3 text-right font-mono">{euro(t.tva)}</td><td className="p-3 text-right font-mono">{euro(t.ttc)}</td></tr>)}</tbody><tfoot><tr className="border-t-2 border-border font-bold"><td className="p-3">Total général</td><td className="p-3 text-right">{totaux.global.nb}</td><td className="p-3 text-right font-mono">{euro(totaux.global.ht)}</td><td className="p-3 text-right font-mono">{euro(totaux.global.tva)}</td><td className="p-3 text-right font-mono">{euro(totaux.global.ttc)}</td></tr></tfoot></table></div></section>}
  <div className="relative max-w-xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher client, ticket, affaire ou commande" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
  <section className="overflow-hidden rounded-md border border-border bg-card divide-y divide-border">{list.isLoading ? <div className="p-6"><Loader2 className="animate-spin" /></div> : rows.length === 0 ? <p className="p-6 text-sm text-muted-foreground">Aucun attachement de travaux.</p> : rows.map((a) => <Link key={a.id} to="/attachements/$id" params={{ id: a.id }} className="flex flex-wrap items-center gap-3 p-4 hover:bg-muted/40"><ClipboardList className="h-4 w-4 text-primary" /><strong>{a.numero}</strong><span>{a.client_nom}</span><span className="text-sm text-muted-foreground">Ticket {a.numero_ticket}</span>{a.viewed_at ? <span title={`Dernière consultation le ${new Date(a.last_viewed_at ?? a.viewed_at).toLocaleString("fr-FR")}`} className="rounded-full border border-primary/50 bg-primary/10 px-2 py-1 text-xs text-primary">Vu {new Date(a.viewed_at).toLocaleDateString("fr-FR")}{a.view_count > 1 ? ` · ${a.view_count}×` : ""}</span> : a.sent_at ? <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">Non consulté</span> : null}<span className="ml-auto font-mono">{euro(Number(a.total_ht))} HT</span><span className="rounded-full border border-border px-2 py-1 text-xs">{a.statut}</span></Link>)}</section></div></ProShell>;
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-xs text-muted-foreground">{label}<Input className="mt-1.5" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>; }
