import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { updateFactureComplete } from "@/lib/factures.functions";
import { computeTotals } from "@/lib/billing";

type Item = { libelle: string; description: string | null; quantite: number; prix_unitaire: number; tva: number };
type Facture = {
  id: string; client_nom: string; client_email: string | null; client_telephone: string | null;
  client_adresse: string | null; client_cp_ville: string | null; objet: string | null;
  remise_pct: number; conditions_paiement: string | null; notes: string | null; autoliquidation: boolean;
};

const inp = "mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm";
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function FactureEditor({ facture, items, onDone }: { facture: Facture; items: Item[]; onDone: () => void }) {
  const saveFn = useServerFn(updateFactureComplete);
  const [f, setF] = useState({
    client_nom: facture.client_nom, client_email: facture.client_email ?? "", client_telephone: facture.client_telephone ?? "",
    client_adresse: facture.client_adresse ?? "", client_cp_ville: facture.client_cp_ville ?? "", objet: facture.objet ?? "",
    remise_pct: Number(facture.remise_pct) || 0, conditions_paiement: facture.conditions_paiement ?? "",
    notes: facture.notes ?? "", autoliquidation: facture.autoliquidation,
  });
  const [lignes, setLignes] = useState<Item[]>(
    items.map((i) => ({ libelle: i.libelle, description: i.description, quantite: Number(i.quantite), prix_unitaire: Number(i.prix_unitaire), tva: Number(i.tva) })),
  );
  const totals = computeTotals(f.autoliquidation ? lignes.map((l) => ({ ...l, tva: 0 })) : lignes, f.remise_pct);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: facture.id, ...f, items: lignes } }),
    onSuccess: onDone,
  });
  const setL = (i: number, patch: Partial<Item>) => setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const champ = (key: keyof typeof f, label: string) => (
    <label className="block text-xs text-muted-foreground">{label}
      <input className={inp} value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="border border-primary rounded-sm bg-card p-6 space-y-5">
      <h2 className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">Modifier la facture</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {champ("client_nom", "Client")}{champ("client_email", "Email")}
        {champ("client_telephone", "Téléphone")}{champ("client_adresse", "Adresse")}
        {champ("client_cp_ville", "CP / Ville")}{champ("objet", "Objet")}
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Lignes</div>
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-2">
            <label className="col-span-12 sm:col-span-5 text-xs text-muted-foreground">Désignation
              <input className={inp} value={l.libelle} onChange={(e) => setL(i, { libelle: e.target.value })} />
            </label>
            <label className="col-span-4 sm:col-span-2 text-xs text-muted-foreground">Qté
              <input type="number" step="any" className={inp} value={l.quantite} onChange={(e) => setL(i, { quantite: Number(e.target.value) })} />
            </label>
            <label className="col-span-4 sm:col-span-2 text-xs text-muted-foreground">PU HT
              <input type="number" step="any" className={inp} value={l.prix_unitaire} onChange={(e) => setL(i, { prix_unitaire: Number(e.target.value) })} />
            </label>
            <label className="col-span-3 sm:col-span-2 text-xs text-muted-foreground">TVA %
              <input type="number" step="any" className={inp} value={l.tva} disabled={f.autoliquidation} onChange={(e) => setL(i, { tva: Number(e.target.value) })} />
            </label>
            <button type="button" aria-label="Supprimer la ligne" onClick={() => setLignes(lignes.filter((_, k) => k !== i))}
              className="col-span-1 p-2 text-destructive disabled:opacity-30" disabled={lignes.length <= 1}>
              <Trash2 className="h-4 w-4" />
            </button>
            <label className="col-span-12 text-xs text-muted-foreground">Description (facultatif)
              <input className={inp} value={l.description ?? ""} onChange={(e) => setL(i, { description: e.target.value })} />
            </label>
          </div>
        ))}
        <button type="button" onClick={() => setLignes([...lignes, { libelle: "", description: null, quantite: 1, prix_unitaire: 0, tva: 20 }])}
          className="border border-border rounded-sm px-3 py-2 text-mono text-xs inline-flex items-center gap-1.5 hover:border-primary hover:text-primary">
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs text-muted-foreground">Remise %
          <input type="number" min={0} max={100} className={inp} value={f.remise_pct} onChange={(e) => setF({ ...f, remise_pct: Number(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={f.autoliquidation} onChange={(e) => setF({ ...f, autoliquidation: e.target.checked })} />
          Autoliquidation (TVA à 0)
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">Conditions de paiement
        <textarea rows={2} className={inp} value={f.conditions_paiement} onChange={(e) => setF({ ...f, conditions_paiement: e.target.value })} />
      </label>
      <label className="block text-xs text-muted-foreground">Notes
        <textarea rows={2} className={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </label>
      <div className="text-mono text-sm">Total HT {eur(totals.total_ht)} · TVA {eur(totals.total_tva)} · <b>TTC {eur(totals.total_ttc)}</b></div>
      {save.isError && <p className="text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Erreur"}</p>}
      <div className="flex gap-3">
        <button type="button" disabled={save.isPending || !f.client_nom.trim() || lignes.some((l) => !l.libelle.trim())}
          onClick={() => save.mutate()}
          className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer les modifications
        </button>
        <button type="button" onClick={onDone} className="border border-border rounded-sm px-4 py-2 text-mono text-xs">Annuler</button>
      </div>
    </div>
  );
}
