import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Mail, Printer, Receipt } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { AttachementPrint } from "@/components/AttachementPrint";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { convertirAttachementEnFacture, envoyerAttachement, getAttachement } from "@/lib/attachements.functions";

export const Route = createFileRoute("/_authenticated/attachements/$id")({
  head: () => ({ meta: [{ title: "Attachement de travaux — IRVE Technologie" }, { name: "description", content: "Consulter, envoyer et convertir un attachement de travaux fibre." }, { name: "robots", content: "noindex" }, { property: "og:title", content: "Attachement de travaux — IRVE Technologie" }, { property: "og:description", content: "Consultation d’un attachement de travaux fibre." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AttachementDetail,
});

function AttachementDetail() {
  const { id } = Route.useParams(); const qc = useQueryClient(); const navigate = useNavigate();
  const getFn = useServerFn(getAttachement); const sendFn = useServerFn(envoyerAttachement); const convertFn = useServerFn(convertirAttachementEnFacture);
  const query = useQuery({ queryKey: ["attachement", id], queryFn: () => getFn({ data: { id } }), retry: 1 });
  const [message, setMessage] = useState(""); const [feedback, setFeedback] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["attachement", id] }); void qc.invalidateQueries({ queryKey: ["attachements"] }); };
  const send = useMutation({ mutationFn: () => sendFn({ data: { id, message: message || null } }), onSuccess: (r) => { setError(null); setFeedback(r.sent ? "Attachement envoyé par e-mail." : "E-mail non envoyé."); refresh(); }, onError: (e) => setError(e instanceof Error ? e.message : "Envoi impossible.") });
  const convert = useMutation({ mutationFn: () => convertFn({ data: { id } }), onSuccess: (r) => { refresh(); navigate({ to: "/factures/$id", params: { id: r.id } }); }, onError: (e) => setError(e instanceof Error ? e.message : "Conversion impossible.") });
  if (query.isLoading) return <ProShell><Loader2 className="animate-spin text-primary" /></ProShell>;
  if (!query.data || query.error) return <ProShell><p className="text-destructive">Attachement introuvable.</p></ProShell>;
  const { attachement: a, items } = query.data; const origin = typeof window === "undefined" ? "" : window.location.origin; const link = `${origin}/attachement/${a.public_token}`;
  return <ProShell><div className="print:hidden space-y-5"><header className="flex flex-wrap items-center gap-3"><Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Attachements</Link><strong className="text-primary">{a.numero}</strong><span className="rounded-full border border-border px-2 py-1 text-xs">{a.statut}</span><div className="ml-auto flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}><Printer /> Imprimer / PDF</Button>{a.facture_id ? <Button asChild><Link to="/factures/$id" params={{ id: a.facture_id }}><CheckCircle2 /> Voir la facture</Link></Button> : <Button onClick={() => convert.mutate()} disabled={convert.isPending}><Receipt /> Convertir en facture</Button>}</div></header>
  <section className="grid gap-4 sm:grid-cols-3"><Stat label="Ticket obligatoire" value={a.numero_ticket} /><Stat label="Numéro d’affaire" value={a.numero_affaire || "Non renseigné"} /><Stat label="Bon de commande" value={a.bon_commande || "Non renseigné"} /></section>
  <section className="rounded-md border border-border bg-card p-5 space-y-3"><h2 className="text-sm font-bold uppercase text-primary">Envoyer sous IRVE Technologie</h2><p className="text-sm text-muted-foreground">Objet : IRVE Technologie — Attachement de travaux — Ticket {a.numero_ticket}</p><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message personnalisé (facultatif)" /><div className="flex flex-wrap items-center gap-3"><Button onClick={() => send.mutate()} disabled={!a.client_email || send.isPending}><Mail /> {a.sent_at ? "Renvoyer l’attachement" : "Envoyer l’attachement"}</Button><span className="text-xs text-muted-foreground">{a.validation_requise ? "Validation en ligne demandée" : "Consultation seule"}</span></div><div className="flex gap-2"><input readOnly value={link} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-xs" /><Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(link); setFeedback("Lien copié."); }}><Copy /> Copier</Button></div>{feedback && <p className="text-sm text-primary">{feedback}</p>}{error && <p className="text-sm text-destructive">{error}</p>}</section>
  <section className="grid gap-4 sm:grid-cols-4"><Stat label="Envoyé" value={a.sent_at ? new Date(a.sent_at).toLocaleString("fr-FR") : "—"} /><Stat label="Consulté" value={a.viewed_at ? new Date(a.viewed_at).toLocaleString("fr-FR") : "—"} /><Stat label="Accepté" value={a.accepted_at ? new Date(a.accepted_at).toLocaleString("fr-FR") : "—"} /><Stat label="Consultations" value={String(a.view_count)} /></section></div>
  <div className="mt-8 print:mt-0"><AttachementPrint doc={a} items={items} /></div></ProShell>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-card p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }