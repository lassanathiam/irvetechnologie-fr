import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Camera,
  Download,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Package,
  Plus,
  Euro,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { AdresseFields } from "@/components/AdresseFields";
import { compressImage } from "@/lib/image-compress";
import {
  comptePhotosPartenaire,
  connexionPartenaire,
  creerDossierPartenaire,
  deconnexionPartenaire,
  definirPinPartenaire,
  getAccesPartenaire,
  getEspacePartenaire,
  majMaterielPartenaire,
  uploadPhotoPartenaire,
  MATERIEL_LABELS,
  MATERIEL_STATUTS,
  proposerMontantPartenaire,
  PHOTO_CATEGORIES,
  PHOTO_CATEGORIES_LABELS,
} from "@/lib/partenaires.functions";
import {
  isDossierEnCours,
  isDossierFacture,
  isDossierNouveau,
  isDossierTermine,
} from "@/lib/partenaireDossierBuckets";


export const Route = createFileRoute("/partenaire/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Espace partenaire — IRVE Technologie" },
      {
        name: "description",
        content:
          "Saisie des dossiers d'intervention pour les partenaires d'IRVE Technologie : client, adresse, montant et date de rendez-vous.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PagePartenaire,
});

const INPUT =
  "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

const eurosFr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

const cleSession = (token: string) => `partenaire-session:${token}`;

/* --------------------- Installation de l'application --------------------- */

function InstallerApp() {
  const [prompt, setPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [installee, setInstallee] = useState(false);
  const [aide, setAide] = useState(false);

  useEffect(() => {
    setInstallee(window.matchMedia("(display-mode: standalone)").matches);
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installee) return null;

  return (
    <section className="bg-card border border-border rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold inline-flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" /> Installer l&apos;application
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajoutez cet espace sur votre téléphone ou votre ordinateur : plus besoin de retrouver le
            lien, votre code à 6 chiffres suffit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (prompt) void prompt.prompt();
            else setAide((v) => !v);
          }}
          className="bg-primary text-primary-foreground rounded-sm px-4 py-2.5 text-sm font-semibold min-h-11"
        >
          Installer
        </button>
      </div>
      {aide && !prompt && (
        <p className="text-xs text-muted-foreground mt-3">
          Sur iPhone/iPad : bouton « Partager » puis « Sur l&apos;écran d&apos;accueil ». Sur
          ordinateur : icône d&apos;installation dans la barre d&apos;adresse, ou menu du navigateur
          puis « Installer ».
        </p>
      )}
    </section>
  );
}

/* ------------------------- Accès par code à 6 chiffres ------------------------ */

