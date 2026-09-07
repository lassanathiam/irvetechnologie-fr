import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Mail, Printer, Receipt } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { DocumentPrint } from "@/components/DocumentPrint";
import {
  convertirEnFacture,
  envoyerDevis,
  getDevis,
  listEnvoisDevis,
  updateStatutDevis,
} from "@/lib/devis.functions";

export const Route = createFileRoute("/_authenticated/devis/$id")({
  head: () => ({
    meta: [
      { title: "Devis — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Aperçu, envoi et conversion en facture du devis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevisDetail,
});

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "a_valider", label: "À valider" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
] as const;

function DevisDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchDevis = useServerFn(getDevis);
  const sendFn = useServerFn(envoyerDevis);
  const statutFn = useServerFn(updateStatutDevis);
  const convertFn = useServerFn(convertirEnFacture);
  const envoisFn = useServerFn(listEnvoisDevis);

  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({ queryKey: ["devis", id], queryFn: () => fetchDevis({ data: { id } }) });
  const envois = useQuery({
    queryKey: ["devis-envois", id],
    queryFn: () => envoisFn({ data: { id } }),
  });

  const send = useMutation({
    mutationFn: () => sendFn({ data: { id, message: message || null } }),
    onSuccess: (res) => {
      setError(null);
      setFeedback(
        res.sent
          ? "Devis envoyé au client par email."
          : "Adresse email bloquée (désinscription) — envoi non effectué.",
      );
      qc.invalidateQueries({ queryKey: ["devis"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Envoi impossible."),
  });

  const convert = useMutation({
    mutationFn: () => convertFn({ data: { id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      navigate({ to: "/factures/$id", params: { id: res.id } });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Conversion impossible."),
  });

  const statut = useMutation({
    mutationFn: (value: string) => statutFn({ data: { id, statut: value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devis", id] });
      qc.invalidateQueries({ queryKey: ["devis"] });
    },
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
        <p className="text-sm text-destructive">Devis introuvable.</p>
      </ProShell>
    );
  }

  const { devis, items } = query.data;

  return (
    <ProShell>
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/devis"
            className="text-mono text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Devis
          </Link>
          <span className="text-mono text-xs text-primary">{devis.numero}</span>
          <select
            value={devis.statut}
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
          {devis.facture_id ? (
            <Link
              to="/factures/$id"
              params={{ id: devis.facture_id }}
              className="border border-border rounded-sm px-4 py-2 text-mono text-xs text-primary inline-flex items-center gap-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Voir la facture
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => convert.mutate()}
              disabled={convert.isPending}
              className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {convert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
              Convertir en facture
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="border border-border rounded-sm bg-card p-6 space-y-3">
            <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Envoyer au client
            </h2>
            <p className="text-sm text-muted-foreground">
              {devis.client_email
                ? `Destinataire : ${devis.client_email}`
                : "Aucune adresse email sur ce devis — ajoutez-la pour pouvoir l'envoyer."}
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
                disabled={!devis.client_email || send.isPending}
                onClick={() => {
                  setFeedback(null);
                  setError(null);
                  send.mutate();
                }}
                className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Envoyer le devis
              </button>
              {devis.sent_at && (
                <span className="text-mono text-xs text-muted-foreground">
                  Dernier envoi : {new Date(devis.sent_at).toLocaleString("fr-FR")}
                </span>
              )}
            </div>
            {feedback && <p className="text-mono text-xs text-primary">{feedback}</p>}
            {error && <p className="text-mono text-xs text-destructive">{error}</p>}

            <div className="pt-4 border-t border-border space-y-2">
              <div className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Lien client (consultation, PDF, signature)
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

          <div className="space-y-6">
            <div className="border border-border rounded-sm bg-card p-6 space-y-2">
              <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Suivi de signature
              </h2>
              <TrackRow
                label="Envoyé"
                value={devis.sent_at ? new Date(devis.sent_at).toLocaleString("fr-FR") : null}
              />
              <TrackRow
                label="Ouvert par le client"
                value={devis.viewed_at ? new Date(devis.viewed_at).toLocaleString("fr-FR") : null}
              />
              <TrackRow
                label="Signé en ligne"
                value={
                  devis.signed_at
                    ? `${devis.signataire_nom ?? "Client"} — ${new Date(devis.signed_at).toLocaleString("fr-FR")}`
                    : null
                }
              />
              {devis.signature_client && (
                <img
                  src={devis.signature_client}
                  alt="Signature du client"
                  className="mt-2 h-16 w-full object-contain object-left bg-background border border-border rounded-sm"
                />
              )}
            </div>

            <div className="border border-border rounded-sm bg-card p-6 space-y-3">
              <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Historique d&apos;envois
              </h2>
              {(envois.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun envoi enregistré.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(envois.data ?? []).map((e) => (
                    <li key={e.id} className="text-[12px] border-b border-border pb-2 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-mono font-bold">
                          {new Date(e.created_at).toLocaleString("fr-FR")}
                        </span>
                        <span
                          className={
                            e.resultat === "envoye"
                              ? "text-mono text-[10px] text-primary uppercase"
                              : "text-mono text-[10px] text-destructive uppercase"
                          }
                        >
                          {e.resultat === "envoye" ? "Envoyé" : "Bloqué"}
                        </span>
                      </div>
                      <div className="text-muted-foreground">{e.destinataire}</div>
                      {e.message && <div className="text-muted-foreground italic">{e.message}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 print:mt-0">
        <DocumentPrint
          type="devis"
          doc={{
            numero: devis.numero,
            date_emission: devis.date_emission,
            date_limite: devis.date_expiration,
            client_nom: devis.client_nom,
            client_email: devis.client_email,
            client_telephone: devis.client_telephone,
            client_adresse: devis.client_adresse,
            client_cp_ville: devis.client_cp_ville,
            objet: devis.objet,
            remise_pct: devis.remise_pct,
            acompte_pct: devis.acompte_pct,
            conditions_paiement: devis.conditions_paiement,
            notes: devis.notes,
          }}
          items={items}
          signature={{
            signature_client: devis.signature_client,
            signataire_nom: devis.signataire_nom,
            signed_at: devis.signed_at,
          }}
        />
      </div>
    </ProShell>
  );
}
