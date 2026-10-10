import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deplacer, deplacerVers } from "@/lib/reorder";

export type LigneAtt = { key: string; libelle: string; description: string; quantite: string; prix: string; rendezvous_id?: string | null };
export const nouvelleLigne = (init?: Partial<LigneAtt>): LigneAtt => ({ key: crypto.randomUUID(), libelle: "", description: "", quantite: "1", prix: "", ...init });

/** Éditeur de lignes : glisser-déposer (poignée), flèches, et « + » pour insérer une ligne juste en dessous. */
export type PrestationBpu = { id: string; reference?: string | null; libelle: string; unite: string; prix_unitaire: number | string };
const estTableauSecondaire = (p: PrestationBpu) => /sous-distributeur/i.test(p.libelle);

export function LignesAttachement({ lines, setLines, catalogue = [] }: { lines: LigneAtt[]; setLines: (l: LigneAtt[]) => void; catalogue?: PrestationBpu[] }) {
  const tableau = catalogue.find(estTableauSecondaire);
  const insererBpu = (idx: number, id: string) => { const p = catalogue.find((c) => c.id === id); if (!p) return; const n = lines.slice(); n.splice(idx + 1, 0, nouvelleLigne({ rendezvous_id: null, libelle: p.libelle.split(" — ")[0], description: `BPU ${p.reference ?? ""}${estTableauSecondaire(p) ? " — pose tableau secondaire / coffret" : ""}`.trim(), quantite: "1", prix: String(Number(p.prix_unitaire)) })); setLines(n); };
  const [drag, setDrag] = useState<number | null>(null);
  const [cible, setCible] = useState<number | null>(null);
  const maj = (key: string, patch: Partial<LigneAtt>) => setLines(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const inserer = (idx: number) => { const n = lines.slice(); n.splice(idx + 1, 0, nouvelleLigne({ rendezvous_id: null })); setLines(n); };
  return <div className="space-y-2">
    {lines.map((line, idx) => <div key={line.key}
      draggable={drag === idx}
      onDragOver={(e) => { if (drag === null) return; e.preventDefault(); setCible(idx); }}
      onDrop={(e) => { e.preventDefault(); if (drag !== null) setLines(deplacerVers(lines, drag, idx)); setDrag(null); setCible(null); }}
      onDragEnd={() => { setDrag(null); setCible(null); }}
      className={`rounded-md border p-3 ${cible === idx && drag !== idx ? "border-primary ring-2 ring-primary/40" : "border-border"} ${line.rendezvous_id ? "bg-primary/5" : "bg-background"} ${drag === idx ? "opacity-50" : ""}`}>
      <div className="grid gap-2 sm:grid-cols-[auto_1.4fr_1.5fr_.5fr_.7fr_auto] sm:items-center">
        <button type="button" aria-label="Glisser pour déplacer" title="Maintenir et glisser pour déplacer" className="hidden cursor-grab text-muted-foreground sm:block" onMouseDown={() => setDrag(idx)} onMouseUp={() => setDrag(null)}><GripVertical className="h-5 w-5" /></button>
        <Input aria-label="Travaux" placeholder="Travaux réalisés" value={line.libelle} onChange={(e) => maj(line.key, { libelle: e.target.value })} />
        <Input aria-label="Description" placeholder="Description / adresse" value={line.description} onChange={(e) => maj(line.key, { description: e.target.value })} />
        <Input aria-label="Quantité" type="number" min="0.01" step="0.01" placeholder="Qté" value={line.quantite} onChange={(e) => maj(line.key, { quantite: e.target.value })} />
        <Input aria-label="Prix HT" type="number" min="0" step="0.01" placeholder="Prix HT" value={line.prix} onChange={(e) => maj(line.key, { prix: e.target.value })} />
        <div className="flex items-center justify-end">
          <Button type="button" variant="ghost" size="icon" aria-label="Monter la ligne" disabled={idx === 0} onClick={() => setLines(deplacer(lines, idx, -1))}><ChevronUp /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Descendre la ligne" disabled={idx === lines.length - 1} onClick={() => setLines(deplacer(lines, idx, 1))}><ChevronDown /></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [nouvelleLigne()])}><Trash2 /></Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => inserer(idx)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><Plus className="h-3 w-3" /> Insérer une ligne en dessous</button>
        {tableau ? <button type="button" onClick={() => insererBpu(idx, tableau.id)} className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"><Plus className="h-3 w-3" /> Tableau secondaire / coffret ({Number(tableau.prix_unitaire)} €)</button> : null}
        {catalogue.length ? <select aria-label="Ajouter une prestation du bordereau sous cette ligne" className="max-w-full rounded-md border border-input bg-background px-2 py-1 text-xs sm:max-w-xs" value="" onChange={(e) => insererBpu(idx, e.target.value)}><option value="">+ Prestation du bordereau en dessous…</option>{catalogue.map((p) => <option key={p.id} value={p.id}>{`${p.reference ?? ""} ${p.libelle.split(" — ")[0]} — ${Number(p.prix_unitaire)} € / ${p.unite}`}</option>)}</select> : null}
      </div>
    </div>)}
    <Button type="button" variant="outline" onClick={() => setLines([...lines, nouvelleLigne()])}><Plus /> Ajouter une ligne en bas</Button>
  </div>;
}
