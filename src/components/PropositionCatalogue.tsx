import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Loader2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { AdresseFields } from "@/components/AdresseFields";
import { whatsappLien } from "@/lib/contact-client";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import {
  analyserPropositionCatalogue,
  envoyerPropositionCatalogue,
  getCatalogueCommercial,
} from "@/lib/catalogue-commercial.functions";
import { DISTANCE_MAX_FORFAIT_M, MARGE_MINIMUM_HT, MARGE_PLANCHER_HT } from "@/lib/tarification";
import { montant, PHASE_LIBELLE } from "@/components/catalogue/outils";
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

function PanneauProposition({ onClose, prefill }: { onClose: () => void; prefill?: ReponseExpressPrefill }) {
  const qc = useQueryClient();
  const charger = useServerFn(getCatalogueCommercial);
  const analyser = useServerFn(analyserPropositionCatalogue);
  const enregistrer = useServerFn(envoyerPropositionCatalogue);
  const envoyer = useEnvoiConfirme(envoyerPropositionCatalogue, "Confirmer l'envoi de la proposition au client ?");
  const catalogue = useQuery({ queryKey: ["catalogue-commercial"], queryFn: () => charger() });

  const [marque, setMarque] = useState("");
  const [puissance, setPuissance] = useState("");
  const [produitId, setProduitId] = useState("");
  const [distance, setDistance] = useState(prefill?.metrage_m ? String(prefill.metrage_m) : "");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [typePose, setTypePose] = useState("");
  const [resultat, setResultat] = useState<{ numero: string; lien: string; sent: boolean; telephone: string | null; nom: string } | null>(null);

  const data = catalogue.data;
  const actifs = (data?.produits ?? []).filter((p) => p.actif);
  const marques = Array.from(new Set(actifs.map((p) => p.marque)));
  const puissances = Array.from(new Set(actifs.filter((p) => !marque || p.marque === marque).map((p) => p.puissance_kw))).sort((a, b) => a - b);
  const modeles = actifs.filter((p) => (!marque || p.marque === marque) && (!puissance || String(p.puissance_kw) === puissance));
  const produit = actifs.find((p) => p.id === produitId) ?? null;
  const options = (data?.options ?? []).filter((o) => o.actif && o.prix_ttc != null);
  const distanceNum = Number(distance.replace(",", ".")) || 0;

  const entree = useMemo(
    () => (produitId ? { produit_id: produitId, distance_m: distanceNum, option_ids: optionIds } : null),
    [produitId, distanceNum, optionIds],
  );
  const analyse = useQuery({
    queryKey: ["proposition-catalogue", entree],
    queryFn: () => analyser({ data: entree! } as never),
    enabled: Boolean(entree),
  });
  const a = analyse.data;
  const estAdmin = Boolean(data?.estAdmin);
  const bloque =
    !a || a.etude || !a.achat_confirme || a.total_ttc == null || !a.suffisante;

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
        produit_id: produitId,
        distance_m: distanceNum,
        option_ids: optionIds,
        type_pose: typePose || null,
        envoyer: avecEnvoi,
      };
      const fn = avecEnvoi ? envoyer : enregistrer;
      const r = await fn({ data: payload } as never);
      return { r, payload };
    },
    onSuccess: ({ r, payload }) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      setResultat({ numero: r.numero, lien: r.lien, sent: Boolean(r.sent), telephone: payload.telephone, nom: payload.nom });
      if (r.sent) toast.success(`Proposition ${r.numero} envoyée au client.`);
      else toast.message(`Devis ${r.numero} enregistré dans « Devis » — lien à copier ci-dessous.`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const messageWa = resultat
    ? `Bonjour ${resultat.nom}, voici notre proposition d'installation de borne de recharge : ${resultat.lien}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-4 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Réponse express</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Borne du catalogue, distance de câble, options : le prix TTC est calculé tout seul.
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
                Devis {resultat.numero} {resultat.sent ? "envoyé au client" : "créé (e-mail non envoyé)"}
              </p>
            </div>
            <label className="block">
              <span className={LIB}>Lien à envoyer par SMS ou WhatsApp</span>
              <div className="mt-1.5 flex gap-2">
                <input readOnly value={resultat.lien} className={`${INPUT} mt-0`} />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(resultat.lien);
                    toast.success("Lien copié.");
                  }}
                  className="inline-flex items-center gap-2 rounded-sm border border-border px-3 text-xs font-bold hover:border-primary hover:text-primary"
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </button>
              </div>
            </label>
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
            className="mt-5 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ form: e.currentTarget, avecEnvoi: true });
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={LIB}>Prénom</span><input name="prenom" defaultValue={prefill?.prenom ?? ""} className={INPUT} autoComplete="off" /></label>
              <label className="block"><span className={LIB}>Nom *</span><input name="nom" required defaultValue={prefill?.nom ?? ""} className={INPUT} autoComplete="off" /></label>
              <label className="block"><span className={LIB}>E-mail</span><input name="email" type="email" defaultValue={prefill?.email ?? ""} className={INPUT} autoComplete="off" /></label>
              <label className="block"><span className={LIB}>Téléphone</span><input name="telephone" type="tel" defaultValue={prefill?.telephone ?? ""} className={INPUT} autoComplete="off" /></label>
            </div>
            <AdresseFields defaultAdresse={prefill?.adresse ?? undefined} defaultCpVille={prefill?.cp_ville ?? undefined} />

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={LIB}>Marque</span>
                <select className={INPUT} value={marque} onChange={(e) => { setMarque(e.target.value); setProduitId(""); }}>
                  <option value="">Toutes</option>
                  {marques.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={LIB}>Puissance</span>
                <select className={INPUT} value={puissance} onChange={(e) => { setPuissance(e.target.value); setProduitId(""); }}>
                  <option value="">Toutes</option>
                  {puissances.map((p) => <option key={p} value={String(p)}>{String(p).replace(".", ",")} kW</option>)}
                </select>
              </label>
              <label className="block">
                <span className={LIB}>Type d'installation</span>
                <select className={INPUT} value={typePose} onChange={(e) => setTypePose(e.target.value)}>
                  <option value="">À préciser</option>
                  {TYPES_POSE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className={LIB}>Modèle *</span>
              <select className={INPUT} value={produitId} onChange={(e) => setProduitId(e.target.value)}>
                <option value="">Choisir une borne ({modeles.length})</option>
                {modeles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.marque} — {p.nom_commercial} · {String(p.puissance_kw).replace(".", ",")} kW {PHASE_LIBELLE[p.phase]}
                    {p.achat_confirme ? "" : " · prix d'achat à confirmer"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={LIB}>Distance tableau électrique → borne (m)</span>
              <input value={distance} onChange={(e) => setDistance(e.target.value)} inputMode="decimal" placeholder="Ex. 8" className={INPUT} />
            </label>

            {options.length > 0 && (
              <div className="grid gap-1.5">
                <span className={LIB}>Options</span>
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

            <div className="rounded-md border border-border bg-muted/30 p-4">
              {!produit ? (
                <p className="text-sm text-muted-foreground">Choisissez une borne pour obtenir le prix.</p>
              ) : analyse.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : !a ? (
                <p className="text-sm text-destructive">Calcul impossible pour le moment.</p>
              ) : a.etude ? (
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Plus de {DISTANCE_MAX_FORFAIT_M} m : étude personnalisée. Aucun prix automatique.
                </p>
              ) : !a.achat_confirme ? (
                <p className="text-sm font-semibold text-destructive">
                  Prix d'achat à confirmer : cette borne ne peut pas encore être proposée.
                  {estAdmin && <> Renseignez-le dans <Link to="/catalogue-commercial" className="underline">le catalogue commercial</Link>.</>}
                </p>
              ) : a.total_ttc == null ? (
                <p className="text-sm font-semibold text-destructive">Aucun prix n'est renseigné pour le forfait {a.palier} m de cette borne.</p>
              ) : (
                <div className="space-y-2">
                  <p className={LIB}>Prix à proposer — forfait jusqu'à {a.palier} m</p>
                  <p className="text-2xl font-bold">{montant(a.total_ttc)} <span className="text-sm font-normal text-muted-foreground">TTC</span></p>
                  {a.options_ttc > 0 && (
                    <p className="text-xs text-muted-foreground">Dont borne et pose {montant(a.forfait_ttc)} + options {montant(a.options_ttc)}</p>
                  )}
                  {estAdmin && a.detail && (
                    <p className="text-xs text-muted-foreground">
                      Prix de revient {montant(a.detail.revient_ht)} HT · marge {montant(a.detail.marge_ht)} HT · prix conseillé {montant(a.detail.prix_conseille_ttc)} TTC
                      {a.provisoire ? " · marge provisoire (coûts à compléter)" : ""}
                    </p>
                  )}
                  {!a.suffisante && (
                    <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Verrouillé : marge sous {MARGE_PLANCHER_HT} € HT. Ce prix ne permet pas de gagner sa vie sur ce chantier.
                        {estAdmin && a.detail?.prix_conseille_ttc != null
                          ? ` Montez le forfait à ${montant(a.detail.prix_conseille_ttc)} TTC dans le catalogue.`
                          : " Demandez à l'administrateur de revoir le prix du forfait."}
                      </span>
                    </div>
                  )}
                  {a.suffisante && a.tolerance && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      Marge légèrement sous {MARGE_MINIMUM_HT} € (entre {MARGE_PLANCHER_HT} et {MARGE_MINIMUM_HT} €) : accepté.
                    </p>
                  )}
                  {a.suffisante && a.provisoire && (
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Marge provisoire : certains coûts de référence ne sont pas encore renseignés.</p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="submit"
                disabled={mutation.isPending || bloque}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Envoyer la proposition
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
          </form>
        )}
      </div>
    </div>
  );
}
