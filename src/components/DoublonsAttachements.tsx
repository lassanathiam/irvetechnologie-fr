import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listDoublonsAttachements, supprimerAttachement, type DoublonTrouve } from "@/lib/attachements.functions";
import { euro } from "@/lib/company";

const CLE_IGNORES = "irve-doublons-attachements-ignores";
const clePaire = (a: string, b: string) => [a, b].sort().join("|");

function Fiche({ d, titre }: { d: DoublonTrouve; titre: string }) {
  return <Link to="/attachements/$id" params={{ id: d.id }} className="block min-w-0 rounded-md border border-border bg-background p-2 underline-offset-2 hover:underline">
    <span className="block text-xs text-muted-foreground">{titre}</span>
    <strong className="block text-base font-extrabold">{d.noms.length ? d.noms.join(", ") : "Aucun chantier relié"}</strong>
    <span className="block text-xs text-muted-foreground">{d.numero} · {d.facture ? "Facturé" : d.envoye ? "Envoyé au client" : "Pas encore envoyé"}</span>
    <strong className="block text-lg font-extrabold text-dashboard-green">{euro(d.total_ht)} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
  </Link>;
}

/** Doublons possibles d'attachements : suppression du doublon après confirmation, jamais automatique. */
export function DoublonsAttachements() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDoublonsAttachements); const supprimerFn = useServerFn(supprimerAttachement);
  const q = useQuery({ queryKey: ["attachements-doublons"], queryFn: () => listFn() });
  const [ignores, setIgnores] = useState<string[]>([]);
  const [ouvert, setOuvert] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  useEffect(() => { try { setIgnores(JSON.parse(localStorage.getItem(CLE_IGNORES) ?? "[]")); } catch { /* rien */ } }, []);
  const ignorer = (cles: string[]) => setIgnores((cur) => { const n = [...new Set([...cur, ...cles])]; try { localStorage.setItem(CLE_IGNORES, JSON.stringify(n)); } catch { /* rien */ } return n; });
  const paires = (q.data ?? []).filter((p) => !ignores.includes(clePaire(p.garder.id, p.doublon.id)));
  // Une seule carte par doublon, avec tous les attachements qu'il répète.
  const groupes = [...paires.reduce((m, p) => m.set(p.doublon.id, [...(m.get(p.doublon.id) ?? []), p]), new Map<string, typeof paires>()).values()];
  const proposes = new Set(groupes.map((g) => g[0]!.doublon.id));
  if (!groupes.length) return null;

  async function supprimer(d: DoublonTrouve, garder: DoublonTrouve) {
    if (!window.confirm(`Supprimer définitivement l’attachement ${d.numero} (${euro(d.total_ht)} HT) ?\n\n${garder.numero} est conservé. Cette suppression ne peut pas être annulée.`)) return;
    setEnCours(d.id);
    try { await supprimerFn({ data: { id: d.id } }); toast.success(`${d.numero} supprimé`); await qc.invalidateQueries(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Suppression impossible."); }
    finally { setEnCours(null); }
  }

  return <section className="rounded-md border-2 border-destructive/50 bg-card p-5 space-y-3">
    <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} className="flex w-full items-center gap-2 text-left">
      {ouvert ? <ChevronDown className="h-5 w-5 text-destructive" /> : <ChevronRight className="h-5 w-5 text-destructive" />}
      <h2 className="flex flex-1 items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-destructive" /> Doublons possibles ({groupes.length})</h2>
    </button>
    {ouvert && <>
      <p className="text-sm text-muted-foreground">Ces attachements portent le même chantier, ou sont identiques (même semaine, mêmes lignes, même montant) alors que l’un n’est relié à aucun chantier. Rien n’est supprimé sans votre accord.</p>
      <ul className="space-y-3">{groupes.map((g0) => { const surs = g0.filter((p) => !proposes.has(p.garder.id)); const g = surs.length ? surs : g0; const d = g[0]!.doublon; const garder = g[0]!.garder; return <li key={d.id} className="rounded-md border border-border p-3 space-y-2">
        <p className="text-sm font-semibold">{d.raison === "chantier" ? "Même chantier dans deux attachements" : "Attachement identique à un autre"} · {g[0]!.client}</p>
        <div className="grid gap-2 sm:grid-cols-2"><Fiche d={d} titre="Doublon proposé à la suppression" /><div className="space-y-2">{g.map((p) => <Fiche key={p.garder.id} d={p.garder} titre="Déjà existant, à garder" />)}</div></div>
        <div className="flex flex-wrap gap-2">
          {!d.facture && !d.envoye
            ? <Button size="sm" variant="destructive" disabled={enCours !== null} onClick={() => void supprimer(d, garder)}>{enCours === d.id ? <Loader2 className="animate-spin" /> : <Trash2 />} Supprimer {d.numero}</Button>
            : <span className="text-xs text-muted-foreground">{d.numero} est déjà {d.facture ? "facturé" : "envoyé au client"} : ouvrez-le pour l’annuler.</span>}
          <Button size="sm" variant="outline" onClick={() => ignorer(g0.map((p) => clePaire(p.garder.id, p.doublon.id)))}>Ce n’est pas un doublon</Button>
        </div>
      </li>; })}</ul>
    </>}
  </section>;
}
