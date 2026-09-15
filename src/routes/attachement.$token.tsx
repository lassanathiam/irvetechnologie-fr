import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, Printer, XCircle } from "lucide-react";
import { AttachementPrint } from "@/components/AttachementPrint";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { getAttachementPublic, repondreAttachementPublic } from "@/lib/attachements-public.functions";

export const Route = createFileRoute("/attachement/$token")({
  head: () => ({ meta: [{ title: "Attachement de travaux — IRVE Technologie" }, { name: "description", content: "Consultez et validez votre attachement de travaux." }, { name: "robots", content: "noindex, nofollow" }, { property: "og:title", content: "Attachement de travaux — IRVE Technologie" }, { property: "og:description", content: "Consultation privée d’un attachement de travaux." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PublicAttachment,
});

function PublicAttachment() {
  const { token } = Route.useParams(); const qc = useQueryClient(); const getFn = useServerFn(getAttachementPublic); const replyFn = useServerFn(repondreAttachementPublic);
  const [name, setName] = useState(""); const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["attachement-public", token], queryFn: () => getFn({ data: { token } }), retry: false });
  const reply = useMutation({ mutationFn: (decision: "accepte" | "refuse") => replyFn({ data: { token, decision, signataire_nom: name } }), onSuccess: () => { setError(null); void qc.invalidateQueries({ queryKey: ["attachement-public", token] }); }, onError: (e) => setError(e instanceof Error ? e.message : "Réponse impossible.") });
  if (query.isLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-primary" /></main>;
  if (!query.data) return <main className="grid min-h-screen place-items-center px-6 text-center"><div><BrandLogo className="mx-auto h-16 w-16" /><h1 className="mt-5 text-2xl font-bold">Lien invalide</h1><p className="text-muted-foreground">Contactez {COMPANY.raisonSociale} au {COMPANY.telephone}.</p></div></main>;
  const { attachement: a, items } = query.data; const answered = ["accepte", "refuse", "facture"].includes(a.statut);
  return <main className="min-h-screen bg-background"><header className="print:hidden border-b border-border bg-card"><div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4"><BrandLogo className="h-11 w-11" /><div><strong>IRVE Technologie</strong><div className="text-xs uppercase text-primary">Attachement · Ticket {a.numero_ticket}</div></div><Button className="ml-auto" variant="outline" onClick={() => window.print()}><Printer /> Imprimer / PDF</Button></div></header><div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
  {answered && <div className="print:hidden rounded-md border border-primary/40 bg-primary/10 p-4"><strong>{a.statut === "refuse" ? "Attachement refusé" : "Attachement accepté"}</strong>{a.signataire_nom ? <p className="text-sm text-muted-foreground">Réponse de {a.signataire_nom}</p> : null}</div>}
  <AttachementPrint doc={a} items={items} />
  {a.validation_requise && !answered ? <section className="print:hidden rounded-md border border-border bg-card p-5 space-y-4"><h2 className="font-bold">Valider cet attachement</h2><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom et prénom du signataire" /><div className="flex flex-wrap gap-3"><Button disabled={name.trim().length < 2 || reply.isPending} onClick={() => reply.mutate("accepte")}><CheckCircle2 /> Accepter l’attachement</Button><Button variant="outline" disabled={name.trim().length < 2 || reply.isPending} onClick={() => reply.mutate("refuse")}><XCircle /> Refuser</Button></div>{error && <p className="text-sm text-destructive">{error}</p>}</section> : null}
  </div></main>;
}