import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, MapPin, Plus } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AdresseFields } from "@/components/AdresseFields";
import { creerDossierPartenaire, getEspacePartenaire } from "@/lib/partenaires.functions";

export const Route = createFileRoute("/partenaire/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Espace partenaire — Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Saisie des dossiers d'intervention pour les partenaires de Borne de l'Ouest : client, adresse, montant et date de rendez-vous.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EspacePartenaire,
});

const INPUT =
  "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

const eurosFr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

function EspacePartenaire() {
  const { token } = Route.useParams();
  const charger = useServerFn(getEspacePartenaire);
  const creer = useServerFn(creerDossierPartenaire);

  const espace = useQuery({
    queryKey: ["espace-partenaire", token],
    queryFn: () => charger({ data: { token } }),
    retry: false,
  });

  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rdvAPrendre, setRdvAPrendre] = useState(true);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    setError(null);
    setNotice(null);
    if (get("client_nom").length < 2) {
      setError("Indiquez le nom du client.");
      return;
    }
    if (get("adresse").length < 3) {
      setError("Indiquez l'adresse du chantier.");
      return;
    }
    setBusy(true);
    try {
      await creer({
        data: {
          token,
          client_nom: get("client_nom"),
          client_telephone: get("client_telephone") || null,
          client_email: get("client_email") || null,
          adresse: get("adresse"),
          cp_ville: get("cp_ville") || null,
          designation: get("designation") || null,
          date_debut: rdvAPrendre ? null : get("date_debut") || null,
          montant_ht: get("montant_ht"),
          notes: get("notes") || null,
        },
      });
      setNotice("Dossier transmis à Borne de l'Ouest.");
      setForm(false);
      setRdvAPrendre(true);
      await espace.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (espace.isError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="text-sm text-destructive text-center">
          Ce lien de saisie n'est plus valide. Contactez Borne de l'Ouest.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center gap-3">
          <BrandLogo className="h-9 w-9" />
          <div className="leading-tight">
            <p className="font-extrabold tracking-tight text-sm">Espace partenaire</p>
            <p className="text-mono text-[11px] text-primary uppercase tracking-[0.14em]">
              {espace.data?.nom ?? "…"} · Borne de l'Ouest
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 space-y-5">
        {notice && (
          <p className="text-sm text-primary inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </p>
        )}

        {!form ? (
          <button
            type="button"
            onClick={() => {
              setForm(true);
              setNotice(null);
            }}
            className="w-full bg-primary text-primary-foreground rounded-sm px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nouveau dossier
          </button>
        ) : (
          <form onSubmit={submit} className="bg-card border border-border rounded-xl p-5 grid gap-4">
            <h1 className="font-semibold text-sm">Nouveau dossier d'intervention</h1>

            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Nom du client</span>
              <input name="client_nom" required className={INPUT} placeholder="M. Dupont" />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Téléphone</span>
                <input name="client_telephone" className={INPUT} placeholder="06 12 34 56 78" />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Email</span>
                <input name="client_email" type="email" className={INPUT} placeholder="client@email.fr" />
              </label>
            </div>

            <AdresseFields required />

            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">
                Désignation de la prestation
              </span>
              <input
                name="designation"
                className={INPUT}
                placeholder="Pose borne 7,4 kW — maison individuelle"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">
                  Montant HT convenu (facultatif)
                </span>
                <input name="montant_ht" inputMode="decimal" className={INPUT} placeholder="480" />
              </label>
              <div>
                <span className="text-mono text-xs text-muted-foreground">Rendez-vous</span>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRdvAPrendre(true)}
                    className={`flex-1 text-xs font-semibold rounded-sm px-3 py-2.5 border ${
                      rdvAPrendre
                        ? "border-primary text-primary bg-muted"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    À prendre
                  </button>
                  <button
                    type="button"
                    onClick={() => setRdvAPrendre(false)}
                    className={`flex-1 text-xs font-semibold rounded-sm px-3 py-2.5 border ${
                      !rdvAPrendre
                        ? "border-primary text-primary bg-muted"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    Date connue
                  </button>
                </div>
              </div>
            </div>

            {!rdvAPrendre && (
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Date et heure du rendez-vous</span>
                <input name="date_debut" type="datetime-local" className={INPUT} />
              </label>
            )}

            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Informations complémentaires</span>
              <textarea name="notes" rows={3} className={INPUT} placeholder="Accès, étage, contraintes…" />
            </label>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="bg-primary text-primary-foreground rounded-sm px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Transmettre
              </button>
              <button
                type="button"
                onClick={() => setForm(false)}
                className="text-sm text-muted-foreground px-4 py-2.5"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <section className="space-y-3">
          <h2 className="text-mono text-xs text-primary uppercase">Mes dossiers</h2>
          {espace.isLoading ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          ) : (espace.data?.dossiers.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dossier transmis pour le moment.</p>
          ) : (
            <ul className="grid gap-3">
              {espace.data!.dossiers.map((d) => (
                <li key={d.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="font-medium text-sm">
                    {d.client_nom}
                    {d.designation ? (
                      <span className="text-muted-foreground font-normal"> — {d.designation}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {d.adresse}
                      {d.cp_ville ? `, ${d.cp_ville}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {d.date_a_confirmer
                        ? "Rendez-vous à prendre"
                        : new Date(d.date_debut).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                    </span>
                    {Number(d.montant_ht ?? 0) > 0 && (
                      <span className="text-mono">{eurosFr(Number(d.montant_ht))} HT</span>
                    )}
                  </p>
                  <p className="text-[11px] text-mono mt-2 text-primary uppercase">
                    {d.statut === "realise"
                      ? "Réalisé"
                      : d.date_a_confirmer
                        ? "En attente de planification"
                        : "Planifié"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
