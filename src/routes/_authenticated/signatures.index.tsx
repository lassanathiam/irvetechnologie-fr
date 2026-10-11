import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, ExternalLink, FileText, FolderLock, Loader2, PenLine, Send } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { listSignaturesClients, type SignatureClient } from "@/lib/signatures.functions";
import { dateFr } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/signatures/")({
  head: () => ({
    meta: [
      { title: "Signatures clients — Espace pro" },
      {
        name: "description",
        content: "Tous les PV, devis et documents signés par les clients, prêts à transmettre.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignaturesPage,
});

const KIND_META: Record<SignatureClient["kind"], { label: string; icon: typeof FileText }> = {
  pv: { label: "PV / Rapport", icon: ClipboardCheck },
  devis: { label: "Devis", icon: FileText },
  document: { label: "Document", icon: FolderLock },
};

function heureFr(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function SignaturesPage() {
  const fetchListe = useServerFn(listSignaturesClients);
  const liste = useQuery({ queryKey: ["signatures-clients"], queryFn: () => fetchListe() });
  const rows = liste.data ?? [];

  return (
    <ProShell titre="Signatures clients">
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <PenLine className="h-5 w-5 text-primary" /> Signatures clients
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tous les PV, devis et documents signés par les clients. Ouvrez le lien pour vérifier puis transmettre au
            donneur d'ordre.
          </p>
        </div>

        {liste.isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        )}
        {liste.isError && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Impossible de charger les signatures.
          </p>
        )}
        {!liste.isLoading && rows.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Aucun document signé pour le moment. Dès qu'un client signe un PV, un devis ou un document, il apparaît ici.
          </p>
        )}

        <ul className="space-y-2">
          {rows.map((s) => {
            const Meta = KIND_META[s.kind];
            const Icon = Meta.icon;
            return (
              <li key={`${s.kind}-${s.id}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Icon className="h-3.5 w-3.5" /> {Meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Signé
                  </span>
                  {s.transmis_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <Send className="h-3 w-3" /> Transmis le {dateFr(s.transmis_at)}
                    </span>
                  )}
                </div>
                <p className="mt-2 font-medium text-foreground">{s.client}</p>
                <p className="text-sm text-muted-foreground">{s.titre}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Signé{s.signe_par ? ` par ${s.signe_par}` : ""} le {dateFr(s.signe_at)} à {heureFr(s.signe_at)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.kind === "document" ? (
                    <Link
                      to="/documents"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <ExternalLink className="h-4 w-4" /> Ouvrir le document
                    </Link>
                  ) : (
                    <a
                      href={s.lien}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                    >
                      <ExternalLink className="h-4 w-4" /> Voir le document signé
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ProShell>
  );
}
