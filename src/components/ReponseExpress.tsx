import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Loader2, Settings2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { AdresseFields } from "@/components/AdresseFields";
import { computeTotals } from "@/lib/billing";
import { euro } from "@/lib/company";
import { whatsappLien } from "@/lib/contact-client";
import {
  CONFIG_DEFAUT,
  getReponseExpressConfig,
  lignesExpress,
  updateReponseExpressConfig,
  type ReponseExpressConfig,
  envoyerReponseExpress,
} from "@/lib/leads.functions";

type EnvoiPayload = {
  prenom: string | null;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  cp_ville: string | null;
  offre_id: string;
  metrage_m: number;
  option: boolean;
  message: string | null;
};

const INPUT =
  "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

/** Bouton « Réponse express » : proposition chiffrée envoyée en un clic. */
export function ReponseExpressButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        }
      >
        <Zap className="h-4 w-4" /> Réponse express
      </button>
      {open && <ReponseExpressPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function ReponseExpressPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const chargerConfig = useServerFn(getReponseExpressConfig);
  const enregistrerConfig = useServerFn(updateReponseExpressConfig);
  const envoyer = useServerFn(envoyerReponseExpress);

  const configQuery = useQuery({
    queryKey: ["reponse-express-config"],
    queryFn: () => chargerConfig(),
  });
  const config: ReponseExpressConfig = configQuery.data ?? CONFIG_DEFAUT;

  const [offreId, setOffreId] = useState<string | null>(null);
  const [metrage, setMetrage] = useState<string>("");
  const [prixDirecte, setPrixDirecte] = useState<string>("");
  const [option, setOption] = useState(false);
  const [reglages, setReglages] = useState(false);
  const [resultat, setResultat] = useState<{
    numero: string;
    lien: string;
    sent: boolean;
    telephone: string | null;
    nom: string;
  } | null>(null);

  const offreChoisie = config.offres.find((o) => o.id === offreId) ?? null;
  const metrageNum = Number(metrage.replace(",", ".")) || config.metrage_inclus_m;

  const totaux = useMemo(() => {
    if (!offreChoisie) return null;
    return computeTotals(lignesExpress(config, offreChoisie, metrageNum, option), 0);
  }, [config, offreChoisie, metrageNum, option]);

  const envoi = useMutation({
    mutationFn: (payload: EnvoiPayload) => envoyer({ data: payload } as never),
    onSuccess: (r, payload) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setResultat({
        numero: r.numero,
        lien: r.lien,
        sent: Boolean(r.sent),
        telephone: payload.telephone ?? null,
        nom: payload.nom,
      });
      if (r.sent) toast.success(`Proposition ${r.numero} envoyée au prospect.`);
      else
        toast.message(
          `Devis ${r.numero} créé — e-mail non parti, utilisez le lien à copier ci-dessous.`,
        );
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Envoi impossible pour le moment."),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!offreChoisie) {
      toast.error("Choisissez une borne.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    if (!get("nom")) {
      toast.error("Le nom est obligatoire.");
      return;
    }
    envoi.mutate({
      prenom: get("prenom") || null,
      nom: get("nom"),
      email: get("email") || null,
      telephone: get("telephone") || null,
      adresse: get("adresse") || null,
      cp_ville: get("cp_ville") || null,
      offre_id: offreChoisie.id,
      metrage_m: metrageNum,
      option,
      message: null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Réponse express</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Coordonnées, borne, métrage de câble — proposition chiffrée envoyée immédiatement.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setReglages((v) => !v)}
              className="rounded-sm p-2 text-muted-foreground transition hover:text-primary"
              aria-label="Réglages des prix"
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-sm p-2 text-muted-foreground transition hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {configQuery.isLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" />
        ) : reglages ? (
          <ReglagesExpress
            config={config}
            onCancel={() => setReglages(false)}
            onSave={async (next) => {
              await enregistrerConfig({ data: next });
              await qc.invalidateQueries({ queryKey: ["reponse-express-config"] });
              setReglages(false);
              toast.success("Tarifs de la réponse express enregistrés.");
            }}
          />
        ) : resultat ? (
          <div className="mt-6 grid gap-4">
            <div className="flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              <div className="text-sm">
                <p className="font-bold">
                  Devis {resultat.numero}{" "}
                  {resultat.sent ? "envoyé au prospect" : "créé (e-mail non envoyé)"}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Il apparaît dans « Mes devis » ; l'acceptation en ligne remonte dans votre boîte de
                  réception.
                </p>
              </div>
            </div>
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">
                Lien à envoyer par SMS ou WhatsApp
              </span>
              <div className="mt-2 flex gap-2">
                <input readOnly value={resultat.lien} className={`${INPUT} mt-0`} />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultat.lien);
                    toast.success("Lien copié.");
                  }}
                  className="inline-flex items-center gap-2 rounded-sm border border-border px-3 text-xs font-bold transition hover:border-primary hover:text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </button>
              </div>
            </label>
            {whatsappLien(
              resultat.telephone,
              `Bonjour ${resultat.nom}, voici notre proposition d'installation de borne de recharge : ${resultat.lien}`,
            ) && (
              <a
                href={
                  whatsappLien(
                    resultat.telephone,
                    `Bonjour ${resultat.nom}, voici notre proposition d'installation de borne de recharge : ${resultat.lien}`,
                  ) as string
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-4 text-xs font-bold transition hover:border-primary hover:text-primary"
              >
                Envoyer par WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground"
            >
              Terminé
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Prénom</span>
                <input name="prenom" className={INPUT} autoComplete="off" />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Nom *</span>
                <input name="nom" required className={INPUT} autoComplete="off" />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">E-mail</span>
                <input name="email" type="email" className={INPUT} autoComplete="off" />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Téléphone</span>
                <input name="telephone" type="tel" className={INPUT} autoComplete="off" />
              </label>
            </div>
            <div className="grid gap-3">
              <AdresseFields />
            </div>

            <div className="grid gap-2">
              <span className="text-mono text-xs text-muted-foreground">Borne proposée</span>
              {config.offres.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => setOffreId(o.id)}
                  className={`rounded-md border p-3 text-left transition ${
                    offreId === o.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/60"
                  }`}
                >
                  <p className="text-sm font-bold">{o.libelle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.prix_ht > 0
                      ? `${euro(o.prix_ht)} HT — forfait ${config.metrage_inclus_m} m de câble inclus`
                      : "Prix à renseigner dans les réglages"}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">
                  Métrage de câble (m) — {config.metrage_inclus_m} m inclus
                </span>
                <input
                  value={metrage}
                  onChange={(e) => setMetrage(e.target.value)}
                  inputMode="decimal"
                  placeholder={String(config.metrage_inclus_m)}
                  className={INPUT}
                />
              </label>
              {config.option_prix_ht > 0 && (
                <label className="mt-2 flex items-center gap-2 self-end text-sm sm:mt-0">
                  <input
                    type="checkbox"
                    checked={option}
                    onChange={(e) => setOption(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span>
                    {config.option_libelle} (+{euro(config.option_prix_ht)} HT)
                  </span>
                </label>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-4">
              <p className="text-mono text-xs text-muted-foreground">Total à proposer</p>
              <p className="mt-1 text-2xl font-bold">
                {totaux ? euro(totaux.total_ttc) : "—"}{" "}
                <span className="text-sm font-normal text-muted-foreground">TTC</span>
              </p>
              {totaux && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {euro(totaux.total_ht)} HT + {euro(totaux.total_tva)} de TVA
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={envoi.isPending || !offreChoisie}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {envoi.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Envoyer la proposition
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ReglagesExpress({
  config,
  onSave,
  onCancel,
}: {
  config: ReponseExpressConfig;
  onSave: (next: ReponseExpressConfig) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ReponseExpressConfig>(config);
  const [saving, setSaving] = useState(false);

  const num = (v: string) => Number(v.replace(",", ".")) || 0;

  return (
    <div className="mt-5 grid gap-4">
      <p className="text-xs text-muted-foreground">
        Tarifs de la réponse express — modifiez librement les prix et descriptifs.
      </p>
      {draft.offres.map((o, i) => (
        <div key={o.id} className="grid gap-2 rounded-md border border-border p-3">
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Intitulé</span>
            <input
              value={o.libelle}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  offres: d.offres.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)),
                }))
              }
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Prix HT (€)</span>
            <input
              value={String(o.prix_ht)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  offres: d.offres.map((x, j) =>
                    j === i ? { ...x, prix_ht: num(e.target.value) } : x,
                  ),
                }))
              }
              inputMode="decimal"
              className={INPUT}
            />
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Descriptif</span>
            <textarea
              value={o.descriptif}
              rows={5}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  offres: d.offres.map((x, j) =>
                    j === i ? { ...x, descriptif: e.target.value } : x,
                  ),
                }))
              }
              className={INPUT}
            />
          </label>
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">Câble inclus (m)</span>
          <input
            value={String(draft.metrage_inclus_m)}
            onChange={(e) => setDraft((d) => ({ ...d, metrage_inclus_m: num(e.target.value) }))}
            inputMode="decimal"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">
            Mètre supplémentaire (€ HT)
          </span>
          <input
            value={String(draft.prix_metre_ht)}
            onChange={(e) => setDraft((d) => ({ ...d, prix_metre_ht: num(e.target.value) }))}
            inputMode="decimal"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">Option — intitulé</span>
          <input
            value={draft.option_libelle}
            onChange={(e) => setDraft((d) => ({ ...d, option_libelle: e.target.value }))}
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">Option — prix HT (€)</span>
          <input
            value={String(draft.option_prix_ht)}
            onChange={(e) => setDraft((d) => ({ ...d, option_prix_ht: num(e.target.value) }))}
            inputMode="decimal"
            className={INPUT}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-mono text-xs text-muted-foreground">Message d'accompagnement</span>
        <textarea
          value={draft.message}
          rows={3}
          onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
          className={INPUT}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-xs font-bold transition hover:border-primary hover:text-primary"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
