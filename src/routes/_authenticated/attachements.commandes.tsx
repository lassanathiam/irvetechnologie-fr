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
import { choisirAttachementCommande } from "@/lib/commande-ecart";
import { RapportEcartCommande } from "@/components/RapportEcartCommande";

export const Route = createFileRoute("/_authenticated/attachements/commandes")({
  head: () => ({
    meta: [
      { title: "Commandes et rapports d’écart — IRVE Technologie" },
      { name: "description", content: "Commandes ENSIO, AXIANS et autres donneurs d’ordre : rapports d’écart, signature et facturation." },
      { property: "og:title", content: "Commandes et rapports d’écart — IRVE Technologie" },
      { property: "og:description", content: "Vérification des commandes, rapports d’écart détaillés et factures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Att = Awaited<ReturnType<typeof trouverAttachementsCommandes>>[number];
type Ligne = { nom: string; bytes: Uint8Array; lu: CommandeLue; attId: string; choix: "" | "commande" | "attachement"; signe?: Uint8Array; factureId?: string; erreur?: string };

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

async function texteDuPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const textes: string[] = [];
    for (let index = 1; index <= doc.numPages; index++) {
      const page = await doc.getPage(index);
      const c = await page.getTextContent();
      textes.push(c.items.map((i: any) => i.str).join(" "));
    }
    return textes.join(" ");
  } finally { await doc.destroy(); }
}

function associer(lu: CommandeLue, atts: Att[]): string {
  return choisirAttachementCommande(lu, atts, cleNom);
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
        nouvelles.push({ nom: f.name, bytes, lu: { ...lu, numero: lu.numero ?? f.name.replace(/\.pdf$/i, "").replace(/^CST\s*/i, "CST ") }, attId: associer(lu, liste), choix: "" });
      }
      setLignes((l) => [...l, ...nouvelles.filter((n) => !l.some((x) => x.nom === n.nom))]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Lecture impossible."); }
    finally { setBusy(null); }
  }

  const maj = (i: number, p: Partial<Ligne>) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function toutTraiter() {
    const { signerCommande } = await import("@/lib/commande-signature");
    let ok = 0;
    for (const [i, l] of lignes.entries()) {
      if (l.factureId || !l.attId) continue;
      const att = atts.find((a) => a.id === l.attId);
      const numero = l.lu.numero?.trim();
      if (!att || !numero || l.lu.montantHt === null) { maj(i, { erreur: "Vérifiez le numéro, le montant HT et l’attachement." }); continue; }
      const ecart = Math.abs(l.lu.montantHt - att.total_ht) >= 0.01;
      if (ecart && !l.choix) { maj(i, { erreur: "Choisissez le montant à retenir pour cet écart avant de facturer." }); continue; }
      if (lignes.some((autre, j) => j !== i && autre.attId === l.attId)) { maj(i, { erreur: "Deux commandes ciblent le même attachement : vérifiez l’association." }); continue; }
      setBusy(`Signature et facture ${i + 1}/${lignes.length}…`);
      try {
        const signe = await signerCommande(l.bytes);
        const r = await appliquer({ data: { id: l.attId, bon_commande: numero, montant_ht: ecart && l.choix === "commande" ? l.lu.montantHt : null } });
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
        if (!l.factureId || !l.signe || !l.lu.numero) continue;
        setBusy(`Préparation du dossier ${i + 1}/${prets.length}…`);
        const f = await lireFacture({ data: { id: l.factureId } });
        setRendu(f);
        await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
        await document.fonts.ready;
        const el = stage.current?.firstElementChild;
        if (!(el instanceof HTMLElement)) throw new Error("La facture n’est pas encore prête.");
        await Promise.all(Array.from(el.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff", windowWidth: 1280, onclone: (_d, c) => { c.classList.add("pdf-render"); c.style.width = "800px"; } });
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const w = 200, h = (canvas.height * w) / canvas.width;
        const ratio = h > 287 ? 287 / h : 1;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 5 + (w - w * ratio) / 2, 5, w * ratio, h * ratio);
        const dossier = `${l.lu.numero.replace(/[^\p{L}\d_-]+/gu, "")}_${(l.lu.client ?? f.facture.client_nom).replace(/[^\p{L}\d]+/gu, "-")}`;
        zip.file(`${dossier}/Facture_${f.facture.numero}.pdf`, pdf.output("arraybuffer"));
        zip.file(`${dossier}/Commande_${l.lu.numero.replace(/[^\p{L}\d_-]+/gu, "")}_signee.pdf`, l.signe);
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

  const aTraiter = lignes.filter((l) => {
    const att = atts.find((a) => a.id === l.attId);
    return !l.factureId && att && l.lu.numero?.trim() && l.lu.montantHt !== null && (Math.abs(l.lu.montantHt - att.total_ht) < 0.01 || l.choix);
  }).length;
  const prets = lignes.filter((l) => l.factureId).length;

  return (
    <ProShell>
      <div className="space-y-6">
        <header>
          <Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Attachements</Link>
          <h1 className="mt-2 text-3xl font-semibold">Bons de commande</h1>
          <p className="mt-1 text-sm text-muted-foreground">ENSIO · AXIANS · Autres donneurs d’ordre</p>
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
                  <div key={l.nom + i} className="flex min-w-0 flex-wrap items-center gap-3 p-4 text-sm">
                  {l.factureId ? <CheckCircle2 className="h-5 w-5 text-primary" /> : !l.attId ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <PenLine className="h-5 w-5 text-muted-foreground" />}
                  <div className="min-w-40">
                    <label className="block text-xs text-muted-foreground">Numéro de commande<input aria-label={`Numéro de commande ${i + 1}`} className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" maxLength={60} disabled={!!l.factureId} value={l.lu.numero ?? ""} onChange={(e) => maj(i, { lu: { ...l.lu, numero: e.target.value } })} /></label>
                    <div className="text-muted-foreground">{l.lu.client ?? l.nom} · {l.lu.montantHt !== null ? euro(l.lu.montantHt) : "montant ?"} HT</div>
                  </div>
                  <label className="text-xs text-muted-foreground">Montant HT<input aria-label={`Montant HT commande ${i + 1}`} className="mt-1 block w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" type="number" min={0} max={1000000} step="0.01" disabled={!!l.factureId} value={l.lu.montantHt ?? ""} onChange={(e) => maj(i, { lu: { ...l.lu, montantHt: e.target.value === "" ? null : Number(e.target.value) }, choix: "" })} /></label>
                  <select aria-label={`Attachement commande ${i + 1}`} className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 sm:w-auto sm:max-w-full" disabled={!!l.factureId} value={l.attId} onChange={(e) => maj(i, { attId: e.target.value, choix: "" })}>
                    <option value="">— Choisir l’attachement —</option>
                    {atts.map((a) => <option key={a.id} value={a.id}>{a.client_nom} · {a.numero} · {a.objet} · {euro(a.total_ht)}{a.facture_id ? " · facturé" : ""}{a.bon_commande ? ` · ${a.bon_commande}` : ""}</option>)}
                  </select>
                  {ecart && att && !l.factureId && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1">
                      <span>Écart : attachement {euro(att.total_ht)}</span>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "commande"} onChange={() => maj(i, { choix: "commande" })} /> Prendre la commande</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "attachement"} onChange={() => maj(i, { choix: "attachement" })} /> Garder l’attachement</label>
                    </div>
                  )}
                  {ecart && att && !l.factureId && l.lu.montantHt !== null && l.lu.numero?.trim() && <RapportEcartCommande id={att.id} numero={l.lu.numero} montantHt={l.lu.montantHt} />}
                  {l.factureId && <Link to="/factures/$id" params={{ id: l.factureId }} className="text-primary underline">Facture créée</Link>}
                  {l.erreur && <span className="text-destructive">{l.erreur}</span>}
                  {!l.factureId && <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))}>Retirer</Button>}
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
