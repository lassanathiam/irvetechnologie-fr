import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, ExternalLink, Loader2, Mail, Phone, Plus, Send, Target, Undo2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  blocageDoublon,
  memesContacts,
  type ProspectSuivi,
  CANAL_LIBELLE,
  dateRelance,
  envoiPermis,
  etatEnvoi,
  objetPourEnvoi,
  type CanalEnvoi,
  type EtatEnvoi,
  finaliserCorps,
  lienMailto,
  mailParDefaut,
  METIER_LIBELLE,
  STATUT_LIBELLE,
  type MetierProspect,
  type StatutProspect,
} from "@/lib/prospection";

export const Route = createFileRoute("/_authenticated/prospects")({
  head: () => ({
    meta: [
      { title: "Prospects — Espace pro IRVE Technologie" },
      { name: "description", content: "Prospects professionnels bornes et fibre avec mails prêts à envoyer et suivi des relances." },
      { property: "og:title", content: "Prospects — IRVE Technologie" },
      { property: "og:description", content: "Suivi interne de la prospection professionnelle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProspectsPage,
});

type Prospect = Tables<"prospects">;
const CLE = ["prospects"];

function useProspects() {
  return useQuery({
    queryKey: CLE,
    queryFn: async () => {
      const { data, error } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Prospect[];
    },
  });
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const suivi = (p: Prospect) => ({ ...p, statut: p.statut as StatutProspect });
const dateFr = (d: string) => new Date(d).toLocaleDateString("fr-FR");

type Filtre = "a_faire" | "envoyes" | "a_relancer" | "suivis" | "clos" | "tous";
const FILTRES: { cle: Filtre; label: string }[] = [
  { cle: "a_faire", label: "Jamais contactés" },
  { cle: "envoyes", label: "Déjà envoyés" },
  { cle: "a_relancer", label: "À relancer" },
  { cle: "suivis", label: "Réponses" },
  { cle: "clos", label: "Clos" },
  { cle: "tous", label: "Tous" },
];

function correspond(p: Prospect, f: Filtre, jour: string) {
  const e = etatEnvoi(suivi(p), jour);
  if (f === "tous") return true;
  if (f === "a_faire") return e === "jamais" || e === "a_confirmer";
  if (f === "envoyes") return p.nb_envois > 0 || !!p.envoye_le;
  if (f === "a_relancer") return e === "a_relancer";
  if (f === "suivis") return p.statut === "repondu" || p.statut === "interesse";
  return p.statut === "pas_interesse" || p.statut === "stop";
}

function ProspectsPage() {
  const { data = [], isLoading, error } = useProspects();
  const [filtre, setFiltre] = useState<Filtre>("a_faire");
  const [metier, setMetier] = useState<"tous" | MetierProspect>("tous");
  const [ajout, setAjout] = useState(false);
  const jour = aujourdhui();

  const liste = useMemo(
    () => data.filter((p) => correspond(p, filtre, jour) && (metier === "tous" || p.metier === metier)),
    [data, filtre, metier, jour],
  );
  const compte = (f: Filtre) => data.filter((p) => correspond(p, f, jour)).length;
  const aConfirmer = data.filter((p) => etatEnvoi(suivi(p), jour) === "a_confirmer").length;

  return (
    <ProShell>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Target className="h-6 w-6 text-primary" /> Prospects
          </h1>
          <p className="text-sm text-muted-foreground">
            Professionnels uniquement. Chaque envoi est noté : une entreprise déjà contactée ne vous est plus proposée avant sa date de relance.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-xl font-bold">{compte("a_faire")}</p>
            <p className="text-xs text-muted-foreground">jamais contactés</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-xl font-bold text-primary">{compte("envoyes")}</p>
            <p className="text-xs text-muted-foreground">déjà envoyés</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-xl font-bold">{compte("a_relancer")}</p>
            <p className="text-xs text-muted-foreground">à relancer aujourd'hui</p>
          </div>
        </div>

        {aConfirmer > 0 && (
          <p className="flex items-center gap-2 rounded-lg border border-accent bg-accent/30 p-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {aConfirmer} mail{aConfirmer > 1 ? "s" : ""} ouvert{aConfirmer > 1 ? "s" : ""} dans votre messagerie sans confirmation d'envoi. Ouvrez la fiche et répondez « Oui, envoyé » ou « Non ».
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <Button key={f.cle} size="sm" variant={filtre === f.cle ? "default" : "outline"} onClick={() => setFiltre(f.cle)}>
              {f.label} <span className="ml-1 opacity-70">{compte(f.cle)}</span>
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["tous", "bornes", "fibre"] as const).map((m) => (
            <Button key={m} size="sm" variant={metier === m ? "secondary" : "ghost"} onClick={() => setMetier(m)}>
              {m === "tous" ? "Bornes + fibre" : METIER_LIBELLE[m]}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAjout((v) => !v)}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>

        {ajout && <FormAjout tous={data} onFini={() => setAjout(false)} />}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Impossible de charger les prospects.</p>
        ) : liste.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {filtre === "envoyes" ? "Aucun envoi noté pour l'instant." : "Aucun prospect ici. Écrivez « prospection du soir » dans le chat pour recevoir une nouvelle liste."}
          </p>
        ) : (
          <ul className="space-y-2">
            {liste.map((p) => (
              <CarteProspect key={p.id} p={p} tous={data} />
            ))}
          </ul>
        )}
      </div>
    </ProShell>
  );
}

function FormAjout({ tous, onFini }: { tous: Prospect[]; onFini: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ entreprise: "", metier: "bornes" as MetierProspect, ville: "", email: "", telephone: "" });
  const [enCours, setEnCours] = useState(false);
  const enregistrer = async () => {
    if (!f.entreprise.trim()) return toast.error("Nom de l'entreprise obligatoire.");
    const candidat = {
      id: "nouveau", entreprise: f.entreprise.trim(), statut: "a_envoyer" as StatutProspect,
      email: f.email.trim() || null, telephone: f.telephone.trim() || null, site_web: null,
      envoye_le: null, relance_le: null, nb_envois: 0, mail_ouvert_le: null,
    };
    const doublon = memesContacts<ProspectSuivi>(candidat, tous.map(suivi))[0]
      ?? tous.find((o) => o.entreprise.trim().toLowerCase() === candidat.entreprise.toLowerCase());
    if (doublon) return toast.error(`Déjà dans la liste : ${doublon.entreprise} (${STATUT_LIBELLE[doublon.statut as StatutProspect]}).`);
    setEnCours(true);
    const mail = mailParDefaut(f.metier, f.entreprise.trim());
    const { error } = await supabase.from("prospects").insert({
      entreprise: f.entreprise.trim(),
      metier: f.metier,
      ville: f.ville.trim() || null,
      email: candidat.email,
      telephone: candidat.telephone,
      objet_mail: mail.objet,
      corps_mail: mail.corps,
      lot: "Ajout manuel",
    });
    setEnCours(false);
    if (error) return toast.error(error.code === "23505" ? "Ce prospect existe déjà." : "Enregistrement impossible.");
    toast.success("Prospect ajouté.");
    qc.invalidateQueries({ queryKey: CLE });
    onFini();
  };
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
      <Input placeholder="Entreprise" value={f.entreprise} onChange={(e) => setF({ ...f, entreprise: e.target.value })} />
      <div className="flex gap-2">
        {(["bornes", "fibre"] as const).map((m) => (
          <Button key={m} type="button" size="sm" variant={f.metier === m ? "default" : "outline"} onClick={() => setF({ ...f, metier: m })}>
            {METIER_LIBELLE[m]}
          </Button>
        ))}
      </div>
      <Input placeholder="Ville" value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} />
      <Input placeholder="Email professionnel" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <Input placeholder="Téléphone" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} />
      <Button onClick={enregistrer} disabled={enCours}>{enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}</Button>
    </div>
  );
}

