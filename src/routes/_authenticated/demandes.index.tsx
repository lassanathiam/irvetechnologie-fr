import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck, Image as ImageIcon, Inbox, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { getPhotoUrls, listDemandes } from "@/lib/photos.functions";
import { dateFr } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/demandes/")({
  head: () => ({
    meta: [
      { title: "Demandes reçues — Espace pro IRVE Technologie" },
      {
        name: "description",
        content: "Boîte de réception des demandes clients avec les photos du tableau électrique, du cheminement et de l'emplacement de la borne.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DemandesPage,
});

const KIND_LABEL: Record<string, string> = {
  tableau: "Tableau électrique",
  cheminement: "Cheminement",
  borne: "Emplacement borne",
};

function DemandesPage() {
  const fetchDemandes = useServerFn(listDemandes);
  const demandes = useQuery({ queryKey: ["demandes"], queryFn: () => fetchDemandes() });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-mono">
            <Inbox className="h-4 w-4 text-primary" /> Demandes reçues
          </div>
          <nav className="flex items-center gap-4 text-mono text-sm">
            <Link to="/devis" className="text-muted-foreground hover:text-primary">Devis</Link>
            <Link to="/rapports" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <ClipboardCheck className="h-3.5 w-3.5" /> Rapports
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-4">
        {demandes.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : !demandes.data?.length ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
        ) : (
          demandes.data.map((d) => (
            <article key={d.id} className="bg-card border border-border rounded-sm">
              <button
                type="button"
                onClick={() => setOpen(open === d.id ? null : d.id)}
                className="w-full text-left p-5 flex items-start justify-between gap-4 flex-wrap"
              >
                <div>
                  <div className="font-medium">{d.nom}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {d.email}</span>
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {d.telephone}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {d.code_postal}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="text-mono">{dateFr(d.created_at)}</div>
                  <div className="mt-1 inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {d.photos.length} photo{d.photos.length > 1 ? "s" : ""}
                  </div>
                </div>
              </button>

              {open === d.id && (
                <div className="border-t border-border p-5 space-y-5">
                  <div className="grid sm:grid-cols-4 gap-4 text-sm">
                    <Info label="Type de bien" value={d.type_bien} />
                    <Info label="Puissance" value={d.puissance} />
                    <Info label="Installation" value={d.type_installation} />
                    <Info label="Distance" value={d.distance_m ? `${d.distance_m} m` : null} />
                  </div>
                  {d.notes && (
                    <p className="text-sm whitespace-pre-line border border-border rounded-sm p-4">{d.notes}</p>
                  )}
                  <Photos paths={d.photos} />
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Photos({ paths }: { paths: { path: string; kind: string }[] }) {
  const sign = useServerFn(getPhotoUrls);
  const urls = useQuery({
    queryKey: ["photo-urls", paths.map((p) => p.path).join("|")],
    queryFn: () => sign({ data: { paths: paths.map((p) => p.path) } }),
    enabled: paths.length > 0,
  });

  if (!paths.length) return <p className="text-xs text-muted-foreground">Aucune photo transmise.</p>;
  if (urls.isLoading) return <Loader2 className="h-4 w-4 animate-spin text-primary" />;

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {paths.map((p) => {
        const url = urls.data?.find((u) => u.path === p.path)?.url;
        return (
          <a
            key={p.path}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block border border-border rounded-sm overflow-hidden hover:border-primary transition"
          >
            <div className="aspect-[4/3] bg-secondary/40">
              {url ? <img src={url} alt={KIND_LABEL[p.kind] ?? p.kind} className="w-full h-full object-cover" /> : null}
            </div>
            <div className="px-3 py-2 text-mono text-[11px] text-muted-foreground">
              {KIND_LABEL[p.kind] ?? p.kind}
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-mono">{value || "—"}</div>
    </div>
  );
}
