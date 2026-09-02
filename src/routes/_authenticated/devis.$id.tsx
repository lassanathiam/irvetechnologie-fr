import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer, Zap } from "lucide-react";
import { COMPANY, LOGO_URL, dateFr, euro } from "@/lib/company";
import { getDevis } from "@/lib/devis.functions";

export const Route = createFileRoute("/_authenticated/devis/$id")({
  head: () => ({
    meta: [
      { title: "Devis — IRVE Technologie" },
      { name: "description", content: "Aperçu du devis IRVE Technologie prêt à imprimer ou envoyer." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevisDetail,
});

function DevisDetail() {
  const { id } = Route.useParams();
  const fetchDevis = useServerFn(getDevis);
  const { data, isLoading, error } = useQuery({
    queryKey: ["devis", id],
    queryFn: () => fetchDevis({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-muted-foreground">Ce devis est introuvable.</p>
          <Link to="/devis" className="mt-4 inline-block text-mono text-primary hover:underline">
            Retour aux devis
          </Link>
        </div>
      </div>
    );
  }

  const { devis, items } = data;
  const totalBrut = items.reduce((s, i) => s + Number(i.quantite) * Number(i.prix_unitaire), 0);
  const remise = Math.round(((totalBrut * Number(devis.remise_pct)) / 100) * 100) / 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/devis" className="text-mono text-muted-foreground hover:text-primary inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Devis
          </Link>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="border border-border rounded-sm px-4 py-2.5 text-mono hover:border-primary hover:text-primary inline-flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimer / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12 print:py-0 print:px-0">
        <article className="bg-card border border-border rounded-sm overflow-hidden print:border-0">
          {/* En-tête */}
          <header className="p-10 border-b border-border">
            <div className="flex items-start justify-between gap-8 flex-wrap">
              <div className="flex items-center gap-3">
                {LOGO_URL ? (
                  <img src={LOGO_URL} alt="IRVE Technologie" className="h-14 w-auto" />
                ) : (
                  <span className="hero-grad text-primary-foreground p-2.5 rounded-sm">
                    <Zap className="h-6 w-6" strokeWidth={2.5} />
                  </span>
                )}
                <div>
                  <div className="text-xl font-semibold tracking-tight leading-none">
                    {COMPANY.raisonSociale}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{COMPANY.baseline}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-mono text-primary">Devis</div>
                <div className="text-2xl font-medium tracking-tight">{devis.numero}</div>
                <div className="text-xs text-muted-foreground mt-2">
                  Émis le {dateFr(devis.date_emission)}
                  <br />
                  Valable jusqu'au {dateFr(devis.date_expiration)}
                </div>
              </div>
            </div>
          </header>

          {/* Parties */}
          <section className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border">
            <div className="p-8">
              <div className="text-mono text-muted-foreground">Émetteur</div>
              <div className="mt-3 text-sm leading-relaxed">
                <div className="font-medium">
                  {COMPANY.raisonSociale}, {COMPANY.forme}
                </div>
                <div className="text-muted-foreground">
                  {COMPANY.adresse}
                  <br />
                  {COMPANY.cpVille}
                  <br />
                  {COMPANY.email}
                  <br />
                  {COMPANY.telephone}
                  <br />
                  SIRET {COMPANY.siret}
                  <br />
                  TVA {COMPANY.tva}
                </div>
              </div>
            </div>
            <div className="p-8">
              <div className="text-mono text-muted-foreground">Client</div>
              <div className="mt-3 text-sm leading-relaxed">
                <div className="font-medium">{devis.client_nom}</div>
                <div className="text-muted-foreground">
                  {devis.client_adresse && (
                    <>
                      {devis.client_adresse}
                      <br />
                    </>
                  )}
                  {devis.client_cp_ville && (
                    <>
                      {devis.client_cp_ville}
                      <br />
                    </>
                  )}
                  {devis.client_email && (
                    <>
                      {devis.client_email}
                      <br />
                    </>
                  )}
                  {devis.client_telephone}
                </div>
              </div>
            </div>
          </section>

          {devis.objet && (
            <div className="px-8 py-5 border-b border-border">
              <span className="text-mono text-primary">Objet</span>{" "}
              <span className="font-medium">{devis.objet}</span>
            </div>
          )}

          {/* Lignes */}
          <section className="p-8">
            <div className="hidden sm:grid grid-cols-[1fr_60px_110px_70px_110px] gap-4 pb-3 border-b border-border text-mono text-muted-foreground">
              <span>Description</span>
              <span className="text-right">Qté</span>
              <span className="text-right">PU HT</span>
              <span className="text-right">TVA</span>
              <span className="text-right">Total HT</span>
            </div>
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid sm:grid-cols-[1fr_60px_110px_70px_110px] gap-x-4 gap-y-1 py-4"
                >
                  <div>
                    <div className="font-medium">{item.libelle}</div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right text-mono text-muted-foreground">
                    {Number(item.quantite)}
                  </div>
                  <div className="sm:text-right text-mono">{euro(Number(item.prix_unitaire))}</div>
                  <div className="sm:text-right text-mono text-muted-foreground">
                    {Number(item.tva)} %
                  </div>
                  <div className="sm:text-right text-mono">
                    {euro(Number(item.quantite) * Number(item.prix_unitaire))}
                  </div>
                </div>
              ))}
            </div>

            {/* Totaux */}
            <div className="mt-8 flex justify-end">
              <div className="w-full sm:w-80 space-y-2">
                <Line label="Total HT" value={euro(totalBrut)} />
                {Number(devis.remise_pct) > 0 && (
                  <Line label={`Remise (${Number(devis.remise_pct)} %)`} value={`-${euro(remise)}`} />
                )}
                <Line label="Total HT net" value={euro(Number(devis.total_ht))} />
                <Line label="Montant de la TVA" value={euro(Number(devis.total_tva))} />
                <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between">
                  <span className="font-medium">Total TTC</span>
                  <span className="text-2xl font-medium">{euro(Number(devis.total_ttc))}</span>
                </div>
              </div>
            </div>
          </section>

          {devis.notes && (
            <section className="px-8 pb-8">
              <div className="border border-border rounded-sm p-5 bg-secondary/40">
                <div className="text-mono text-muted-foreground">Notes</div>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{devis.notes}</p>
              </div>
            </section>
          )}

          <footer className="px-8 py-6 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <span>
              {COMPANY.raisonSociale}, {COMPANY.forme} · {COMPANY.site}
            </span>
            <span>{devis.numero} · 1/1</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-mono">{value}</span>
    </div>
  );
}
