import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileUp, Loader2, PenLine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { DocumentPrint } from "@/components/DocumentPrint";
import { appliquerCommandeAttachement, trouverAttachementsCommandes } from "@/lib/attachements.functions";
import { getFacture } from "@/lib/factures.functions";
import { cleNom, lireCommande, type CommandeLue } from "@/lib/commandes-ensio";

export const Route = createFileRoute("/_authenticated/attachements/commandes")({
  head: () => ({
    meta: [
      { title: "Bons de commande ENSIO — IRVE Technologie" },
      { name: "description", content: "Importer les bons de commande, les signer, les rattacher aux attachements et créer les factures." },
      { property: "og:title", content: "Bons de commande ENSIO — IRVE Technologie" },
      { property: "og:description", content: "Commandes signées et factures prêtes à déposer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Att = Awaited<ReturnType<typeof trouverAttachementsCommandes>>[number];
type Ligne = { nom: string; bytes: Uint8Array; lu: CommandeLue; attId: string; choix: "commande" | "attachement"; signe?: Uint8Array; factureId?: string; erreur?: string };

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

async function texteDuPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const page = await doc.getPage(1);
  const c = await page.getTextContent();
  return c.items.map((i: any) => i.str).join(" ");
}

function associer(lu: CommandeLue, atts: Att[]): string {
  if (lu.attachement) { const a = atts.find((x) => x.numero.toUpperCase() === lu.attachement); if (a) return a.id; }
  if (lu.client) {
    const k = cleNom(lu.client);
    const libres = atts.filter((x) => !x.bon_commande);
    const a = libres.find((x) => cleNom(`${x.client_nom} ${x.texte}`).includes(k)) ?? atts.find((x) => cleNom(`${x.client_nom} ${x.texte}`).includes(k));
    if (a) return a.id;
  }
  return "";
}

function Page() {
  const trouver = useServerFn(trouverAttachementsCommandes);
  const appliquer = useServerFn(appliquerCommandeAttachement);
  const lireFacture = useServerFn(getFacture);
  const [atts, setAtts] = useState<Att[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [rendu, setRendu] = useState<Awaited<ReturnType<typeof getFacture>> | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  async function importer(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    setBusy("Lecture des commandes…");
    try {
      const liste = atts.length ? atts : await trouver({ data: { numeros: [] } });
      setAtts(liste);
      const nouvelles: Ligne[] = [];
      for (const f of pdfs) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        let lu: CommandeLue = { numero: null, attachement: null, client: null, montantHt: null };
        try { lu = lireCommande(await texteDuPdf(bytes)); } catch { /* lecture impossible : saisie manuelle */ }
        nouvelles.push({ nom: f.name, bytes, lu: { ...lu, numero: lu.numero ?? f.name.replace(/\.pdf$/i, "").replace(/^CST\s*/i, "CST ") }, attId: associer(lu, liste), choix: "attachement" });
      }
      setLignes((l) => [...l, ...nouvelles.filter((n) => !l.some((x) => x.lu.numero === n.lu.numero))]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Lecture impossible."); }
    finally { setBusy(null); }
  }

  const maj = (i: number, p: Partial<Ligne>) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function toutTraiter() {
    const { signerCommande } = await import("@/lib/commande-signature");
    let ok = 0;
    for (const [i, l] of lignes.entries()) {
      if (l.factureId || !l.attId) continue;
      setBusy(`Signature et facture ${i + 1}/${lignes.length}…`);
      try {
        const signe = await signerCommande(l.bytes);
        const att = atts.find((a) => a.id === l.attId)!;
        const ecart = l.lu.montantHt !== null && Math.abs(l.lu.montantHt - att.total_ht) >= 0.01;
        const r = await appliquer({ data: { id: l.attId, bon_commande: l.lu.numero!, montant_ht: ecart && l.choix === "commande" ? l.lu.montantHt : null } });
        maj(i, { signe, factureId: r.id, erreur: undefined });
        ok++;
      } catch (e) { maj(i, { erreur: e instanceof Error ? e.message : "Erreur" }); }
    }
    setBusy(null);
    if (ok) toast.success(`${ok} commande(s) signée(s) et facture(s) créée(s).`);
  }

  async function telecharger() {
    const prets = lignes.filter((l) => l.signe && l.factureId);
    if (!prets.length) return;
    const [{ default: JSZip }, { default: html2canvas }, { jsPDF }] = await Promise.all([import("jszip"), import("html2canvas-pro"), import("jspdf")]);
    const zip = new JSZip();
    try {
      for (const [i, l] of prets.entries()) {
        setBusy(`Préparation du dossier ${i + 1}/${prets.length}…`);
        const f = await lireFacture({ data: { id: l.factureId! } });
        setRendu(f);
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await document.fonts.ready;
        const el = stage.current?.firstElementChild as HTMLElement;
        await Promise.all(Array.from(el.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 1280, onclone: (_d, c) => { c.classList.add("pdf-render"); c.style.width = "800px"; } });
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const w = 200, h = (canvas.height * w) / canvas.width;
        const ratio = h > 287 ? 287 / h : 1;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 5 + (w - w * ratio) / 2, 5, w * ratio, h * ratio);
        const dossier = `${l.lu.numero!.replace(/\s+/g, "")}_${(l.lu.client ?? f.facture.client_nom).replace(/[^\p{L}\d]+/gu, "-")}`;
        zip.file(`${dossier}/Facture_${f.facture.numero}.pdf`, pdf.output("arraybuffer"));
        zip.file(`${dossier}/Commande_${l.lu.numero!.replace(/\s+/g, "")}_signee.pdf`, l.signe!);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `commandes-factures-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(null); setRendu(null); }
  }

  const aTraiter = lignes.filter((l) => !l.factureId && l.attId).length;
  const prets = lignes.filter((l) => l.factureId).length;

  return (
    <ProShell>
      <div className="space-y-6">
        <header>
          <Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Attachements</Link>
          <h1 className="mt-2 text-3xl font-semibold">Bons de commande ENSIO</h1>
          <p className="mt-1 text-sm text-muted-foreground">1. Déposez toutes les commandes · 2. Vérifiez · 3. Signez et facturez tout · 4. Téléchargez le dossier (une facture + sa commande signée par chantier).</p>
        </header>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void importer(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-8 text-center"
        >
          <FileUp className="h-8 w-8 text-primary" />
          <strong>Glissez ici toutes les commandes PDF</strong>
          <span className="text-sm text-muted-foreground">ou touchez pour les choisir (plusieurs à la fois)</span>
          <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => { if (e.target.files) void importer(e.target.files); e.target.value = ""; }} />
        </div>

        {busy && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p>}

        {lignes.length > 0 && (
          <section className="divide-y divide-border rounded-md border border-border bg-card">
            {lignes.map((l, i) => {
              const att = atts.find((a) => a.id === l.attId);
              const ecart = att && l.lu.montantHt !== null && Math.abs(l.lu.montantHt - att.total_ht) >= 0.01;
              return (
                <div key={l.lu.numero! + i} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                  {l.factureId ? <CheckCircle2 className="h-5 w-5 text-primary" /> : !l.attId ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <PenLine className="h-5 w-5 text-muted-foreground" />}
                  <div className="min-w-40">
                    <strong>{l.lu.numero}</strong>
                    <div className="text-muted-foreground">{l.lu.client ?? l.nom} · {l.lu.montantHt !== null ? euro(l.lu.montantHt) : "montant ?"} HT</div>
                  </div>
                  <select className="min-w-56 rounded-md border border-border bg-background px-2 py-1.5" disabled={!!l.factureId} value={l.attId} onChange={(e) => maj(i, { attId: e.target.value })}>
                    <option value="">— Choisir l’attachement —</option>
                    {atts.map((a) => <option key={a.id} value={a.id}>{a.numero} · {euro(a.total_ht)}{a.facture_id ? " · facturé" : ""}{a.bon_commande ? ` · ${a.bon_commande}` : ""}</option>)}
                  </select>
                  {ecart && !l.factureId && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1">
                      <span>Écart : attachement {euro(att!.total_ht)}</span>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "commande"} onChange={() => maj(i, { choix: "commande" })} /> Prendre la commande</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "attachement"} onChange={() => maj(i, { choix: "attachement" })} /> Garder l’attachement</label>
                    </div>
                  )}
                  {l.factureId && <Link to="/factures/$id" params={{ id: l.factureId }} className="text-primary underline">Facture créée</Link>}
                  {l.erreur && <span className="text-destructive">{l.erreur}</span>}
                  {!l.factureId && <button type="button" className="ml-auto text-xs text-muted-foreground underline" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}>Retirer</button>}
                </div>
              );
            })}
          </section>
        )}

        {lignes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy || !aTraiter} onClick={() => void toutTraiter()}><PenLine /> Signer et facturer tout ({aTraiter})</Button>
            <Button variant="outline" disabled={!!busy || !prets} onClick={() => void telecharger()}><Download /> Télécharger le dossier ({prets})</Button>
          </div>
        )}
      </div>
      <div ref={stage} className="attachment-export-stage" aria-hidden="true">
        {rendu && (
          <div className="bg-white">
            <DocumentPrint type="facture" doc={{ ...rendu.facture, date_limite: rendu.facture.date_echeance, acompte_pct: 0 }} items={rendu.items} />
          </div>
        )}
      </div>
    </ProShell>
  );
}
