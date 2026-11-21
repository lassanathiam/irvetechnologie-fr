import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AttachementPrint } from "@/components/AttachementPrint";
import { supabase } from "@/integrations/supabase/client";
import { getAttachement } from "@/lib/attachements.functions";
import { getFacture } from "@/lib/factures.functions";
import { creerFacturePdf } from "@/lib/facture-pdf";
import { creerPdfAttachements } from "@/lib/pdf-attachements";
import { dossiersUniques, nomDossier, numerosColles, selectionParDefaut, selectionParNumeros } from "@/lib/bloc-dossiers";
import { Textarea } from "@/components/ui/textarea";
import { euro } from "@/lib/company";

type Commande = { id: string; nom: string; signe_path: string | null; bytes: Uint8Array; lu: { numero: string | null; client: string | null; montantHt: number | null }; attId: string; factureId?: string | null };
type Att = { id: string; numero: string; total_ht: number; facture_id: string | null };
type Etat = { recu: boolean; noms: string };

/** Télécharge en un seul ZIP les dossiers choisis (facture + commande + attachement) pour la plateforme du donneur d'ordre. */
export function BlocDossiersPlateforme({ commandes, atts }: { commandes: Commande[]; atts: Att[] }) {
  const lireFacture = useServerFn(getFacture); const lireAtt = useServerFn(getAttachement);
  const dossiers = useMemo(() => dossiersUniques(commandes.map((c) => ({ ...c, numero: c.lu.numero, client: c.lu.client, factureId: c.factureId ?? atts.find((a) => a.id === c.attId)?.facture_id ?? null }))), [commandes, atts]);
  const [etats, setEtats] = useState<Map<string, Etat>>(new Map());
  const [coches, setCoches] = useState<string[]>([]); const [init, setInit] = useState(false);
  const [avecAtt, setAvecAtt] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof getAttachement>>[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const [ouvert, setOuvert] = useState(true);
  const [colle, setColle] = useState("");
  const CLE = "irve-bloc-dossiers-coches";
  const cocher = (ids: string[]) => { setCoches(ids); try { localStorage.setItem(CLE, JSON.stringify(ids)); } catch { /* rien */ } };

  useEffect(() => {
    const attIds = [...new Set(dossiers.map((d) => d.attId).filter(Boolean))];
    if (!attIds.length) return;
    let actif = true;
    void (async () => {
      const { data: items } = await supabase.from("attachement_items").select("attachement_id, rendezvous_id").in("attachement_id", attIds);
      const rdvIds = [...new Set((items ?? []).map((x) => x.rendezvous_id).filter(Boolean))] as string[];
      const { data: rdvs } = rdvIds.length ? await supabase.from("rendezvous").select("id, client_nom, receptionne_at").in("id", rdvIds) : { data: [] };
      const rdv = new Map((rdvs ?? []).map((r) => [r.id, r]));
      const m = new Map<string, Etat>();
      for (const id of attIds) {
        const rs = [...new Set((items ?? []).filter((x) => x.attachement_id === id && x.rendezvous_id).map((x) => x.rendezvous_id as string))].map((r) => rdv.get(r)).filter(Boolean) as { client_nom: string | null; receptionne_at: string | null }[];
        m.set(id, { recu: rs.length > 0 && rs.every((r) => r.receptionne_at), noms: [...new Set(rs.map((r) => r.client_nom).filter(Boolean))].join(" · ") });
      }
      if (!actif) return;
      setEtats(m);
      if (!init) {
        let memo: string[] | null = null;
        try { const v = localStorage.getItem(CLE); if (v) memo = (JSON.parse(v) as string[]).filter((id) => dossiers.some((d) => d.id === id)); } catch { /* rien */ }
        setCoches(memo?.length ? memo : selectionParDefaut(dossiers, new Map([...m].map(([k, v]) => [k, v.recu])))); setInit(true);
      }
    })();
    return () => { actif = false; };
  }, [dossiers]);

  const choisis = dossiers.filter((d) => coches.includes(d.id));
  const total = choisis.reduce((s, d) => s + (atts.find((a) => a.id === d.attId)?.total_ht ?? 0), 0);

  async function telecharger() {
    if (!choisis.length) return;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const recap: string[] = ["Commande;Client;Facture;Attachement;Montant HT;Réceptionné"];
      let attPdfs = new Map<string, Blob>();
      if (avecAtt) {
        setBusy("Préparation des attachements…");
        const lus = [];
        for (const [i, d] of choisis.entries()) { setBusy(`Lecture des attachements ${i + 1}/${choisis.length}…`); lus.push(await lireAtt({ data: { id: d.attId } })); }
        setDocs(lus);
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await document.fonts.ready;
        const els = Array.from(stage.current?.querySelectorAll<HTMLElement>(".print-doc") ?? []);
        await Promise.all(els.flatMap((e) => Array.from(e.querySelectorAll("img"))).map((img) => img.decode().catch(() => undefined)));
        for (const [i, el] of els.entries()) { setBusy(`PDF attachement ${i + 1}/${els.length}…`); const id = lus[i]?.attachement.id; if (id) attPdfs.set(id, await creerPdfAttachements([el])); }
      }
      for (const [i, d] of choisis.entries()) {
        setBusy(`Préparation du dossier ${i + 1}/${choisis.length}…`);
        const f = await lireFacture({ data: { id: d.factureId! } });
        const client = etats.get(d.attId)?.noms || d.client || f.facture.client_nom;
        const dossier = nomDossier(d.numero!, client);
        const factPdf = await creerFacturePdf({ ...f.facture, date_limite: f.facture.date_echeance }, f.items);
        let cmd: Uint8Array | Blob = d.bytes;
        if (d.signe_path) { const s = await supabase.storage.from("documents").download(d.signe_path); if (s.data) cmd = s.data; }
        const numCmd = d.numero!.replace(/[^\p{L}\d_-]+/gu, "");
        zip.file(`${dossier}/Facture_${f.facture.numero}.pdf`, factPdf);
        zip.file(`${dossier}/Commande_${numCmd}.pdf`, cmd);
        const a = atts.find((x) => x.id === d.attId);
        const ap = attPdfs.get(d.attId);
        if (ap && a) zip.file(`${dossier}/Attachement_${a.numero}.pdf`, ap);
        zip.file(`Toutes_les_factures/Facture_${f.facture.numero}_${dossier}.pdf`, factPdf);
        recap.push([d.numero, client, f.facture.numero, a?.numero ?? "", String(a?.total_ht ?? "").replace(".", ","), etats.get(d.attId)?.recu ? "oui" : "non"].join(";"));
      }
      zip.file("Recapitulatif.csv", "\ufeff" + recap.join("\n"));
      setBusy("Création du fichier ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob); const lien = document.createElement("a");
      lien.href = url; lien.download = `dossiers-plateforme-${choisis.length}-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(lien); lien.click(); lien.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success(`${choisis.length} dossier(s) prêts dans un seul fichier.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(null); setDocs([]); }
  }

  if (!dossiers.length) return null;
  const nbRecus = dossiers.filter((d) => etats.get(d.attId)?.recu).length;
  return <section className="space-y-3 rounded-md border-2 border-primary/50 bg-card p-5">
    <button type="button" aria-expanded={ouvert} onClick={() => setOuvert((v) => !v)} className="flex w-full flex-wrap items-center gap-2 text-left">
      <PackageOpen className="h-5 w-5 text-primary" /><h2 className="flex-1 text-lg font-semibold">Dossiers à déposer sur la plateforme — en un seul bloc</h2>
      <span className="text-sm text-muted-foreground">{dossiers.length} dossiers · {nbRecus} réceptionnés</span>
    </button>
    {ouvert && <>
      <p className="text-sm text-muted-foreground">Chaque dossier contient la facture, le bon de commande (version signée si elle existe) et l’attachement. Les dossiers réceptionnés sont cochés ; décochez ceux à ne pas envoyer. Rien n’est modifié ni envoyé.</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 font-semibold"><Checkbox checked={coches.length === dossiers.length} onCheckedChange={(v) => cocher(v === true ? dossiers.map((d) => d.id) : [])} /> Tout cocher</label>
        <Button type="button" size="sm" variant="outline" onClick={() => cocher(dossiers.filter((d) => etats.get(d.attId)?.recu).map((d) => d.id))}>Seulement les réceptionnés</Button>
        <label className="flex items-center gap-2"><Checkbox checked={avecAtt} onCheckedChange={(v) => setAvecAtt(v === true)} /> Inclure les attachements PDF</label>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-64 flex-1 text-xs text-muted-foreground">Ou collez les numéros de commande du tableau du client (CST…)
          <Textarea className="mt-1.5 min-h-16" value={colle} onChange={(e) => setColle(e.target.value)} placeholder="CST02048127 CST02048129 …" />
        </label>
        <Button type="button" size="sm" variant="outline" disabled={!numerosColles(colle).length} onClick={() => { const n = numerosColles(colle); const ids = selectionParNumeros(dossiers, n); cocher(ids); toast.info(`${ids.length} dossier(s) cochés sur ${n.length} numéro(s) collé(s).`); }}>Cocher ces commandes ({numerosColles(colle).length})</Button>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {dossiers.map((d) => { const a = atts.find((x) => x.id === d.attId); const e = etats.get(d.attId); return <li key={d.id}><label className="flex cursor-pointer flex-wrap items-center gap-3 px-3 py-2 text-sm">
          <Checkbox checked={coches.includes(d.id)} onCheckedChange={(v) => cocher(v === true ? [...coches, d.id] : coches.filter((x) => x !== d.id))} />
          <span className="font-mono text-xs">{d.numero}</span>
          <strong className="text-base">{e?.noms || d.client || a?.numero}</strong>
          <span className="text-xs text-muted-foreground">{a?.numero}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e?.recu ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>{e ? (e.recu ? "Réceptionné" : "Pas réceptionné") : "…"}</span>
          <strong className="ml-auto text-dashboard-green">{euro(a?.total_ht ?? 0)} HT</strong>
        </label></li>; })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{choisis.length} dossier(s) · <span className="text-dashboard-green">{euro(total)} HT</span></strong>
        <Button disabled={!!busy || !choisis.length} onClick={() => void telecharger()}>{busy ? <Loader2 className="animate-spin" /> : <Download />} {busy ?? `Télécharger le bloc (${choisis.length})`}</Button>
      </div>
    </>}
    <div ref={stage} className="attachment-export-stage" aria-hidden="true">{docs.map((doc) => <AttachementPrint key={doc.attachement.id} doc={doc.attachement} items={doc.items} />)}</div>
  </section>;
}
