import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, ExternalLink, Loader2, Mail, Phone, Plus, Target } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  dateRelance,
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

const FILTRES: { cle: "tous" | "a_faire" | "a_relancer" | "suivis" | "clos"; label: string }[] = [
  { cle: "a_faire", label: "À envoyer" },
  { cle: "a_relancer", label: "À relancer" },
  { cle: "suivis", label: "Réponses" },
  { cle: "clos", label: "Clos" },
  { cle: "tous", label: "Tous" },
];

function aRelancer(p: Prospect) {
  return (p.statut === "envoye" || p.statut === "relance") && !!p.relance_le && p.relance_le <= new Date().toISOString().slice(0, 10);
}

function correspond(p: Prospect, f: (typeof FILTRES)[number]["cle"]) {
  if (f === "tous") return true;
  if (f === "a_faire") return p.statut === "a_envoyer";
  if (f === "a_relancer") return aRelancer(p);
  if (f === "suivis") return p.statut === "repondu" || p.statut === "interesse";
  return p.statut === "pas_interesse" || p.statut === "stop";
}

function ProspectsPage() {
  const { data = [], isLoading, error } = useProspects();
  const [filtre, setFiltre] = useState<(typeof FILTRES)[number]["cle"]>("a_faire");
  const [metier, setMetier] = useState<"tous" | MetierProspect>("tous");
  const [ajout, setAjout] = useState(false);

  const liste = useMemo(
    () => data.filter((p) => correspond(p, filtre) && (metier === "tous" || p.metier === metier)),
    [data, filtre, metier],
  );
  const compte = (f: (typeof FILTRES)[number]["cle"]) => data.filter((p) => correspond(p, f)).length;

  return (
    <ProShell>
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Target className="h-6 w-6 text-primary" /> Prospects
          </h1>
          <p className="text-sm text-muted-foreground">
            Entreprises à démarcher (bornes et fibre). Ouvrez le mail prêt, envoyez-le depuis votre messagerie, puis touchez « Marquer envoyé ». Professionnels uniquement.
          </p>
        </header>

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

        {ajout && <FormAjout onFini={() => setAjout(false)} />}

        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Impossible de charger les prospects.</p>
        ) : liste.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Aucun prospect ici. Écrivez « prospection du soir » dans le chat pour recevoir une nouvelle liste.
          </p>
        ) : (
          <ul className="space-y-2">
            {liste.map((p) => (
              <CarteProspect key={p.id} p={p} />
            ))}
          </ul>
        )}
      </div>
    </ProShell>
  );
}

