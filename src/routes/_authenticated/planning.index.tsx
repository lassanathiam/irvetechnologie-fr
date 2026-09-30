import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  FileCheck2,
  Euro,
  Eye,
  EyeOff,
  Flag,
  Fuel,
  Play,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Route as RouteIcon,
  ListChecks,
  Trophy,
  Camera,
  ShieldCheck,
  Mail,
  Trash2,
  Upload,
  Smartphone,
  ClipboardCheck,
  Clock3,
  Navigation,
  Zap,
} from "lucide-react";
import {
  appliquerProgramme,
  archiverRendezVous,
  createRendezVous,
  demarrerChantier,
  affecterTechnicien,
  envoyerPropositionRdv,
  terminerChantier,
  deleteRendezVous,
  listChantiersRealises,
  listPhotosChantier,
  listRendezVous,
  programmerEnsemble,
  updateStatutRendezVous,
  updateAdresseRendezVous,
  updateDossierRendezVous,
  validerChantier,
  updateFacturationRdv,
  type DossierRendezVousInput,
  type RendezVousInput,
} from "@/lib/planning.functions";

import {
  deleteVoirie,
  listVoirie,
  saveVoirie,
  VOIRIE_STATUTS,
  type VoirieInput,
} from "@/lib/voirie.functions";
import {
  listPartenaires,
  MATERIEL_LABELS,
  PHOTO_CATEGORIES_LABELS,
} from "@/lib/partenaires.functions";
import { ProShell } from "@/components/ProShell";
import { InterventionsMap, STATUT_COLORS, type MapMarker } from "@/components/InterventionsMap";
import {
  comparerDeuxChantiers,
  itineraireDepuisBase,
  tourneeReelle,
} from "@/lib/routing.functions";

import { AgendaMois } from "@/components/AgendaMois";
import { AdresseFields } from "@/components/AdresseFields";
import { telLien, whatsappLien, wazeLien } from "@/lib/contact-client";
import { estNoteAutoDepuisDevis } from "@/lib/devis-to-planning";
import { dureeFr, TECHNICIENS, technicienByNom } from "@/lib/geo";
import { economieCarburant, groupesProximite, optimiserTournee, planifierCampagne } from "@/lib/tournee";
import { useIsMobile } from "@/hooks/use-mobile";
import RetourTravauxSheet, { type RetourTravauxRdv } from "@/components/RetourTravauxSheet";
import { ImportRdvDialog } from "@/components/ImportRdvDialog";
import { DonneurOrdreField } from "@/components/DonneurOrdreField";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/planning/")({
  validateSearch: (search: Record<string, unknown>): { rdv?: string; vue?: string } => ({
    rdv: typeof search.rdv === "string" ? search.rdv : undefined,
    vue: search.vue === "realises" ? "realises" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planning des interventions — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Planification des rendez-vous IRVE : adresse géolocalisée, tournées optimisées, validation de chantier et autorisations de voirie.",
      },
      { property: "og:title", content: "Planning des interventions — Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Planification et suivi terrain des interventions IRVE de Borne de l'Ouest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanningPage,
});


const TYPES = [
  { v: "visite", l: "Visite technique" },
  { v: "installation", l: "Installation" },
  { v: "maintenance", l: "Maintenance" },
  { v: "sav", l: "SAV / dépannage" },
  { v: "controle", l: "Contrôle / conformité" },
] as const;

const STATUTS = [
  { v: "planifie", l: "Planifié" },
  { v: "confirme", l: "Confirmé" },
  { v: "en_cours", l: "Travaux en cours" },
  { v: "termine", l: "Terminé" },
  { v: "realise", l: "Réalisé" },
  { v: "annule", l: "Annulé" },
] as const;

/** Code couleur unique pour l'état d'un chantier (badge + liseré + fond de la fiche). */
const STATUT_STYLE: Record<
  string,
  { label: string; badge: string; barre: string; point: string; fond: string }
> = {
  planifie: {
    label: "Planifié",
    badge: "bg-blue-600/15 text-blue-700 dark:text-blue-300 border-blue-600/50",
    barre: "before:bg-blue-600",
    point: "bg-blue-600",
    fond: "bg-blue-50 dark:bg-blue-600/10 border-blue-300/70 dark:border-blue-600/30",
  },
  confirme: {
    label: "Confirmé",
    badge: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/50",
    barre: "before:bg-sky-500",
    point: "bg-sky-500",
    fond: "bg-sky-50 dark:bg-sky-500/10 border-sky-300/70 dark:border-sky-500/30",
  },
  en_cours: {
    label: "Travaux en cours",
    badge: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/50",
    barre: "before:bg-violet-500",
    point: "bg-violet-500",
    fond: "bg-violet-50 dark:bg-violet-500/10 border-violet-300/70 dark:border-violet-500/30",
  },
  termine: {
    label: "Terminé",
    badge: "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/50",
    barre: "before:bg-teal-500",
    point: "bg-teal-500",
    fond: "bg-teal-50 dark:bg-teal-500/10 border-teal-300/70 dark:border-teal-500/30",
  },
  realise: {
    label: "Réalisé",
    badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/50",
    barre: "before:bg-emerald-500",
    point: "bg-emerald-500",
    fond: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300/70 dark:border-emerald-500/30",
  },
  annule: {
    label: "Annulé",
    badge: "bg-destructive/20 text-destructive border-destructive/50",
    barre: "before:bg-destructive",
    point: "bg-destructive",
    fond: "bg-destructive/10 border-destructive/30",
  },
};

const styleStatut = (s?: string | null) => STATUT_STYLE[s ?? "planifie"] ?? STATUT_STYLE.planifie!;




const VOIRIE_LABEL = Object.fromEntries(VOIRIE_STATUTS.map((s) => [s.v, s.l])) as Record<
  string,
  string
>;

const dateTimeFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(
    new Date(iso),
  );

const MAX_DOC = 8_000_000;

const FACTU_LABEL: Record<string, string> = {
  a_facturer: "à facturer",
  facture: "facturé",
  paye: "payé",
};

const TYPES_INTERVENTION = ["visite", "installation", "maintenance", "sav", "controle"] as const;
const STATUTS_DOSSIER = ["planifie", "confirme", "en_cours", "termine", "realise", "annule"] as const;
const ORIGINES_DOSSIER = ["direct", "sous_traitance"] as const;
const STATUTS_FACTURATION = ["a_facturer", "facture", "paye"] as const;

function optionValue<const T extends readonly string[]>(value: string, options: T, fallback: T[number]): T[number] {
  return options.includes(value) ? (value as T[number]) : fallback;
}

const ETIQUETTES_SUGGEREES = [
  "Borne 7,4 kW (monophasé 32A)",
  "Borne 11 kW",
  "Borne 22 kW",
  "Maison",
  "Copropriété",
  "Entreprise",
  "Tranchée",
  "Voirie",
  "Urgent",
  "SAV",
];

const normaliserEtiquettes = (etiquettes: string[]) => {
  const propres: string[] = [];
  for (const brute of etiquettes) {
    const valeur = brute.trim();
    if (!valeur) continue;
    const precedente = propres[propres.length - 1];
    const debutPuissance = precedente?.match(/^(.*\D)\s(\d+)$/i);
    const finPuissance = valeur.match(/^(\d+)\s*kW$/i);
    if (debutPuissance && finPuissance) {
      propres[propres.length - 1] = `${debutPuissance[1].trim()} ${debutPuissance[2]},${finPuissance[1]} kW`;
      continue;
    }
    propres.push(valeur);
  }
  return propres.slice(0, 12);
};

const parseEtiquettes = (v: string) =>
  normaliserEtiquettes(
    v
      .split(/,(?!\d)/)
      .map((s) => s.trim())
      .filter(Boolean),
  );


const eurosFr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n);

function PlanningPage() {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const fetchList = useServerFn(listRendezVous);
  const createFn = useServerFn(createRendezVous);
  const statutFn = useServerFn(updateStatutRendezVous);
  const deleteFn = useServerFn(deleteRendezVous);
  const validerFn = useServerFn(validerChantier);
  const fetchVoirie = useServerFn(listVoirie);
  const saveVoirieFn = useServerFn(saveVoirie);
  const deleteVoirieFn = useServerFn(deleteVoirie);

  const list = useQuery({ queryKey: ["rendezvous"], queryFn: () => fetchList() });
  const voirie = useQuery({ queryKey: ["voirie"], queryFn: () => fetchVoirie() });
  const recherche = Route.useSearch();
  const [active, setActive] = useState<string | null>(recherche.rdv ?? null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<{
    id: string;
    tab: "chantier" | "voirie" | "montant" | "adresse" | "date" | "dossier";
  } | null>(null);
  const [prefillDate, setPrefillDate] = useState<string>("");
  /** Dossier dont les outils de gestion sont dépliés (un seul bouton par fiche). */
  const [dossier, setDossier] = useState<string | null>(recherche.rdv ?? null);
  /** Vue « Nos chantiers réalisés » (bilan du mois), ouverte depuis le tableau de bord. */
  const [vueBilan, setVueBilan] = useState(recherche.vue === "realises");
  /** Mois du bilan (AAAA-MM) ; vide = les 12 derniers mois. */
  const [moisBilan, setMoisBilan] = useState(() => new Date().toISOString().slice(0, 7));
  /** Sélection de plusieurs chantiers à programmer ensemble. */
  const [selection, setSelection] = useState<string[]>([]);
  const [modeSelection, setModeSelection] = useState(false);
  const [dateGroupee, setDateGroupee] = useState("");
  const [modeIntervention, setModeIntervention] = useState(true);
  const [mobileSections, setMobileSections] = useState({
    carte: false,
    rendezvous: false,
    agenda: false,
    trajet: false,
    programme: false,
    proches: false,
  });
  const toggleMobileSection = (section: keyof typeof mobileSections) =>
    setMobileSections((current) => ({ ...current, [section]: !current[section] }));


  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rendezvous"] });
    qc.invalidateQueries({ queryKey: ["voirie"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation({
    mutationFn: (payload: RendezVousInput) => createFn({ data: payload }),
    onSuccess: () => {
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const setStatut = useMutation({
    mutationFn: (p: { id: string; statut: string }) => statutFn({ data: p }),
    onSuccess: (res: {
      ok: boolean;
      sms?: { status: string; to?: string; reason?: string } | null;
      email?: { status: string; to?: string; reason?: string } | null;
    }) => {
      if (res?.email?.status === "sent") {
        toast.success(`Email de confirmation envoyé au client (${res.email.to ?? "adresse masquée"}).`);
      } else if (res?.email?.status === "skipped") {
        toast.message(`Email non envoyé: ${res.email.reason ?? "configuration manquante"}`);
      } else if (res?.email?.status === "failed") {
        toast.error(`Email non envoyé: ${res.email.reason ?? "erreur inconnue"}`);
      }
      if (res?.sms?.status === "sent") {
        toast.success(`SMS de confirmation envoyé au client (${res.sms.to ?? "numéro masqué"}).`);
      } else if (res?.sms?.status === "failed") {
        toast.error(`SMS non envoyé: ${res.sms.reason ?? "erreur inconnue"}`);
      }
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });
  const valider = useMutation({
    mutationFn: (p: { id: string; valide: boolean; commentaire?: string | null; par?: string | null }) =>
      validerFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      refresh();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Validation impossible."),
  });
  const saveVoirieMut = useMutation({
    mutationFn: (payload: VoirieInput) => saveVoirieFn({ data: payload }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Enregistrement de l'autorisation impossible."),
  });
  const factuFn = useServerFn(updateFacturationRdv);
  const dossierFn = useServerFn(updateDossierRendezVous);
  const setFacturation = useMutation({
    mutationFn: (p: {
      id: string;
      origine: "direct" | "sous_traitance";
      partenaire?: string | null;
      montant_ht: number;
      tva_pct?: number;
      statut_facturation: "a_facturer" | "facture" | "paye";
      designation?: string | null;
      etiquettes?: string[];
      metrage_m?: number;
      puissance_borne?: string | null;
      phase_installation?: string | null;
      type_pose?: string | null;

    }) => factuFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });
  const setDossierComplet = useMutation({
    mutationFn: (payload: DossierRendezVousInput) => dossierFn({ data: payload }),
    onSuccess: (res: {
      ok: boolean;
      email?: { status: string; to?: string; reason?: string } | null;
      sms?: { status: string; to?: string; reason?: string } | null;
    }) => {
      setPanel(null);
      setError(null);
      if (res?.email?.status === "sent") {
        toast.success(`Email de confirmation envoyé au client (${res.email.to ?? "adresse masquée"}).`);
      } else if (res?.email?.status === "skipped") {
        toast.message(`Email non envoyé: ${res.email.reason ?? "configuration manquante"}`);
      } else if (res?.email?.status === "failed") {
        toast.error(`Email non envoyé: ${res.email.reason ?? "erreur inconnue"}`);
      }
      if (res?.sms?.status === "sent") {
        toast.success(`SMS de confirmation envoyé au client (${res.sms.to ?? "numéro masqué"}).`);
      } else if (res?.sms?.status === "failed") {
        toast.error(`SMS non envoyé: ${res.sms.reason ?? "erreur inconnue"}`);
      }
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Mise à jour du dossier impossible."),
  });
  const adresseFn = useServerFn(updateAdresseRendezVous);
  const setAdresse = useMutation({
    mutationFn: (p: { id: string; adresse: string; cp_ville?: string | null }) =>
      adresseFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Modification de l'adresse impossible."),
  });
  const removeVoirie = useMutation({
    mutationFn: (id: string) => deleteVoirieFn({ data: { id } }),
    onSuccess: refresh,
  });
  const propositionFn = useServerFn(envoyerPropositionRdv);
  const proposerRdv = useMutation({
    mutationFn: (p: { id: string; relance: boolean }) => propositionFn({ data: p }),
    onSuccess: (r) => {
      refresh();
      toast.success(`Proposition envoyée à ${r.destinataire}`);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Envoi impossible pour le moment."),
  });
  const archiveFn = useServerFn(archiverRendezVous);
  const archiver = useMutation({
    mutationFn: (p: { id: string; archive: boolean }) => archiveFn({ data: p }),
    onSuccess: refresh,
  });
  const demarrerFn = useServerFn(demarrerChantier);
  const demarrer = useMutation({
    mutationFn: (p: { id: string; demarre: boolean }) => demarrerFn({ data: p }),
    onSuccess: refresh,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Démarrage du chantier impossible.";
      setError(msg);
      toast.error(msg);
    },
  });
  const affecterFn = useServerFn(affecterTechnicien);
  const affecter = useMutation({
    mutationFn: (p: { id: string; technicien: string | null }) => affecterFn({ data: p }),
    onSuccess: (_r, p) => {
      refresh();
      // Sélectionne le chantier pour redessiner le trajet depuis le domicile du nouvel intervenant.
      setActive(p.id);
      toast.success(p.technicien ? `Chantier affecté à ${p.technicien}` : "Affectation retirée");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Affectation impossible."),
  });
  const [retourRdv, setRetourRdv] = useState<RetourTravauxRdv | null>(null);
  const terminerFn = useServerFn(terminerChantier);
  const terminer = useMutation({
    mutationFn: (p: { id: string; notifier: boolean }) => terminerFn({ data: p }),
    onSuccess: refresh,
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Clôture du chantier impossible.";
      setError(msg);
      toast.error(msg);
    },
  });
  const programmeFn = useServerFn(appliquerProgramme);
  const appliquer = useMutation({
    mutationFn: (items: Array<{ id: string; date_debut: string }>) =>
      programmeFn({ data: { items } }),
    onSuccess: refresh,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Application du programme impossible."),
  });

  /** Couleur d'identification de chaque partenaire (carte + fiches). */
  const fetchPartenaires = useServerFn(listPartenaires);
  const [importOpen, setImportOpen] = useState(false);
  const partenaires = useQuery({
    queryKey: ["partenaires"],
    queryFn: () => fetchPartenaires(),
  });
  const couleurPartenaire = (nom?: string | null) => {
    if (!nom?.trim()) return null;
    const cible = nom.trim().toLowerCase();
    return (
      partenaires.data?.find((p) => p.nom.trim().toLowerCase() === cible)?.couleur ?? null
    );
  };

  /** Confidentialité : les montants peuvent être masqués à l'écran (chantier, clients présents). */
  const [montantsVisibles, setMontantsVisibles] = useState(true);

  /** Vue « Archives » : les chantiers clôturés sont rangés à part, sans être supprimés. */
  const [vueListe, setVueListe] = useState<"encours" | "annules" | "clotures">("encours");
  const vueArchives = vueListe === "clotures";
  /** Filtre par état de chantier (tout, planifié, confirmé, réalisé, annulé). */
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");

  const toutes = list.data ?? [];
  /** Clôturé = rangé à la main, facturé, ou terminé + rapport/retour complet + validé (automatique). */
  const estArchiveLogique = (r: (typeof toutes)[number]) =>
    Boolean(r.archive) ||
    r.statut_facturation === "facture" ||
    r.statut_facturation === "paye" ||
    (Boolean(r.termine_at || r.statut === "termine" || r.statut === "realise") &&
      Boolean(r.retour_complete_at) &&
      Boolean(r.chantier_valide));
  /** Onglet d'un rendez-vous : annulé en priorité, puis clôturé, sinon en cours. */
  const ongletDe = (r: (typeof toutes)[number]) =>
    r.statut === "annule" ? "annules" : estArchiveLogique(r) ? "clotures" : "encours";
  const nbArchives = toutes.filter((r) => ongletDe(r) === "clotures").length;
  const nbAnnules = toutes.filter((r) => ongletDe(r) === "annules").length;
  const nbEnCours = toutes.length - nbArchives - nbAnnules;
  const rows = useMemo(
    () =>
      toutes
        .filter((r) => ongletDe(r) === vueListe)
        .filter((r) => filtreStatut === "tous" || r.statut === filtreStatut),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.data, vueListe, filtreStatut],
  );
  /** Chantiers en cours : toujours remontés en tête de page. */
  const enCours = useMemo(
    () => toutes.filter((r) => r.demarre_at && !r.termine_at && !estArchiveLogique(r)),
    [toutes],
  );
  /** Chantiers clôturés (validés) qui peuvent être rangés pour libérer la liste. */
  const aRanger = useMemo(
    () =>
      toutes.filter(
        (r) => !estArchiveLogique(r) && (r.statut === "termine" || r.statut === "realise"),
      ),
    [toutes],
  );
  /** Intervenant choisi sur cet appareil (compte partagé). */
  const [moiId, setMoiId] = useState<string | null>(null);
  useEffect(() => {
    setMoiId(window.localStorage.getItem("irve-intervenant"));
  }, []);
  const choisirMoi = (id: string | null) => {
    setMoiId(id);
    if (id) window.localStorage.setItem("irve-intervenant", id);
    else window.localStorage.removeItem("irve-intervenant");
    setActive(null);
  };
  const moi = TECHNICIENS.find((t) => t.id === moiId) ?? null;
  const estPourMoi = (r: { technicien?: string | null }) =>
    !moi || !r.technicien?.trim() || technicienByNom(r.technicien)?.id === moi.id;
  const chantiersDuJour = useMemo(() => {
    const maintenant = new Date();
    return toutes
      .filter((r) => {
        const date = new Date(r.date_debut);
        return (
          !estArchiveLogique(r) &&
          r.statut !== "annule" &&
          estPourMoi(r) &&
          date.getFullYear() === maintenant.getFullYear() &&
          date.getMonth() === maintenant.getMonth() &&
          date.getDate() === maintenant.getDate()
        );
      })
      .sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toutes, moiId]);
  const missionTerrain =
    chantiersDuJour.find((r) => r.id === active) ?? enCours.filter(estPourMoi)[0] ?? chantiersDuJour[0] ?? null;

  /** Bilan « Nos chantiers réalisés » (mois choisi). */
  const fetchBilan = useServerFn(listChantiersRealises);
  const bilan = useQuery({
    queryKey: ["chantiers-realises", moisBilan],
    queryFn: () => fetchBilan({ data: { mois: moisBilan } }),
    enabled: vueBilan,
  });

  /** Photos déposées par les partenaires sur le dossier ouvert. */
  const fetchPhotos = useServerFn(listPhotosChantier);
  const photosDossier = useQuery({
    queryKey: ["photos-chantier", dossier],
    queryFn: () => fetchPhotos({ data: { rendezvous_id: dossier! } }),
    enabled: Boolean(dossier),
  });

  /** Programmation groupée de plusieurs chantiers sélectionnés. */
  const groupeFn = useServerFn(programmerEnsemble);
  const programmerGroupe = useMutation({
    mutationFn: (p: { ids: string[]; date_debut: string; nuitee: boolean }) =>
      groupeFn({ data: p }),
    onSuccess: () => {
      setSelection([]);
      setModeSelection(false);
      setDateGroupee("");
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Programmation groupée impossible."),
  });

  const basculerSelection = (id: string) =>
    setSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 6 ? prev : [...prev, id],
    );




  /** Technicien dont on calcule les trajets (son domicile est le point de départ). */
  const [departId, setDepartId] = useState(TECHNICIENS[0]!.id);
  const depart = TECHNICIENS.find((t) => t.id === departId) ?? TECHNICIENS[0]!;
  const voirieByRdv = useMemo(() => {
    type Row = NonNullable<typeof voirie.data>[number];
    const m = new Map<string, Row>();
    for (const v of voirie.data ?? []) if (!m.has(v.rendezvous_id)) m.set(v.rendezvous_id, v);
    return m;
  }, [voirie.data]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = dayKey(r.date_debut);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  const points: MapMarker[] = useMemo(
    () =>
      rows
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => ({
          id: r.id,
          lat: Number(r.lat),
          lng: Number(r.lng),
          label: r.client_nom,
          sub: [r.adresse, r.cp_ville].filter(Boolean).join(", "),
          statut: r.statut,
          couleur: couleurPartenaire(r.partenaire),
          date: dateTimeFr(r.date_debut),
          technicien: r.technicien ?? null,
          trajet:
            r.distance_km != null
              ? `${Math.round(Number(r.distance_km))} km · ${dureeFr(Number(r.duree_trajet_min ?? 0))}`
              : null,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, partenaires.data],
  );

  /** Chantiers à venir non annulés : base de la tournée optimisée. */
  const aVenir = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.lat != null &&
          r.lng != null &&
          r.statut !== "annule" &&
          new Date(r.date_debut).getTime() >= Date.now() - 12 * 3600e3 &&
          // Chantiers du technicien sélectionné + chantiers encore sans technicien.
          (!r.technicien?.trim() || technicienByNom(r.technicien)?.id === depart.id),
      ),
    [rows, depart.id],
  );

  const asStop = (r: (typeof rows)[number]) => ({
    id: r.id,
    lat: Number(r.lat),
    lng: Number(r.lng),
    label: r.client_nom,
    sub: r.cp_ville,
  });

  /** Chantiers regroupés par journée : une tournée ne peut concerner qu'un seul jour. */
  const joursDispo = useMemo(() => {
    const m = new Map<string, { key: string; label: string; stops: ReturnType<typeof asStop>[] }>();
    for (const r of aVenir) {
      const d = new Date(r.date_debut);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = m.get(key) ?? { key, label: dayKey(r.date_debut), stops: [] };
      entry.stops.push(asStop(r));
      m.set(key, entry);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aVenir]);

  const [jourSel, setJourSel] = useState<string | null>(null);
  const jourActif =
    (jourSel ? joursDispo.find((j) => j.key === jourSel) : undefined) ?? joursDispo[0] ?? null;
  const stopsJour = jourActif?.stops ?? [];

  const tournee = useMemo(() => optimiserTournee(stopsJour, depart), [stopsJour, depart]);

  /** Campagne sur plusieurs jours (chantiers éloignés : une nuitée sur place). */
  const [horizon, setHorizon] = useState(7);
  const [campagneOn, setCampagneOn] = useState(false);
  const campagne = useMemo(
    () =>
      campagneOn ? planifierCampagne(aVenir.map(asStop), depart, { jours: horizon }) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campagneOn, horizon, aVenir, depart],
  );

  const grappes = useMemo(
    () => groupesProximite(aVenir.map(asStop)).filter((g) => g.length > 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aVenir],
  );

  const economie = economieCarburant(Math.max(tournee.kmDirect - tournee.kmTotal, 0));

  /** Deux premiers chantiers cochés : comparaison « même journée » / « deux déplacements ». */
  const selRows = selection
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is (typeof rows)[number] => !!r && r.lat != null && r.lng != null);
  const paireA = selRows[0];
  const paireB = selRows[1];
  const comparerFn = useServerFn(comparerDeuxChantiers);
  const comparaison = useQuery({
    queryKey: ["comparaison-2", paireA?.id, paireB?.id, depart.id],
    enabled: Boolean(paireA && paireB),
    staleTime: 30 * 60_000,
    queryFn: () =>
      comparerFn({
        data: {
          a: { lat: Number(paireA!.lat), lng: Number(paireA!.lng) },
          b: { lat: Number(paireB!.lat), lng: Number(paireB!.lng) },
          base: { lat: departTrajet.lat, lng: departTrajet.lng },
        },
      }),
  });
  const kmEconomises = comparaison.data
    ? Math.max(comparaison.data.kmSepares - comparaison.data.kmEnsemble, 0)
    : 0;
  const economieDeux = economieCarburant(kmEconomises);


  /** Itinéraire routier réel base → chantier sélectionné. */
  const routeFn = useServerFn(itineraireDepuisBase);
  const activeRow = rows.find((r) => r.id === active && r.lat != null && r.lng != null);
  const departTrajet = technicienByNom(activeRow?.technicien) ?? depart;
  const [avecPeage, setAvecPeage] = useState(true);
  const itineraire = useQuery({
    queryKey: ["itineraire", activeRow?.id, departTrajet.id, activeRow?.lat, activeRow?.lng],
    enabled: !!activeRow,
    staleTime: 30 * 60_000,
    queryFn: () =>
      routeFn({
        data: {
          lat: Number(activeRow!.lat),
          lng: Number(activeRow!.lng),
          base: { lat: departTrajet.lat, lng: departTrajet.lng },
        },
      }),
  });

  const trajetChoisi =
    itineraire.data && !avecPeage && itineraire.data.sansPeage
      ? itineraire.data.sansPeage
      : itineraire.data;

  /** Tournée de la journée sélectionnée, sur le réseau routier réel. */
  const tourneeFn = useServerFn(tourneeReelle);
  const tourneeStops = useMemo(() => stopsJour.slice(0, 10), [stopsJour]);
  const tourneeReel = useQuery({
    queryKey: ["tournee-reelle", depart.id, tourneeStops.map((s) => s.id).join(",")],
    enabled: tourneeStops.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () =>
      tourneeFn({ data: { stops: tourneeStops, base: { lat: depart.lat, lng: depart.lng } } }),
  });

  /** Données affichées : routier réel si disponible, sinon estimation locale. */
  const tourneeAff =
    tourneeReel.data && tourneeReel.data.etapes.length
      ? {
          etapes: tourneeReel.data.etapes,
          kmTotal: tourneeReel.data.kmTotal,
          minutes: tourneeReel.data.minutes,
          kmDirect: tourneeReel.data.kmSepares,
        }
      : { ...tournee, kmDirect: tournee.kmDirect };


  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (!get("client_nom")) {
      setError("Merci d'indiquer le nom du client.");
      return;
    }
    if (!get("adresse")) {
      setError("Merci d'indiquer l'adresse du chantier.");
      return;
    }
    const d = new Date(get("date_debut"));
    if (Number.isNaN(d.getTime())) {
      setError("Merci d'indiquer la date et l'heure du rendez-vous.");
      return;
    }
    setError(null);
    create.mutate({
      titre: get("titre") || "Intervention",
      type: get("type") as RendezVousInput["type"],
      statut: "planifie",
      client_nom: get("client_nom"),
      client_telephone: get("client_telephone") || null,
      client_email: get("client_email") || null,
      adresse: get("adresse"),
      cp_ville: get("cp_ville") || null,
      date_debut: d.toISOString(),

      duree_min: Number(get("duree_min") || 120),
      technicien: get("technicien") || null,
      notes: get("notes") || null,
      origine: (get("origine") || "direct") as "direct" | "sous_traitance",
      partenaire: get("partenaire") || null,
      montant_ht: Number(get("montant_ht") || 0),
      tva_pct: Number(get("tva_pct") || 20),
      statut_facturation: "a_facturer",
      designation: get("designation") || null,
      etiquettes: parseEtiquettes(get("etiquettes")),
      metrage_m: Number(get("metrage_m") || 0),
      puissance_borne: get("puissance_borne") || null,
      phase_installation: get("phase_installation") || null,
      type_pose: get("type_pose") || null,

    });
  }

  async function onVoirieSubmit(e: React.FormEvent<HTMLFormElement>, rdvId: string, existingId?: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const file = f.get("document") as File | null;
    let data_url: string | null = null;
    if (file && file.size > 0) {
      if (file.size > MAX_DOC) {
        setError("Document trop lourd (8 Mo maximum).");
        return;
      }
      data_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
        reader.readAsDataURL(file);
      });
    }
    saveVoirieMut.mutate({
      id: existingId ?? null,
      rendezvous_id: rdvId,
      statut: (get("statut") || "en_attente") as VoirieInput["statut"],
      reference: get("reference") || null,
      autorite: get("autorite") || null,
      date_demande: get("date_demande") || null,
      date_obtention: get("date_obtention") || null,
      date_fin: get("date_fin") || null,
      notes: get("notes") || null,
      data_url,
      file_name: file && file.size > 0 ? file.name : null,
    });
  }

  return (
    <ProShell referenceStyle>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-mono text-primary">Planning</p>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Chantiers, tournées & autorisations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adresse géolocalisée automatiquement, tournée optimisée, validation de chantier et
            autorisation de voirie.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setVueBilan((v) => !v)}
            className={`text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 border ${
              vueBilan ? "border-primary text-primary" : "border-border hover:border-primary"
            }`}
          >
            <Trophy className="h-4 w-4" /> Nos chantiers réalisés
          </button>
          <button
            type="button"
            onClick={() => {
              setModeSelection((m) => !m);
              setSelection([]);
            }}
            className={`text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 border ${
              modeSelection ? "border-primary text-primary" : "border-border hover:border-primary"
            }`}
          >
            <ListChecks className="h-4 w-4" /> Programmer ensemble
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 border border-primary/60 text-primary hover:bg-primary/10"
          >
            <FileUp className="h-4 w-4" /> Importer (photo, PDF, Excel)
          </button>
          {importOpen && (
            <ImportRdvDialog
              partenaires={(partenaires.data ?? []).map((p) => p.nom)}
              onClose={() => setImportOpen(false)}
              onDone={refresh}
            />
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> {open ? "Fermer" : "Nouveau rendez-vous"}
          </button>
        </div>
      </div>

      <section className="mx-auto mb-6 w-full min-w-0 max-w-full lg:hidden">
        <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-bold"><Smartphone className="h-5 w-5 text-primary" /> Mission terrain</h2>
            <p className="truncate text-xs text-muted-foreground">L’intervention en cours, étape par étape</p>
          </div>
          <Button variant={modeIntervention ? "default" : "outline"} size="sm" onClick={() => setModeIntervention((value) => !value)} aria-pressed={modeIntervention}>
            {modeIntervention ? "Masquer" : "Ouvrir"}
          </Button>
        </div>

        {modeIntervention && (
          <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Je suis :</span>
            {TECHNICIENS.map((t) => (
              <Button key={t.id} size="sm" variant={moiId === t.id ? "default" : "outline"} onClick={() => choisirMoi(t.id)}>
                {t.nom.split(" ")[0]}
              </Button>
            ))}
            <Button size="sm" variant={!moi ? "default" : "outline"} onClick={() => choisirMoi(null)}>Tous</Button>
          </div>
        )}

        {modeIntervention && (
          missionTerrain ? (
            <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              <div className="bg-slate-900 p-5 text-slate-50 dark:bg-slate-950 sm:p-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-md bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-200">{styleStatut(missionTerrain.statut).label}</span>
                    <h3 className="mt-2 truncate text-xl font-bold">{missionTerrain.client_nom}</h3>
                    <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-600 px-4 py-3 text-slate-50"><Clock3 className="h-8 w-8 shrink-0" /><div className="min-w-0"><p className="text-2xl font-extrabold leading-tight sm:text-3xl">{new Date(missionTerrain.date_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-base font-bold capitalize">{new Date(missionTerrain.date_debut).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}{missionTerrain.technicien ? ` · ${missionTerrain.technicien.split(" ")[0]}` : ""}</p></div></div>
                    <p className="mt-1 text-sm text-slate-300">{missionTerrain.titre}</p>
                    <p className="mt-1 text-sm text-slate-400">{missionTerrain.adresse}{missionTerrain.cp_ville ? `, ${missionTerrain.cp_ville}` : ""}</p>
                  </div>
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-800"><MapPin className="h-6 w-6 text-slate-300" /></div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {telLien(missionTerrain.client_telephone) ? <Button asChild variant="secondary" className="h-12"><a href={telLien(missionTerrain.client_telephone) ?? undefined}><Phone /> Appeler</a></Button> : <Button variant="secondary" className="h-12" disabled><Phone /> Appeler</Button>}
                  <Button asChild variant="secondary" className="h-12"><a href={wazeLien(missionTerrain.adresse, missionTerrain.cp_ville, missionTerrain.lat, missionTerrain.lng)} target="_blank" rel="noreferrer"><Navigation /> Itinéraire</a></Button>
                </div>
              </div>

              <div className="space-y-0 p-5 sm:p-6">
                <EtapeMission titre="Arrivée sur site" detail={missionTerrain.demarre_at ? `Validée à ${new Date(missionTerrain.demarre_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : `${new Date(missionTerrain.date_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} prévu`} etat={missionTerrain.demarre_at ? "termine" : "active"} icone={<MapPin />}>
                  {!missionTerrain.demarre_at && <Button className="mt-3 min-h-12 h-auto w-full min-w-0 whitespace-normal px-2 py-3 text-center text-sm font-bold leading-tight sm:px-4 sm:text-base" onClick={() => demarrer.mutate({ id: missionTerrain.id, demarre: true })} disabled={demarrer.isPending}><Play className="shrink-0" /><span className="min-w-0 break-words">Je suis arrivé — démarrer</span></Button>}
                  {missionTerrain.demarre_at && !missionTerrain.termine_at && <Button variant="outline" className="mt-3 min-h-11 h-auto w-full min-w-0 whitespace-normal border-destructive/40 px-2 py-3 text-center text-sm leading-tight text-destructive sm:px-4" disabled={demarrer.isPending} onClick={() => { if (window.confirm(`Annuler le démarrage des travaux chez ${missionTerrain.client_nom} ?\n\nÀ utiliser seulement si vous avez démarré par erreur. Le chantier repasse en « confirmé ».`)) demarrer.mutate({ id: missionTerrain.id, demarre: false }); }}><span className="min-w-0 break-words">Annuler les travaux démarrés par erreur</span></Button>}
                </EtapeMission>
                <EtapeMission titre={missionTerrain.type === "maintenance" ? "Maintenance, photos et contrôle" : "Matériel, photos et métrage"} detail={missionTerrain.retour_complete_at ? "Enregistré" : undefined} etat={missionTerrain.retour_complete_at ? "termine" : missionTerrain.demarre_at ? "active" : "attente"} icone={<Camera />}>
                  {missionTerrain.demarre_at && !missionTerrain.termine_at && <Button variant="outline" className="mt-3 h-12 w-full min-w-0 border-blue-300 text-base font-bold" onClick={() => setRetourRdv(missionTerrain as unknown as RetourTravauxRdv)}><Camera /> Photos</Button>}
                </EtapeMission>
                <EtapeMission titre="Rapport et signatures" detail="Rapport du donneur d’ordre" etat={missionTerrain.retour_complete_at ? "active" : "attente"} icone={<ClipboardCheck />}>
                  {missionTerrain.demarre_at && <Button asChild variant="outline" className="mt-3 h-12 w-full min-w-0 text-base font-bold"><Link to="/chantier-rapport/$rdvId" params={{ rdvId: missionTerrain.id }}><ClipboardCheck /> Rapport</Link></Button>}
                </EtapeMission>
                <EtapeMission titre="Clôture" detail={missionTerrain.termine_at ? "Intervention terminée" : "Finaliser et prévenir le client"} etat={missionTerrain.termine_at ? "termine" : missionTerrain.retour_complete_at ? "active" : "attente"} icone={<Flag />} dernier>
                  {missionTerrain.demarre_at && !missionTerrain.termine_at && <Button className="mt-3 min-h-14 h-auto w-full min-w-0 whitespace-normal bg-teal-600 px-3 py-3 text-center text-sm font-bold leading-tight text-slate-50 hover:bg-teal-700 sm:text-base" onClick={() => terminer.mutate({ id: missionTerrain.id, notifier: true })} disabled={terminer.isPending || !missionTerrain.retour_complete_at}><Flag className="shrink-0" /> <span className="min-w-0">Terminer et prévenir le client</span></Button>}
                </EtapeMission>
              </div>

              {chantiersDuJour.length > 1 && <div className="border-t border-border bg-muted/40 p-4"><p className="mb-2 text-xs font-semibold text-muted-foreground">Autres interventions aujourd’hui</p><div className="flex gap-2 overflow-x-auto">{chantiersDuJour.filter((r) => r.id !== missionTerrain.id).map((r) => <Button key={r.id} variant="outline" className="h-11 shrink-0" onClick={() => setActive(r.id)}><Clock3 /> {new Date(r.date_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {r.client_nom}</Button>)}</div></div>}
            </div>
          ) : <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center"><CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-bold">Aucune intervention prévue aujourd’hui</p><p className="mt-1 text-sm text-muted-foreground">Le planning complet reste disponible ci-dessous.</p></div>
        )}
      </section>

      {enCours.length > 0 && (
        <div className={`mb-6 rounded-xl border border-violet-400/60 bg-violet-50 p-4 dark:bg-violet-500/10 ${modeIntervention ? "hidden md:block" : ""}`}>
          <p className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            Travaux en cours
          </p>
          <ul className="mt-2 grid gap-2">
            {enCours.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(r.id);
                    setDossier(r.id);
                  }}
                  className="w-full text-left rounded-lg bg-card/70 px-3 py-3 text-base font-semibold hover:text-primary"
                >
                  {r.client_nom}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {r.cp_ville || r.adresse}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vueBilan && (
        <div className="mb-8 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-mono text-xs text-primary uppercase tracking-[0.14em]">
                Nos chantiers réalisés
              </p>
              <h2 className="text-lg font-bold mt-1">Bilan du mois</h2>
            </div>
            <input
              type="month"
              value={moisBilan}
              onChange={(e) => setMoisBilan(e.target.value)}
              className="bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            />
          </div>
          {bilan.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary mt-4" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4 mt-4">
                <Bilan label="Chantiers" valeur={String(bilan.data?.bilan.nb ?? 0)} />
                <Bilan label="Validés" valeur={String(bilan.data?.bilan.valides ?? 0)} />
                <Bilan
                  label="Montant HT"
                  valeur={montantsVisibles ? eurosFr(bilan.data?.bilan.montant_ht ?? 0) : "•••"}
                />
                <Bilan label="Kilomètres" valeur={`${Math.round(bilan.data?.bilan.km ?? 0)} km`} />
              </div>
              <ul className="divide-y divide-border mt-4">
                {(bilan.data?.chantiers ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="py-3 flex flex-wrap items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="font-semibold">
                      {c.client_nom}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {c.cp_ville || c.adresse}
                      </span>
                    </span>
                    <span className="text-mono text-xs text-muted-foreground">
                      {dateTimeFr(c.date_debut)}
                    </span>
                  </li>
                ))}
                {!bilan.data?.chantiers.length && (
                  <li className="py-3 text-sm text-muted-foreground">
                    Aucun chantier réalisé sur ce mois.
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      {modeSelection && (
        <div className="mb-8 bg-card border border-primary/50 rounded-xl p-5 shadow-sm">
          <p className="text-mono text-xs text-primary uppercase tracking-[0.14em]">
            Programmation groupée
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Cochez jusqu'à 6 chantiers, sur la carte (un clic sur le repère) ou dans la liste, puis
            choisissez la date du premier rendez-vous : les suivants sont placés à la suite (même
            journée) ou le lendemain si vous prévoyez une nuitée.
          </p>

          {selRows.length > 0 && (
            <ul className="mt-4 grid gap-2">
              {selRows.map((r, i) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2"
                >
                  <span className="text-sm font-semibold">
                    <span className="text-mono text-xs mr-2 inline-grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white">
                      {i + 1}
                    </span>
                    {r.client_nom}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {r.cp_ville || r.adresse}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => basculerSelection(r.id)}
                    className="text-mono text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}

          {paireA && paireB && (
            <div className="mt-4 rounded-lg border border-blue-500/50 bg-blue-500/5 p-4">
              {comparaison.isFetching || !comparaison.data ? (
                <p className="text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Calcul des distances
                  d'un chantier à l'autre…
                </p>
              ) : (
                <>
                  <p className="text-base font-bold">
                    {paireA.cp_ville || paireA.client_nom} → {paireB.cp_ville || paireB.client_nom} :{" "}
                    {comparaison.data.entre.km} km · {dureeFr(comparaison.data.entre.minutes)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2 mt-3 text-sm">
                    <p>
                      Les deux le même jour :{" "}
                      <strong>
                        {comparaison.data.kmEnsemble} km ·{" "}
                        {dureeFr(comparaison.data.minutesEnsemble)}
                      </strong>{" "}
                      de route
                    </p>
                    <p>
                      En deux déplacements séparés :{" "}
                      <strong>
                        {comparaison.data.kmSepares} km ·{" "}
                        {dureeFr(comparaison.data.minutesSepares)}
                      </strong>
                    </p>
                  </div>
                  {kmEconomises > 0 && (
                    <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      Économie en groupant : {kmEconomises} km, environ {economieDeux.litres} L de
                      carburant ({economieDeux.euros} €) et{" "}
                      {dureeFr(
                        Math.max(
                          comparaison.data.minutesSepares - comparaison.data.minutesEnsemble,
                          0,
                        ),
                      )}{" "}
                      de route en moins.
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold">
                    {comparaison.data.nuiteeConseillee
                      ? "Trop de route pour une seule journée : nuitée sur place conseillée."
                      : "Faisable dans la même journée."}
                  </p>
                  {comparaison.data.estime && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Distances estimées (réseau routier momentanément indisponible).
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3 mt-4">
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">
                Date du premier chantier
              </span>
              <input
                type="datetime-local"
                value={dateGroupee}
                onChange={(e) => setDateGroupee(e.target.value)}
                className="mt-2 bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={selection.length < 2 || !dateGroupee || programmerGroupe.isPending}
              onClick={() => {
                const d = new Date(dateGroupee);
                if (Number.isNaN(d.getTime())) {
                  setError("Merci d'indiquer une date valide.");
                  return;
                }
                programmerGroupe.mutate({
                  ids: selection,
                  date_debut: d.toISOString(),
                  nuitee: false,
                });
              }}
              className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm disabled:opacity-40"
            >
              Programmer le même jour ({selection.length})
            </button>
            <button
              type="button"
              disabled={selection.length < 2 || !dateGroupee || programmerGroupe.isPending}
              onClick={() => {
                const d = new Date(dateGroupee);
                if (Number.isNaN(d.getTime())) {
                  setError("Merci d'indiquer une date valide.");
                  return;
                }
                programmerGroupe.mutate({
                  ids: selection,
                  date_debut: d.toISOString(),
                  nuitee: true,
                });
              }}
              className="text-mono text-xs px-4 py-2.5 rounded-sm border border-border hover:border-primary disabled:opacity-40"
            >
              Étaler sur plusieurs jours (nuitée)
            </button>
          </div>
        </div>
      )}

      {aRanger.length > 0 && !vueArchives && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm">
            <strong>{aRanger.length}</strong> chantier{aRanger.length > 1 ? "s" : ""} terminé
            {aRanger.length > 1 ? "s" : ""} peu{aRanger.length > 1 ? "vent" : "t"} être clôturé
            {aRanger.length > 1 ? "s" : ""} dans « Chantiers clôturés ».
          </p>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Clôturer ${aRanger.length} chantier(s) terminé(s) ?`)) return;
              for (const r of aRanger) archiver.mutate({ id: r.id, archive: true });
            }}
            className="text-mono text-xs px-4 py-2.5 rounded-sm border border-border hover:border-primary inline-flex items-center gap-2"
          >
            <Archive className="h-4 w-4" /> Tout clôturer
          </button>
        </div>
      )}



      {open && (
        <form
          onSubmit={onSubmit}
          className="bg-card border border-border rounded-xl p-5 shadow-sm mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Client" name="client_nom" required />
          <Field label="Téléphone" name="client_telephone" />
          <Field label="Email" name="client_email" type="email" />
          <AdresseFields required />
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Type</span>
            <select
              name="type"
              defaultValue="installation"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </label>
          <Field
            key={prefillDate}
            label="Date & heure"
            name="date_debut"
            type="datetime-local"
            required
            defaultValue={prefillDate ? `${prefillDate}T09:00` : undefined}
          />
          <Field label="Durée sur site (min)" name="duree_min" type="number" defaultValue="120" />
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Technicien</span>
            <select
              name="technicien"
              defaultValue={depart.nom}
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">À attribuer</option>
              {TECHNICIENS.map((t) => (
                <option key={t.id} value={t.nom}>
                  {t.nom} — départ {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Origine du chantier</span>
            <select
              name="origine"
              defaultValue="direct"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            >
              <option value="direct">Client direct</option>
              <option value="sous_traitance">Sous-traitance / partenaire</option>
            </select>
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Partenaire / donneur d&apos;ordre</span>
            <DonneurOrdreField name="partenaire" />
          </label>
          <Field label="Montant convenu HT (€)" name="montant_ht" type="number" defaultValue="0" />
          <Field label="TVA (%)" name="tva_pct" type="number" defaultValue="20" />
          <Field label="Objet" name="titre" placeholder="Pose borne 7,4 kW (monophasé 32A)" />
          <Field
            label="Désignation du chantier"
            name="designation"
            placeholder="Ex. Inter de Rennes — prestation pour PureEnergie"
          />
          <Field label="Métrage estimé (m)" name="metrage_m" type="number" defaultValue="0" />
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Puissance de la borne</span>
            <select name="puissance_borne" defaultValue="À définir" className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
              <option value="3,7 kW">3,7 kW — prise renforcée</option><option value="7,4 kW">7,4 kW — standard maison (32A mono)</option><option value="11 kW">11 kW — recharge accélérée</option><option value="22 kW">22 kW — forte puissance (triphasé)</option><option>À définir</option>
            </select>
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Alimentation</span>
            <select name="phase_installation" defaultValue="À définir" className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
              <option>Monophasé</option><option>Triphasé</option><option>À définir</option>
            </select>
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Type de pose</span>
            <select name="type_pose" defaultValue="À définir" className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
              <option>Intérieure</option><option>Extérieure</option><option>Sur pied</option><option>À définir</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">
              Étiquettes (séparées par des virgules)
            </span>
            <input
              name="etiquettes"
              list="etiquettes-suggestions"
              placeholder="Borne 7,4 kW (mono 32A), Copropriété, Urgent"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            <datalist id="etiquettes-suggestions">
              {ETIQUETTES_SUGGEREES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>

          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-4">
            <button
              type="submit"
              disabled={create.isPending}
              className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Planifier
            </button>
            {error && <p className="text-mono text-xs text-destructive">{error}</p>}
          </div>
        </form>
      )}

      <div className="mx-auto grid w-full min-w-0 max-w-full items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.85fr)] lg:[grid-template-areas:'mission_map'_'list_tools']">
        <aside className="hidden min-w-0 lg:block lg:[grid-area:mission]">
          <div className="overflow-hidden rounded-lg border border-primary/30 bg-card shadow-sm">
            <div className="border-b border-border bg-primary/10 px-4 py-4">
              <p className="text-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Missions actuelles</p>
              <h2 className="mt-1 text-base font-bold">Mission terrain</h2>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                {TECHNICIENS.map((t) => (
                  <Button key={t.id} size="sm" variant={moiId === t.id ? "default" : "outline"} onClick={() => choisirMoi(t.id)}>
                    {t.nom.split(" ")[0]}
                  </Button>
                ))}
                <Button size="sm" variant={!moi ? "default" : "outline"} onClick={() => choisirMoi(null)}>Tous</Button>
              </div>

              {missionTerrain ? (
                <div className="border-l-2 border-primary pl-3">
                  <p className="text-mono text-[10px] font-bold uppercase text-primary">{styleStatut(missionTerrain.statut).label}</p>
                  <p className="mt-1 font-bold leading-tight">{missionTerrain.client_nom}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(missionTerrain.date_debut).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {new Date(missionTerrain.date_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{missionTerrain.adresse}{missionTerrain.cp_ville ? `, ${missionTerrain.cp_ville}` : ""}</p>
                  <div className="mt-3 grid gap-2">
                    {!missionTerrain.demarre_at && (
                      <Button className="h-auto min-h-11 w-full whitespace-normal text-center" onClick={() => demarrer.mutate({ id: missionTerrain.id, demarre: true })} disabled={demarrer.isPending}>
                        <Play /> Démarrer les travaux
                      </Button>
                    )}
                    {missionTerrain.demarre_at && !missionTerrain.termine_at && (
                      <Button variant="outline" className="h-auto min-h-11 w-full whitespace-normal" onClick={() => setRetourRdv(missionTerrain as unknown as RetourTravauxRdv)}>
                        <Camera /> Photos et métrage
                      </Button>
                    )}
                    {missionTerrain.demarre_at && (
                      <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal">
                        <Link to="/chantier-rapport/$rdvId" params={{ rdvId: missionTerrain.id }}><ClipboardCheck /> Rapport</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal">
                      <a href={wazeLien(missionTerrain.adresse, missionTerrain.cp_ville, missionTerrain.lat, missionTerrain.lng)} target="_blank" rel="noreferrer"><Navigation /> Itinéraire</a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-center">
                  <CalendarClock className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold">Aucune mission aujourd’hui</p>
                </div>
              )}

              {enCours.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-mono text-[10px] font-bold uppercase text-violet-500">Travaux en cours · {enCours.length}</p>
                  <div className="mt-2 space-y-1">
                    {enCours.slice(0, 3).map((r) => (
                      <button key={r.id} type="button" onClick={() => { setActive(r.id); setDossier(r.id); }} className="w-full truncate rounded-md px-2 py-2 text-left text-sm font-semibold hover:bg-muted">
                        {r.client_nom}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Au téléphone les blocs restent empilés ; sur ordinateur ils deviennent trois zones stables. */}
        <div className="w-full min-w-0 max-w-full space-y-4 lg:contents">
        <MobileSectionTrigger
          label="Carte des interventions"
          count={points.length}
          open={!modeIntervention || mobileSections.carte}
          onToggle={() => toggleMobileSection("carte")}
        />
        {/* CARTE — en haut à gauche */}
        <section className={`w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:[grid-area:map] ${modeIntervention && !mobileSections.carte ? "hidden md:block" : ""}`}>
          <div className="grid min-w-0 gap-2 border-b border-border px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 sm:px-5">
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Carte des interventions
            </h2>
            <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-2 text-[11px] font-semibold text-muted-foreground sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:gap-4">
              <Legende color={STATUT_COLORS.planifie!} label="Programmé" />
              <Legende color={STATUT_COLORS.confirme!} label="Confirmé" />
              <Legende color={STATUT_COLORS.realise!} label="Réalisé / validé" />
              <Legende color={STATUT_COLORS.annule!} label="Annulé" />
            </div>
          </div>
          <div className="w-full min-w-0 max-w-full p-2.5 sm:p-4">
            {modeSelection && (
              <p className="mb-3 rounded-lg border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                Cliquez directement les repères sur la carte pour cocher les chantiers à faire
                ensemble ({selection.length} coché{selection.length > 1 ? "s" : ""}).
              </p>
            )}
            <InterventionsMap
              markers={points}
              activeId={active}
              onSelect={setActive}
              height={isMobile ? 300 : 330}
              scrollWheelZoom
              selectionMode={modeSelection}
              selectedIds={selection}
              onToggleSelect={basculerSelection}
              onAssign={(id, tech) => affecter.mutate({ id, technicien: tech })}
              lienCoords={comparaison.data?.entre.coords ?? null}
              routeCoords={trajetChoisi?.coords ?? null}
              routeEstime={itineraire.data?.estime ?? false}
              tourneeCoords={tourneeReel.data?.coords ?? null}
              visible={!modeIntervention || mobileSections.carte || !isMobile}
            />

            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 break-words text-[11px] font-semibold text-muted-foreground">
              {itineraire.isFetching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Calcul de l'itinéraire routier…
                </span>
              ) : itineraire.data ? (
                <span className="min-w-0 break-words text-primary text-mono">
                  {itineraire.data.estime ? (
                    <>Itinéraire routier indisponible — ouvrez Waze</>
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      <span>Départ {departTrajet.nom.split(" ")[0]} ({departTrajet.label}) :</span>
                      <button type="button" onClick={() => setAvecPeage(true)} className={`rounded-md border px-3 py-2 text-xs font-bold ${avecPeage ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        Avec péage · {itineraire.data.km} km · {dureeFr(itineraire.data.minutes)}
                        {itineraire.data.prixPeage > 0 ? ` · ≈ ${itineraire.data.prixPeage.toFixed(2).replace(".", ",")} €` : " · sans péage sur ce trajet"}
                      </button>
                      {itineraire.data.sansPeage && (
                        <button type="button" onClick={() => setAvecPeage(false)} className={`rounded-md border px-3 py-2 text-xs font-bold ${!avecPeage ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                          Sans péage · {itineraire.data.sansPeage.km} km · {dureeFr(itineraire.data.sansPeage.minutes)} · 0 €
                        </button>
                      )}
                    </span>
                  )}
                  {activeRow && (
                    <a className="ml-2 underline" href={wazeLien(activeRow.adresse, activeRow.cp_ville, activeRow.lat, activeRow.lng)} target="_blank" rel="noreferrer">
                      Ouvrir dans Waze
                    </a>
                  )}
                </span>
              ) : (
                <span>Cliquez une intervention pour afficher l'itinéraire routier réel.</span>
              )}
              {tourneeReel.data && tourneeReel.data.etapes.length > 1 && (
                <span>
                  Boucle complète : {tourneeReel.data.kmTotal} km ·{" "}
                  {dureeFr(tourneeReel.data.minutes)}
                </span>
              )}
            </div>
          </div>
        </section>

        <MobileSectionTrigger
          label="Tous les rendez-vous"
          count={rows.length}
          open={!modeIntervention || mobileSections.rendezvous}
          onToggle={() => toggleMobileSection("rendezvous")}
        />
        <section className={`space-y-4 lg:[grid-area:list] ${modeIntervention && !mobileSections.rendezvous ? "hidden md:block" : ""}`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              {vueListe === "clotures" ? "Chantiers clôturés" : vueListe === "annules" ? "Rendez-vous annulés" : "Rendez-vous programmés"}
            </h2>
            <div className="ml-auto inline-flex rounded-full border border-border p-0.5">
              <button
                type="button"
                onClick={() => { setVueListe("encours"); setFiltreStatut("tous"); }}
                className={`text-[11px] px-3 py-1.5 rounded-full transition ${
                  vueListe === "encours" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
                }`}
              >
                En cours ({nbEnCours})
              </button>
              <button
                type="button"
                onClick={() => { setVueListe("annules"); setFiltreStatut("tous"); }}
                className={`text-[11px] px-3 py-1.5 rounded-full transition ${
                  vueListe === "annules" ? "bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-destructive"
                }`}
              >
                Annulés ({nbAnnules})
              </button>
              <button
                type="button"
                onClick={() => { setVueListe("clotures"); setFiltreStatut("tous"); }}
                className={`text-[11px] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition ${
                  vueListe === "clotures" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
                }`}
              >
                <Archive className="h-3.5 w-3.5" /> Chantiers clôturés ({nbArchives})
              </button>
            </div>
          </div>

          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max items-center gap-2">
            {[
              { v: "tous", l: "Tous", point: "bg-muted-foreground" },
              ...STATUTS.filter((s) => (vueListe === "annules" ? false : s.v !== "annule")).map((s) => ({ v: s.v, l: s.l, point: styleStatut(s.v).point })),
            ].map((f) => {
              const nb =
                f.v === "tous"
                  ? toutes.filter((r) => ongletDe(r) === vueListe).length
                  : toutes.filter(
                      (r) => ongletDe(r) === vueListe && r.statut === f.v,
                    )
                      .length;
              const on = filtreStatut === f.v;
              return (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => setFiltreStatut(f.v)}
                  className={`shrink-0 text-mono text-[11px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/60"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${f.point}`} /> {f.l} ({nb})
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMontantsVisibles((v) => !v)}
              className="shrink-0 text-mono text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1.5"
            >
              {montantsVisibles ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Masquer les montants
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Afficher les montants
                </>
              )}
            </button>
          </div>
          </div>

          {list.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : !groups.length ? (
            <p className="text-sm text-muted-foreground">
              {vueListe === "annules"
                ? "Aucun rendez-vous annulé."
                : vueArchives
                ? "Aucun chantier archivé pour le moment."
                : filtreStatut !== "tous"
                  ? "Aucun chantier dans cet état."
                  : "Aucun rendez-vous. Créez le premier avec « Nouveau rendez-vous »."}
            </p>
          ) : (

            groups.map(([day, items]) => (
              <div key={day}>
                <h2 className="text-mono text-xs text-primary uppercase mb-3">{day}</h2>
                <ul className="grid gap-3">

                  {items.map((r) => {
                    const v = voirieByRdv.get(r.id);
                    const isChantierPanel = panel?.id === r.id && panel.tab === "chantier";
                    const isVoiriePanel = panel?.id === r.id && panel.tab === "voirie";
                    const isMontantPanel = panel?.id === r.id && panel.tab === "montant";
                    const isAdressePanel = panel?.id === r.id && panel.tab === "adresse";
                    const isDatePanel = panel?.id === r.id && panel.tab === "date";
                    const isDossierPanel = panel?.id === r.id && panel.tab === "dossier";
                    const dossierOuvert = dossier === r.id;
                    const st = styleStatut(r.statut);
                    const notesVisibles =
                      r.notes && !estNoteAutoDepuisDevis(r.notes) ? r.notes : null;
                    const tel = telLien(r.client_telephone);
                    const wa = whatsappLien(
                      r.client_telephone,
                      `Bonjour ${r.client_nom}, Borne de l'Ouest au sujet de votre installation de borne de recharge.`,
                    );
                    return (
                      <li
                        key={r.id}
                        onMouseEnter={() => setActive(r.id)}
                        className={`relative overflow-hidden border rounded-xl p-4 pl-5 h-fit transition-all duration-200 hover:shadow-md before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 ${st.barre} ${st.fond} ${
                          active === r.id
                            ? "border-primary shadow-md ring-1 ring-primary/30"
                            : "border-border"
                        } ${r.statut === "annule" ? "opacity-75" : ""}`}
                      >
                        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="min-w-0">
                            <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                              <span className="min-w-0 truncate text-base font-bold">{r.client_nom}</span>
                              <span
                                className={`text-mono text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${st.badge}`}
                              >
                                {st.label}
                              </span>
                              {!r.date_a_confirmer && (
                                <span className="text-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/40 text-primary">
                                  {new Date(r.date_debut).toLocaleDateString("fr-FR", {
                                    day: "2-digit",
                                    month: "short",
                                  })}
                                </span>
                              )}
                              {r.archive && (
                                <span className="text-mono text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                  Archivé
                                </span>
                              )}
                            </p>
                            <p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-bold text-foreground">
                              <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                              <span className="truncate">
                                {r.date_a_confirmer
                                  ? "Rendez-vous à prendre"
                                  : new Date(r.date_debut).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}
                                {!r.date_a_confirmer && ` · ${new Date(r.date_debut).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                              </span>
                            </p>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-dashboard-orange" />
                              <span className="truncate">{r.adresse}{r.cp_ville ? `, ${r.cp_ville}` : ""}</span>
                            </p>
                            <p className="mt-1 flex min-w-0 items-center gap-2 text-xs font-semibold text-primary">
                              <Zap className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{TYPES.find((type) => type.v === r.type)?.l ?? r.titre}{r.designation ? ` · ${r.designation}` : ""}</span>
                            </p>

                            {!dossierOuvert && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDossier(r.id)}
                                className="mt-2 h-8 px-0 text-xs font-bold text-primary hover:bg-transparent"
                              >
                                Afficher tout <ChevronDown className="h-4 w-4" />
                              </Button>
                            )}

                            {dossierOuvert && <>

                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="min-w-0 rounded-md border border-border bg-background/55 p-3">
                                <p className="text-mono text-[10px] font-bold uppercase text-muted-foreground">Contact</p>
                                <p className="mt-1 truncate text-sm font-semibold">{r.client_nom}</p>
                                <p className="truncate text-xs text-muted-foreground">{r.client_email || r.client_telephone || "Non renseigné"}</p>
                              </div>
                              <div className="min-w-0 rounded-md border border-border bg-background/55 p-3">
                                <p className="text-mono text-[10px] font-bold uppercase text-muted-foreground">Intervention</p>
                                <p className="mt-1 text-sm font-semibold">{r.date_a_confirmer ? "Date à confirmer" : dateTimeFr(r.date_debut)}</p>
                                <p className="truncate text-xs text-muted-foreground">{dureeFr(r.duree_min)} · {r.technicien || "À attribuer"}</p>
                              </div>
                              <div className="min-w-0 rounded-md border border-border bg-background/55 p-3">
                                <p className="text-mono text-[10px] font-bold uppercase text-muted-foreground">Technique</p>
                                <p className="mt-1 truncate text-sm font-semibold">{r.puissance_borne || "Puissance à définir"}</p>
                                <p className="truncate text-xs text-muted-foreground">{Number(r.metrage_m ?? 0) > 0 ? `${Number(r.metrage_m)} m` : "Métrage à définir"}{r.phase_installation ? ` · ${r.phase_installation}` : ""}</p>
                              </div>
                              <div className="min-w-0 rounded-md border border-border bg-background/55 p-3">
                                <p className="text-mono text-[10px] font-bold uppercase text-muted-foreground">Facturation</p>
                                <p className="mt-1 truncate text-sm font-semibold">{montantsVisibles ? `${eurosFr(Number(r.montant_ht ?? 0))} HT` : "Montant masqué"}</p>
                                <p className="truncate text-xs text-muted-foreground">{FACTU_LABEL[r.statut_facturation] ?? r.statut_facturation}</p>
                              </div>
                            </div>

                            {(tel || wa || r.client_email) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {tel && (
                                  <a
                                    href={tel}
                                    className="text-mono text-[11px] px-2.5 py-1.5 rounded-full border border-border text-foreground inline-flex items-center gap-1.5 transition hover:border-primary hover:text-primary"
                                  >
                                    <Phone className="h-3.5 w-3.5" /> Appeler
                                  </a>
                                )}
                                {wa && (
                                  <a
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-mono text-[11px] px-2.5 py-1.5 rounded-full border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 transition hover:bg-emerald-500/10"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                                  </a>
                                )}
                                {r.client_telephone && (
                          <span className="text-mono text-[11px] text-muted-foreground break-all">
                                    {r.client_telephone}
                                  </span>
                                )}
                              </div>
                            )}


                            <p className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {r.date_a_confirmer && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDossier(r.id);
                                    setPanel({ id: r.id, tab: "date" });
                                  }}
                                  className="text-mono text-[11px] rounded-full border border-amber-500/60 text-amber-600 dark:text-amber-400 px-2.5 py-1 inline-flex items-center gap-1 transition hover:bg-amber-500/10"
                                >
                                  <CalendarClock className="h-3 w-3" /> Fixer la date
                                </button>
                              )}

                              <a
                                href={wazeLien(r.adresse, r.cp_ville, r.lat, r.lng)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                                title="Ouvrir dans Waze"
                              >
                                <MapPin className="h-3 w-3" /> {r.adresse}
                                {r.cp_ville ? `, ${r.cp_ville}` : ""}
                              </a>
                              {r.distance_km != null ? (
                                <span className="inline-flex items-center gap-1 text-mono">
                                  <RouteIcon className="h-3 w-3" />{" "}
                                  {Math.round(Number(r.distance_km))} km ·{" "}
                                  {dureeFr(Number(r.duree_trajet_min ?? 0))}
                                </span>
                              ) : (
                                <span className="text-mono text-destructive">
                                  adresse non géolocalisée
                                </span>
                              )}
                            </p>
                            {notesVisibles && <p className="text-xs mt-2">{notesVisibles}</p>}
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mono">
                              <span
                                className={`px-2 py-0.5 rounded-full border ${
                                  r.origine === "sous_traitance"
                                    ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                                    : "border-primary/40 text-primary"
                                }`}
                              >
                                {r.partenaire && couleurPartenaire(r.partenaire) && (
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle"
                                    style={{ background: couleurPartenaire(r.partenaire)! }}
                                  />
                                )}
                                {r.origine === "sous_traitance"
                                  ? `Sous-traitance${r.partenaire ? ` · ${r.partenaire}` : ""}`
                                  : "Client direct"}
                              </span>
                            </p>

                            {Array.isArray(r.etiquettes) && r.etiquettes.length > 0 && (
                              <p className="mt-2 flex flex-wrap gap-1.5">
                                {normaliserEtiquettes(r.etiquettes).map((et: string, idx: number) => (
                                  <span
                                    key={`${et}-${idx}`}
                                    className="text-mono text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border"
                                  >
                                    {et}
                                  </span>
                                ))}
                              </p>
                            )}


                            {/* Suivi en direct : démarrage puis fin de chantier */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {!r.demarre_at && !r.termine_at && (
                                <button
                                  type="button"
                                  onClick={() => demarrer.mutate({ id: r.id, demarre: true })}
                                  disabled={demarrer.isPending}
                                  className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm bg-violet-600 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Play className="h-3.5 w-3.5" /> Démarrer les travaux
                                </button>
                              )}
                              {r.demarre_at && !r.termine_at && (
                                <>
                                  <span className="text-mono text-[11px] text-violet-600 dark:text-violet-300">
                                    Démarré à{" "}
                                    {new Date(r.demarre_at).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={demarrer.isPending}
                                    onClick={() => {
                                      if (window.confirm(`Annuler le démarrage des travaux chez ${r.client_nom} ?\n\nLe rendez-vous est conservé et repasse en « confirmé ».`)) demarrer.mutate({ id: r.id, demarre: false });
                                    }}
                                    className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm border-2 border-destructive/60 text-destructive inline-flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    Annuler le démarrage
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRetourRdv(r as unknown as RetourTravauxRdv)}
                                    className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm border-2 border-amber-500 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1.5"
                                  >
                                    <ClipboardCheck className="h-3.5 w-3.5" /> Retour de travaux
                                  </button>
                                  <Link
                                    to="/chantier-rapport/$rdvId"
                                    params={{ rdvId: r.id }}
                                    className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm border-2 border-sky-500 text-sky-600 dark:text-sky-400 inline-flex items-center gap-1.5"
                                  >
                                    <ClipboardCheck className="h-3.5 w-3.5" /> Rapport donneur d'ordre
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Terminer le chantier de ${r.client_nom} ? Un email de fin de chantier sera envoyé.`,
                                        )
                                      )
                                        return;
                                      terminer.mutate({ id: r.id, notifier: true });
                                    }}
                                    disabled={terminer.isPending}
                                    className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm bg-teal-600 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    <Flag className="h-3.5 w-3.5" /> Terminer le chantier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          "Annuler le démarrage des travaux ? Le chantier repasse en « confirmé ».",
                                        )
                                      )
                                        demarrer.mutate({ id: r.id, demarre: false });
                                    }}
                                    className="text-mono text-[11px] text-muted-foreground hover:text-destructive"
                                  >
                                    Annuler le démarrage
                                  </button>
                                </>
                              )}
                              {r.termine_at && (
                                <span className="text-mono text-[11px] px-2 py-1 rounded-sm border border-teal-500/50 text-teal-700 dark:text-teal-300 inline-flex items-center gap-1">
                                  <Flag className="h-3 w-3" /> Terminé le{" "}
                                  {new Date(r.termine_at).toLocaleString("fr-FR")}
                                  {r.notif_fin_at ? " · client prévenu" : ""}
                                </span>
                              )}
                              {(r.termine_at || r.statut === "termine" || r.statut === "realise") &&
                                r.statut_facturation === "a_facturer" && (
                                <Link
                                  to="/factures/nouvelle"
                                  search={{ rdv: r.id }}
                                  className="text-mono text-[11px] font-bold min-h-[38px] px-3 rounded-sm bg-primary text-primary-foreground inline-flex items-center gap-1.5"
                                >
                                  Facturer le chantier
                                </Link>
                              )}
                            </div>

                            {/* Un seul bouton pour gérer tout le dossier */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {modeSelection && (
                                <label
                                  className={`text-mono text-xs font-bold min-h-[44px] px-4 rounded-sm border-2 inline-flex items-center gap-2 cursor-pointer ${
                                    selection.includes(r.id)
                                      ? "border-blue-600 bg-blue-600 text-white"
                                      : "border-blue-500/60 text-blue-700 dark:text-blue-300"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selection.includes(r.id)}
                                    onChange={() => basculerSelection(r.id)}
                                    className="h-5 w-5"
                                  />
                                  {selection.includes(r.id)
                                    ? `Coché n°${selection.indexOf(r.id) + 1}`
                                    : "Faire ensemble"}
                                </label>
                              )}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDossier(null);
                                  setPanel(null);
                                }}
                                className="text-xs font-bold"
                              >
                                <ChevronDown className="h-4 w-4 rotate-180" /> Réduire
                              </Button>
                              {r.chantier_valide && (
                                <span className="text-mono text-[11px] px-2 py-1 rounded-sm border border-primary/40 text-primary inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Chantier validé
                                  {r.chantier_valide_at
                                    ? ` le ${new Date(r.chantier_valide_at).toLocaleDateString("fr-FR")}`
                                    : ""}
                                </span>
                              )}
                              {v && (
                                <span className="text-mono text-[11px] text-muted-foreground">
                                  Voirie : {VOIRIE_LABEL[v.statut] ?? v.statut}
                                </span>
                              )}
                              {r.origine === "sous_traitance" && (
                                <span
                                  className={`text-mono text-[11px] px-2 py-0.5 rounded-sm border ${
                                    r.materiel_statut === "en_cours"
                                      ? "border-border text-muted-foreground"
                                      : "border-primary/40 text-primary"
                                  }`}
                                >
                                  {MATERIEL_LABELS[
                                    (r.materiel_statut ??
                                      "en_cours") as keyof typeof MATERIEL_LABELS
                                  ] ?? "Matériel en cours"}
                                </span>
                              )}
                            </div>

                            {dossierOuvert && (photosDossier.data?.length ?? 0) > 0 && (
                              <div className="mt-2 border-t border-border pt-2">
                                <p className="text-mono text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <Camera className="h-3 w-3" /> Photos déposées (
                                  {photosDossier.data!.length})
                                </p>
                                <div className="mt-2 flex gap-2 overflow-x-auto">
                                  {photosDossier.data!.map((p) => {
                                    const cat = (p.categorie ?? "autre") as keyof typeof PHOTO_CATEGORIES_LABELS;
                                    const libelle = PHOTO_CATEGORIES_LABELS[cat] ?? "Autre";
                                    return p.url ? (
                                      <a
                                        key={p.id}
                                        href={p.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="shrink-0 w-24"
                                        title={libelle}
                                      >
                                        <img
                                          src={p.url}
                                          alt={p.legende ?? libelle}
                                          className="h-20 w-24 rounded-sm border border-border object-cover"
                                        />
                                        <span className="block text-mono text-[10px] text-muted-foreground mt-1 leading-tight">
                                          {libelle}
                                        </span>
                                      </a>
                                    ) : null;
                                  })}
                                </div>
                              </div>
                            )}

                            {dossierOuvert && (

                              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 sm:flex sm:flex-wrap">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isDossierPanel ? null : { id: r.id, tab: "dossier" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isDossierPanel
                                      ? "border-primary text-primary"
                                      : "border-primary/50 text-primary hover:border-primary"
                                  }`}
                                >
                                  <ClipboardCheck className="h-3 w-3" /> Dossier complet
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isChantierPanel ? null : { id: r.id, tab: "chantier" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isChantierPanel
                                      ? "border-primary text-primary"
                                      : "border-border hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  <FileCheck2 className="h-3 w-3" /> Validation du chantier
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isVoiriePanel ? null : { id: r.id, tab: "voirie" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isVoiriePanel
                                      ? "border-primary text-primary"
                                      : v?.statut === "obtenue"
                                        ? "border-primary/40 text-primary"
                                        : v?.statut === "refusee"
                                          ? "border-destructive/40 text-destructive"
                                          : "border-border hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  <ShieldCheck className="h-3 w-3" /> Voirie
                                </button>
                                {v?.url && (
                                  <a
                                    href={v.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-mono text-[11px] text-primary hover:underline"
                                  >
                                    Voir le document
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isMontantPanel ? null : { id: r.id, tab: "montant" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isMontantPanel
                                      ? "border-primary text-primary"
                                      : "border-border hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  <Euro className="h-3 w-3" /> Montant & facturation
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isDatePanel ? null : { id: r.id, tab: "date" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isDatePanel
                                      ? "border-primary text-primary"
                                      : r.date_a_confirmer
                                        ? "border-amber-500/60 text-amber-600 dark:text-amber-400"
                                        : "border-border hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  <CalendarClock className="h-3 w-3" />{" "}
                                  {r.date_a_confirmer ? "Fixer la date" : "Modifier la date"}
                                </button>
                                {r.client_email ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      proposerRdv.mutate({
                                        id: r.id,
                                        relance: Boolean(r.rdv_propose_at),
                                      })
                                    }
                                    disabled={proposerRdv.isPending}
                                    className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 disabled:opacity-50 ${
                                      r.rdv_confirme_at
                                        ? "border-emerald-500/60 text-emerald-600 dark:text-emerald-400"
                                        : "border-border hover:border-primary hover:text-primary"
                                    }`}
                                    title="Envoyer au client une proposition de rendez-vous à confirmer"
                                  >
                                    <Mail className="h-3 w-3" />{" "}
                                    {r.rdv_confirme_at
                                      ? `Confirmé le ${new Date(r.rdv_confirme_at).toLocaleDateString("fr-FR")}`
                                      : r.rdv_refuse_at
                                        ? "Nouveau créneau demandé — renvoyer"
                                        : r.rdv_propose_at
                                          ? `Proposé le ${new Date(r.rdv_propose_at).toLocaleDateString("fr-FR")} — relancer`
                                          : "Proposer au client"}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isAdressePanel ? null : { id: r.id, tab: "adresse" })
                                  }
                                  className={`text-mono text-[11px] min-h-[38px] px-3 rounded-sm border inline-flex items-center gap-1 ${
                                    isAdressePanel
                                      ? "border-primary text-primary"
                                      : "border-border hover:border-primary hover:text-primary"
                                  }`}
                                >
                                  <MapPin className="h-3 w-3" /> Adresse & technique
                                </button>
                                <button
                                  type="button"
                                  onClick={() => archiver.mutate({ id: r.id, archive: !r.archive })}
                                  disabled={archiver.isPending}
                                  className="text-mono text-[11px] min-h-[38px] px-3 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1 disabled:opacity-50"
                                >
                                  {r.archive ? (
                                    <>
                                      <ArchiveRestore className="h-3 w-3" /> Remettre dans le planning
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="h-3 w-3" /> Clôturer le chantier
                                    </>
                                  )}
                                </button>
                                {r.chantier_valide && (
                                  <button
                                    type="button"
                                    onClick={() => valider.mutate({ id: r.id, valide: false })}
                                    className="text-mono text-[11px] text-muted-foreground hover:text-destructive"
                                  >
                                    Annuler la validation
                                  </button>
                                )}
                              </div>
                            )}

                            {r.chantier_commentaire && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Validation : {r.chantier_commentaire}
                              </p>
                            )}
                            </>}
                          </div>
                          {dossierOuvert && <div className="order-first flex min-w-0 items-center justify-end gap-2 sm:order-none sm:shrink-0">
                            <select
                              value={r.statut}
                              onChange={(e) =>
                                setStatut.mutate({ id: r.id, statut: e.target.value })
                              }
                              className="bg-input border border-border rounded-sm px-2 py-1.5 text-mono text-xs"
                            >
                              {STATUTS.map((s) => (
                                <option key={s.v} value={s.v}>
                                  {s.l}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Supprimer définitivement le rendez-vous de ${r.client_nom} ? Cette action est irréversible.`,
                                  )
                                ) {
                                  remove.mutate(r.id);
                                }
                              }}
                              aria-label="Supprimer le rendez-vous"

                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>}
                        </div>

                        {isDossierPanel && (
                          <form
                            key={`dossier-${r.id}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              const g = (k: string) => String(f.get(k) ?? "").trim();
                              const dateLocal = g("date_debut");
                              const d = new Date(dateLocal);
                              if (Number.isNaN(d.getTime())) {
                                setError("Date de rendez-vous invalide.");
                                return;
                              }
                              if (!g("adresse")) {
                                setError("Merci d'indiquer l'adresse du chantier.");
                                return;
                              }
                              setDossierComplet.mutate({
                                id: r.id,
                                titre: g("titre"),
                                type: optionValue(g("type"), TYPES_INTERVENTION, "installation"),
                                statut: optionValue(g("statut"), STATUTS_DOSSIER, "planifie"),
                                client_nom: g("client_nom"),
                                client_telephone: g("client_telephone") || null,
                                client_email: g("client_email") || null,
                                adresse: g("adresse"),
                                cp_ville: g("cp_ville") || null,
                                date_debut: d.toISOString(),
                                duree_min: Number(g("duree_min") || 120),
                                technicien: g("technicien") || null,
                                notes: g("notes") || null,
                                origine: optionValue(g("origine"), ORIGINES_DOSSIER, "direct"),
                                partenaire: g("partenaire") || null,
                                montant_ht: Number(g("montant_ht") || 0),
                                tva_pct: Number(g("tva_pct") || 20),
                                statut_facturation: optionValue(g("statut_facturation"), STATUTS_FACTURATION, "a_facturer"),
                                designation: g("designation") || null,
                                etiquettes: parseEtiquettes(g("etiquettes")),
                                metrage_m: Number(g("metrage_m") || 0),
                                puissance_borne: g("puissance_borne") || null,
                                phase_installation: g("phase_installation") || null,
                                type_pose: g("type_pose") || null,
                                sous_traitant_id: g("sous_traitant_id") || null,
                                montant_sous_traitant_ht: g("montant_sous_traitant_ht")
                                  ? Number(g("montant_sous_traitant_ht").replace(",", "."))
                                  : null,
                              });
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <Field label="Client" name="client_nom" defaultValue={r.client_nom ?? ""} required />
                            <Field label="Téléphone" name="client_telephone" defaultValue={r.client_telephone ?? ""} />
                            <Field label="Email" name="client_email" type="email" defaultValue={r.client_email ?? ""} />
                            <Field label="Objet" name="titre" defaultValue={r.titre ?? ""} />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Type d&apos;intervention</span>
                              <select
                                name="type"
                                defaultValue={r.type}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                {TYPES.map((t) => (
                                  <option key={t.v} value={t.v}>
                                    {t.l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Statut chantier</span>
                              <select
                                name="statut"
                                defaultValue={r.statut}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                {STATUTS.map((s) => (
                                  <option key={s.v} value={s.v}>
                                    {s.l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Date & heure</span>
                              <input
                                type="datetime-local"
                                name="date_debut"
                                required
                                defaultValue={new Date(
                                  new Date(r.date_debut).getTime() -
                                    new Date(r.date_debut).getTimezoneOffset() * 60000,
                                )
                                  .toISOString()
                                  .slice(0, 16)}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <Field label="Durée sur site (min)" name="duree_min" type="number" defaultValue={String(r.duree_min ?? 120)} />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Technicien</span>
                              <select
                                name="technicien"
                                defaultValue={r.technicien ?? ""}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="">À attribuer</option>
                                {TECHNICIENS.map((t) => (
                                  <option key={t.id} value={t.nom}>
                                    {t.nom} — départ {t.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <SousTraitantFields
                              defaultId={(r as { sous_traitant_id?: string | null }).sous_traitant_id ?? ""}
                              defaultMontant={(r as { montant_sous_traitant_ht?: number | null }).montant_sous_traitant_ht ?? null}
                            />
                            <div className="sm:col-span-2">
                              <AdresseFields
                                required
                                defaultAdresse={r.adresse}
                                defaultCpVille={r.cp_ville ?? ""}
                              />
                            </div>

                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Origine</span>
                              <select
                                name="origine"
                                defaultValue={r.origine ?? "direct"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="direct">Client direct</option>
                                <option value="sous_traitance">Sous-traitance / partenaire</option>
                              </select>
                            </label>
                            <Field label="Partenaire / donneur d'ordre" name="partenaire" defaultValue={r.partenaire ?? ""} />
                            <Field label="Montant HT (€)" name="montant_ht" type="number" defaultValue={String(r.montant_ht ?? 0)} />
                            <Field label="TVA (%)" name="tva_pct" type="number" defaultValue={String(r.tva_pct ?? 20)} />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Facturation</span>
                              <select
                                name="statut_facturation"
                                defaultValue={r.statut_facturation ?? "a_facturer"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="a_facturer">À facturer</option>
                                <option value="facture">Facturé</option>
                                <option value="paye">Payé</option>
                              </select>
                            </label>
                            <div className="sm:col-span-2">
                              <Field label="Désignation du chantier" name="designation" defaultValue={r.designation ?? ""} />
                            </div>
                            <Field label="Métrage estimé (m)" name="metrage_m" type="number" defaultValue={String(r.metrage_m ?? 0)} />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Puissance de la borne</span>
                              <select name="puissance_borne" defaultValue={r.puissance_borne ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option value="3,7 kW">3,7 kW — prise renforcée</option><option value="7,4 kW">7,4 kW — standard maison (32A mono)</option><option value="11 kW">11 kW — recharge accélérée</option><option value="22 kW">22 kW — forte puissance (triphasé)</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Alimentation</span>
                              <select name="phase_installation" defaultValue={r.phase_installation ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option>Monophasé</option><option>Triphasé</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Type de pose</span>
                              <select name="type_pose" defaultValue={r.type_pose ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option>Intérieure</option><option>Extérieure</option><option>Sur pied</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">Étiquettes</span>
                              <input
                                name="etiquettes"
                                list="etiquettes-suggestions"
                                defaultValue={Array.isArray(r.etiquettes) ? normaliserEtiquettes(r.etiquettes).join(", ") : ""}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">Notes</span>
                              <textarea
                                name="notes"
                                rows={3}
                                defaultValue={r.notes ?? ""}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <div className="sm:col-span-2 flex items-center gap-3">
                              <button
                                type="submit"
                                disabled={setDossierComplet.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                {setDossierComplet.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Enregistrer tout le dossier
                              </button>
                              <span className="text-mono text-xs text-muted-foreground">
                                Un seul bouton pour corriger client, adresse, planning et montant.
                              </span>
                            </div>
                          </form>
                        )}

                        {isChantierPanel && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              valider.mutate({
                                id: r.id,
                                valide: true,
                                par: String(f.get("par") ?? "").trim() || r.technicien || null,
                                commentaire: String(f.get("commentaire") ?? "").trim() || null,
                              });
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <Field label="Validé par" name="par" defaultValue={r.technicien ?? ""} />
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Commentaire de fin de chantier
                              </span>
                              <textarea
                                name="commentaire"
                                rows={2}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <button
                              type="submit"
                              disabled={valider.isPending}
                              className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 w-fit disabled:opacity-60"
                            >
                              {valider.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Confirmer la réalisation
                            </button>
                          </form>
                        )}

                        {isAdressePanel && (
                          <form
                            key={`adr-${r.id}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              setAdresse.mutate({
                                id: r.id,
                                adresse: String(f.get("adresse") ?? "").trim(),
                                cp_ville: String(f.get("cp_ville") ?? "").trim() || null,
                              });
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <AdresseFields
                              required
                              defaultAdresse={r.adresse}
                              defaultCpVille={r.cp_ville ?? ""}
                            />
                            <div className="sm:col-span-2 flex items-center gap-4">
                              <button
                                type="submit"
                                disabled={setAdresse.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 w-fit disabled:opacity-60"
                              >
                                {setAdresse.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Enregistrer la nouvelle adresse
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                La carte et le temps de trajet seront recalculés automatiquement.
                              </p>
                            </div>
                          </form>
                        )}

                        {isDatePanel && (
                          <form
                            key={`date-${r.id}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              const val = String(f.get("date_debut") ?? "");
                              const d = new Date(val);
                              if (Number.isNaN(d.getTime())) {
                                setError("Date de rendez-vous invalide.");
                                return;
                              }
                              appliquer.mutate([{ id: r.id, date_debut: d.toISOString() }]);
                              setPanel(null);
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">
                                Date et heure du rendez-vous
                              </span>
                              <input
                                type="datetime-local"
                                name="date_debut"
                                required
                                defaultValue={
                                  r.date_a_confirmer
                                    ? ""
                                    : new Date(
                                        new Date(r.date_debut).getTime() -
                                          new Date(r.date_debut).getTimezoneOffset() * 60000,
                                      )
                                        .toISOString()
                                        .slice(0, 16)
                                }
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
                              <button
                                type="submit"
                                disabled={appliquer.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 w-fit disabled:opacity-60"
                              >
                                {appliquer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Enregistrer la date
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                La date apparaît aussitôt dans l&apos;agenda du partenaire et du
                                client.
                              </p>
                            </div>
                          </form>
                        )}

                        {isMontantPanel && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              const g = (k: string) => String(f.get(k) ?? "").trim();
                              setFacturation.mutate({
                                id: r.id,
                                origine: g("origine") as "direct" | "sous_traitance",
                                partenaire: g("partenaire") || null,
                                montant_ht: Number(g("montant_ht") || 0),
                                tva_pct: Number(g("tva_pct") || 20),
                                statut_facturation: g("statut_facturation") as
                                  | "a_facturer"
                                  | "facture"
                                  | "paye",
                                designation: g("designation") || null,
                                etiquettes: parseEtiquettes(g("etiquettes")),
                                metrage_m: Number(g("metrage_m") || 0),
                                puissance_borne: g("puissance_borne") || null,
                                phase_installation: g("phase_installation") || null,
                                type_pose: g("type_pose") || null,
                              });

                            }}
                            className="mt-4 pt-4 border-t border-border grid gap-3 sm:grid-cols-2"
                          >
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">
                                Origine
                              </span>
                              <select
                                name="origine"
                                defaultValue={r.origine ?? "direct"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="direct">Client direct</option>
                                <option value="sous_traitance">Sous-traitance / partenaire</option>
                              </select>
                            </label>
                            <Field
                              label="Partenaire / donneur d'ordre"
                              name="partenaire"
                              defaultValue={r.partenaire ?? ""}
                            />
                            <Field
                              label="Montant HT (€)"
                              name="montant_ht"
                              type="number"
                              defaultValue={String(r.montant_ht ?? 0)}
                            />
                            <Field
                              label="TVA (%)"
                              name="tva_pct"
                              type="number"
                              defaultValue={String(r.tva_pct ?? 20)}
                            />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">
                                Facturation
                              </span>
                              <select
                                name="statut_facturation"
                                defaultValue={r.statut_facturation ?? "a_facturer"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="a_facturer">À facturer</option>
                                <option value="facture">Facturé</option>
                                <option value="paye">Payé</option>
                              </select>
                            </label>
                            <div className="sm:col-span-2">
                              <Field
                                label="Désignation du chantier"
                                name="designation"
                                defaultValue={r.designation ?? ""}
                                placeholder="Ex. Inter de Rennes — prestation pour PureEnergie"
                              />
                            </div>
                            <Field label="Métrage estimé (m)" name="metrage_m" type="number" defaultValue={String(r.metrage_m ?? 0)} />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Puissance de la borne</span>
                              <select name="puissance_borne" defaultValue={r.puissance_borne ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option value="3,7 kW">3,7 kW — prise renforcée</option><option value="7,4 kW">7,4 kW — standard maison (32A mono)</option><option value="11 kW">11 kW — recharge accélérée</option><option value="22 kW">22 kW — forte puissance (triphasé)</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Alimentation</span>
                              <select name="phase_installation" defaultValue={r.phase_installation ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option>Monophasé</option><option>Triphasé</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Type de pose</span>
                              <select name="type_pose" defaultValue={r.type_pose ?? "À définir"} className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm">
                                <option>Intérieure</option><option>Extérieure</option><option>Sur pied</option><option>À définir</option>
                              </select>
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Étiquettes (séparées par des virgules)
                              </span>
                              <input
                                name="etiquettes"
                                list="etiquettes-suggestions"
                                defaultValue={
                                  Array.isArray(r.etiquettes) ? normaliserEtiquettes(r.etiquettes).join(", ") : ""
                                }
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                              />
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {ETIQUETTES_SUGGEREES.map((et) => (
                                  <span
                                    key={et}
                                    className="text-mono text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                                  >
                                    {et}
                                  </span>
                                ))}
                              </span>
                            </label>

                            <div className="sm:col-span-2 flex items-center gap-3">
                              <button
                                type="submit"
                                disabled={setFacturation.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                {setFacturation.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Enregistrer
                              </button>
                              <span className="text-mono text-xs text-muted-foreground">
                                Total TTC :{" "}
                                {eurosFr(
                                  Number(r.montant_ht ?? 0) * (1 + Number(r.tva_pct ?? 20) / 100),
                                )}
                              </span>
                            </div>
                          </form>
                        )}

                        {isVoiriePanel && (
                          <form
                            onSubmit={(e) => onVoirieSubmit(e, r.id, v?.id)}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Statut</span>
                              <select
                                name="statut"
                                defaultValue={v?.statut ?? "en_attente"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                {VOIRIE_STATUTS.map((s) => (
                                  <option key={s.v} value={s.v}>
                                    {s.l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Field
                              label="Référence de l'arrêté"
                              name="reference"
                              defaultValue={v?.reference ?? ""}
                            />
                            <Field
                              label="Autorité (mairie, métropole…)"
                              name="autorite"
                              defaultValue={v?.autorite ?? ""}
                            />
                            <Field
                              label="Date de demande"
                              name="date_demande"
                              type="date"
                              defaultValue={v?.date_demande ?? ""}
                            />
                            <Field
                              label="Date d'obtention"
                              name="date_obtention"
                              type="date"
                              defaultValue={v?.date_obtention ?? ""}
                            />
                            <Field
                              label="Valable jusqu'au"
                              name="date_fin"
                              type="date"
                              defaultValue={v?.date_fin ?? ""}
                            />
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Document (PDF ou photo, 8 Mo max.)
                              </span>
                              <input
                                type="file"
                                name="document"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">Notes</span>
                              <textarea
                                name="notes"
                                rows={2}
                                defaultValue={v?.notes ?? ""}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <div className="sm:col-span-2 flex items-center gap-4">
                              <button
                                type="submit"
                                disabled={saveVoirieMut.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                {saveVoirieMut.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                                Enregistrer l'autorisation
                              </button>
                              {v && (
                                <button
                                  type="button"
                                  onClick={() => removeVoirie.mutate(v.id)}
                                  className="text-mono text-xs text-muted-foreground hover:text-destructive"
                                >
                                  Supprimer
                                </button>
                              )}
                              {error && (
                                <p className="text-mono text-xs text-destructive">{error}</p>
                              )}
                            </div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>
        </div>

        <aside className="w-full min-w-0 max-w-full space-y-6 lg:[grid-area:tools]">
          <MobileSectionTrigger
            label="Agenda"
            count={rows.length}
            open={!modeIntervention || mobileSections.agenda}
            onToggle={() => toggleMobileSection("agenda")}
            className="order-3"
          />
          <div className={`order-4 min-w-0 ${modeIntervention && !mobileSections.agenda ? "hidden md:block" : ""}`}>
            <AgendaMois
              events={rows.map((r) => ({
                id: r.id,
                date_debut: r.date_debut,
                duree_min: r.duree_min,
                client_nom: r.client_nom,
                titre: r.titre,
                cp_ville: r.cp_ville,
                statut: r.statut,
                distance_km: r.distance_km,
              }))}
              activeId={active}
              onSelectEvent={setActive}
              onPickDay={(iso) => {
                setPrefillDate(iso);
                setOpen(true);
              }}
            />
          </div>

          <MobileSectionTrigger
            label={tourneeAff.etapes.length > 1 ? "Tournée du jour" : "Trajet du jour"}
            count={tourneeAff.etapes.length}
            open={!modeIntervention || mobileSections.trajet}
            onToggle={() => toggleMobileSection("trajet")}
            className="order-1"
          />
          <div className={`order-2 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 ${modeIntervention && !mobileSections.trajet ? "hidden md:block" : ""}`}>
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] mb-3 flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" />
              {tourneeAff.etapes.length > 1 ? "Tournée du jour optimisée" : "Trajet du jour"}
              {tourneeReel.data && !tourneeReel.data.estime && (
                <span className="text-[10px] font-bold text-primary normal-case tracking-normal bg-primary/10 px-1.5 py-0.5 rounded-full">
                  itinéraires réels
                </span>
              )}
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {TECHNICIENS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDepartId(t.id)}
                  className={`min-w-0 w-full sm:w-auto sm:max-w-[280px] text-left border rounded-lg px-3 py-2 text-xs transition ${
                    depart.id === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="block font-semibold">{t.nom}</span>
                  <span className="block truncate text-muted-foreground">Départ {t.adresse}</span>
                </button>
              ))}
            </div>
            {joursDispo.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {joursDispo.map((j) => (
                  <button
                    key={j.key}
                    type="button"
                    onClick={() => setJourSel(j.key)}
                    className={`text-mono text-[11px] px-2 py-1 rounded-full border transition ${
                      jourActif?.key === j.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {j.label} · {j.stops.length}
                  </button>
                ))}
              </div>
            )}
            {tourneeAff.etapes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun chantier géolocalisé ce jour-là pour {depart.nom}.
              </p>
            ) : (
              <>
                <ol className="space-y-1.5">
                  {tourneeAff.etapes.map((e) => (
                    <li
                      key={e.id}
                      onMouseEnter={() => setActive(e.id)}
                      onClick={() => setActive(e.id)}
                      className={`flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 cursor-pointer transition ${
                        active === e.id ? "bg-primary/12" : "hover:bg-muted/70"
                      }`}
                    >
                      <span className="text-mono text-[11px] font-bold w-6 h-6 rounded-full hero-grad text-primary-foreground grid place-items-center shrink-0">
                        {e.ordre}
                      </span>
                      <span className="truncate font-semibold">{e.label}</span>
                      <span className="ml-auto text-mono text-xs font-bold text-muted-foreground shrink-0">
                        +{e.km} km
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-mono text-xs">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tourneeAff.etapes.length > 1
                        ? `${jourActif?.label ?? "Journée"} · ${tourneeAff.etapes.length} chantiers`
                        : `Aller-retour depuis ${depart.label}`}
                    </span>
                    <span>
                      {tourneeAff.kmTotal} km · {dureeFr(tourneeAff.minutes)}
                    </span>
                  </p>
                  {tourneeAff.etapes.length > 1 && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Un aller-retour par chantier</span>
                      <span>{tourneeAff.kmDirect} km</span>
                    </p>
                  )}
                  {tourneeAff.etapes.length > 1 && tourneeAff.kmDirect > tourneeAff.kmTotal && (
                    <p className="flex justify-between text-primary">
                      <span className="inline-flex items-center gap-1">
                        <Fuel className="h-3.5 w-3.5" /> Économie estimée
                      </span>
                      <span>
                        {tourneeAff.kmDirect - tourneeAff.kmTotal} km · {economie.litres} L ·{" "}
                        {economie.euros} €
                      </span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <MobileSectionTrigger
            label="Programme des tournées"
            open={!modeIntervention || mobileSections.programme}
            onToggle={() => toggleMobileSection("programme")}
            className="order-5"
          />
          <div className={`order-6 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 ${modeIntervention && !mobileSections.programme ? "hidden md:block" : ""}`}>
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] mb-1 flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" /> Programme des tournées
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Répartit les chantiers sur plusieurs journées en suivant les secteurs : au-delà de
              150 km, la journée prévoit une nuitée sur place.
            </p>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="flex items-center gap-2 bg-muted/30 px-2 py-1.5 rounded-sm border border-border mr-2">
                <span className="text-mono text-[10px] text-muted-foreground uppercase font-bold">Horizon</span>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={horizon}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setHorizon(Math.min(365, Math.max(1, v)));
                      setCampagneOn(true);
                    }
                  }}
                  className="w-12 bg-transparent border-none text-xs text-mono text-primary font-bold focus:ring-0 p-0 text-center"
                />
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Jours</span>
              </div>
              {[1, 3, 7, 14, 30, 60, 90].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHorizon(h);
                    setCampagneOn(true);
                  }}
                  className={`text-mono text-[11px] px-2.5 py-1.5 rounded-sm border transition ${
                    campagneOn && horizon === h
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Sur {h} jours
                </button>
              ))}
              <label className="w-full sm:min-w-[150px] sm:flex-1 sm:max-w-[210px]">
                <span className="mb-1 block text-mono text-[10px] text-muted-foreground">
                  Durée libre
                </span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center overflow-hidden rounded-sm border border-border bg-background focus-within:border-primary">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={horizon}
                    onChange={(e) => {
                      const valeur = Number(e.target.value);
                      if (Number.isFinite(valeur)) setHorizon(Math.min(365, Math.max(1, valeur)));
                    }}
                    onFocus={() => setCampagneOn(true)}
                    className="min-h-[42px] min-w-0 bg-transparent px-3 text-sm outline-none"
                    aria-label="Nombre de jours à planifier"
                  />
                  <span className="pr-3 text-mono text-[10px] text-muted-foreground">jours</span>
                </span>
              </label>
              <button
                type="button"
                onClick={() => setCampagneOn((v) => !v)}
                className="hero-grad text-primary-foreground text-mono text-[11px] px-3 py-1.5 rounded-sm"
              >
                {campagneOn ? "Masquer" : "Programmer les tournées"}
              </button>
            </div>
            {campagneOn &&
              (!campagne || !campagne.jours.length ? (
                <p className="text-sm text-muted-foreground">
                  Aucun chantier à répartir pour {depart.nom}.
                </p>
              ) : (
                <>
                  <ol className="space-y-2">
                    {campagne.jours.map((j) => (
                      <li key={j.jour} className="text-sm border border-border rounded-lg p-2.5">
                        <p className="flex items-center gap-2">
                          <span className="text-mono text-[11px] font-bold w-6 h-6 rounded-full hero-grad text-primary-foreground grid place-items-center shrink-0">
                            J{j.jour}
                          </span>
                          <span className="font-semibold truncate">{j.secteur}</span>
                          <span className="ml-auto text-mono text-xs text-muted-foreground shrink-0">
                            +{j.km} km
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {j.stops.map((s) => s.label).join(" · ")}
                        </p>
                        {j.nuitee && (
                          <p className="text-mono text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            Nuitée sur place conseillée
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-mono text-xs">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">
                        {campagne.jours.length} journées · {campagne.nuitees} nuitée(s)
                      </span>
                      <span>{campagne.kmTotal} km</span>
                    </p>
                    {campagne.kmSepares > campagne.kmTotal && (
                      <p className="flex justify-between text-primary">
                        <span className="inline-flex items-center gap-1">
                          <Fuel className="h-3.5 w-3.5" /> Économie estimée
                        </span>
                        <span>{campagne.kmSepares - campagne.kmTotal} km</span>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const items = campagne.jours.flatMap((j) =>
                        j.stops.map((stop, i) => {
                          const d = new Date();
                          d.setDate(d.getDate() + j.jour);
                          d.setHours(8 + i * 3, 0, 0, 0);
                          return { id: stop.id, date_debut: d.toISOString() };
                        }),
                      );
                      if (!items.length) return;
                      if (
                        !window.confirm(
                          `Appliquer ce programme ? ${items.length} rendez-vous seront replanifiés aux dates proposées.`,
                        )
                      )
                        return;
                      appliquer.mutate(items);
                    }}
                    disabled={appliquer.isPending}
                    className="mt-3 w-full hero-grad text-primary-foreground text-mono text-[11px] font-bold min-h-[42px] rounded-sm disabled:opacity-60"
                  >
                    {appliquer.isPending
                      ? "Application en cours…"
                      : "Appliquer ce programme aux rendez-vous"}
                  </button>
                </>
              ))}
          </div>

          {grappes.length > 0 && (
            <>
            <MobileSectionTrigger
              label="Chantiers proches"
              count={grappes.length}
              open={!modeIntervention || mobileSections.proches}
              onToggle={() => toggleMobileSection("proches")}
              className="order-7"
            />
            <div className={`order-8 w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 ${modeIntervention && !mobileSections.proches ? "hidden md:block" : ""}`}>
              <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Chantiers proches (moins de 25 km)
              </h2>
              <ul className="space-y-3">
                {grappes.map((g, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-mono text-xs text-primary">
                      Secteur {i + 1} · {g.length} chantiers
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {g.map((s) => s.label).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            </>
          )}
        </aside>
      </div>

      {retourRdv && (
        <RetourTravauxSheet rdv={retourRdv} onClose={() => setRetourRdv(null)} />
      )}
    </ProShell>
  );
}

function MobileSectionTrigger({
  label,
  count,
  open,
  onToggle,
  className = "",
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`mx-auto grid min-h-12 w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl border border-border bg-card px-4 text-left md:hidden ${className}`}
      aria-expanded={open}
    >
      <span className="min-w-0 truncate font-bold">{label}</span>
      {typeof count === "number" && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
          {count}
        </span>
      )}
      <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

function EtapeMission({
  titre,
  detail,
  etat,
  icone,
  dernier = false,
  children,
}: {
  titre: string;
  detail?: string;
  etat: "termine" | "active" | "attente";
  icone: React.ReactNode;
  dernier?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 ${dernier ? "" : "pb-6"}`}>
      {!dernier && <span className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5 ${etat === "termine" ? "bg-emerald-500" : "bg-border"}`} />}
      <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full [&_svg]:h-4 [&_svg]:w-4 ${etat === "termine" ? "bg-emerald-500 text-slate-50" : etat === "active" ? "bg-blue-600 text-slate-50 ring-4 ring-blue-100 dark:ring-blue-950" : "bg-muted text-muted-foreground"}`}>
        {etat === "termine" ? <CheckCircle2 /> : icone}
      </span>
      <div className={`min-w-0 max-w-full overflow-hidden rounded-lg p-3 ${etat === "active" ? "border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30" : ""}`}>
        <h4 className={`break-words font-bold ${etat === "attente" ? "text-muted-foreground" : "text-foreground"}`}>{titre}</h4>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">{detail}</p>
        {children}
      </div>
    </div>
  );
}

function Bilan({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-bold mt-2">{valeur}</p>
    </div>
  );
}

function Legende({ color, label }: { color: string; label: string }) {

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-mono text-xs text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </label>
  );
}


/** Affectation d'un dossier à un sous-traitant (qui ne voit que ses dossiers). */
function SousTraitantFields({ defaultId, defaultMontant }: { defaultId: string; defaultMontant: number | null }) {
  const lister = useServerFn(listPartenaires);
  const q = useQuery({ queryKey: ["partenaires"], queryFn: () => lister() });
  const sts = (q.data ?? []).filter((p) => p.type === "sous_traitant" && p.actif);
  return (
    <>
      <label className="block">
        <span className="text-mono text-xs text-muted-foreground">Sous-traitant affecté</span>
        <select
          name="sous_traitant_id"
          defaultValue={defaultId}
          key={`${defaultId}-${sts.length}`}
          className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
        >
          <option value="">Aucun (réalisé par nous)</option>
          {sts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}{p.base_adresse ? "" : " — base non définie"}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="Montant payé au sous-traitant (HT €)"
        name="montant_sous_traitant_ht"
        type="number"
        defaultValue={defaultMontant != null ? String(defaultMontant) : ""}
      />
    </>
  );
}
