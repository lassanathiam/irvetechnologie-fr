import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Loader2, Merge, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { DoublonsAttachements } from "@/components/DoublonsAttachements";
import { euro } from "@/lib/company";
import { listDoublonsSite, traiterDoublon } from "@/lib/doublons-site.functions";
import { actionChantier, actionDevis, actionFacture, blocagesChantier, type ActionDoublon, type ChantierDoublon, type ClientDoublon, type DevisDoublon, type FactureDoublon, type PartenaireDoublon } from "@/lib/doublons-site";

type Onglet = "chantier" | "facture" | "devis" | "fiche" | "attachement";
const ONGLETS: { cle: Onglet; label: string }[] = [
  { cle: "chantier", label: "Chantiers du Planning" }, { cle: "facture", label: "Factures" }, { cle: "devis", label: "Devis" },
  { cle: "fiche", label: "Fiches clients / partenaires" }, { cle: "attachement", label: "Attachements" },
];

export const Route = createFileRoute("/_authenticated/doublons")({
  validateSearch: (s: Record<string, unknown>): { type?: Onglet } => (ONGLETS.some((o) => o.cle === s.type) ? { type: s.type as Onglet } : {}),
  head: () => ({
    meta: [
      { title: "Doublons — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Repérer et supprimer les doublons de chantiers, factures, devis, attachements et fiches clients, toujours après confirmation." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Doublons — Borne de l'Ouest" },
      { property: "og:description", content: "Un seul endroit pour nettoyer les doublons du site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DoublonsPage,
});

const CLE_IGNORES = "irve-doublons-site-ignores";
const clePaire = (t: string, a: string, b: string) => `${t}|${[a, b].sort().join("|")}`;
const dateFr = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("fr-FR") : "");
const STATUT_FACTURE: Record<string, string> = { brouillon: "Brouillon", validee: "Émise", envoyee: "Envoyée", payee: "Payée", annulee: "Annulée" };
const STATUT_DEVIS: Record<string, string> = { brouillon: "Brouillon", envoye: "Envoyé", accepte: "Accepté", refuse: "Refusé" };

type Carte = { type: "chantier" | "facture" | "devis" | "partenaire" | "client"; garder: any; doublon: any; titre: string };

function DoublonsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onglet = search.type ?? "chantier";
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["doublons-site"], queryFn: useServerFn(listDoublonsSite) });
  const traiter = useServerFn(traiterDoublon);
  const [ignores, setIgnores] = useState<string[]>([]);
  const [inverses, setInverses] = useState<string[]>([]);
  const [enCours, setEnCours] = useState<string | null>(null);
  useEffect(() => { try { setIgnores(JSON.parse(localStorage.getItem(CLE_IGNORES) ?? "[]")); } catch { /* rien */ } }, []);
  const ignorer = (cle: string) => setIgnores((cur) => { const n = [...new Set([...cur, cle])]; try { localStorage.setItem(CLE_IGNORES, JSON.stringify(n)); } catch { /* rien */ } return n; });

  const d = q.data;
  const cartes: Record<Exclude<Onglet, "attachement">, Carte[]> = {
    chantier: (d?.chantiers ?? []).map((p) => ({ type: "chantier", garder: p.garder, doublon: p.doublon, titre: "Même client, même adresse ou même téléphone, à la même période" })),
    facture: (d?.factures ?? []).map((p) => ({ type: "facture", garder: p.garder, doublon: p.doublon, titre: "Même client et même chantier, même commande ou même montant" })),
    devis: (d?.devis ?? []).map((p) => ({ type: "devis", garder: p.garder, doublon: p.doublon, titre: "Même client, même objet et même montant" })),
    fiche: [
      ...(d?.clients ?? []).map((p) => ({ type: "client" as const, garder: p.garder, doublon: p.doublon, titre: "Deux fiches de facturation pour le même client" })),
      ...(d?.partenaires ?? []).map((p) => ({ type: "partenaire" as const, garder: p.garder, doublon: p.doublon, titre: "Deux fiches partenaires pour la même société" })),
    ],
  };
  const visibles = (t: Exclude<Onglet, "attachement">) => cartes[t].filter((c) => !ignores.includes(clePaire(c.type, c.garder.id, c.doublon.id)));
  const total = (["chantier", "facture", "devis", "fiche"] as const).reduce((n, t) => n + visibles(t).length, 0);

  async function agir(c: Carte, doublon: any, garder: any, action: ActionDoublon) {
    const nom = nomDe(c.type, doublon);
    const texte = action === "annuler"
      ? `Annuler la facture ${doublon.numero} (${euro(doublon.total_ht)} HT) ?\n\nUne facture émise n’est jamais effacée : elle reste numérotée, marquée « Annulée », et n’est plus comptée. ${garder.numero} est gardée.`
      : action === "fusionner"
        ? `Fusionner « ${doublon.nom} » dans « ${garder.nom} » ?\n\nLes chantiers et les informations manquantes passent sur la fiche gardée, puis le doublon est supprimé.${c.type === "partenaire" ? " Le lien privé du doublon ne fonctionnera plus." : ""}`
        : `Supprimer définitivement ${nom} ?\n\n${nomDe(c.type, garder)} est gardé. Cette suppression ne peut pas être annulée.`;
    if (!window.confirm(texte)) return;
    setEnCours(doublon.id);
    try {
      const r = await traiter({ data: { type: c.type, id: doublon.id, garderId: garder.id } });
      toast.success(r.fait === "annule" ? `${doublon.numero} annulée.` : r.fait === "fusionne" ? "Fiches fusionnées." : `${nom} supprimé.`);
      await qc.invalidateQueries();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Action impossible."); } finally { setEnCours(null); }
  }

  return <ProShell><div className="space-y-4">
    <header>
      <h1 className="text-2xl font-bold">Doublons</h1>
      <p className="text-sm text-muted-foreground">Tous les doublons possibles du site au même endroit. Pour chaque paire, vous choisissez celui à garder ; rien n’est supprimé sans votre confirmation.</p>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Types de doublons">
      {ONGLETS.map((o) => {
        const n = o.cle === "attachement" ? null : visibles(o.cle).length;
        const actif = o.cle === onglet;
        return <Button key={o.cle} size="sm" variant={actif ? "default" : "outline"} aria-current={actif ? "page" : undefined} onClick={() => void navigate({ search: { type: o.cle } })}>
          {o.label}{n !== null && <span className={`ml-1 rounded-full px-2 text-xs font-bold ${n ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>{n}</span>}
        </Button>;
      })}
    </nav>
    {q.isLoading ? <Loader2 className="animate-spin text-primary" /> : q.error ? <p className="text-destructive">Doublons indisponibles, rechargez la page.</p> :
      onglet === "attachement" ? <DoublonsAttachementsOuVide /> :
      !visibles(onglet).length ? <p className="flex items-center gap-2 rounded-md border border-border bg-card p-6 text-sm font-semibold text-primary"><CheckCircle2 className="h-5 w-5" />Aucun doublon ici.{total ? " Regardez les autres onglets." : ""}</p> :
      <ul className="space-y-3">{visibles(onglet).map((c) => {
        const cle = clePaire(c.type, c.garder.id, c.doublon.id);
        const inv = inverses.includes(cle);
        const doublon = inv ? c.garder : c.doublon, garder = inv ? c.doublon : c.garder;
        const action = actionDe(c.type, doublon);
        return <li key={cle} className="space-y-2 rounded-md border-2 border-destructive/40 bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" />{c.titre}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Fiche type={c.type} x={doublon} titre={action === "fusionner" ? "Doublon à fusionner" : action === "annuler" ? "Doublon à annuler" : "Doublon à supprimer"} rouge />
            <Fiche type={c.type} x={garder} titre="À garder" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {action
              ? <Button size="sm" variant="destructive" disabled={enCours !== null} onClick={() => void agir(c, doublon, garder, action)}>
                  {enCours === doublon.id ? <Loader2 className="animate-spin" /> : action === "fusionner" ? <Merge /> : action === "annuler" ? <XCircle /> : <Trash2 />}
                  {action === "fusionner" ? "Fusionner dans la fiche gardée" : action === "annuler" ? `Annuler ${doublon.numero}` : `Supprimer ${nomDe(c.type, doublon)}`}
                </Button>
              : <span className="text-xs font-semibold text-destructive">{raisonBlocage(c.type, doublon)}</span>}
            <Button size="sm" variant="outline" onClick={() => setInverses((cur) => (inv ? cur.filter((k) => k !== cle) : [...cur, cle]))}><ArrowLeftRight /> Garder plutôt l’autre</Button>
            <Button size="sm" variant="ghost" onClick={() => ignorer(cle)}>Ce n’est pas un doublon</Button>
          </div>
        </li>;
      })}</ul>}
  </div></ProShell>;
}

function DoublonsAttachementsOuVide() {
  return <div className="space-y-2"><DoublonsAttachements /><p className="text-xs text-muted-foreground">Si aucune case rouge n’apparaît, il n’y a pas de doublon d’attachement.</p></div>;
}

function nomDe(type: Carte["type"], x: any): string {
  if (type === "chantier") return `le chantier ${x.client_nom ?? ""}`.trim();
  if (type === "facture" || type === "devis") return x.numero;
  return x.nom;
}
function actionDe(type: Carte["type"], x: any): ActionDoublon {
  if (type === "chantier") return actionChantier(x as ChantierDoublon);
  if (type === "facture") return actionFacture(x as FactureDoublon);
  if (type === "devis") return actionDevis(x as DevisDoublon);
  return "fusionner";
}
function raisonBlocage(type: Carte["type"], x: any): string {
  if (type === "chantier") return `Ce chantier a ${blocagesChantier(x).join(", ")} : il ne peut pas être supprimé. Gardez plutôt celui-ci.`;
  if (type === "facture") return `${x.numero} est payée : faites un avoir, elle ne peut pas être annulée ici.`;
  return `${x.numero} est signé, accepté ou facturé : il ne peut pas être supprimé.`;
}

function Fiche({ type, x, titre, rouge }: { type: Carte["type"]; x: any; titre: string; rouge?: boolean }) {
  let corps: ReactNode = null;
  if (type === "chantier") {
    const c = x as ChantierDoublon; const l = c.liens;
    corps = <>
      <Link to="/planning" search={{ rdv: c.id }} className="block text-lg font-extrabold hover:underline">{c.client_nom || "Chantier sans nom"}</Link>
      <span className="block text-xs text-muted-foreground">{[c.adresse, c.cp_ville].filter(Boolean).join(", ")}{c.client_telephone ? ` · ${c.client_telephone}` : ""}</span>
      <span className="block text-xs text-muted-foreground">{c.date_debut ? `Prévu le ${dateFr(c.date_debut)}` : "Sans date"} · {c.statut ?? ""}</span>
      {l && <span className="block text-xs">{blocagesChantier(c).join(" · ") || "Aucun document ni photo relié"}</span>}
    </>;
  } else if (type === "facture") {
    const f = x as FactureDoublon;
    corps = <>
      <Link to="/factures/$id" params={{ id: f.id }} className="block text-lg font-extrabold hover:underline">{f.numero} · {f.client_nom}</Link>
      <span className="block text-xs text-muted-foreground">{f.objet}</span>
      <span className="block text-xs text-muted-foreground">{STATUT_FACTURE[f.statut ?? ""] ?? f.statut} · {dateFr(f.date_emission)}{f.bon_commande ? ` · Commande ${f.bon_commande}` : " · Sans commande"}{f.depose_at ? " · Déposée" : ""}</span>
      <strong className="block text-lg font-extrabold text-dashboard-green">{euro(Number(f.total_ht ?? 0))} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
    </>;
  } else if (type === "devis") {
    const v = x as DevisDoublon;
    corps = <>
      <Link to="/devis/$id" params={{ id: v.id }} className="block text-lg font-extrabold hover:underline">{v.numero} · {v.client_nom}</Link>
      <span className="block text-xs text-muted-foreground">{v.objet}</span>
      <span className="block text-xs text-muted-foreground">{STATUT_DEVIS[v.statut ?? ""] ?? v.statut} · {dateFr(v.date_emission)}{v.signed_at ? " · Signé" : ""}</span>
      <strong className="block text-lg font-extrabold text-dashboard-green">{euro(Number(v.total_ttc ?? 0))} <span className="text-xs font-normal text-muted-foreground">TTC</span></strong>
    </>;
  } else if (type === "partenaire") {
    const p = x as PartenaireDoublon;
    corps = <>
      <Link to="/partenaires" className="block text-lg font-extrabold hover:underline">{p.nom}</Link>
      <span className="block text-xs text-muted-foreground">Fiche partenaire · {p.chantiers ?? 0} chantier(s){p.email ? ` · ${p.email}` : ""}{p.actif ? "" : " · inactive"}</span>
    </>;
  } else {
    const c = x as ClientDoublon;
    corps = <>
      <strong className="block text-lg font-extrabold">{c.nom}</strong>
      <span className="block text-xs text-muted-foreground">Fiche de facturation{c.raison_sociale ? ` · ${c.raison_sociale}` : ""}{c.siret ? ` · SIRET ${c.siret}` : " · sans SIRET"}</span>
      <span className="block text-xs text-muted-foreground">{[c.adresse, c.cp_ville].filter(Boolean).join(", ") || "Sans adresse"}{c.charge_affaires_email ? ` · ${c.charge_affaires_email}` : ""}</span>
    </>;
  }
  return <div className={`min-w-0 rounded-md border p-2 ${rouge ? "border-destructive/60 bg-destructive/5" : "border-primary/50 bg-primary/5"}`}>
    <span className={`block text-xs font-bold ${rouge ? "text-destructive" : "text-primary"}`}>{titre}</span>
    {corps}
  </div>;
}