function FormAjout({ onFini }: { onFini: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ entreprise: "", metier: "bornes" as MetierProspect, ville: "", email: "", telephone: "" });
  const [enCours, setEnCours] = useState(false);
  const enregistrer = async () => {
    if (!f.entreprise.trim()) return toast.error("Nom de l'entreprise obligatoire.");
    setEnCours(true);
    const mail = mailParDefaut(f.metier, f.entreprise.trim());
    const { error } = await supabase.from("prospects").insert({
      entreprise: f.entreprise.trim(),
      metier: f.metier,
      ville: f.ville.trim() || null,
      email: f.email.trim() || null,
      telephone: f.telephone.trim() || null,
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

function CarteProspect({ p }: { p: Prospect }) {
  const qc = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const defaut = mailParDefaut(p.metier as MetierProspect, p.entreprise);
  const [objet, setObjet] = useState(p.objet_mail ?? defaut.objet);
  const [corps, setCorps] = useState(p.corps_mail ?? defaut.corps);
  const statut = p.statut as StatutProspect;
  const mailto = lienMailto({ email: p.email, statut, objet, corps });

  const maj = async (champs: Partial<Prospect>, message?: string) => {
    const { error } = await supabase.from("prospects").update(champs).eq("id", p.id);
    if (error) return toast.error("Modification impossible.");
    if (message) toast.success(message);
    qc.invalidateQueries({ queryKey: CLE });
  };
  const marquerEnvoye = () => {
    const relance = statut === "envoye" || statut === "relance";
    maj(
      { statut: relance ? "relance" : "envoye", envoye_le: new Date().toISOString(), relance_le: dateRelance(new Date()), objet_mail: objet, corps_mail: corps },
      relance ? "Relance notée. Prochaine relance dans 7 jours." : "Envoi noté. Relance prévue dans 7 jours.",
    );
  };
  const copier = async () => {
    await navigator.clipboard.writeText(`${objet}\n\n${finaliserCorps(corps)}`);
    toast.success("Mail copié.");
  };

  return (
    <li className={`rounded-lg border bg-card ${statut === "stop" ? "border-destructive/40" : "border-border"}`}>
      <button type="button" onClick={() => setOuvert((v) => !v)} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{p.entreprise}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {METIER_LIBELLE[p.metier as MetierProspect]}
            {p.cible ? ` · ${p.cible}` : ""}
            {p.ville ? ` · ${p.ville}` : ""}
            {p.departement ? ` (${p.departement})` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statut === "stop" ? "bg-destructive/15 text-destructive" : aRelancer(p) ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary"}`}>
          {aRelancer(p) ? "À relancer" : STATUT_LIBELLE[statut]}
        </span>
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <div className="space-y-3 border-t border-border p-3 text-sm">
          {p.pourquoi && <p><span className="font-semibold">Pourquoi : </span>{p.pourquoi}</p>}
          {p.inconnu && <p className="text-xs text-muted-foreground">À vérifier : {p.inconnu}</p>}
          <div className="flex flex-wrap gap-3 text-xs">
            {p.email && <span>{p.email}</span>}
            {p.telephone && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`tel:${p.telephone.replace(/\s/g, "")}`}><Phone className="h-3 w-3" />{p.telephone}</a>}
            {p.site_web && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={p.site_web} target="_blank" rel="noreferrer">Site <ExternalLink className="h-3 w-3" /></a>}
            {p.formulaire_url && <a className="inline-flex items-center gap-1 text-primary hover:underline" href={p.formulaire_url} target="_blank" rel="noreferrer">Formulaire de contact <ExternalLink className="h-3 w-3" /></a>}
            {p.source_url && <a className="inline-flex items-center gap-1 text-muted-foreground hover:underline" href={p.source_url} target="_blank" rel="noreferrer">Source <ExternalLink className="h-3 w-3" /></a>}
          </div>

          {statut === "stop" ? (
            <p className="rounded-md bg-destructive/10 p-2 text-destructive">Cette entreprise a demandé à ne plus être contactée.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Input value={objet} onChange={(e) => setObjet(e.target.value)} aria-label="Objet du mail" />
                <Textarea value={corps} onChange={(e) => setCorps(e.target.value)} rows={7} aria-label="Texte du mail" />
                <p className="text-xs text-muted-foreground">Votre signature (07 68 08 43 67, contacts@irvetechnologie.fr) et la ligne STOP sont ajoutées automatiquement.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mailto ? (
                  <Button asChild size="sm"><a href={mailto}><Mail className="h-4 w-4" /> Ouvrir dans ma messagerie</a></Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">Pas d'email : passez par le formulaire ou le téléphone.</span>
                )}
                <Button size="sm" variant="outline" onClick={copier}><Copy className="h-4 w-4" /> Copier</Button>
                <Button size="sm" variant="secondary" onClick={marquerEnvoye}>Marquer envoyé</Button>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
            {(["repondu", "interesse", "pas_interesse", "stop", "a_envoyer"] as StatutProspect[]).map((s) => (
              <Button key={s} size="sm" variant={statut === s ? "default" : "ghost"} className="h-7 text-xs" onClick={() => maj({ statut: s }, `Statut : ${STATUT_LIBELLE[s]}`)}>
                {STATUT_LIBELLE[s]}
              </Button>
            ))}
          </div>
          {p.envoye_le && <p className="text-xs text-muted-foreground">Dernier envoi le {new Date(p.envoye_le).toLocaleDateString("fr-FR")}{p.relance_le ? ` · relance le ${new Date(p.relance_le).toLocaleDateString("fr-FR")}` : ""}</p>}
        </div>
      )}
    </li>
  );
}