function PagePartenaire() {
  const { token } = Route.useParams();
  const chargerAcces = useServerFn(getAccesPartenaire);
  const definirPin = useServerFn(definirPinPartenaire);
  const connexion = useServerFn(connexionPartenaire);

  const [session, setSession] = useState<string | null>(null);
  const [pret, setPret] = useState(false);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setSession(localStorage.getItem(cleSession(token)));
    setPret(true);
  }, [token]);

  const acces = useQuery({
    queryKey: ["acces-partenaire", token, session],
    queryFn: () => chargerAcces({ data: { token, session } }),
    enabled: pret,
    retry: 1,
  });

  function ouvrir(s: string) {
    localStorage.setItem(cleSession(token), s);
    setSession(s);
    setPin("");
    setPin2("");
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!/^\d{6}$/.test(pin)) {
      setErreur("Le code doit contenir 6 chiffres.");
      return;
    }
    setBusy(true);
    try {
      if (acces.data?.pin_defini) {
        const r = await connexion({ data: { token, pin } });
        ouvrir(r.session);
      } else {
        if (pin !== pin2) {
          setErreur("Les deux codes ne sont pas identiques.");
          return;
        }
        const r = await definirPin({ data: { token, pin } });
        ouvrir(r.session);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (acces.isError) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="text-sm text-destructive text-center">
          Ce lien de saisie n&apos;est plus valide. Contactez IRVE Technologie.
        </p>
      </main>
    );
  }

  if (!pret || acces.isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!acces.data?.session_valide) {
    const premiereFois = !acces.data?.pin_defini;
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-5 py-10">
        <form onSubmit={valider} className="w-full max-w-sm bg-card border border-border rounded-xl p-6 grid gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-9 w-9" />
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-sm">Espace partenaire</p>
              <p className="text-mono text-[11px] text-primary uppercase tracking-[0.14em]">
                {acces.data?.nom ?? "…"} · IRVE Technologie
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground inline-flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            {premiereFois
              ? "Première connexion : choisissez votre code à 6 chiffres. Il protégera vos dossiers et vos informations de facturation."
              : "Saisissez votre code à 6 chiffres pour accéder à vos dossiers."}
          </p>

          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Code à 6 chiffres</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${INPUT} text-center text-2xl tracking-[0.5em]`}
              placeholder="••••••"
            />
          </label>

          {premiereFois && (
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Confirmez le code</span>
              <input
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                className={`${INPUT} text-center text-2xl tracking-[0.5em]`}
                placeholder="••••••"
              />
            </label>
          )}

          {erreur && <p className="text-sm text-destructive">{erreur}</p>}

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-sm px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 min-h-11"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {premiereFois ? "Créer mon code" : "Entrer"}
          </button>

          <p className="text-xs text-muted-foreground">
            Code oublié ? Demandez sa réinitialisation à IRVE Technologie au 06 33 65 78 40.
          </p>
        </form>
      </main>
    );
  }

  return (
    <EspacePartenaire
      token={token}
      session={session!}
      onDeconnexion={() => {
        localStorage.removeItem(cleSession(token));
        setSession(null);
      }}
    />
  );
}

function EspacePartenaire({
  token,
  session,
  onDeconnexion,
}: {
  token: string;
  session: string;
  onDeconnexion: () => void;
}) {
  const charger = useServerFn(getEspacePartenaire);
  const creer = useServerFn(creerDossierPartenaire);
  const envoyerPhoto = useServerFn(uploadPhotoPartenaire);
  const chargerComptes = useServerFn(comptePhotosPartenaire);
  const majMateriel = useServerFn(majMaterielPartenaire);
  const proposerMontant = useServerFn(proposerMontantPartenaire);
  const deconnecter = useServerFn(deconnexionPartenaire);

  const espace = useQuery({
    queryKey: ["espace-partenaire", token],
    queryFn: () => charger({ data: { token, session } }),
    retry: 2,
  });
  const photos = useQuery({
    queryKey: ["photos-partenaire", token],
    queryFn: () => chargerComptes({ data: { token, session } }),
    retry: 1,
  });

  const [form, setForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rdvAPrendre, setRdvAPrendre] = useState(true);
  /** Envoi de photos en cours, sous la forme « idDossier:catégorie ». */
  const [envoi, setEnvoi] = useState<string | null>(null);
  /** Dossier dont l'état du matériel est en cours d'enregistrement. */
  const [materielBusy, setMaterielBusy] = useState<string | null>(null);
  /** Dossier dont le montant valorisé est en cours d'envoi. */
  const [montantBusy, setMontantBusy] = useState<string | null>(null);

  async function envoyerValorisation(rendezvousId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);
    const montant = String(fd.get("montant_ht") ?? "").trim();
    if (!montant) {
      setError("Indiquez le montant valorisé HT.");
      return;
    }
    setError(null);
    setNotice(null);
    setMontantBusy(rendezvousId);
    try {
      await proposerMontant({
        data: {
          token,
          session,
          rendezvous_id: rendezvousId,
          montant_ht: montant,
          note: String(fd.get("note") ?? "").trim() || null,
        },
      });
      setNotice("Montant valorisé transmis à IRVE Technologie pour validation.");
      await espace.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible. Réessayez.");
    } finally {
      setMontantBusy(null);
    }
  }

  async function ajouterPhotos(
    rendezvousId: string,
    categorie: (typeof PHOTO_CATEGORIES)[number],
    fichiers: FileList | null,
  ) {
    if (!fichiers?.length) return;
    setError(null);
    setNotice(null);
    setEnvoi(`${rendezvousId}:${categorie}`);
    let ok = 0;
    try {
      for (const fichier of Array.from(fichiers).slice(0, 10)) {
        const data_url = await compressImage(fichier, 1280, 0.66);
        await envoyerPhoto({
          data: { token, session, rendezvous_id: rendezvousId, data_url, categorie },
        });
        ok++;
      }
      setNotice(
        `${ok} photo${ok > 1 ? "s" : ""} « ${PHOTO_CATEGORIES_LABELS[categorie]} » transmise${
          ok > 1 ? "s" : ""
        } à IRVE Technologie.`,
      );
      void photos.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi des photos impossible. Réessayez.");
    } finally {
      setEnvoi(null);
    }
  }

  async function changerMateriel(
    rendezvousId: string,
    statut: (typeof MATERIEL_STATUTS)[number],
  ) {
    setError(null);
    setNotice(null);
    setMaterielBusy(rendezvousId);
    try {
      await majMateriel({ data: { token, session, rendezvous_id: rendezvousId, materiel_statut: statut } });
      setNotice(`${MATERIEL_LABELS[statut]} — enregistré.`);
      await espace.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible. Réessayez.");
    } finally {
      setMaterielBusy(null);
    }
  }


  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const fd = new FormData(formElement);
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
      const resultat = await creer({
        data: {
          token,
          session,
          client_nom: get("client_nom"),
          client_telephone: get("client_telephone") || null,
          client_email: get("client_email") || null,
          adresse: get("adresse"),
          cp_ville: get("cp_ville") || null,
          designation: get("designation") || null,
          metrage_m: get("metrage_m") || null,
          puissance_borne: get("puissance_borne") || null,
          phase_installation: get("phase_installation") || null,
          type_pose: get("type_pose") || null,
          date_debut: rdvAPrendre ? null : get("date_debut") || null,
          montant_ht: get("montant_ht"),
          notes: get("notes") || null,
          materiel_statut: (get("materiel_statut") ||
            "en_cours") as (typeof MATERIEL_STATUTS)[number],
        },
      });
      if (!resultat?.ok) throw new Error("Le dossier n'a pas pu être enregistré.");
      setNotice("Dossier transmis à IRVE Technologie.");
      setForm(false);
      setRdvAPrendre(true);
      formElement.reset();
      void espace.refetch();
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
          Ce lien de saisie n'est plus valide. Contactez IRVE Technologie.
        </p>
      </main>
    );
  }

  const dossiers = espace.data?.dossiers ?? [];
  const dossiersNouveaux = dossiers.filter(isDossierNouveau);
  const dossiersEnCours = dossiers.filter(isDossierEnCours);
  const dossiersTerminesAFacturer = dossiers.filter((d) => isDossierTermine(d) && !isDossierFacture(d));
  const dossiersFactures = dossiers.filter(isDossierFacture);

  function renderDossier(d: (typeof dossiers)[number]) {
    return (
      <li key={d.id} className="bg-card border border-border rounded-xl p-4">
        <p className="font-medium text-sm">
          {d.client_nom}
          {d.designation ? (
            <span className="text-muted-foreground font-normal"> — {d.designation}</span>
          ) : null}
        </p>
        {(d.metrage_m != null || d.puissance_borne || d.phase_installation || d.type_pose) && (
          <p className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {d.metrage_m != null && <span>{Number(d.metrage_m)} m</span>}
            {d.puissance_borne && <span>{d.puissance_borne}</span>}
            {d.phase_installation && <span>{d.phase_installation}</span>}
            {d.type_pose && <span>Pose {d.type_pose.toLowerCase()}</span>}
          </p>
        )}
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
          {d.termine_at
            ? `Terminé le ${new Date(d.termine_at).toLocaleString("fr-FR")}`
            : d.demarre_at
              ? "Travaux en cours"
              : d.statut === "realise"
                ? "Réalisé"
                : d.date_a_confirmer
                  ? "En attente de planification"
                  : "Planifié"}
        </p>

        <div className="mt-3 border-t border-border pt-3 space-y-3">
          {(d.termine_at || d.statut === "termine" || d.statut === "realise") && (
            <div>
              <p className="text-mono text-[11px] text-muted-foreground uppercase inline-flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" /> Valorisation des travaux
              </p>
              {(d.metrage_reel_m != null || d.metrage_inclus_m != null) && (
                <p className="text-xs text-muted-foreground mt-2">
                  Métrage posé : {Number(d.metrage_reel_m ?? d.metrage_m ?? 0)} m
                  {" · "}inclus : {Number(d.metrage_inclus_m ?? 5)} m
                  {Math.max(
                    0,
                    Number(d.metrage_reel_m ?? 0) - Number(d.metrage_inclus_m ?? 5),
                  ) > 0 && (
                    <span className="text-primary">
                      {" · "}
                      {Math.max(
                        0,
                        Number(d.metrage_reel_m ?? 0) - Number(d.metrage_inclus_m ?? 5),
                      )}{" "}
                      m supplémentaires
                    </span>
                  )}
                </p>
              )}
              {d.montant_propose_ht != null ? (
                <p className="text-xs mt-2">
                  <span className="text-mono">
                    {eurosFr(Number(d.montant_propose_ht))} HT proposé
                  </span>{" "}
                  —{" "}
                  {d.montant_valide_at ? (
                    <span className="text-primary">validé par IRVE Technologie</span>
                  ) : (
                    <span className="text-muted-foreground">en attente de validation</span>
                  )}
                </p>
              ) : null}
              <form
                onSubmit={(e) => void envoyerValorisation(d.id, e)}
                className="mt-2 grid gap-2 sm:grid-cols-[130px_1fr_auto] sm:items-end"
              >
                <label className="text-xs text-muted-foreground">
                  Montant HT (€)
                  <input
                    name="montant_ht"
                    inputMode="decimal"
                    defaultValue={
                      d.montant_propose_ht != null
                        ? String(d.montant_propose_ht)
                        : Number(d.montant_ht ?? 0) > 0
                          ? String(d.montant_ht)
                          : ""
                    }
                    className={INPUT}
                    placeholder="620"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Précision (plus-value, métrage…)
                  <input name="note" className={INPUT} placeholder="+ 12 m de câble" />
                </label>
                <button
                  type="submit"
                  disabled={montantBusy === d.id}
                  className="bg-primary text-primary-foreground rounded-sm px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 min-h-11"
                >
                  {montantBusy === d.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Transmettre
                </button>
              </form>
            </div>
          )}
          <div>
            <p className="text-mono text-[11px] text-muted-foreground uppercase inline-flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Matériel
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MATERIEL_STATUTS.map((s) => {
                const actif = (d.materiel_statut ?? "en_cours") === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={materielBusy === d.id}
                    onClick={() => void changerMateriel(d.id, s)}
                    className={`text-xs font-semibold rounded-sm px-3 py-2.5 border min-h-11 ${
                      actif
                        ? "border-primary text-primary bg-muted"
                        : "border-border text-muted-foreground"
                    } disabled:opacity-60`}
                  >
                    {actif && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />}
                    {MATERIEL_LABELS[s]}
                  </button>
                );
              })}
              {materielBusy === d.id && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
              )}
            </div>
          </div>

          <div>
            <p className="text-mono text-[11px] text-muted-foreground uppercase inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" /> Photos de l&apos;étude
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PHOTO_CATEGORIES.map((cat) => {
                const cle = `${d.id}:${cat}`;
                const nb = photos.data?.[d.id]?.categories?.[cat] ?? 0;
                return (
                  <label
                    key={cat}
                    className="text-sm font-semibold rounded-sm border border-border px-3 py-2.5 min-h-11 inline-flex items-center gap-2 cursor-pointer hover:border-primary hover:text-primary"
                  >
                    {envoi === cle ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0" />
                    )}
                    <span className="min-w-0">
                      {PHOTO_CATEGORIES_LABELS[cat]}
                      {nb > 0 && (
                        <span className="text-mono text-[11px] text-muted-foreground font-normal">
                          {" "}
                          · {nb}
                        </span>
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={envoi !== null}
                      onChange={(e) => {
                        void ajouterPhotos(d.id, cat, e.target.files);
                        e.target.value = "";
                      }}
                      className="hidden"
                    />
                  </label>
                );
              })}
            </div>
            {(photos.data?.[d.id]?.total ?? 0) > 0 && (
              <p className="text-mono text-[11px] text-muted-foreground mt-2">
                {photos.data![d.id]!.total} photo
                {photos.data![d.id]!.total > 1 ? "s" : ""} transmise
                {photos.data![d.id]!.total > 1 ? "s" : ""} à Borne de l&apos;Ouest.
              </p>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center gap-3">
          <BrandLogo className="h-9 w-9" />
          <div className="leading-tight min-w-0">
            <p className="font-extrabold tracking-tight text-sm">Espace partenaire</p>
            <p className="text-mono text-[11px] text-primary uppercase tracking-[0.14em]">
              {espace.data?.nom ?? "…"} · IRVE Technologie
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void deconnecter({ data: { session } });
              onDeconnexion();
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 min-h-11 px-2"
          >
            <LogOut className="h-4 w-4" /> Quitter
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-6 space-y-5">
        {notice && (
          <p className="text-sm text-primary inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {notice}
          </p>
        )}

        <InstallerApp />


        {(espace.data?.dossiers.length ?? 0) > 0 &&
          (() => {
            const tous = espace.data!.dossiers;
            const dates = tous
              .filter((d) => !d.date_a_confirmer && !d.termine_at)
              .sort(
                (a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime(),
              )
              .slice(0, 6);
            const aPlanifier = tous.filter((d) => d.date_a_confirmer && !d.termine_at).length;
            return (
              <section className="bg-card border border-border rounded-xl p-4">
                <h2 className="text-mono text-xs text-primary uppercase inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Agenda des interventions
                </h2>
                {dates.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    Aucune date fixée pour le moment.
                  </p>
                ) : (
                  <ul className="mt-2 grid gap-2">
                    {dates.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm"
                      >
                        <span className="font-medium">
                          {new Date(d.date_debut).toLocaleString("fr-FR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-muted-foreground text-xs min-w-0">
                          {d.client_nom} — {d.cp_ville || d.adresse}
                        </span>
                        <span className="text-mono text-[11px] text-primary uppercase">
                          {MATERIEL_LABELS[
                            (d.materiel_statut ?? "en_cours") as (typeof MATERIEL_STATUTS)[number]
                          ] ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {aPlanifier > 0 && (
                  <p className="text-xs text-muted-foreground mt-3">
                    {aPlanifier} dossier{aPlanifier > 1 ? "s" : ""} en attente de date — Borne de
                    l&apos;Ouest vous rappelle pour la planification.
                  </p>
                )}
              </section>
            );
          })()}

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
                <span className="text-mono text-xs text-muted-foreground">Métrage estimé (m)</span>
                <input name="metrage_m" type="number" min="0" step="0.1" inputMode="decimal" className={INPUT} placeholder="Ex. 18" />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Puissance de la borne</span>
                <select name="puissance_borne" defaultValue="À définir" className={INPUT}>
                  <option>3,7 kW</option><option>7,4 kW</option><option>11 kW</option><option>22 kW</option><option>À définir</option>
                </select>
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Alimentation</span>
                <select name="phase_installation" defaultValue="À définir" className={INPUT}>
                  <option>Monophasé</option><option>Triphasé</option><option>À définir</option>
                </select>
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Type de pose</span>
                <select name="type_pose" defaultValue="À définir" className={INPUT}>
                  <option>Intérieure</option><option>Extérieure</option><option>Sur pied</option><option>À définir</option>
                </select>
              </label>
            </div>

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
              <span className="text-mono text-xs text-muted-foreground">Matériel</span>
              <select name="materiel_statut" defaultValue="en_cours" className={INPUT}>
                {MATERIEL_STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {MATERIEL_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

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
          ) : dossiers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dossier transmis pour le moment.</p>
          ) : (
            <div className="space-y-5">
              {[
                {
                  key: "nouveaux",
                  title: "Nouveaux / à planifier",
                  hint: "Dossiers transmis en attente de démarrage.",
                  items: dossiersNouveaux,
                },
                {
                  key: "encours",
                  title: "Chantiers en cours",
                  hint: "Interventions démarrées par l'équipe terrain.",
                  items: dossiersEnCours,
                },
                {
                  key: "termines",
                  title: "Terminés (à facturer)",
                  hint: "Travaux terminés, en attente de facturation/règlement.",
                  items: dossiersTerminesAFacturer,
                },
                {
                  key: "factures",
                  title: "Facturés",
                  hint: "Chantiers déjà passés en facturation ou payés.",
                  items: dossiersFactures,
                },
              ].map((section) => (
                <div key={section.key} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <span className="text-mono text-[11px] text-primary uppercase">
                      {section.items.length} dossier{section.items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{section.hint}</p>
                  {section.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
                      Aucun dossier dans cette section.
                    </p>
                  ) : (
                    <ul className="grid gap-3">{section.items.map((d) => renderDossier(d))}</ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
