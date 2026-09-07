import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getEmailReceipts } from "@/lib/email-receipts.functions";

const LABELS: Record<string, { text: string; tone: "ok" | "warn" | "bad" }> = {
  sent: { text: "Email remis au serveur du client", tone: "ok" },
  rejected: { text: "Envoi refusé", tone: "bad" },
  bounced: { text: "Adresse invalide (rebond)", tone: "bad" },
  complained: { text: "Signalé comme indésirable", tone: "bad" },
  unsubscribed: { text: "Le client s'est désinscrit", tone: "warn" },
  suppressed: { text: "Adresse bloquée — envoi non effectué", tone: "bad" },
  rate_limited: { text: "Envoi différé (trop d'emails)", tone: "warn" },
};

/** Accusé d'envoi : état réel de la distribution de l'email au client. */
export function EmailReceipts({ email }: { email?: string | null }) {
  const fetchReceipts = useServerFn(getEmailReceipts);
  const query = useQuery({
    queryKey: ["email-receipts", email],
    queryFn: () => fetchReceipts({ data: { email: email as string } }),
    enabled: !!email,
    staleTime: 30_000,
  });

  return (
    <div className="border border-border rounded-sm bg-card p-6 space-y-3">
      <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        Accusé d&apos;envoi
      </h2>
      {!email ? (
        <p className="text-sm text-muted-foreground">Aucune adresse email renseignée.</p>
      ) : query.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (query.data?.events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun événement de distribution pour {email}. Les accusés apparaissent après un envoi
          depuis le site publié.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {(query.data?.events ?? []).map((e, i) => {
            const info = LABELS[e.event_type] ?? { text: e.event_type, tone: "warn" as const };
            const color =
              info.tone === "ok"
                ? "text-primary"
                : info.tone === "bad"
                  ? "text-destructive"
                  : "text-muted-foreground";
            return (
              <li key={i} className="text-[12px] border-b border-border pb-2 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-mono font-bold ${color}`}>{info.text}</span>
                  <span className="text-mono text-[10px] text-muted-foreground">
                    {new Date(e.timestamp).toLocaleString("fr-FR")}
                  </span>
                </div>
                {e.status && <div className="text-muted-foreground">{e.status}</div>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        L&apos;ouverture de l&apos;email lui-même n&apos;est pas mesurable ; la consultation du
        document se suit via le lien client ci-contre.
      </p>
    </div>
  );
}
