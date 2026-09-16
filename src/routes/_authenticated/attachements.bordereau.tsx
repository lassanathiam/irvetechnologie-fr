import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Loader2, Plus, Save, Search } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBordereauLigne, listBordereau, listDonneurs, updateBordereauLigne, upsertDonneur } from "@/lib/bordereau.functions";
import { euro } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/attachements/bordereau")({
  head: () => ({ meta: [{ title: "Bordereau de prix fibre — IRVE Technologie" }, { name: "description", content: "Modifier les prix du bordereau fibre et les donneurs d’ordre." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Bordereau de prix fibre — IRVE Technologie" }, { property: "og:description", content: "Prix du bordereau fibre et donneurs d’ordre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BordereauPage,
});

type DonneurForm = {
  id?: string; nom: string; raison_sociale: string; adresse: string; cp_ville: string; siret: string; tva_intracom: string;
  numero_fournisseur: string; adresse_livraison: string; charge_affaires_nom: string; charge_affaires_email: string;
  charge_affaires_telephone: string; delai_paiement_jours: number; autoliquidation: boolean; notes: string;
};
const vide: DonneurForm = { nom: "", raison_sociale: "", adresse: "", cp_ville: "", siret: "", tva_intracom: "", numero_fournisseur: "", adresse_livraison: "", charge_affaires_nom: "", charge_affaires_email: "", charge_affaires_telephone: "", delai_paiement_jours: 60, autoliquidation: true, notes: "" };

function BordereauPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBordereau); const updateFn = useServerFn(updateBordereauLigne); const createFn = useServerFn(createBordereauLigne);
  const donneursFn = useServerFn(listDonneurs); const saveDonneurFn = useServerFn(upsertDonneur);
  const bordereau = useQuery({ queryKey: ["bordereau"], queryFn: () => listFn() });
  const donneurs = useQuery({ queryKey: ["donneurs-ordre"], queryFn: () => donneursFn() });
  const [search, setSearch] = useState(""); const [prix, setPrix] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [nouvelle, setNouvelle] = useState({ libelle: "", unite: "u", prix: "", section: "Ajouts IRVE Technologie" });
  const [donneur, setDonneur] = useState<DonneurForm>(vide);

  const enregistrerPrix = useMutation({
    mutationFn: async (id: string) => updateFn({ data: { id, prix_unitaire: Number(prix[id]) } }),
    onSuccess: () => { setError(null); setFeedback("Prix mis à jour."); void qc.invalidateQueries({ queryKey: ["bordereau"] }); },
    onError: (e) => setError(e instanceof Error ? e.message : "Modification impossible."),
  });
  const ajouterLigne = useMutation({
    mutationFn: () => createFn({ data: { categorie: "Travaux et génie civil", section: nouvelle.section, libelle: nouvelle.libelle, unite: nouvelle.unite, prix_unitaire: Number(nouvelle.prix) } }),
    onSuccess: () => { setNouvelle({ libelle: "", unite: "u", prix: "", section: "Ajouts IRVE Technologie" }); setFeedback("Prestation ajoutée au bordereau."); void qc.invalidateQueries({ queryKey: ["bordereau"] }); },
    onError: (e) => setError(e instanceof Error ? e.message : "Ajout impossible."),
  });
  const saveDonneur = useMutation({
    mutationFn: () => saveDonneurFn({ data: { ...donneur, delai_paiement_jours: Number(donneur.delai_paiement_jours) || 60 } }),
    onSuccess: () => { setDonneur(vide); setFeedback("Donneur d’ordre enregistré."); void qc.invalidateQueries({ queryKey: ["donneurs-ordre"] }); },
    onError: (e) => setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const rows = useMemo(() => (bordereau.data ?? []).filter((l: any) => `${l.libelle} ${l.section ?? ""}`.toLowerCase().includes(search.toLowerCase())).slice(0, 400), [bordereau.data, search]);

  return <ProShell><div className="space-y-6">
    <header className="flex flex-wrap items-center gap-3"><Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Attachements</Link><h1 className="text-2xl font-semibold">Bordereau de prix &amp; donneurs d’ordre</h1></header>
    {feedback && <p className="text-sm text-primary">{feedback}</p>}{error && <p className="text-sm text-destructive">{error}</p>}

    <section className="rounded-md border border-border bg-card p-5 space-y-4">
      <div><h2 className="text-sm font-bold uppercase text-primary">Donneur d’ordre</h2><p className="text-sm text-muted-foreground">Enregistrez une fois les coordonnées et le chargé d’affaires : elles préremplissent chaque attachement.</p></div>
      <div className="flex flex-wrap gap-2">{(donneurs.data ?? []).map((d: any) => <Button key={d.id} variant="outline" size="sm" onClick={() => setDonneur({ ...vide, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null)) as any })}><Building2 /> {d.nom}</Button>)}<Button variant="ghost" size="sm" onClick={() => setDonneur(vide)}><Plus /> Nouveau</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <F label="Nom *" value={donneur.nom} onChange={(v) => setDonneur({ ...donneur, nom: v })} />
        <F label="Raison sociale" value={donneur.raison_sociale} onChange={(v) => setDonneur({ ...donneur, raison_sociale: v })} />
        <F label="Adresse de facturation" value={donneur.adresse} onChange={(v) => setDonneur({ ...donneur, adresse: v })} />
        <F label="Code postal / ville" value={donneur.cp_ville} onChange={(v) => setDonneur({ ...donneur, cp_ville: v })} />
        <F label="SIRET" value={donneur.siret} onChange={(v) => setDonneur({ ...donneur, siret: v })} />
        <F label="TVA intracommunautaire" value={donneur.tva_intracom} onChange={(v) => setDonneur({ ...donneur, tva_intracom: v })} />
        <F label="Numéro fournisseur" value={donneur.numero_fournisseur} onChange={(v) => setDonneur({ ...donneur, numero_fournisseur: v })} />
        <F label="Chargé d’affaires" value={donneur.charge_affaires_nom} onChange={(v) => setDonneur({ ...donneur, charge_affaires_nom: v })} />
        <F label="E-mail du chargé d’affaires" type="email" value={donneur.charge_affaires_email} onChange={(v) => setDonneur({ ...donneur, charge_affaires_email: v })} />
        <F label="Téléphone" value={donneur.charge_affaires_telephone} onChange={(v) => setDonneur({ ...donneur, charge_affaires_telephone: v })} />
        <F label="Délai de paiement (jours)" type="number" value={String(donneur.delai_paiement_jours)} onChange={(v) => setDonneur({ ...donneur, delai_paiement_jours: Number(v) })} />
      </div>
      <Textarea placeholder="Adresse de livraison / chantier" value={donneur.adresse_livraison} onChange={(e) => setDonneur({ ...donneur, adresse_livraison: e.target.value })} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={donneur.autoliquidation} onChange={(e) => setDonneur({ ...donneur, autoliquidation: e.target.checked })} /> Autoliquidation de TVA par défaut</label>
      <Button disabled={saveDonneur.isPending || donneur.nom.trim().length < 2} onClick={() => saveDonneur.mutate()}>{saveDonneur.isPending && <Loader2 className="animate-spin" />}<Save /> Enregistrer le donneur d’ordre</Button>
    </section>

    <section className="rounded-md border border-border bg-card p-5 space-y-4">
      <div><h2 className="text-sm font-bold uppercase text-primary">Prix du bordereau ({(bordereau.data ?? []).length})</h2><p className="text-sm text-muted-foreground">Modifiez un prix quand le bordereau évolue : les nouveaux attachements l’utilisent aussitôt.</p></div>
      <div className="relative max-w-xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Rechercher une prestation" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[2fr_.5fr_.7fr_auto]"><Input placeholder="Nouvelle prestation" value={nouvelle.libelle} onChange={(e) => setNouvelle({ ...nouvelle, libelle: e.target.value })} /><Input placeholder="Unité" value={nouvelle.unite} onChange={(e) => setNouvelle({ ...nouvelle, unite: e.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Prix HT" value={nouvelle.prix} onChange={(e) => setNouvelle({ ...nouvelle, prix: e.target.value })} /><Button variant="outline" disabled={ajouterLigne.isPending || !nouvelle.libelle.trim()} onClick={() => ajouterLigne.mutate()}><Plus /> Ajouter</Button></div>
      {bordereau.isLoading ? <Loader2 className="animate-spin text-primary" /> : <div className="divide-y divide-border">{rows.map((l: any) => <div key={l.id} className="flex flex-wrap items-center gap-3 py-2 text-sm"><div className="min-w-0 flex-1"><div className="font-medium">{l.libelle}</div><div className="text-xs text-muted-foreground">{l.section} · unité {l.unite} · {euro(Number(l.prix_unitaire))}</div></div><Input className="w-28" type="number" min="0" step="0.01" aria-label={`Prix ${l.libelle}`} value={prix[l.id] ?? String(Number(l.prix_unitaire))} onChange={(e) => setPrix({ ...prix, [l.id]: e.target.value })} /><Button size="sm" variant="outline" disabled={enregistrerPrix.isPending || (prix[l.id] ?? String(Number(l.prix_unitaire))) === String(Number(l.prix_unitaire))} onClick={() => enregistrerPrix.mutate(l.id)}><Save /> Enregistrer</Button></div>)}</div>}
    </section>
  </div></ProShell>;
}

function F({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-xs text-muted-foreground">{label}<Input className="mt-1.5" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
