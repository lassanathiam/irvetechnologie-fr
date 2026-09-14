import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Bell, CheckCheck, Circle, Loader2, Mail } from "lucide-react";
import {
  NOTIF_LABELS,
  getEmailRappel,
  listNotifications,
  marquerNotificationLue,
  marquerToutesNotificationsLues,
  setEmailRappel,
} from "@/lib/notifications.functions";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications — Espace pro IRVE Technologie" },
      {
        name: "description",
        content:
          "Boîte de réception interne : devis acceptés, rendez-vous confirmés, chantiers terminés et montants proposés par les partenaires.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

const dateHeure = (v: string) =>
  new Date(v).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const euros = (n: number | null) =>
  n == null ? null : n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function NotificationsPage() {
  const qc = useQueryClient();
  const [nonLuesSeules, setNonLuesSeules] = useState(false);
  const [emailSaisi, setEmailSaisi] = useState<string | null>(null);

  const charger = useServerFn(listNotifications);
  const lireEmail = useServerFn(getEmailRappel);
  const marquerUne = useServerFn(marquerNotificationLue);
  const marquerTout = useServerFn(marquerToutesNotificationsLues);
  const enregistrerEmail = useServerFn(setEmailRappel);

  const { data: liste, isLoading } = useQuery({
    queryKey: ["notifications", nonLuesSeules],
    queryFn: () => charger({ data: { non_lues: nonLuesSeules } }),
  });

  const { data: rappel } = useQuery({
    queryKey: ["notifications-email-rappel"],
    queryFn: () => lireEmail(),
  });

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-non-lues"] });
  };

  const basculerLue = useMutation({
    mutationFn: (v: { id: string; lu: boolean }) => marquerUne({ data: v }),
    onSuccess: rafraichir,
  });

  const toutLire = useMutation({
    mutationFn: () => marquerTout(),
    onSuccess: rafraichir,
  });

  const sauverEmail = useMutation({
    mutationFn: (email: string) => enregistrerEmail({ data: { email } }),
    onSuccess: () => {
      setEmailSaisi(null);
      qc.invalidateQueries({ queryKey: ["notifications-email-rappel"] });
    },
  });

  const items = liste ?? [];
  const nbNonLues = items.filter((n) => !n.lu_at).length;

  return (
    <ProShell>
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Bell className="h-6 w-6" /> Notifications
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tout ce qui se passe sur la plateforme : devis acceptés, rendez-vous confirmés,
              chantiers terminés, montants proposés par les partenaires.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={nonLuesSeules ? "default" : "outline"}
              size="sm"
              onClick={() => setNonLuesSeules((v) => !v)}
            >
              Non lues {nbNonLues > 0 ? `(${nbNonLues})` : ""}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={toutLire.isPending}
              onClick={() => toutLire.mutate()}
            >
              <CheckCheck className="mr-1 h-4 w-4" /> Tout marquer comme lu
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" /> Adresse e-mail de rappel (facultative)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Laissez vide pour tout suivre uniquement ici. Si vous renseignez une adresse, elle
            recevra un simple rappel en plus de cette page.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="votre@adresse.fr"
              className="max-w-xs"
              value={emailSaisi ?? rappel?.email ?? ""}
              onChange={(e) => setEmailSaisi(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              disabled={sauverEmail.isPending || emailSaisi === null}
              onClick={() => sauverEmail.mutate((emailSaisi ?? "").trim())}
            >
              Enregistrer
            </Button>
          </div>
        </section>

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun événement pour le moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 ${
                  n.lu_at ? "border-border bg-card" : "border-primary/50 bg-primary/5"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
                      {!n.lu_at && <Circle className="h-2.5 w-2.5 fill-primary text-primary" />}
                      {NOTIF_LABELS[n.type] ?? n.type} · {dateHeure(n.created_at)}
                    </div>
                    <p className="mt-1 font-semibold">{n.titre}</p>
                    {n.message ? (
                      <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                    ) : null}
                    {n.montant != null ? (
                      <p className="mt-1 text-sm font-bold">{euros(Number(n.montant))}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {n.lien ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={n.lien as never}>
                          Ouvrir <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={basculerLue.isPending}
                      onClick={() => basculerLue.mutate({ id: n.id, lu: !n.lu_at })}
                    >
                      {n.lu_at ? "Marquer non lu" : "Marquer lu"}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProShell>
  );
}
