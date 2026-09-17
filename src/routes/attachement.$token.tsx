import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Plus, Printer, Send, SlidersHorizontal, Trash2, XCircle } from "lucide-react";
import { AttachementPrint } from "@/components/AttachementPrint";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COMPANY, euro } from "@/lib/company";
import { getAttachementPublic, proposerValorisationPublic, repondreAttachementPublic } from "@/lib/attachements-public.functions";

export const Route = createFileRoute("/attachement/$token")({
  head: () => ({ meta: [{ title: "Attachement de travaux — IRVE Technologie" }, { name: "description", content: "Consultez, valorisez et validez votre attachement de travaux." }, { name: "robots", content: "noindex, nofollow" }, { property: "og:title", content: "Attachement de travaux — IRVE Technologie" }, { property: "og:description", content: "Consultation privée d’un attachement de travaux." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PublicAttachment,
});

type EditLine = { key: string; libelle: string; description: string; quantite: string; prix: string };
const newLine = (): EditLine => ({ key: crypto.randomUUID(), libelle: "", description: "", quantite: "1", prix: "" });

function PublicAttachment() {
  const { token } = Route.useParams(); const qc = useQueryClient();
  const getFn = useServerFn(getAttachementPublic); const replyFn = useServerFn(repondreAttachementPublic); const proposeFn = useServerFn(proposerValorisationPublic);
  const [name, setName] = useState(""); const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(false); const [comment, setComment] = useState(""); const [lines, setLines] = useState<EditLine[]>([]);
  const query = useQuery({ queryKey: ["attachement-public", token], queryFn: () => getFn({ data: { token } }), retry: false });
  const reply = useMutation({ mutationFn: (decision: "accepte" | "refuse") => replyFn({ data: { token, decision, signataire_nom: name } }), onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ["attachement-public", token] }); }, onError: (e) => setError(e instanceof Error ? e.message : "Réponse impossible.") });
  const propose = useMutation({
    mutationFn: () => proposeFn({ data: { token, signataire_nom: name, commentaire: comment, lignes: lines.map((l) => ({ libelle: l.libelle, description: l.description || null, quantite: Number(l.quantite), prix_unitaire: Number(l.prix) })) } }),
    onSuccess: () => { setError(null); setMode(false); void qc.invalidateQueries({ queryKey: ["attachement-public", token] }); },
    onError: (e) => setError(e instanceof Error ? e.message : "Proposition impossible."),
  });

  if (query.isLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-primary" /></main>;
  if (!query.data) return <main className="grid min-h-screen place-items-center px-6 text-center"><div><BrandLogo className="mx-auto h-16 w-16" /><h1 className="mt-5 text-2xl font-bold">Lien invalide</h1><p className="text-muted-foreground">Contactez {COMPANY.raisonSociale} au {COMPANY.telephone}.</p></div></main>;
  const { attachement: a, items, proposition } = query.data as any;
  const answered = ["accepte", "refuse", "facture"].includes(a.statut);
  const pending = proposition && proposition.statut === "en_attente";
  const canPropose = Boolean(a.proposition_autorisee) && !answered && !pending;
  const total = lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const openEditor = () => { setLines((items ?? []).map((item: any) => ({ key: crypto.randomUUID(), libelle: item.libelle ?? "", description: item.description ?? "", quantite: String(Number(item.quantite)), prix: String(Number(item.prix_unitaire)) })) as EditLine[]); setMode(true); };
  const patch = (key: string, field: keyof EditLine, value: string) => setLines((ls) => ls.map((l) => l.key === key ? { ...l, [field]: value } : l));
  const invalid = name.trim().length < 2 || comment.trim().length < 3 || !lines.length || lines.some((l) => !l.libelle.trim() || !(Number(l.quantite) > 0));

  return <main className="min-h-screen bg-background"><header className="print:hidden border-b border-border bg-card"><div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4"><BrandLogo className="h-11 w-11" /><div><strong>IRVE Technologie</strong><div className="text-xs uppercase text-primary">Attachement · Ticket {a.numero_ticket}</div></div><Button className="ml-auto" variant="outline" onClick={() => window.print()}><Printer /> Imprimer / PDF</Button></div></header><div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
  {answered && <div className="print:hidden rounded-md border border-primary/40 bg-primary/10 p-4"><strong>{a.statut === "refuse" ? "Attachement refusé" : "Attachement accepté"}</strong>{a.signataire_nom ? <p className="text-sm text-muted-foreground">Réponse de {a.signataire_nom}</p> : null}</div>}
  {pending && <div className="print:hidden rounded-md border border-primary/40 bg-primary/10 p-4"><strong>Valorisation proposée — en attente de validation par IRVE Technologie</strong><p className="text-sm text-muted-foreground">{euro(Number(proposition.total_ht))} HT proposés par {proposition.signataire_nom}.</p></div>}
  {proposition && proposition.statut === "refusee" && !answered ? <div className="print:hidden rounded-md border border-destructive/40 bg-destructive/10 p-4"><strong>Votre proposition de valorisation n’a pas été retenue</strong><p className="text-sm text-muted-foreground">L’attachement ci-dessous reste la version applicable. Vous pouvez en proposer une nouvelle.</p></div> : null}
  <AttachementPrint doc={a} items={items} />

  {mode ? <section className="print:hidden rounded-md border border-primary/40 bg-card p-5 space-y-4">
    <h2 className="font-bold">Proposer une valorisation</h2>
    <p className="text-sm text-muted-foreground">Ajustez les quantités et les prix, ajoutez ou retirez des lignes. Votre proposition est transmise à IRVE Technologie pour validation.</p>
    <div className="space-y-3">{lines.map((line) => <div key={line.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1.3fr_1.4fr_.5fr_.7fr_auto]">
      <Input aria-label="Travaux" placeholder="Travaux" value={line.libelle} onChange={(e) => patch(line.key, "libelle", e.target.value)} />
      <Input aria-label="Description" placeholder="Description" value={line.description} onChange={(e) => patch(line.key, "description", e.target.value)} />
      <Input aria-label="Quantité" type="number" min="0.01" step="0.01" value={line.quantite} onChange={(e) => patch(line.key, "quantite", e.target.value)} />
      <Input aria-label="Prix HT" type="number" min="0" step="0.01" value={line.prix} onChange={(e) => patch(line.key, "prix", e.target.value)} />
      <Button variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [newLine()])}><Trash2 /></Button>
    </div>)}<Button variant="outline" onClick={() => setLines([...lines, newLine()])}><Plus /> Ajouter une ligne</Button></div>
    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom et prénom du chargé d’affaires" />
    <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Expliquez vos ajustements (obligatoire)" />
    <div className="flex flex-wrap items-center justify-between gap-3"><strong>Total proposé : {euro(total)} HT</strong><div className="flex gap-2"><Button variant="outline" onClick={() => setMode(false)}>Annuler</Button><Button disabled={invalid || propose.isPending} onClick={() => propose.mutate()}>{propose.isPending ? <Loader2 className="animate-spin" /> : <Send />} Envoyer ma proposition</Button></div></div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </section> : <>
    {a.validation_requise && !answered && !pending ? <section className="print:hidden rounded-md border border-border bg-card p-5 space-y-4"><h2 className="font-bold">Valider cet attachement</h2><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom et prénom du signataire" /><div className="flex flex-wrap gap-3"><Button disabled={name.trim().length < 2 || reply.isPending} onClick={() => reply.mutate("accepte")}><CheckCircle2 /> Accepter l’attachement</Button><Button variant="outline" disabled={name.trim().length < 2 || reply.isPending} onClick={() => reply.mutate("refuse")}><XCircle /> Refuser</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}</section> : null}
    {canPropose ? <section className="print:hidden rounded-md border border-border bg-card p-5 space-y-3"><h2 className="font-bold">La valorisation ne correspond pas ?</h2><p className="text-sm text-muted-foreground">Proposez vos propres quantités et prix : nous les validons de notre côté avant facturation.</p><Button variant="outline" onClick={openEditor}><SlidersHorizontal /> Proposer une valorisation</Button></section> : null}
  </>}
  </div></main>;
}
