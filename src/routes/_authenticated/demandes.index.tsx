import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Image as ImageIcon,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { getPhotoUrls, listDemandes } from "@/lib/photos.functions";
import { updateStatutDemande } from "@/lib/demandes-admin.functions";
import { ProShell } from "@/components/ProShell";
import { telLien, whatsappLien } from "@/lib/contact-client";
import { dateFr } from "@/lib/company";


export const Route = createFileRoute("/_authenticated/demandes/")({
  head: () => ({
    meta: [
      { title: "Demandes reçues — Espace pro IRVE Technologie" },
      {
        name: "description",
        content:
          "Boîte de réception des demandes clients avec les photos du tableau électrique, du cheminement et de l'emplacement de la borne.",
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

const STATUT: Record<string, { label: string; cls: string }> = {
  nouveau: { label: "Nouvelle", cls: "bg-primary/15 text-primary" },
  en_cours: { label: "En cours", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  accepte: { label: "Acceptée", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  refuse: { label: "Refusée", cls: "bg-destructive/15 text-destructive" },
  clos: { label: "Clôturée", cls: "bg-muted text-muted-foreground" },
};

function DemandesPage() {
  const fetchDemandes = useServerFn(listDemandes);
  const setStatutFn = useServerFn(updateStatutDemande);
  const qc = useQueryClient();
  const demandes = useQuery({ queryKey: ["demandes"], queryFn: () => fetchDemandes() });
  const [open, setOpen] = useState<string | null>(null);

  const changer = useMutation({
    mutationFn: (v: { id: string; status: string }) => setStatutFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <ProShell>
      <div className="mb-8">
        <p className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          Boîte de réception
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mt-2 flex items-center gap-2">
          <Inbox className="h-6 w-6 text-primary" /> Demandes clients
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Acceptez une demande pour créer son devis avec les coordonnées du client déjà remplies.
        </p>
      </div>

      <div className="space-y-4">
        {demandes.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : !demandes.data?.length ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
        ) : (
          demandes.data.map((d) => {
            const st = STATUT[d.status] ?? STATUT.nouveau;
            return (
              <article
                key={d.id}
                className="bg-card border border-border rounded-xl shadow-sm transition hover:border-primary/40"
              >
                <button
                  type="button"
                  onClick={() => setOpen(open === d.id ? null : d.id)}
                  className="w-full text-left p-5 flex items-start justify-between gap-4 flex-wrap"
                >
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {d.nom}
                      <span className={`text-mono text-[10px] rounded-full px-2 py-0.5 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {d.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {d.telephone}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {d.code_postal}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="text-mono">{dateFr(d.created_at)}</div>
                    <div className="mt-1 inline-flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> {d.photos.length} photo
                      {d.photos.length > 1 ? "s" : ""}
                    </div>
                  </div>
                </button>

                <div className="border-t border-border px-5 py-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changer.mutate({ id: d.id, status: "accepte" })}
                    disabled={changer.isPending || d.status === "accepte"}
                    className="text-mono text-[11px] font-bold rounded-full border border-primary/50 text-primary px-3 py-1.5 inline-flex items-center gap-1.5 transition hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accepter le client
                  </button>
                  <button
                    type="button"
                    onClick={() => changer.mutate({ id: d.id, status: "refuse" })}
                    disabled={changer.isPending || d.status === "refuse"}
                    className="text-mono text-[11px] font-bold rounded-full border border-border text-muted-foreground px-3 py-1.5 inline-flex items-center gap-1.5 transition hover:border-destructive hover:text-destructive disabled:opacity-40"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Refuser
                  </button>
                  {d.status === "accepte" && (
                    <Link
                      to="/devis"
                      search={{ demande: d.id }}
                      className="hero-grad text-primary-foreground text-mono text-[11px] font-bold rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition hover:brightness-110"
                    >
                      Créer le devis <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>

                {open === d.id && (
                  <div className="border-t border-border p-5 space-y-5">
                    <div className="grid sm:grid-cols-4 gap-4 text-sm">
                      <Info label="Type de bien" value={d.type_bien} />
                      <Info label="Puissance" value={d.puissance} />
                      <Info label="Installation" value={d.type_installation} />
                      <Info label="Distance" value={d.distance_m ? `${d.distance_m} m` : null} />
                    </div>
                    {d.notes && (
                      <p className="text-sm whitespace-pre-line border border-border rounded-lg p-4">
                        {d.notes}
                      </p>
                    )}
                    <Photos paths={d.photos} />
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </ProShell>
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
