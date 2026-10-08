import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { decouperDossier } from "@/lib/reorder";
import { ChevronRight, FileCheck2, FileClock, FileSignature, FolderOpen, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { DOSSIERS, STATUT_DOC } from "@/lib/documents";
import { creerDocument, listDocuments, supprimerDocument } from "@/lib/documents.functions";

export const Route = createFileRoute("/_authenticated/documents/")({
  head: () => ({
    meta: [
      { title: "Documents — IRVE Technologie Pro" },
      { name: "description", content: "Rangement et signature électronique des documents importants." },
      { property: "og:title", content: "Documents — IRVE Technologie Pro" },
      { property: "og:description", content: "Rangement et signature électronique des documents importants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentsPage,
});

async function versPdf(file: File): Promise<Uint8Array> {
  if (file.type === "application/pdf") {
    const { pdfSignable } = await import("@/lib/pdf-signable");
    return (await pdfSignable(new Uint8Array(await file.arrayBuffer()))).bytes;
  }
  if (file.type === "image/jpeg" || file.type === "image/png") {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = file.type === "image/png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const W = 595, H = 842;
    const r = Math.min((W - 40) / img.width, (H - 40) / img.height);
    const page = doc.addPage([W, H]);
    page.drawImage(img, { x: (W - img.width * r) / 2, y: (H - img.height * r) / 2, width: img.width * r, height: img.height * r });
    return await doc.save();
  }
  throw new Error("Format non accepté : utilisez un PDF ou une photo (JPG/PNG). Pour Word, enregistrez d'abord en PDF.");
}

function DocumentsPage() {
  const qc = useQueryClient();
  const lister = useServerFn(listDocuments);
  const creer = useServerFn(creerDocument);
  const suppr = useServerFn(supprimerDocument);
  const { data = [], isLoading } = useQuery({ queryKey: ["documents"], queryFn: () => lister() });
  const [dossier, setDossier] = useState<string>("tous");
  const [q, setQ] = useState("");
  const [cible, setCible] = useState<string>("contrats");
  const [envoi, setEnvoi] = useState(false);
  const [sous, setSous] = useState<string>("");
  const [cibleSous, setCibleSous] = useState<string>("");
  const [locaux, setLocaux] = useState<Record<string, string[]>>({});
  useEffect(() => {
    try { setLocaux(JSON.parse(localStorage.getItem("irve-sous-dossiers") || "{}")); } catch { /* ignore */ }
  }, []);
  const sousDe = (parent: string) => {
    const set = new Set<string>(locaux[parent] ?? []);
    for (const d of data) { const x = decouperDossier(d.dossier); if (x.parent === parent && x.sous) set.add(x.sous); }
    return [...set].sort((a, b) => a.localeCompare(b, "fr"));
  };
  const nouveauSous = (parent: string) => {
    const nom = window.prompt("Nom du sous-dossier (ex. MODOP, PV chantiers)")?.trim().replace(/\//g, "-").slice(0, 60);
    if (!nom) return null;
    const next = { ...locaux, [parent]: [...new Set([...(locaux[parent] ?? []), nom])] };
    setLocaux(next);
    localStorage.setItem("irve-sous-dossiers", JSON.stringify(next));
    return nom;
  };
  const input = useRef<HTMLInputElement | null>(null);

  const liste = useMemo(
    () => data.filter((d) => (dossier === "tous" || (decouperDossier(d.dossier).parent === dossier && (!sous || decouperDossier(d.dossier).sous === sous))) && d.nom.toLowerCase().includes(q.toLowerCase())),
    [data, dossier, sous, q],
  );
  const signes = data.filter((d) => d.statut === "signe").length;
  const enAttente = data.filter((d) => d.statut === "envoye" || d.statut === "consulte").length;

  const importer = async (files: FileList | null) => {
    if (!files?.length) return;
    setEnvoi(true);
    try {
      for (const f of Array.from(files)) {
        const pdf = await versPdf(f);
        const dest = cibleSous ? `${cible}/${cibleSous}` : cible;
        const path = `${cible}/${crypto.randomUUID()}.pdf`;
        const { error } = await supabase.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
        if (error) throw new Error(error.message);
        await creer({ data: { dossier: dest, nom: f.name.replace(/\.(pdf|jpe?g|png)$/i, ""), storage_path: path, mime: "application/pdf", taille: pdf.byteLength } });
      }
      toast.success("Document ajouté");
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setEnvoi(false);
      if (input.current) input.current.value = "";
    }
  };

  const supprimer = useMutation({
    mutationFn: (id: string) => suppr({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <ProShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground">Rangez vos documents importants et faites-les signer en ligne.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Ranger dans
              <select value={cible} onChange={(e) => { setCible(e.target.value); setCibleSous(""); }} className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground sm:w-52" aria-label="Dossier de rangement">
                {DOSSIERS.map((d) => <option key={d.cle} value={d.cle}>{d.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
              Sous-dossier
              <select value={cibleSous} onChange={(e) => { if (e.target.value === "__nouveau") { const n = nouveauSous(cible); setCibleSous(n ?? cibleSous); } else setCibleSous(e.target.value); }} className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground sm:w-48" aria-label="Sous-dossier de rangement">
                <option value="">Aucun</option>
                {sousDe(cible).map((n) => <option key={n} value={n}>{n}</option>)}
                <option value="__nouveau">+ Nouveau sous-dossier…</option>
              </select>
            </label>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" multiple hidden onChange={(e) => importer(e.target.files)} />
            <Button className="w-full sm:w-auto" onClick={() => input.current?.click()} disabled={envoi}>
              {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Ajouter un document
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">Tous les documents</p>
            <p className="mt-1 text-2xl font-bold">{data.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><FileClock className="h-4 w-4" /> En attente de signature</p>
            <p className="mt-1 text-2xl font-bold">{enAttente}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><FileCheck2 className="h-4 w-4" /> Signés</p>
            <p className="mt-1 text-2xl font-bold">{signes}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Filtrer par dossier">
          {[{ cle: "tous", label: "Tous" }, ...DOSSIERS].map((d) => (
            <Button key={d.cle} type="button" size="sm" variant={dossier === d.cle ? "default" : "outline"} onClick={() => { setDossier(d.cle); setSous(""); }}>
              {d.label} ({d.cle === "tous" ? data.length : data.filter((x) => decouperDossier(x.dossier).parent === d.cle).length})
            </Button>
          ))}
        </div>
        {dossier !== "tous" && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Sous-dossiers">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Button type="button" size="sm" variant={sous === "" ? "secondary" : "ghost"} onClick={() => setSous("")}>Tout le dossier</Button>
            {sousDe(dossier).map((n) => (
              <Button key={n} type="button" size="sm" variant={sous === n ? "secondary" : "ghost"} onClick={() => setSous(n)}>
                {n} ({data.filter((x) => x.dossier === `${dossier}/${n}`).length})
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => { const n = nouveauSous(dossier); if (n) { setSous(n); setCible(dossier); setCibleSous(n); } }}>+ Nouveau sous-dossier</Button>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un document" className="pl-9" />
        </div>

        <div>
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : liste.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <FolderOpen className="h-8 w-8" />
              <p className="text-sm">Aucun document ici. Ajoutez un PDF ou une photo.</p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {liste.map((d) => {
                const st = STATUT_DOC[d.statut] ?? STATUT_DOC["brouillon"]!;
                return (
                  <li key={d.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><FileSignature className="h-5 w-5" /></div>
                    <Link to="/documents/$id" params={{ id: d.id }} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="block truncate font-semibold text-foreground">{d.nom}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {(() => { const x = decouperDossier(d.dossier); const l = DOSSIERS.find((y) => y.cle === x.parent)?.label ?? x.parent; return x.sous ? `${l} › ${x.sous}` : l; })()} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                      </span>
                      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      {d.viewed_at && d.statut !== "signe" ? <span className="ml-2 text-[11px] text-muted-foreground">Lu le {new Date(d.viewed_at).toLocaleDateString("fr-FR")}</span> : null}
                      {d.signed_at ? <span className="ml-2 text-[11px] text-muted-foreground">Signé le {new Date(d.signed_at).toLocaleDateString("fr-FR")}</span> : null}
                    </Link>
                    <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => confirm(`Supprimer « ${d.nom} » ?`) && supprimer.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </ProShell>
  );
}
