import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Euro,
  Loader2,
  MapPin,
  Receipt,
  Ruler,
  Zap,
} from "lucide-react";
import { ProShell } from "@/components/ProShell";
import {
  creerFactureChantier,
  getSuiviFacturation,
  updateSuiviPaiement,
  validerMontantPropose,
} from "@/lib/planning.functions";

export const Route = createFileRoute("/_authenticated/facturation/")({
  head: () => ({
    meta: [
      { title: "Chantiers à facturer — Espace pro IRVE Technologie" },
      {
        name: "description",
        content:
          "Suivi des chantiers terminés à facturer : échéances de règlement, retards, montants valorisés par les partenaires et métrages de câble du mois.",
      },
      { property: "og:title", content: "Chantiers à facturer — IRVE Technologie" },
      {
        property: "og:description",
        content: "Échéances de règlement, retards et métrages des chantiers terminés.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FacturationChantiers,
});

const eurosFr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const FACTU_LABEL: Record<string, string> = {
  a_facturer: "À facturer",
  facture: "Facturé",
  paye: "Payé",
};

const INPUT =
  "bg-input border border-border rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-primary";

/** Liste des 12 derniers mois, du plus récent au plus ancien. */
function moisRecents() {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

function FacturationChantiers() {
  const charger = useServerFn(getSuiviFacturation);
  const majPaiement = useServerFn(updateSuiviPaiement);
  const validerMontant = useServerFn(validerMontantPropose);
  const creerFacture = useServerFn(creerFactureChantier);
  const [message, setMessage] = useState<string | null>(null);

  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const [filtre, setFiltre] = useState<"encours" | "retard" | "a_valider" | "tous">("encours");
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const suivi = useQuery({
    queryKey: ["suivi-facturation", mois],
    queryFn: () => charger({ data: { mois } }),
  });

  const chantiers = useMemo(() => {
    const list = suivi.data?.chantiers ?? [];
    if (filtre === "retard") return list.filter((c) => c.en_retard);
    if (filtre === "a_valider")
      return list.filter((c) => c.montant_propose_ht != null && c.montant_valide_at == null);
    if (filtre === "encours") return list.filter((c) => c.statut_facturation !== "paye");
    return list;
  }, [suivi.data, filtre]);

  async function action(id: string, fn: () => Promise<unknown>) {
    setErreur(null);
    setMessage(null);
    setBusy(id);
    try {
      await fn();
      await suivi.refetch();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  }

  const t = suivi.data?.totaux;
  const m = suivi.data?.mois_totaux;

  return (
    <ProShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight inline-flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" /> Chantiers terminés à facturer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Dès qu&apos;un chantier est terminé, l&apos;échéance de règlement est calculée selon le
              délai convenu. Les montants valorisés par les partenaires attendent votre validation.
            </p>
          </div>
          <label className="text-mono text-xs text-muted-foreground">
            Mois
            <select
              value={mois}
              onChange={(e) => setMois(e.target.value)}
              className={`${INPUT} ml-2`}
            >
              {moisRecents().map((v) => (
                <option key={v} value={v}>
                  {new Date(`${v}-01T00:00:00Z`).toLocaleDateString("fr-FR", {
                    month: "long",
                    year: "numeric",
                  })}
                </option>
              ))}
            </select>
          </label>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Carte
            titre="À facturer"
            valeur={eurosFr(t?.a_facturer_ht ?? 0)}
            detail={`${t?.a_facturer_nb ?? 0} chantier${(t?.a_facturer_nb ?? 0) > 1 ? "s" : ""}`}
          />
          <Carte
            titre="Facturé, en attente de règlement"
            valeur={eurosFr(t?.facture_ht ?? 0)}
            detail={`${t?.facture_nb ?? 0} chantier${(t?.facture_nb ?? 0) > 1 ? "s" : ""}`}
          />
          <Carte
            titre="En retard de paiement"
            valeur={eurosFr(t?.retard_ht ?? 0)}
            detail={`${t?.retard_nb ?? 0} échéance${(t?.retard_nb ?? 0) > 1 ? "s" : ""} dépassée${
              (t?.retard_nb ?? 0) > 1 ? "s" : ""
            }`}
            alerte={(t?.retard_nb ?? 0) > 0}
          />
          <Carte
            titre="Montants à valider"
            valeur={String(t?.a_valider_nb ?? 0)}
            detail="proposés par les partenaires"
          />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Carte titre="Chantiers du mois" valeur={String(m?.nb ?? 0)} detail="terminés" />
          <Carte titre="Montant du mois" valeur={eurosFr(m?.ht ?? 0)} detail="HT" />
          <Carte
            titre="Câble posé dans le mois"
            valeur={`${Math.round(m?.metrage_reel_m ?? 0)} m`}
            detail={`dont ${Math.round(m?.metrage_supplement_m ?? 0)} m au-delà du forfait`}
            icone={<Ruler className="h-4 w-4" />}
          />
          <Carte
            titre="Bornes installées"
            valeur={String(m?.bornes ?? 0)}
            detail="sur le mois"
            icone={<Zap className="h-4 w-4" />}
          />
        </section>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["encours", "En cours"],
              ["retard", "En retard"],
              ["a_valider", "Montants à valider"],
              ["tous", "Tous"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFiltre(v)}
              className={`text-xs font-semibold rounded-sm px-3 py-2 border min-h-10 ${
                filtre === v
                  ? "border-primary text-primary bg-muted"
                  : "border-border text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {erreur && <p className="text-sm text-destructive">{erreur}</p>}
        {message && <p className="text-sm text-primary">{message}</p>}

        {suivi.isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : chantiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun chantier dans cette sélection.</p>
        ) : (
          <ul className="grid gap-3">
            {chantiers.map((c) => {
              const proposeEnAttente = c.montant_propose_ht != null && c.montant_valide_at == null;
              return (
                <li
                  key={c.id}
                  className={`bg-card border rounded-xl p-4 ${
                    c.en_retard ? "border-destructive/60" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {c.client_nom}
                        {c.designation || c.titre ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            — {c.designation || c.titre}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.adresse}
                          {c.cp_ville ? `, ${c.cp_ville}` : ""}
                        </span>
                        {c.partenaire && <span>Pour {c.partenaire}</span>}
                        <span>
                          {c.facturer_a === "partenaire" ? "Sous-traitance" : "Chantier direct"}
                        </span>
                        <span className="text-primary">
                          Facture à{" "}
                          {c.facturer_a === "partenaire"
                            ? `${c.destinataire_nom ?? "partenaire"} (partenaire)`
                            : `${c.destinataire_nom ?? "client"} (client)`}
                          {c.destinataire_email ? "" : " — e-mail manquant"}
                        </span>
                        {c.termine_at && (
                          <span>
                            Terminé le {new Date(c.termine_at).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-mono">{eurosFr(Number(c.montant_ht ?? 0))} HT</span>
                        {c.metrage_reel_m != null && (
                          <span className="text-muted-foreground">
                            {Number(c.metrage_reel_m)} m posés
                            {(c.supplement_m ?? 0) > 0 ? ` (+${c.supplement_m} m)` : ""}
                          </span>
                        )}
                        {c.puissance_borne && (
                          <span className="text-muted-foreground">{c.puissance_borne}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-mono text-[11px] uppercase text-primary">
                        {FACTU_LABEL[c.statut_facturation] ?? c.statut_facturation}
                      </p>
                      {c.echeance_paiement && (
                        <p
                          className={`text-xs mt-1 ${
                            c.en_retard ? "text-destructive font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {c.en_retard ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Retard de{" "}
                              {Math.abs(c.jours_restants ?? 0)} j
                            </span>
                          ) : c.statut_facturation === "paye" ? (
                            "Réglé"
                          ) : (
                            `Échéance le ${new Date(
                              `${c.echeance_paiement}T00:00:00Z`,
                            ).toLocaleDateString("fr-FR")} · ${c.jours_restants} j`
                          )}
                        </p>
                      )}
                      {c.delai_paiement_jours != null && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Délai {c.delai_paiement_jours} j
                        </p>
                      )}
                    </div>
                  </div>

                  {proposeEnAttente && (
                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-xs">
                        <span className="text-mono text-primary">
                          {eurosFr(Number(c.montant_propose_ht))} HT
                        </span>{" "}
                        proposé par {c.montant_propose_par ?? c.partenaire ?? "le partenaire"}
                        {c.montant_propose_note ? ` — ${c.montant_propose_note}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() =>
                            void action(c.id, () =>
                              validerMontant({ data: { id: c.id, accepter: true } }),
                            )
                          }
                          className="bg-primary text-primary-foreground rounded-sm px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 min-h-10"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Valider ce montant
                        </button>
                        <button
                          type="button"
                          disabled={busy === c.id}
                          onClick={() =>
                            void action(c.id, () =>
                              validerMontant({ data: { id: c.id, accepter: false } }),
                            )
                          }
                          className="text-xs font-semibold rounded-sm px-3 py-2 border border-border text-muted-foreground hover:border-destructive hover:text-destructive min-h-10"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      void action(c.id, () =>
                        majPaiement({
                          data: {
                            id: c.id,
                            statut_facturation: String(
                              fd.get("statut_facturation") ?? "a_facturer",
                            ) as "a_facturer" | "facture" | "paye",
                            montant_ht: String(fd.get("montant_ht") ?? ""),
                            delai_paiement_jours: String(fd.get("delai") ?? ""),
                            echeance_paiement: String(fd.get("echeance") ?? "") || null,
                          },
                        }),
                      );
                    }}
                    className="mt-3 border-t border-border pt-3 flex flex-wrap items-end gap-2"
                  >
                    <label className="text-[11px] text-muted-foreground">
                      Montant HT
                      <input
                        name="montant_ht"
                        inputMode="decimal"
                        defaultValue={String(c.montant_ht ?? 0)}
                        className={`${INPUT} block mt-1 w-28`}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Délai (j)
                      <input
                        name="delai"
                        inputMode="numeric"
                        defaultValue={String(c.delai_paiement_jours ?? 30)}
                        className={`${INPUT} block mt-1 w-20`}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Échéance
                      <input
                        name="echeance"
                        type="date"
                        defaultValue={c.echeance_paiement ?? ""}
                        className={`${INPUT} block mt-1`}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      Règlement
                      <select
                        name="statut_facturation"
                        defaultValue={c.statut_facturation}
                        className={`${INPUT} block mt-1`}
                      >
                        <option value="a_facturer">À facturer</option>
                        <option value="facture">Facturé</option>
                        <option value="paye">Payé</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={busy === c.id}
                      className="text-xs font-semibold rounded-sm px-3 py-2 border border-border hover:border-primary hover:text-primary min-h-10 inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {busy === c.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      disabled={busy === c.id}
                      onClick={() =>
                        void action(c.id, async () => {
                          const r = await creerFacture({ data: { id: c.id } });
                          setMessage(
                            `Facture ${r.numero} créée au nom de ${r.destinataire} (${
                              r.facturer_a === "partenaire" ? "partenaire" : "client"
                            }).`,
                          );
                        })
                      }
                      className="bg-primary text-primary-foreground rounded-sm px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60 min-h-10"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      {c.facturer_a === "partenaire"
                        ? "Facturer le partenaire"
                        : "Facturer le client"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ProShell>
  );
}

function Carte({
  titre,
  valeur,
  detail,
  alerte,
  icone,
}: {
  titre: string;
  valeur: string;
  detail?: string;
  alerte?: boolean;
  icone?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-card border rounded-xl p-4 ${alerte ? "border-destructive/60" : "border-border"}`}
    >
      <p className="text-mono text-[11px] uppercase text-muted-foreground inline-flex items-center gap-1.5">
        {icone}
        {titre}
      </p>
      <p
        className={`text-xl font-extrabold tracking-tight mt-2 ${alerte ? "text-destructive" : ""}`}
      >
        {valeur}
      </p>
      {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
    </div>
  );
}
