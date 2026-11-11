import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CheckCircle2, Copy, Loader2, Save, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { AdresseFields } from "@/components/AdresseFields";
import { whatsappLien } from "@/lib/contact-client";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import {
  analyserPropositionCatalogue,
  enregistrerAchatCatalogue,
  enregistrerForfaitsCatalogue,
  envoyerPropositionCatalogue,
  getCatalogueCommercial,
  type AnalyseBorneProposee,
  type DevisPropose,
  type ProduitCatalogue,
} from "@/lib/catalogue-commercial.functions";
import {
  DISTANCE_MAX_FORFAIT_M,
  MARGE_MINIMUM_HT,
  MARGE_PLANCHER_HT,
  PALIERS_CABLE_M,
  palierPourDistance,
  type PalierCable,
} from "@/lib/tarification";
import { lireNombre, montant, PHASE_LIBELLE } from "@/components/catalogue/outils";
import type { ReponseExpressPrefill } from "@/components/ReponseExpress";

const INPUT =
  "mt-1.5 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";
const LIB = "text-mono text-xs text-muted-foreground";
const TYPES_POSE = ["Murale intérieure (garage)", "Murale extérieure", "Sur pied", "Parking / copropriété"];

/** Bouton « Réponse express » d'une demande : borne réelle + forfait de câble + marge contrôlée. */
export function PropositionCatalogueButton({
  className,
  label,
  prefill,
}: {
  className?: string;
  label?: string;
  prefill?: ReponseExpressPrefill;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Zap className="h-3.5 w-3.5" /> {label ?? "Réponse express"}
      </button>
      {open && <PanneauProposition onClose={() => setOpen(false)} prefill={prefill} />}
    </>
  );
}

/** Nombre maximum de bornes proposées au choix dans une même réponse. */
const MAX_CHOIX = 3;

