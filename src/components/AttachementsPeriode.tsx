import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { envoyerAttachementsGroupes } from "@/lib/attachements.functions";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { euro } from "@/lib/company";

/** Bornes [début, fin] d'une semaine (lundi→dimanche) ou d'un mois. */
export function bornesPeriode(mode: "semaine" | "mois", date: string): [string, string] {
  const d = new Date(`${date}T12:00:00`);
  if (mode === "mois") {
    const debut = new Date(d.getFullYear(), d.getMonth(), 1, 12); const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
    return [debut.toISOString().slice(0, 10), fin.toISOString().slice(0, 10)];
  }
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const debut = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 6); return [debut, d.toISOString().slice(0, 10)];
}

export function AttachementsPeriode({ attachements }: { attachements: any[] }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"semaine" | "mois">("semaine");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [exclus, setExclus] = useState<string[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null); const [info, setInfo] = useState<string | null>(null);
  const envoyer = useEnvoiConfirme(envoyerAttachementsGroupes, "Envoyer en UN SEUL email tous les attachements cochés de ce donneur d’ordre (un lien = un PDF avec tout), copie à vous ?");
  const [debut, fin] = bornesPeriode(mode, date);
  const liste = useMemo(() => attachements.filter((a) => a.statut !== "annule" && String(a.date_emission) >= debut && String(a.date_emission) <= fin).sort((a, b) => String(a.numero).localeCompare(String(b.numero))), [attachements, debut, fin]);
  const choisis = liste.filter((a) => !exclus.includes(a.id));
  const groupes = useMemo(() => { const m = new Map<string, any[]>(); for (const a of choisis) { const k = String(a.client_email ?? "").trim().toLowerCase() || `sans:${a.client_nom}`; m.set(k, [...(m.get(k) ?? []), a]); } return [...m.entries()]; }, [choisis]);
  const fr = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString("fr-FR");

  async function envoyerGroupe(cle: string, items: any[]) {
    setEnCours(cle); setInfo(null);
    try { const r = await envoyer({ data: { ids: items.map((a) => a.id) } }); setInfo(r.sent ? `Un seul email envoyé avec ${r.nb} attachement(s).` : "L’email n’est pas parti."); await qc.invalidateQueries({ queryKey: ["attachements"] }); }
    catch (e) { setInfo(e instanceof Error ? e.message : "Envoi impossible."); } finally { setEnCours(null); }
  }

  return <section className="space-y-3 rounded-md border border-border bg-card p-4">
    <h2 className="text-sm font-bold uppercase tracking-wide text-primary">Télécharger ou envoyer par semaine / par mois</h2>
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex rounded-md border border-border">{(["semaine", "mois"] as const).map((m) => <button key={m} type="button" onClick={() => { setMode(m); setExclus([]); }} className={`px-3 py-2 text-sm ${mode === m ? "bg-primary text-primary-foreground" : ""}`}>{m === "semaine" ? "Semaine" : "Mois"}</button>)}</div>
      <Input type={mode === "mois" ? "month" : "date"} className="w-auto" value={mode === "mois" ? date.slice(0, 7) : date} onChange={(e) => { if (e.target.value) { setDate(mode === "mois" ? `${e.target.value}-01` : e.target.value); setExclus([]); } }} />
      <span className="text-sm text-muted-foreground">du {fr(debut)} au {fr(fin)}</span>
    </div>
    {liste.length === 0 ? <p className="text-sm text-muted-foreground">Aucun attachement sur cette période.</p> : <>
      <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">{liste.map((a) => <li key={a.id}><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={!exclus.includes(a.id)} onChange={(e) => setExclus((x) => e.target.checked ? x.filter((i) => i !== a.id) : [...x, a.id])} /><span className="font-semibold">{a.numero}</span><span className="text-muted-foreground">{a.client_nom}</span><span className="ml-auto font-mono">{euro(Number(a.total_ht))}</span></label></li>)}</ul>
      <p className="text-sm font-bold">{choisis.length} attachement(s) · {euro(choisis.reduce((s, a) => s + Number(a.total_ht), 0))} HT</p>
      {groupes.map(([cle, items]) => <div key={cle} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
        <span className="text-sm font-semibold">{items[0].client_nom} ({items.length})</span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => window.open(`/attachements-lot/${items.map((a) => a.public_token).join(".")}`, "_blank")}><Download /> Tout télécharger en un PDF</Button>
        <Button size="sm" disabled={enCours !== null || cle.startsWith("sans:")} onClick={() => void envoyerGroupe(cle, items)}>{enCours === cle ? <Loader2 className="animate-spin" /> : <Mail />} Tout envoyer en un seul email</Button>
      </div>)}
      <p className="text-xs text-muted-foreground">Le PDF s’ouvre avec tous les attachements à la suite : touchez « Télécharger tout en un PDF » puis « Enregistrer en PDF ».</p>
    </>}
    {info && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{info}</p>}
  </section>;
}
