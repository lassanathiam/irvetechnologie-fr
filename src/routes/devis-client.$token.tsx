import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Printer } from "lucide-react";
import { DocumentPrint } from "@/components/DocumentPrint";
import { BrandLogo } from "@/components/BrandLogo";
import { SignaturePad } from "@/components/SignaturePad";
import { getDevisPublic, signerDevisPublic } from "@/lib/devis-public.functions";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/devis-client/$token")({
  head: () => ({
    meta: [
      { title: "Votre devis — Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Consultez, téléchargez et signez en ligne votre devis d'installation de borne de recharge.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Votre devis — Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Consultation, téléchargement et signature en ligne de votre devis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevisClientPage,
});

function DevisClientPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const fetchDevis = useServerFn(getDevisPublic);
  const signFn = useServerFn(signerDevisPublic);

  const [nom, setNom] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["devis-public", token],
    queryFn: () => fetchDevis({ data: { token } }),
    retry: false,
  });

  const sign = useMutation({
    mutationFn: () =>
      signFn({ data: { token, signataire_nom: nom.trim(), signature: signature! } }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["devis-public", token] });
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Signature impossible pour le moment."),
  });

  if (query.isLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (query.error || !query.data) {
    return (
      <main className="min-h-screen grid place-items-center bg-background px-6 text-center">
        <div>
          <BrandLogo className="h-16 w-16 mx-auto" />
          <h1 className="mt-6 text-2xl font-extrabold">Lien de devis invalide</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien a expiré ou n&apos;existe plus. Contactez-nous au {COMPANY.telephone}.
          </p>
        </div>
      </main>
    );
  }

  const { devis, items } = query.data;
  const signe = Boolean(devis.signed_at);

  return (
    <main className="min-h-screen bg-background">
      <header className="print:hidden border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <BrandLogo className="h-11 w-11" />
          <div>
            <div className="text-base font-extrabold tracking-tight">Borne de l&apos;Ouest</div>
            <div className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {COMPANY.raisonSociale} · Devis {devis.numero}
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-2"
          >
            <Printer className="h-3.5 w-3.5" /> Télécharger / Imprimer
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {signe ? (
          <div className="print:hidden border border-primary/50 bg-primary/10 rounded-sm p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Devis signé — merci !</div>
              <p className="text-sm text-muted-foreground mt-1">
                Signé par {devis.signataire_nom} le{" "}
                {new Date(devis.signed_at!).toLocaleString("fr-FR")}. Nous revenons vers vous pour
                planifier l&apos;intervention.
              </p>
            </div>
          </div>
        ) : null}

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

        {!signe ? (
          <section className="print:hidden border border-border rounded-sm bg-card p-6 space-y-4">
            <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Signer le devis en ligne
            </h2>
            <p className="text-sm text-muted-foreground">
              Votre signature vaut acceptation du devis et des conditions générales de vente
              ci-dessus (bon pour accord).
            </p>
            <label className="block">
              <span className="text-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Nom et prénom du signataire
              </span>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="mt-1.5 w-full bg-input border border-border rounded-sm px-4 py-3 text-sm"
                placeholder="Ex. Martin Dupont"
              />
            </label>
            <SignaturePad label="Votre signature" value={signature} onChange={setSignature} />
            <button
              type="button"
              disabled={nom.trim().length < 2 || !signature || sign.isPending}
              onClick={() => sign.mutate()}
              className="hero-grad text-primary-foreground text-mono text-xs px-6 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50"
            >
              {sign.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Valider ma signature
            </button>
            {error ? <p className="text-mono text-xs text-destructive">{error}</p> : null}
          </section>
        ) : null}

        <p className="print:hidden text-mono text-[11px] text-muted-foreground text-center">
          {COMPANY.raisonSociale} · {COMPANY.email} · {COMPANY.telephone}
          <br />
          {COMPANY.qualifications}
        </p>
      </div>
    </main>
  );
}
