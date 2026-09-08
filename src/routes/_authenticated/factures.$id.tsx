import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, FileText, Loader2, Mail, Printer } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { DocumentPrint } from "@/components/DocumentPrint";
import { EmailReceipts } from "@/components/EmailReceipts";
import {
  envoyerFacture,
  getFacture,
  updateFactureDates,
  updateFactureStatut,
} from "@/lib/factures.functions";

export const Route = createFileRoute("/_authenticated/factures/$id")({
  head: () => ({
    meta: [
      { title: "Facture — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Aperçu, envoi et suivi de paiement de la facture." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FactureDetail,
});

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoyee", label: "Envoyée" },
  { value: "payee", label: "Payée" },
  { value: "annulee", label: "Annulée" },
] as const;

function FactureDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchFacture = useServerFn(getFacture);
  const sendFn = useServerFn(envoyerFacture);
  const statutFn = useServerFn(updateFactureStatut);
  const datesFn = useServerFn(updateFactureDates);

  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["facture", id],
    queryFn: () => fetchFacture({ data: { id } }),
    retry: 1,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["facture", id] });
    qc.invalidateQueries({ queryKey: ["factures"] });
  };

  const send = useMutation({
    mutationFn: () => sendFn({ data: { id, message: message || null } }),
    onSuccess: (res) => {
      setError(null);
      setFeedback(
        res.sent
          ? "Facture envoyée au client par email."
          : "Adresse email bloquée (désinscription) — envoi non effectué.",
      );
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Envoi impossible."),
  });

  const statut = useMutation({
    mutationFn: (value: string) => statutFn({ data: { id, statut: value } }),
    onSuccess: invalidate,
  });

  const dates = useMutation({
    mutationFn: (v: { date_emission: string; date_echeance: string }) => datesFn({ data: { id, ...v } }),
    onSuccess: invalidate,
  });

  if (query.isLoading) {
    return (
      <ProShell>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </ProShell>
    );
  }
  if (query.error || !query.data) {
    return (
      <ProShell>
        <p className="text-sm text-destructive">Facture introuvable.</p>
      </ProShell>
    );
  }

  const { facture, items } = query.data;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const lienClient = `${origin}/facture-client/${facture.public_token}`;

  return (
    <ProShell>
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/factures"
            className="text-mono text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Factures
          </Link>
          <span className="text-mono text-xs text-primary">{facture.numero}</span>
          {facture.devis_id && (
            <Link
              to="/devis/$id"
              params={{ id: facture.devis_id }}
              className="text-mono text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" /> Devis d'origine
            </Link>
          )}
          <select
            value={facture.statut}
            onChange={(e) => statut.mutate(e.target.value)}
            className="ml-auto bg-input border border-border rounded-sm px-3 py-2 text-mono text-xs"
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-2"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Date de facture</span>
            <input
              type="date"
              value={facture.date_emission}
              onChange={(e) =>
                dates.mutate({ date_emission: e.target.value, date_echeance: facture.date_echeance })
              }
              className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Échéance de paiement</span>
            <input
              type="date"
              value={facture.date_echeance}
              onChange={(e) =>
                dates.mutate({ date_emission: facture.date_emission, date_echeance: e.target.value })
              }
              className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-2.5"
            />
          </label>
        </div>

        <div className="border border-border rounded-sm bg-card p-6 space-y-3">
          <h2 className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Envoyer au client
          </h2>
          <p className="text-sm text-muted-foreground">
            {facture.client_email
              ? `Destinataire : ${facture.client_email}`
              : "Aucune adresse email sur cette facture."}
          </p>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message personnalisé (optionnel)"
            className="w-full bg-input border border-border rounded-sm px-4 py-3 text-sm resize-none"
          />
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!facture.client_email || send.isPending}
              onClick={() => {
                setFeedback(null);
                setError(null);
                send.mutate();
              }}
              className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Envoyer la facture
            </button>
            {facture.sent_at && (
              <span className="text-mono text-xs text-muted-foreground">
                Dernier envoi : {new Date(facture.sent_at).toLocaleString("fr-FR")}
              </span>
            )}
            {facture.paid_at && (
              <span className="text-mono text-xs text-primary">
                Payée le {new Date(facture.paid_at).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
          {feedback && <p className="text-mono text-xs text-primary">{feedback}</p>}
          {error && <p className="text-mono text-xs text-destructive">{error}</p>}

          <div className="pt-4 border-t border-border space-y-2">
            <div className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Lien client (consultation, PDF)
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={lienClient}
                className="flex-1 bg-input border border-border rounded-sm px-3 py-2 text-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(lienClient);
                  setFeedback("Lien client copié.");
                }}
                className="border border-border rounded-sm px-3 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" /> Copier
              </button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="border border-border rounded-sm bg-card p-6 space-y-2">
            <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Suivi de lecture
            </h2>
            <TrackRow
              label="Envoyée"
              value={facture.sent_at ? new Date(facture.sent_at).toLocaleString("fr-FR") : null}
            />
            <TrackRow
              label="Première ouverture"
              value={facture.viewed_at ? new Date(facture.viewed_at).toLocaleString("fr-FR") : null}
            />
            <TrackRow
              label="Dernière ouverture"
              value={
                facture.last_viewed_at
                  ? new Date(facture.last_viewed_at).toLocaleString("fr-FR")
                  : null
              }
            />
            <TrackRow
              label="Nombre de consultations"
              value={facture.view_count ? String(facture.view_count) : null}
            />
          </div>
          <EmailReceipts email={facture.client_email} />
        </div>
      </div>

      <div className="mt-8 print:mt-0">
        <DocumentPrint
          type="facture"
          doc={{
            numero: facture.numero,
            date_emission: facture.date_emission,
            date_limite: facture.date_echeance,
            client_nom: facture.client_nom,
            client_email: facture.client_email,
            client_telephone: facture.client_telephone,
            client_adresse: facture.client_adresse,
            client_cp_ville: facture.client_cp_ville,
            objet: facture.objet,
            remise_pct: facture.remise_pct,
            acompte_pct: 0,
            conditions_paiement: facture.conditions_paiement,
            notes: facture.notes,
          }}
          items={items}
        />
      </div>
    </ProShell>
  );
}

function TrackRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px] border-b border-border pb-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? "text-mono font-bold" : "text-mono text-muted-foreground"}>
        {value ?? "—"}
      </span>
    </div>
  );
}
