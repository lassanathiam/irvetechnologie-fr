import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lireCommande } from "@/lib/commandes-ensio";
import { rapprocherAttachement, type AttachementSuivi } from "@/lib/attachement-suivi";
import { texteDuPdf } from "@/lib/pdf-texte";
import { statutAttachement, estAttachementCloture } from "@/lib/attachement-classement";
type Att = AttachementSuivi & { objet?: string | null; total_ht: number };
type Controle = { nom: string; att?: Att; erreur?: string };
export function SuiviAttachementsCommandes({ atts }: { atts: Att[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [controle, setControle] = useState<Controle[]>([]);
  const [busy, setBusy] = useState(false);
  const [donneur, setDonneur] = useState("");
  const [recherche, setRecherche] = useState("");
  const [vue, setVue] = useState("restants");
  const selection = atts.filter((a) => (!donneur || a.client_nom === donneur) && `${a.numero} ${a.objet ?? ""} ${a.bon_commande ?? ""} ${a.client_nom}`.toLowerCase().includes(recherche.toLowerCase()));
  const faits = selection.filter(estAttachementCloture);
  const restants = selection.filter((a) => !estAttachementCloture(a) && !["annule", "refuse"].includes(a.statut ?? ""));
  async function comparer(files: FileList | null) {
    if (!files || busy) return;
    setBusy(true);
    const resultat: Controle[] = [];
    try {
      for (const f of Array.from(files).filter((f) => /\.pdf$/i.test(f.name))) {
        try {
          const lu = lireCommande(await texteDuPdf(new Uint8Array(await f.arrayBuffer())));
          const reference = f.name.match(/AT-\d{4}-\d{3,}/i)?.[0]?.toUpperCase();
          const att = rapprocherAttachement({ ...lu, attachement: lu.attachement ?? reference ?? null }, atts);
          resultat.push({ nom: f.name, att, erreur: att ? undefined : "Non reconnu ou références contradictoires — à vérifier" });
        } catch { resultat.push({ nom: f.name, erreur: "PDF illisible — à vérifier" }); }
      }
      setControle(resultat);
    } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-y border-border py-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Suivi des attachements</h2><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><FileSearch />{busy ? "Comparaison…" : "Comparer mes attachements PDF"}</Button><input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => { void comparer(e.target.files); e.target.value = ""; }} /></div>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Donneur d’ordre du suivi" className="max-w-full rounded-md border border-input bg-background p-2 text-sm" value={donneur} onChange={(e) => setDonneur(e.target.value)}><option value="">Tous les donneurs d’ordre</option>{[...new Set(atts.map((a) => a.client_nom))].sort().map((nom) => <option key={nom}>{nom}</option>)}</select>
      <input aria-label="Rechercher un attachement" placeholder="Client, attachement ou commande" className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-sm" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <Button size="sm" variant={vue === "restants" ? "default" : "outline"} aria-pressed={vue === "restants"} onClick={() => setVue("restants")}>À traiter ({restants.length})</Button><Button size="sm" variant={vue === "faits" ? "default" : "outline"} aria-pressed={vue === "faits"} onClick={() => setVue("faits")}>Faits · Facturés ({faits.length})</Button>
    </div>
    <div className="max-h-96 overflow-y-auto divide-y divide-border">{!(vue === "faits" ? faits : restants).length && <p className="py-3 text-sm text-muted-foreground">Aucun attachement dans cette sélection.</p>}{(vue === "faits" ? faits : restants).map((a) => <div key={a.id} className="flex flex-wrap items-center gap-2 py-3 text-sm"><Link to="/attachements/$id" params={{ id: a.id }} className="font-semibold text-primary underline">{a.numero}</Link><span className="min-w-0 flex-1 break-words">{a.objet || a.client_nom}</span><span>{a.total_ht.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT</span><span className="text-muted-foreground">{statutAttachement(a)} · {a.bon_commande || "Commande non renseignée"}</span>{a.facture_id && <Link to="/factures/$id" params={{ id: a.facture_id }} className="text-primary underline">Voir la facture</Link>}</div>)}</div>
    {controle.length > 0 && <div className="space-y-2 border-t border-border pt-4"><h3 className="font-semibold">Comparaison des PDF ({controle.length})</h3>{controle.map((c, i) => <div key={`${c.nom}-${i}`} className="flex flex-wrap gap-2 text-sm"><span className="min-w-0 break-all">{c.nom}</span><strong className={c.erreur ? "text-destructive" : "text-primary"}>{c.erreur ?? (c.att && estAttachementCloture(c.att) ? "Déjà fait · Facturé" : "Reste à traiter")}</strong>{c.att && <Link to="/attachements/$id" params={{ id: c.att.id }} className="text-primary underline">{c.att.numero}</Link>}</div>)}</div>}
  </section>;
}