const BADGE: Record<EtatEnvoi, { label: string; cls: string }> = {
  jamais: { label: "Jamais contacté", cls: "bg-muted text-muted-foreground" },
  a_confirmer: { label: "Envoi à confirmer", cls: "bg-accent text-accent-foreground" },
  deja_envoye: { label: "Déjà envoyé", cls: "bg-primary/15 text-primary" },
  a_relancer: { label: "À relancer", cls: "bg-accent text-accent-foreground" },
  clos: { label: "", cls: "bg-secondary text-secondary-foreground" },
};

function CarteProspect({ p, tous }: { p: Prospect; tous: Prospect[] }) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [voirMail, setVoirMail] = useState(false);
  const defaut = mailParDefaut(p.metier as MetierProspect, p.entreprise);
  const [objet, setObjet] = useState(objetPourEnvoi(p.objet_mail ?? defaut.objet, p.nb_envois));
  const [corps, setCorps] = useState(p.corps_mail ?? defaut.corps);
  const statut = p.statut as StatutProspect;
  const jour = aujourdhui();
  const s = suivi(p);
  const etat = etatEnvoi(s, jour);
  const doublon = blocageDoublon(s, tous.map(suivi));
  const bloqueStop = doublon?.type === "stop";
  const mailto = bloqueStop ? null : lienMailto({ email: p.email, statut, objet, corps });
  const permis = envoiPermis(s, jour) && !bloqueStop;
  const badge = BADGE[etat];

  const maj = async (champs: Partial<Prospect>, message?: string) => {
    const { error } = await supabase.from("prospects").update(champs).eq("id", p.id);
    if (error) return toast.error("Modification impossible.");
    if (message) toast.success(message);
    qc.invalidateQueries({ queryKey: CLE });
  };
  const confirmerEnvoi = (canal: CanalEnvoi) => {
    const n = (p.nb_envois ?? 0) + 1;
    maj(
      {
        statut: n > 1 ? "relance" : "envoye", nb_envois: n, dernier_canal: canal,
        envoye_le: new Date().toISOString(), relance_le: dateRelance(new Date()), mail_ouvert_le: null,
        objet_mail: objet, corps_mail: corps,
      },
      `Envoi n°${n} noté ${CANAL_LIBELLE[canal]}. Relance proposée dans 7 jours.`,
    );
  };
  const annulerEnvoi = () => {
    const n = Math.max(0, (p.nb_envois ?? 0) - 1);
    maj(
      n === 0
        ? { statut: "a_envoyer", nb_envois: 0, envoye_le: null, relance_le: null, dernier_canal: null, mail_ouvert_le: null }
        : { statut: n > 1 ? "relance" : "envoye", nb_envois: n, mail_ouvert_le: null },
      "Dernier envoi annulé.",
    );
  };
  const copier = async () => {
    await navigator.clipboard.writeText(`${objet}\n\n${finaliserCorps(corps)}`);
    toast.success("Mail copié.");
  };

  return (
    <li className={`rounded-lg border bg-card ${statut === "stop" ? "border-destructive/40" : etat === "a_confirmer" ? "border-accent" : "border-border"}`}>
      <button type="button" onClick={() => setOuvert((v) => !v)} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{p.entreprise}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {METIER_LIBELLE[p.metier as MetierProspect]}
            {p.cible ? ` · ${p.cible}` : ""}
            {p.ville ? ` · ${p.ville}` : ""}
            {p.departement ? ` (${p.departement})` : ""}
          </p>
          {p.envoye_le && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Envoyé le {dateFr(p.envoye_le)} {p.dernier_canal ? CANAL_LIBELLE[p.dernier_canal as CanalEnvoi] : ""}
              {p.nb_envois > 1 ? ` · ${p.nb_envois} envois` : ""}
              {p.relance_le && etat === "deja_envoye" ? ` · relance le ${dateFr(p.relance_le)}` : ""}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statut === "stop" ? "bg-destructive/15 text-destructive" : badge.cls}`}>
          {etat === "clos" ? STATUT_LIBELLE[statut] : badge.label}
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="space-y-3 border-t border-border p-3 text-sm">
          {doublon && (
            <p className={`flex items-start gap-2 rounded-md p-2 text-xs ${bloqueStop ? "bg-destructive/10 text-destructive" : "bg-accent/30"}`}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {bloqueStop
                ? `Même contact que « ${doublon.autre.entreprise} », qui a demandé STOP. Envoi bloqué.`
                : `Même contact que « ${doublon.autre.entreprise} », déjà contacté${doublon.autre.envoye_le ? ` le ${dateFr(doublon.autre.envoye_le)}` : ""}. Vérifiez avant d'envoyer.`}
            </p>
          )}
          {p.pourquoi && <p><span className="font-semibold">Pourquoi : </span>{p.pourquoi}</p>}
          {p.inconnu && <p className="text-xs text-muted-foreground">À vérifier : {p.inconnu}</p>}
          <div className="flex flex-wrap gap-3 text-xs">
            {p.email && <span>{p.email}</span>}
            {p.telephone && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${p.telephone.replace(/\s/g, "")}`}><Phone className="h-3 w-3" />{p.telephone}</a>}
            {p.site_web && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={p.site_web} target="_blank" rel="noreferrer">Site <ExternalLink className="h-3 w-3" /></a>}
            {p.formulaire_url && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={p.formulaire_url} target="_blank" rel="noreferrer">Formulaire de contact <ExternalLink className="h-3 w-3" /></a>}
            {p.source_url && <a className="inline-flex items-center gap-1 text-muted-foreground hover:underline" href={p.source_url} target="_blank" rel="noreferrer">Source <ExternalLink className="h-3 w-3" /></a>}
          </div>

          {etat === "a_confirmer" && (
            <div className="space-y-2 rounded-md border border-accent bg-accent/20 p-3">
              <p className="font-semibold">Mail ouvert le {dateFr(p.mail_ouvert_le!)}. L'avez-vous vraiment envoyé ?</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => confirmerEnvoi("mail")}><CheckCircle2 className="h-4 w-4" /> Oui, envoyé</Button>
                <Button size="sm" variant="outline" onClick={() => maj({ mail_ouvert_le: null }, "D'accord, pas envoyé.")}>Non, pas envoyé</Button>
              </div>
            </div>
          )}

          {etat === "deja_envoye" && (
            <div className="space-y-2 rounded-md bg-primary/10 p-3">
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" /> Déjà envoyé le {dateFr(p.envoye_le!)} {p.dernier_canal ? CANAL_LIBELLE[p.dernier_canal as CanalEnvoi] : ""}
                {p.nb_envois > 1 ? ` (${p.nb_envois} envois)` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Inutile de renvoyer. {p.relance_le ? `La relance vous sera proposée le ${dateFr(p.relance_le)}.` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setVoirMail((v) => !v)}>{voirMail ? "Masquer le mail envoyé" : "Revoir le mail envoyé"}</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={annulerEnvoi}><Undo2 className="h-3.5 w-3.5" /> Annuler cet envoi (erreur)</Button>
              </div>
              {voirMail && <pre className="whitespace-pre-wrap rounded bg-card p-2 text-xs">{`${p.objet_mail ?? ""}\n\n${finaliserCorps(p.corps_mail ?? "")}`}</pre>}
            </div>
          )}

          {statut === "stop" ? (
            <p className="rounded-md bg-destructive/10 p-2 text-destructive">Cette entreprise a demandé à ne plus être contactée.</p>
          ) : permis && etat !== "a_confirmer" ? (
            <>
              {etat === "a_relancer" && <p className="text-xs font-semibold">Relance n°{p.nb_envois + 1} — premier envoi le {p.envoye_le ? dateFr(p.envoye_le) : "?"}.</p>}
              <div className="space-y-1.5">
                <Input value={objet} onChange={(e) => setObjet(e.target.value)} aria-label="Objet du mail" />
                <Textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={7} aria-label="Texte du mail" />
                <p className="text-xs text-muted-foreground">Votre signature (07 68 08 43 67, contacts@irvetechnologie.fr) et la ligne STOP sont ajoutées automatiquement.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mailto ? (
                  <Button asChild size="sm">
                    <a href={mailto} onClick={() => maj({ mail_ouvert_le: new Date().toISOString(), objet_mail: objet, corps_mail: corps })}>
                      <Mail className="h-4 w-4" /> Ouvrir dans ma messagerie
                    </a>
                  </Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">Pas d'email : passez par le formulaire ou le téléphone.</span>
                )}
                <Button size="sm" variant="outline" onClick={copier}><Copy className="h-4 w-4" /> Copier</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-2">
                <span className="text-xs font-semibold">Déjà contacté ? Notez-le :</span>
                {p.email && <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => confirmerEnvoi("mail")}><Send className="h-3.5 w-3.5" /> Envoyé par mail</Button>}
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => confirmerEnvoi("formulaire")}>Envoyé par formulaire</Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => confirmerEnvoi("telephone")}>Appelé</Button>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Leur réponse :</p>
            <div className="flex flex-wrap gap-1.5">
              {(["repondu", "interesse", "pas_interesse", "stop"] as StatutProspect[]).map((st) => (
                <Button key={st} size="sm" variant={statut === st ? "default" : "ghost"} className="h-7 text-xs" onClick={() => maj({ statut: st }, `Statut : ${STATUT_LIBELLE[st]}`)}>
                  {STATUT_LIBELLE[st]}
                </Button>
              ))}
              {etat === "clos" && statut !== "stop" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => maj({ statut: p.nb_envois > 0 ? (p.nb_envois > 1 ? "relance" : "envoye") : "a_envoyer" }, "Réponse retirée.")}>
                  <Undo2 className="h-3.5 w-3.5" /> Retirer la réponse
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
