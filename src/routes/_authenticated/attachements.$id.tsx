import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Copy, Loader2, Mail, Pencil, Plus, Printer, Receipt, RotateCcw, Save, Trash2, X } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { AttachementPrint } from "@/components/AttachementPrint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changerStatutAttachement, convertirAttachementEnFacture, envoyerAttachement, getAttachement, supprimerAttachement, traiterPropositionAttachement, updateAttachement } from "@/lib/attachements.functions";
import { euro } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/attachements/$id")({
  head: () => ({ meta: [{ title: "Attachement de travaux — IRVE Technologie" }, { name: "description", content: "Consulter, modifier, envoyer et convertir un attachement de travaux fibre." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Attachement de travaux — IRVE Technologie" }, { property: "og:description", content: "Consultation d’un attachement de travaux fibre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AttachementDetail,
});

type Line = { key: string; libelle: string; description: string; quantite: string; prix: string };
const newLine = (): Line => ({ key: crypto.randomUUID(), libelle: "", description: "", quantite: "1", prix: "" });
const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00`); if (Number.isNaN(d.getTime())) return date; d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const diffDays = (from: string, to: string) => { const a = new Date(`${from}T00:00:00`).getTime(); const b = new Date(`${to}T00:00:00`).getTime(); const n = Math.round((b - a) / 864e5); return Number.isFinite(n) && n > 0 ? n : 60; };

function AttachementDetail() {
  const { id } = Route.useParams(); const qc = useQueryClient(); const navigate = useNavigate();
  const getFn = useServerFn(getAttachement); const sendFn = useServerFn(envoyerAttachement); const convertFn = useServerFn(convertirAttachementEnFacture);
  const updateFn = useServerFn(updateAttachement); const deleteFn = useServerFn(supprimerAttachement); const traiterFn = useServerFn(traiterPropositionAttachement);
  const query = useQuery({ queryKey: ["attachement", id], queryFn: () => getFn({ data: { id } }), retry: 1 });
  const [message, setMessage] = useState(""); const [feedback, setFeedback] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false); const [delai, setDelai] = useState(60);
  const [form, setForm] = useState<any>(null); const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    const data = query.data; if (!data) return;
    const a: any = data.attachement;
    setForm({
      client_nom: a.client_nom ?? "", client_email: a.client_email ?? "", client_telephone: a.client_telephone ?? "",
      client_adresse: a.client_adresse ?? "", client_cp_ville: a.client_cp_ville ?? "", numero_ticket: a.numero_ticket ?? "",
      numero_affaire: a.numero_affaire ?? "", bon_commande: a.bon_commande ?? "", objet: a.objet ?? "",
      date_emission: a.date_emission, date_echeance: a.date_echeance, autoliquidation: Boolean(a.autoliquidation),
      validation_requise: Boolean(a.validation_requise), proposition_autorisee: a.proposition_autorisee !== false, notes: a.notes ?? "",
    });
    setDelai(diffDays(a.date_emission, a.date_echeance));
    setLines((data.items ?? []).map((item: any) => ({ key: crypto.randomUUID(), libelle: item.libelle ?? "", description: item.description ?? "", quantite: String(Number(item.quantite)), prix: String(Number(item.prix_unitaire)) })));
  }, [query.data]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["attachement", id] }); void qc.invalidateQueries({ queryKey: ["attachements"] }); };
  const send = useMutation({ mutationFn: () => sendFn({ data: { id, message: message || null } }), onSuccess: (r) => { setError(null); setFeedback(r.sent ? "Attachement envoyé par e-mail." : "E-mail non envoyé."); refresh(); }, onError: (e) => setError(e instanceof Error ? e.message : "Envoi impossible.") });
  const convert = useMutation({ mutationFn: () => convertFn({ data: { id } }), onSuccess: (r) => { refresh(); navigate({ to: "/factures/$id", params: { id: r.id } }); }, onError: (e) => setError(e instanceof Error ? e.message : "Conversion impossible.") });
  const save = useMutation({
    mutationFn: () => updateFn({ data: { id, ...form, client_email: form.client_email || null, client_telephone: form.client_telephone || null, client_adresse: form.client_adresse || null, client_cp_ville: form.client_cp_ville || null, numero_affaire: form.numero_affaire || null, bon_commande: form.bon_commande || null, objet: form.objet || null, notes: form.notes || null, rendezvous_id: null, items: lines.map((l) => ({ libelle: l.libelle, description: l.description || null, quantite: Number(l.quantite), prix_unitaire: Number(l.prix) })) } }),
    onSuccess: () => { setError(null); setFeedback("Modifications enregistrées."); setEdit(false); refresh(); },
    onError: (e) => setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });
  const remove = useMutation({ mutationFn: () => deleteFn({ data: { id } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["attachements"] }); navigate({ to: "/attachements" }); }, onError: (e) => setError(e instanceof Error ? e.message : "Suppression impossible.") });
  const traiter = useMutation({ mutationFn: (v: { proposition_id: string; decision: "accepter" | "refuser" }) => traiterFn({ data: v }), onSuccess: (r) => { setError(null); setFeedback(r.decision === "accepter" ? "Valorisation du client acceptée : l’attachement est mis à jour." : "Proposition refusée : votre valorisation reste applicable."); refresh(); }, onError: (e) => setError(e instanceof Error ? e.message : "Traitement impossible.") });
  const statutFn = useServerFn(changerStatutAttachement);
  const statutM = useMutation({ mutationFn: (action: "annuler" | "reactiver") => statutFn({ data: { id, action } }), onSuccess: (r) => { setError(null); setFeedback(r.statut === "annule" ? "Attachement annulé : le client voit l’annulation sur son lien." : "Attachement réactivé."); refresh(); }, onError: (e) => setError(e instanceof Error ? e.message : "Changement de statut impossible.") });

  if (query.isLoading) return <ProShell><Loader2 className="animate-spin text-primary" /></ProShell>;
  if (!query.data || query.error) return <ProShell><p className="text-destructive">Attachement introuvable.</p></ProShell>;
  const { attachement: a, items, propositions } = query.data as any;
  const enAttente = (propositions ?? []).find((p: any) => p.statut === "en_attente");
  const origin = typeof window === "undefined" ? "" : window.location.origin; const link = `${origin}/attachement/${a.public_token}`;
  const total = lines.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const setDate = (value: string) => setForm((f: any) => ({ ...f, date_emission: value, date_echeance: addDays(value, delai) }));
  const setDelaiJours = (value: number) => { setDelai(value); setForm((f: any) => ({ ...f, date_echeance: addDays(f.date_emission, value) })); };
  const previewDoc = edit && form ? { ...a, ...form, total_ht: total, total_tva: form.autoliquidation ? 0 : total * 0.2, total_ttc: form.autoliquidation ? total : total * 1.2 } : a;
  const previewItems = edit ? lines.map((l) => ({ libelle: l.libelle, description: l.description, quantite: Number(l.quantite) || 0, prix_unitaire: Number(l.prix) || 0 })) : items;

  return <ProShell><div className="print:hidden space-y-5">
    <header className="flex flex-wrap items-center gap-3"><Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Attachements</Link><strong className="text-primary">{a.numero}</strong><span className="rounded-full border border-border px-2 py-1 text-xs">{a.statut}</span>
      <div className="ml-auto flex flex-wrap gap-2">
        {!a.facture_id && <Button variant={edit ? "secondary" : "outline"} onClick={() => setEdit((v) => !v)}>{edit ? <><X /> Fermer la modification</> : <><Pencil /> Modifier</>}</Button>}
        <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimer / PDF</Button>
        {a.facture_id ? <Button asChild><Link to="/factures/$id" params={{ id: a.facture_id }}><CheckCircle2 /> Voir la facture</Link></Button> : <Button onClick={() => convert.mutate()} disabled={convert.isPending}><Receipt /> Convertir en facture</Button>}
        {!a.facture_id && (a.statut === "annule"
          ? <Button variant="outline" disabled={statutM.isPending} onClick={() => statutM.mutate("reactiver")}><RotateCcw /> Réactiver</Button>
          : <Button variant="outline" disabled={statutM.isPending} onClick={() => { if (window.confirm(`Annuler l’attachement ${a.numero} ? Le client verra l’annulation sur son lien.`)) statutM.mutate("annuler"); }}><Ban /> Annuler</Button>)}
        {!a.facture_id && <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (window.confirm(`Supprimer définitivement l’attachement ${a.numero} ?`)) remove.mutate(); }}><Trash2 /> Supprimer</Button>}
      </div>
    </header>

    {enAttente ? <section className="rounded-md border-2 border-primary bg-primary/5 p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase text-primary">Valorisation proposée par le client</h2>
      <p className="text-sm">Proposée par <strong>{enAttente.signataire_nom}</strong> le {new Date(enAttente.created_at).toLocaleString("fr-FR")}</p>
      {enAttente.commentaire ? <p className="whitespace-pre-line rounded-md border border-border bg-card p-3 text-sm">{enAttente.commentaire}</p> : null}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-[10px] uppercase text-muted-foreground"><th className="p-2">Travaux</th><th className="p-2 text-right">Qté</th><th className="p-2 text-right">Prix HT proposé</th><th className="p-2 text-right">Total HT</th></tr></thead><tbody>
        {(Array.isArray(enAttente.lignes) ? enAttente.lignes : []).map((l: any, index: number) => <tr key={index} className="border-t border-border"><td className="p-2">{l.libelle}{l.description ? <div className="text-xs text-muted-foreground">{l.description}</div> : null}</td><td className="p-2 text-right">{Number(l.quantite)}</td><td className="p-2 text-right">{euro(Number(l.prix_unitaire))}</td><td className="p-2 text-right font-semibold">{euro(Number(l.quantite) * Number(l.prix_unitaire))}</td></tr>)}
      </tbody></table></div>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Votre total HT" value={euro(Number(a.total_ht))} /><Stat label="Total proposé HT" value={euro(Number(enAttente.total_ht))} /><Stat label="Écart" value={`${Number(enAttente.total_ht) - Number(a.total_ht) >= 0 ? "+" : ""}${euro(Number(enAttente.total_ht) - Number(a.total_ht))}`} /></div>
      <div className="flex flex-wrap gap-2"><Button disabled={traiter.isPending} onClick={() => traiter.mutate({ proposition_id: enAttente.id, decision: "accepter" })}><CheckCircle2 /> Accepter sa valorisation</Button><Button variant="outline" disabled={traiter.isPending} onClick={() => traiter.mutate({ proposition_id: enAttente.id, decision: "refuser" })}><X /> Refuser</Button></div>
    </section> : null}


    {edit && form ? <section className="rounded-md border border-primary/40 bg-card p-5 space-y-5">
      <h2 className="text-sm font-bold uppercase text-primary">Modification en direct</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Destinataire *" value={form.client_nom} onChange={(v) => setForm({ ...form, client_nom: v })} />
        <Field label="E-mail du chargé d’affaires" type="email" value={form.client_email} onChange={(v) => setForm({ ...form, client_email: v })} />
        <Field label="Téléphone" value={form.client_telephone} onChange={(v) => setForm({ ...form, client_telephone: v })} />
        <Field label="Adresse" value={form.client_adresse} onChange={(v) => setForm({ ...form, client_adresse: v })} />
        <Field label="Code postal / ville" value={form.client_cp_ville} onChange={(v) => setForm({ ...form, client_cp_ville: v })} />
        <Field label="Numéro de ticket *" value={form.numero_ticket} onChange={(v) => setForm({ ...form, numero_ticket: v })} />
        <Field label="Numéro d’affaire" value={form.numero_affaire} onChange={(v) => setForm({ ...form, numero_affaire: v })} />
        <Field label="Bon de commande" value={form.bon_commande} onChange={(v) => setForm({ ...form, bon_commande: v })} />
        <Field label="Objet" value={form.objet} onChange={(v) => setForm({ ...form, objet: v })} />
        <Field label="Date de l’attachement" type="date" value={form.date_emission} onChange={setDate} />
        <label className="text-xs text-muted-foreground">Délai de paiement (jours)<Input className="mt-1.5" type="number" min="0" max="365" value={String(delai)} onChange={(e) => setDelaiJours(Number(e.target.value) || 0)} /></label>
        <Field label="Échéance (calculée)" type="date" value={form.date_echeance} onChange={(v) => { setForm({ ...form, date_echeance: v }); setDelai(diffDays(form.date_emission, v)); }} />
      </div>
      <div className="flex flex-wrap gap-5">
        <Check label="Autoliquidation de TVA" checked={form.autoliquidation} onChange={(v) => setForm({ ...form, autoliquidation: v })} />
        <Check label="Demander une validation en ligne" checked={form.validation_requise} onChange={(v) => setForm({ ...form, validation_requise: v })} />
        <Check label="Autoriser le client à proposer une valorisation" checked={form.proposition_autorisee !== false} onChange={(v) => setForm({ ...form, proposition_autorisee: v })} />
      </div>
      <div className="space-y-3">{lines.map((line) => <div key={line.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1.4fr_1.5fr_.5fr_.7fr_auto]">
        <Input aria-label="Travaux" placeholder="Travaux réalisés" value={line.libelle} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, libelle: e.target.value } : l))} />
        <Input aria-label="Description" placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, description: e.target.value } : l))} />
        <Input aria-label="Quantité" type="number" min="0.01" step="0.01" value={line.quantite} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, quantite: e.target.value } : l))} />
        <Input aria-label="Prix HT" type="number" min="0" step="0.01" value={line.prix} onChange={(e) => setLines(lines.map((l) => l.key === line.key ? { ...l, prix: e.target.value } : l))} />
        <Button variant="ghost" size="icon" aria-label="Supprimer la ligne" onClick={() => setLines(lines.length > 1 ? lines.filter((l) => l.key !== line.key) : [newLine()])}><Trash2 /></Button>
      </div>)}<Button variant="outline" onClick={() => setLines([...lines, newLine()])}><Plus /> Ajouter une ligne</Button></div>
      <Textarea placeholder="Notes (facultatif)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <div className="flex flex-wrap items-center justify-between gap-3"><strong>Total HT : {euro(total)}</strong><Button disabled={save.isPending || !form.client_nom.trim() || !form.numero_ticket.trim() || lines.some((l) => !l.libelle.trim() || Number(l.quantite) <= 0)} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer</Button></div>
    </section> : <section className="grid gap-4 sm:grid-cols-3"><Stat label="Ticket obligatoire" value={a.numero_ticket} /><Stat label="Numéro d’affaire" value={a.numero_affaire || "Non renseigné"} /><Stat label="Bon de commande" value={a.bon_commande || "Non renseigné"} /></section>}

    <section className="rounded-md border border-border bg-card p-5 space-y-3"><h2 className="text-sm font-bold uppercase text-primary">Envoyer sous IRVE Technologie</h2><p className="text-sm text-muted-foreground">Objet : IRVE Technologie — Attachement de travaux — Ticket {a.numero_ticket}</p><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message personnalisé (facultatif)" /><div className="flex flex-wrap items-center gap-3"><Button onClick={() => send.mutate()} disabled={!a.client_email || send.isPending}><Mail /> {a.sent_at ? "Renvoyer l’attachement" : "Envoyer l’attachement"}</Button><span className="text-xs text-muted-foreground">{a.validation_requise ? "Validation en ligne demandée" : "Consultation seule"}</span></div><div className="flex gap-2"><input readOnly value={link} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs" /><Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(link); setFeedback("Lien copié."); }}><Copy /> Copier</Button></div>{feedback && <p className="text-sm text-primary">{feedback}</p>}{error && <p className="text-sm text-destructive">{error}</p>}</section>
    <section className="grid gap-4 sm:grid-cols-4"><Stat label="Envoyé" value={a.sent_at ? new Date(a.sent_at).toLocaleString("fr-FR") : "—"} /><Stat label="Consulté" value={a.viewed_at ? new Date(a.viewed_at).toLocaleString("fr-FR") : "—"} /><Stat label="Accepté" value={a.accepted_at ? new Date(a.accepted_at).toLocaleString("fr-FR") : "—"} /><Stat label="Consultations" value={String(a.view_count)} /></section></div>
  <div className="mt-8 print:mt-0"><AttachementPrint doc={previewDoc} items={previewItems} /></div></ProShell>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-card p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) { return <label className="text-xs text-muted-foreground">{label}<Input className="mt-1.5" type={type} value={value} onChange={(e) => onChange(e.target.value)} /></label>; }
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) { return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />{label}</label>; }