function PanneauProposition({ onClose, prefill }: { onClose: () => void; prefill?: ReponseExpressPrefill }) {
  const qc = useQueryClient();
  const charger = useServerFn(getCatalogueCommercial);
  const analyser = useServerFn(analyserPropositionCatalogue);
  const enregistrer = useServerFn(envoyerPropositionCatalogue);
  const envoyer = useEnvoiConfirme(envoyerPropositionCatalogue, "Confirmer l'envoi de la proposition au client ?");
  const catalogue = useQuery({ queryKey: ["catalogue-commercial"], queryFn: () => charger() });

  const [marque, setMarque] = useState("");
  const [puissance, setPuissance] = useState("");
  const [choisis, setChoisis] = useState<string[]>([]);
  const [distance, setDistance] = useState(prefill?.metrage_m ? String(prefill.metrage_m) : "");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [typePose, setTypePose] = useState("");
  const [voirClient, setVoirClient] = useState(!prefill?.nom);
  const [voirPlus, setVoirPlus] = useState(false);
  const [voirAutres, setVoirAutres] = useState(false);
  const [resultat, setResultat] = useState<{ devis: DevisPropose[]; sent: boolean; telephone: string | null; nom: string } | null>(null);

  const data = catalogue.data;
  const estAdmin = Boolean(data?.estAdmin);
  const actifs = (data?.produits ?? []).filter((p) => p.actif);
  const marques = Array.from(new Set(actifs.map((p) => p.marque)));
  const puissances = Array.from(new Set(actifs.filter((p) => !marque || p.marque === marque).map((p) => p.puissance_kw))).sort((a, b) => a - b);
  const options = (data?.options ?? []).filter((o) => o.actif && o.prix_ttc != null);
  const optionsTtc = options.filter((o) => optionIds.includes(o.id)).reduce((s, o) => s + (o.prix_ttc ?? 0), 0);
  const distanceSaisie = distance.trim() !== "";
  const distanceNum = Number(distance.replace(",", ".")) || 0;
  const palier = distanceSaisie ? palierPourDistance(distanceNum) : null;
  const etude = distanceSaisie && palier == null;

  // Prix de chaque borne pour la distance saisie, calculé tout seul ; les bornes proposables d'abord.
  const prixPour = (p: ProduitCatalogue) => (palier ? p.forfaits[palier] ?? null : null);
  const modeles = actifs
    .filter((p) => (!marque || p.marque === marque) && (!puissance || String(p.puissance_kw) === puissance))
    .sort((x, y) => {
      const px = x.achat_confirme ? prixPour(x) : null;
      const py = y.achat_confirme ? prixPour(y) : null;
      if ((px == null) !== (py == null)) return px == null ? 1 : -1;
      return (px ?? 0) - (py ?? 0) || x.ordre - y.ordre;
    });

  const basculer = (id: string) =>
    setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CHOIX ? c : [...c, id]));

  const entree = useMemo(
    () => (choisis.length && distanceSaisie && !etude ? { produit_ids: choisis, distance_m: distanceNum, option_ids: optionIds } : null),
    [choisis, distanceSaisie, etude, distanceNum, optionIds],
  );
  const analyse = useQuery({
    queryKey: ["proposition-catalogue", entree],
    queryFn: () => analyser({ data: entree! } as never) as Promise<AnalyseBorneProposee[]>,
    enabled: Boolean(entree),
  });
  const analyses = analyse.data ?? [];
  const proposable = (a: AnalyseBorneProposee) => !a.etude && a.achat_confirme && a.total_ttc != null && a.suffisante;
  const bloque =
    !entree || analyse.isFetching || analyses.length !== choisis.length || analyses.some((a) => !proposable(a));

  const rafraichir = () => {
    qc.invalidateQueries({ queryKey: ["catalogue-commercial"] });
    qc.invalidateQueries({ queryKey: ["proposition-catalogue"] });
  };

  // Bornes prêtes (prix d'achat + forfait) en premier ; les autres sont rangées à part.
  const estPrete = (p: ProduitCatalogue) => !distanceSaisie || (p.achat_confirme && prixPour(p) != null);
  const prets = modeles.filter((p) => estPrete(p) || choisis.includes(p.id));
  const autres = modeles.filter((p) => !estPrete(p) && !choisis.includes(p.id));

  const carteBorne = (p: ProduitCatalogue) => {
    const prix = prixPour(p);
    const coche = choisis.includes(p.id);
    const plein = !coche && choisis.length >= MAX_CHOIX;
    const a = analyses.find((x) => x.produit_id === p.id);
    return (
      <div key={p.id} className={`rounded-md border ${coche ? "border-primary bg-primary/5" : "border-border"} ${plein ? "opacity-50" : ""}`}>
        <button type="button" disabled={plein} onClick={() => basculer(p.id)} className="flex w-full items-center gap-3 p-3 text-left">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border ${coche ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {coche && <Check className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{p.marque} — {p.nom_commercial}</span>
            <span className="block text-xs text-muted-foreground">{String(p.puissance_kw).replace(".", ",")} kW · {PHASE_LIBELLE[p.phase]}</span>
          </span>
          <span className="shrink-0 text-right">
            {!distanceSaisie ? (
              <span className="text-xs text-muted-foreground">—</span>
            ) : prix == null ? (
              <span className="text-xs font-semibold text-destructive">Pas de prix à {palier} m</span>
            ) : (
              <>
                <span className="block text-lg font-bold">{montant(prix + optionsTtc)}</span>
                <span className={`text-xs ${p.achat_confirme ? "text-muted-foreground" : "font-semibold text-destructive"}`}>
                  {p.achat_confirme ? "TTC posé" : "prix d'achat manquant"}
                </span>
              </>
            )}
          </span>
        </button>
        {coche && distanceSaisie && (
          <div className="border-t border-border px-3 py-2">
            {a ? <CarteAnalyse a={a} p={p} estAdmin={estAdmin} onChange={rafraichir} /> : <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        )}
      </div>
    );
  };

  const mutation = useMutation({
    mutationFn: async ({ form, avecEnvoi }: { form: HTMLFormElement; avecEnvoi: boolean }) => {
      const fd = new FormData(form);
      const get = (k: string) => String(fd.get(k) ?? "").trim();
      if (!get("nom")) throw new Error("Le nom est obligatoire.");
      if (avecEnvoi && !get("email")) throw new Error("Indiquez l'e-mail du client, ou utilisez « Enregistrer sans envoyer ».");
      const payload = {
        prenom: get("prenom") || null,
        nom: get("nom"),
        email: get("email") || null,
        telephone: get("telephone") || null,
        adresse: get("adresse") || null,
        cp_ville: get("cp_ville") || null,
        produit_ids: choisis,
        distance_m: distanceNum,
        option_ids: optionIds,
        type_pose: typePose || null,
        envoyer: avecEnvoi,
      };
      const fn = avecEnvoi ? envoyer : enregistrer;
      const r = (await fn({ data: payload } as never)) as { devis: DevisPropose[]; sent: boolean };
      return { r, payload };
    },
    onSuccess: ({ r, payload }) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      setResultat({ devis: r.devis, sent: r.sent, telephone: payload.telephone, nom: payload.nom });
      const nums = r.devis.map((d) => d.numero).join(", ");
      if (r.sent) toast.success(r.devis.length > 1 ? `${r.devis.length} choix envoyés au client (${nums}).` : `Proposition ${nums} envoyée au client.`);
      else toast.message(`Devis ${nums} enregistré(s) dans « Devis » — liens à copier ci-dessous.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const messageWa = resultat
    ? resultat.devis.length > 1
      ? `Bonjour ${resultat.nom}, voici nos ${resultat.devis.length} propositions d'installation de borne de recharge :\n` +
        resultat.devis.map((d, i) => `${i + 1}. ${d.borne} — ${montant(d.total_ttc)} TTC : ${d.lien}`).join("\n") +
        "\nAcceptez simplement celle qui vous convient."
      : `Bonjour ${resultat.nom}, voici notre proposition d'installation de borne de recharge : ${resultat.devis[0]?.lien ?? ""}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Réponse express</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choisissez la distance, puis touchez 1 à {MAX_CHOIX} bornes : le prix posé s'affiche tout seul.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-sm p-2 text-muted-foreground hover:text-foreground" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {catalogue.isLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-primary" />
        ) : resultat ? (
          <div className="mt-6 grid gap-4">
            <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
              <p className="text-sm font-bold">
                {resultat.devis.length > 1 ? `${resultat.devis.length} devis au choix` : `Devis ${resultat.devis[0]?.numero}`}{" "}
                {resultat.sent ? "envoyé(s) au client dans un seul e-mail" : "créé(s) (e-mail non envoyé)"}
              </p>
            </div>
            {resultat.devis.map((d) => (
              <label key={d.id} className="block">
                <span className={LIB}>{d.numero} · {d.borne} · {montant(d.total_ttc)} TTC</span>
                <div className="mt-1.5 flex gap-2">
                  <input readOnly value={d.lien} className={`${INPUT} mt-0`} />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(d.lien);
                      toast.success("Lien copié.");
                    }}
                    className="inline-flex items-center gap-2 rounded-sm border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copier
                  </button>
                </div>
              </label>
            ))}
            {whatsappLien(resultat.telephone, messageWa) && (
              <a
                href={whatsappLien(resultat.telephone, messageWa) as string}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-xs font-bold hover:border-primary hover:text-primary"
              >
                Envoyer par WhatsApp
              </a>
            )}
            <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-xs font-bold text-primary-foreground">
              Terminé
            </button>
          </div>
        ) : (
          <form
            className="mt-5 grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ form: e.currentTarget, avecEnvoi: true });
            }}
          >
            {/* 1. Client : résumé en une ligne, détails seulement si besoin */}
            <section className="grid gap-2">
              <TitreEtape n={1} titre="Client" />
              {!voirClient && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold">{prefill?.nom}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[prefill?.email, prefill?.telephone, prefill?.cp_ville].filter(Boolean).join(" · ") || "Coordonnées à compléter"}
                    </span>
                  </span>
                  <button type="button" onClick={() => setVoirClient(true)} className="shrink-0 text-xs font-bold text-primary hover:underline">
                    Modifier
                  </button>
                </div>
              )}
              <div className={voirClient ? "grid gap-3" : "hidden"}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className={LIB}>Prénom</span><input name="prenom" defaultValue={prefill?.prenom ?? ""} className={INPUT} autoComplete="off" /></label>
                  <label className="block"><span className={LIB}>Nom *</span><input name="nom" defaultValue={prefill?.nom ?? ""} className={INPUT} autoComplete="off" /></label>
                  <label className="block"><span className={LIB}>E-mail</span><input name="email" type="email" defaultValue={prefill?.email ?? ""} className={INPUT} autoComplete="off" /></label>
                  <label className="block"><span className={LIB}>Téléphone</span><input name="telephone" type="tel" defaultValue={prefill?.telephone ?? ""} className={INPUT} autoComplete="off" /></label>
                </div>
                <AdresseFields defaultAdresse={prefill?.adresse ?? undefined} defaultCpVille={prefill?.cp_ville ?? undefined} />
              </div>
            </section>

            {/* 2. Distance : un seul clic sur le forfait */}
            <section className="grid gap-2">
              <TitreEtape n={2} titre="Distance tableau électrique → borne" />
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {PALIERS_CABLE_M.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDistance(String(m))}
                    className={`min-h-12 rounded-md border text-sm font-bold ${palier === m ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                  >
                    {m} m
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDistance(String(DISTANCE_MAX_FORFAIT_M + 1))}
                  className={`min-h-12 rounded-md border px-2 text-xs font-bold ${etude ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
                >
                  + de {DISTANCE_MAX_FORFAIT_M} m
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {!distanceSaisie
                  ? "Touchez la distance la plus proche (arrondir au-dessus)."
                  : etude
                    ? `Plus de ${DISTANCE_MAX_FORFAIT_M} m : passez faire une visite, pas de prix automatique.`
                    : prefill?.metrage_m && palierPourDistance(prefill.metrage_m) === palier
                      ? `Le client a indiqué ${String(prefill.metrage_m).replace(".", ",")} m → forfait ${palier} m.`
                      : `Forfait jusqu'à ${palier} m de câble.`}
              </p>
            </section>

            {/* 3. Bornes : cartes avec le prix final, toucher pour choisir */}
            {!etude && (
              <section className="grid gap-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <TitreEtape n={3} titre={`Bornes à proposer (${choisis.length}/${MAX_CHOIX})`} />
                  <div className="flex gap-2">
                    <select aria-label="Marque" className="rounded-sm border border-border bg-input px-2 py-1.5 text-xs" value={marque} onChange={(e) => setMarque(e.target.value)}>
                      <option value="">Toutes marques</option>
                      {marques.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select aria-label="Puissance" className="rounded-sm border border-border bg-input px-2 py-1.5 text-xs" value={puissance} onChange={(e) => setPuissance(e.target.value)}>
                      <option value="">Toutes puissances</option>
                      {puissances.map((p) => <option key={p} value={String(p)}>{String(p).replace(".", ",")} kW</option>)}
                    </select>
                  </div>
                </div>
                {!distanceSaisie && <p className="text-xs text-muted-foreground">Choisissez d'abord la distance pour voir les prix.</p>}
                <div className="grid gap-2">
                  {prets.length === 0 && distanceSaisie && (
                    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">Aucune borne avec prix prêt pour ces critères.</p>
                  )}
                  {prets.map((p) => carteBorne(p))}
                </div>
                {autres.length > 0 && (
                  <div>
                    <button type="button" onClick={() => setVoirAutres((v) => !v)} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                      {voirAutres ? "▾" : "▸"} {autres.length} autre(s) borne(s) sans prix complet
                    </button>
                    {voirAutres && <div className="mt-2 grid gap-2">{autres.map((p) => carteBorne(p))}</div>}
                  </div>
                )}
              </section>
            )}

            {/* Détails facultatifs */}
            {!etude && (
              <section>
                <button type="button" onClick={() => setVoirPlus((v) => !v)} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                  {voirPlus ? "▾" : "▸"} Options et type de pose (facultatif){optionIds.length ? ` · ${optionIds.length} option(s)` : ""}
                </button>
                {voirPlus && (
                  <div className="mt-2 grid gap-3 rounded-md border border-border p-3">
                    <label className="block">
                      <span className={LIB}>Type d'installation</span>
                      <select className={INPUT} value={typePose} onChange={(e) => setTypePose(e.target.value)}>
                        <option value="">À préciser</option>
                        {TYPES_POSE.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </label>
                    {options.length > 0 && (
                      <div className="grid gap-1.5">
                        <span className={LIB}>Options ajoutées au prix</span>
                        {options.map((o) => (
                          <label key={o.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={optionIds.includes(o.id)}
                              onChange={(e) => setOptionIds((x) => (e.target.checked ? [...x, o.id] : x.filter((i) => i !== o.id)))}
                            />
                            {o.libelle} (+{montant(o.prix_ttc)} TTC)
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* 4. Récapitulatif clair avant envoi */}
            {!etude && (
              <section className="grid gap-2">
                <TitreEtape n={4} titre="Ce que le client va recevoir" />
                {choisis.length === 0 || !distanceSaisie ? (
                  <p className="text-xs text-muted-foreground">Choisissez la distance et au moins une borne.</p>
                ) : (
                  <ul className="grid gap-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
                    {choisis.map((id) => {
                      const p = actifs.find((x) => x.id === id);
                      const a = analyses.find((x) => x.produit_id === id);
                      if (!p) return null;
                      const ok = a ? proposable(a) : false;
                      return (
                        <li key={id} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">{p.marque} — {p.nom_commercial}</span>
                          <span className={`shrink-0 font-bold ${a && !ok ? "text-destructive" : ""}`}>
                            {a?.total_ttc != null ? `${montant(a.total_ttc)} TTC` : "—"}
                            {a && !ok ? " · à corriger" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="submit"
                    disabled={mutation.isPending || bloque}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {choisis.length > 1 ? `Envoyer les ${choisis.length} choix` : "Envoyer la proposition"}
                  </button>
                  <button
                    type="button"
                    disabled={mutation.isPending || bloque}
                    onClick={(e) => {
                      const form = e.currentTarget.closest("form");
                      if (form) mutation.mutate({ form, avecEnvoi: false });
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-bold hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Enregistrer sans envoyer
                  </button>
                </div>
              </section>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

/** Résultat d'une borne cochée : prix, marge (administrateur), verrou et corrections rapides. */
function CarteAnalyse({
  a,
  p,
  estAdmin,
  onChange,
}: {
  a: AnalyseBorneProposee;
  p: ProduitCatalogue;
  estAdmin: boolean;
  onChange: () => void;
}) {
  const sauverAchat = useServerFn(enregistrerAchatCatalogue);
  const sauverForfaits = useServerFn(enregistrerForfaitsCatalogue);
  const [achat, setAchat] = useState("");
  const enCours = useMutation({
    mutationFn: async (action: { type: "achat"; valeur: number } | { type: "prix"; palier: PalierCable; valeur: number }) => {
      if (action.type === "achat") {
        const x = p.achat;
        await sauverAchat({
          data: {
            produit_id: p.id,
            fournisseur: x?.fournisseur ?? null,
            reference_fournisseur: x?.reference_fournisseur ?? null,
            prix_achat_ht: action.valeur,
            tva_achat_pct: x?.tva_achat_pct ?? 20,
            remise_pct: x?.remise_pct ?? 0,
            frais_livraison_ht: x?.frais_livraison_ht ?? 0,
            disponibilite: x?.disponibilite ?? null,
            justificatif_path: x?.justificatif_path ?? null,
            actualise_le: new Date().toISOString().slice(0, 10),
          },
        } as never);
      } else {
        await sauverForfaits({ data: { produit_id: p.id, forfaits: { ...p.forfaits, [action.palier]: action.valeur } } } as never);
      }
    },
    onSuccess: () => {
      toast.success("Enregistré dans le catalogue.");
      onChange();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });
  const nom = `${p.marque} — ${p.nom_commercial}`;
  const conseille = a.detail?.prix_conseille_ttc ?? null;

  return (
    <div aria-label={nom}>
      {!a.achat_confirme ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-destructive">
            Prix d'achat pas encore saisi : impossible de vérifier vos 500 € de marge.
          </p>
          {estAdmin ? (
            <div className="flex gap-2">
              <input
                value={achat}
                onChange={(e) => setAchat(e.target.value)}
                inputMode="decimal"
                placeholder="Votre prix d'achat HT de la borne"
                className={`${INPUT} mt-0`}
              />
              <button
                type="button"
                disabled={enCours.isPending || !(lireNombre(achat) && (lireNombre(achat) ?? 0) > 0)}
                onClick={() => enCours.mutate({ type: "achat", valeur: lireNombre(achat) as number })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {enCours.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Enregistrer
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Demandez à l'administrateur de le saisir.</p>
          )}
        </div>
      ) : a.total_ttc == null ? (
        <p className="text-sm font-semibold text-destructive">Aucun prix n'est renseigné pour le forfait {a.palier} m.</p>
      ) : (
        <div className="space-y-1.5">
          {estAdmin && a.detail && (
            <p className="text-xs text-muted-foreground">
              Prix de revient {montant(a.detail.revient_ht)} HT · marge {montant(a.detail.marge_ht)} HT · prix conseillé {montant(conseille)} TTC
              {a.provisoire ? " · marge provisoire (coûts à compléter)" : ""}
            </p>
          )}
          {!a.suffisante ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">Verrouillé : marge sous {MARGE_PLANCHER_HT} € HT.</span>
              {estAdmin && conseille != null && a.palier != null && (
                <button
                  type="button"
                  disabled={enCours.isPending}
                  onClick={() => enCours.mutate({ type: "prix", palier: a.palier as PalierCable, valeur: conseille - a.options_ttc })}
                  className="rounded-sm bg-destructive px-2.5 py-1.5 text-xs font-bold text-destructive-foreground disabled:opacity-50"
                >
                  Passer ce forfait à {montant(conseille - a.options_ttc)}
                </button>
              )}
            </div>
          ) : a.tolerance ? (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Marge entre {MARGE_PLANCHER_HT} et {MARGE_MINIMUM_HT} € : accepté.
            </p>
          ) : (
            <p className="text-xs font-semibold text-primary">✓ Prêt à proposer (forfait jusqu'à {a.palier} m).</p>
          )}
          {a.suffisante && a.provisoire && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Marge provisoire : certains coûts de référence ne sont pas encore renseignés.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TitreEtape({ n, titre }: { n: number; titre: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
      {titre}
    </h3>
  );
}
