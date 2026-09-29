import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { FileSignature, FolderOpen, Loader2, Search, Trash2, Upload } from "lucide-react";
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
  if (file.type === "application/pdf") return new Uint8Array(await file.arrayBuffer());
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
  const input = useRef<HTMLInputElement | null>(null);

  const liste = useMemo(
    () => data.filter((d) => (dossier === "tous" || d.dossier === dossier) && d.nom.toLowerCase().includes(q.toLowerCase())),
    [data, dossier, q],
  );

  const importer = async (files: FileList | null) => {
    if (!files?.length) return;
    setEnvoi(true);
    try {
      for (const f of Array.from(files)) {
        const pdf = await versPdf(f);
        const path = `${cible}/${crypto.randomUUID()}.pdf`;
        const { error } = await supabase.storage.from("documents").upload(path, pdf, { contentType: "application/pdf" });
        if (error) throw new Error(error.message);
        await creer({ data: { dossier: cible, nom: f.name.replace(/\.(pdf|jpe?g|png)$/i, ""), storage_path: path, mime: "application/pdf", taille: pdf.byteLength } });
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Documents</h1>
            <p className="text-sm text-muted-foreground">Rangez vos documents importants et faites-les signer en ligne.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={cible} onChange={(e) => setCible(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="Dossier de rangement">
              {DOSSIERS.map((d) => <option key={d.cle} value={d.cle}>{d.label}</option>)}
            </select>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" multiple hidden onChange={(e) => importer(e.target.files)} />
            <Button onClick={() => input.current?.click()} disabled={envoi}>
              {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Ajouter un document
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[{ cle: "tous", label: "Tous" }, ...DOSSIERS].map((d) => (
            <button key={d.cle} type="button" onClick={() => setDossier(d.cle)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${dossier === d.cle ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {d.label} ({d.cle === "tous" ? data.length : data.filter((x) => x.dossier === d.cle).length})
            </button>
          ))}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un document" className="pl-9" />
        </div>

        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Chargement…</p>
          ) : liste.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <FolderOpen className="h-8 w-8" />
              <p className="text-sm">Aucun document ici. Ajoutez un PDF ou une photo.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {liste.map((d) => {
                const st = STATUT_DOC[d.statut] ?? STATUT_DOC["brouillon"]!;
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                    <FileSignature className="h-5 w-5 shrink-0 text-primary" />
                    <Link to="/documents/$id" params={{ id: d.id }} className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{d.nom}</span>
                      <span className="block text-xs text-muted-foreground">
                        {DOSSIERS.find((x) => x.cle === d.dossier)?.label ?? d.dossier} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                        {d.viewed_at && d.statut !== "signe" ? ` · Lu le ${new Date(d.viewed_at).toLocaleDateString("fr-FR")}` : ""}
                        {d.signed_at ? ` · Signé le ${new Date(d.signed_at).toLocaleDateString("fr-FR")}` : ""}
                      </span>
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    <Button variant="ghost" size="icon" aria-label="Supprimer" onClick={() => confirm(`Supprimer « ${d.nom} » ?`) && supprimer.mutate(d.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
