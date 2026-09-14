import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, Check, Loader2, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { confirmerRdvPublic, getRdvPublic, refuserRdvPublic } from "@/lib/rdv-public.functions";

export const Route = createFileRoute("/rdv/$token")({
  component: PageRdvClient,
  head: () => ({
    meta: [
      { title: "Confirmer votre rendez-vous | Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Confirmez la date de votre installation de borne de recharge avec Borne de l'Ouest, marque d'IRVE Technologie.",
      },
      { property: "og:title", content: "Confirmer votre rendez-vous | Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Confirmez ou modifiez la date proposée pour votre installation de borne.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PageRdvClient() {
  const { token } = Route.useParams();
  const [message, setMessage] = useState("");
  const [refusOuvert, setRefusOuvert] = useState(false);

  const rdv = useQuery({
    queryKey: ["rdv-public", token],
    queryFn: () => getRdvPublic({ data: { token } }),
    retry: false,
  });

  const confirmer = useMutation({
    mutationFn: () => confirmerRdvPublic({ data: { token } }),
    onSuccess: () => void rdv.refetch(),
  });

  const refuser = useMutation({
    mutationFn: () => refuserRdvPublic({ data: { token, message } }),
    onSuccess: () => {
      setRefusOuvert(false);
      void rdv.refetch();
    },
  });

  const cadre = "mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full">
        {rdv.isPending && (
          <div className={cadre}>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {rdv.isError && (
          <div className={cadre}>
            <h1 className="text-lg font-bold">Lien indisponible</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce lien de rendez-vous n&apos;est plus valide. Contactez-nous au {COMPANY.telephone} ou
              au {COMPANY.telephone2}.
            </p>
          </div>
        )}

        {rdv.data && (
          <div className={cadre}>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              Borne de l&apos;Ouest · {COMPANY.raisonSociale}
            </p>
            <h1 className="mt-2 text-xl font-bold">Votre rendez-vous</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bonjour {rdv.data.client_nom}, voici la date que nous vous proposons.
            </p>

            <div className="mt-4 rounded-xl border border-border p-4">
              <p className="text-base font-bold">
                {new Date(rdv.data.date_debut).toLocaleString("fr-FR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {rdv.data.objet && (
                <p className="mt-1 text-sm text-muted-foreground">{rdv.data.objet}</p>
              )}
              {(rdv.data.adresse || rdv.data.cp_ville) && (
                <p className="mt-2 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {[rdv.data.adresse, rdv.data.cp_ville].filter(Boolean).join(", ")}
                </p>
              )}
              {rdv.data.duree_min ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Durée estimée : {Math.round(rdv.data.duree_min / 60)} h environ
                </p>
              ) : null}
            </div>

            {rdv.data.confirme_at ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm font-semibold">
                <Check className="h-5 w-5 shrink-0 text-emerald-600" />
                Rendez-vous confirmé. Merci ! Nous vous rappelons la veille de l&apos;intervention.
              </p>
            ) : rdv.data.refuse_at ? (
              <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                Nous avons bien noté que ce créneau ne convient pas. Nous vous rappelons pour fixer
                une nouvelle date.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => confirmer.mutate()}
                  disabled={confirmer.isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  <CalendarCheck className="h-4 w-4" />
                  {confirmer.isPending ? "Enregistrement…" : "Je confirme ce rendez-vous"}
                </button>

                {refusOuvert ? (
                  <div className="rounded-lg border border-border p-3">
                    <label className="block text-xs text-muted-foreground">
                      Vos disponibilités (facultatif)
                      <textarea
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Plutôt en fin de journée, ou la semaine suivante…"
                        className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => refuser.mutate()}
                      disabled={refuser.isPending}
                      className="mt-2 min-h-11 w-full rounded-lg border border-border text-sm font-bold disabled:opacity-50"
                    >
                      {refuser.isPending ? "Envoi…" : "Envoyer ma demande"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRefusOuvert(true)}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"
                  >
                    <CalendarX className="h-4 w-4" />
                    Ce créneau ne me convient pas
                  </button>
                )}
              </div>
            )}

            <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {COMPANY.telephone}
              </span>
              <span>{COMPANY.telephone2}</span>
              <span>{COMPANY.site}</span>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
