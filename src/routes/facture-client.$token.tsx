import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Printer } from "lucide-react";
import { DocumentPrint } from "@/components/DocumentPrint";
import { BrandLogo } from "@/components/BrandLogo";
import { getFacturePublic } from "@/lib/factures-public.functions";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/facture-client/$token")({
  head: () => ({
    meta: [
      { title: "Votre facture — Borne de l'Ouest" },
      {
        name: "description",
        content: "Consultez et téléchargez votre facture d'installation de borne de recharge.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Votre facture — Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Consultez et téléchargez votre facture d'installation de borne de recharge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FactureClientPage,
});

function FactureClientPage() {
  const { token } = Route.useParams();
  const fetchFacture = useServerFn(getFacturePublic);

  const query = useQuery({
    queryKey: ["facture-public", token],
    queryFn: () => fetchFacture({ data: { token } }),
    retry: false,
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
          <h1 className="mt-6 text-2xl font-extrabold">Lien de facture invalide</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ce lien a expiré ou n&apos;existe plus. Contactez-nous au {COMPANY.telephone}.
          </p>
        </div>
      </main>
    );
  }

  const { facture, items } = query.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="print:hidden border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <BrandLogo className="h-11 w-11" />
          <div>
            <div className="text-base font-extrabold tracking-tight">Borne de l&apos;Ouest</div>
            <div className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              {COMPANY.raisonSociale} · Facture {facture.numero}
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
        {facture.paid_at ? (
          <div className="print:hidden border border-primary/50 bg-primary/10 rounded-sm p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Facture réglée — merci !</div>
              <p className="text-sm text-muted-foreground mt-1">
                Paiement enregistré le {new Date(facture.paid_at).toLocaleDateString("fr-FR")}.
              </p>
            </div>
          </div>
        ) : null}

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
            numero_ticket: facture.numero_ticket,
            numero_affaire: facture.numero_affaire,
            bon_commande: facture.bon_commande,
            autoliquidation: facture.autoliquidation,
          }}
          items={items}
        />

        <p className="print:hidden text-center text-[12px] text-muted-foreground">
          Une question ? {COMPANY.email} · {COMPANY.telephone} · {COMPANY.telephone2}
        </p>
      </div>
    </main>
  );
}
