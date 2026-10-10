import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import { AttachementPrint } from "@/components/AttachementPrint";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { COMPANY, euro } from "@/lib/company";
import { clientFinalAttachement } from "@/lib/attachement-titre";
import { getAttachementsLotPublic } from "@/lib/attachements-public.functions";

export const Route = createFileRoute("/attachements-lot/$tokens")({
  validateSearch: (s: Record<string, unknown>) => ({ m: typeof s.m === "string" ? s.m.slice(0, 1500) : undefined }),
  head: () => ({ meta: [{ title: "Attachements de travaux regroupés — IRVE Technologie" }, { name: "description", content: "Tous les attachements de travaux de la période dans un seul document." }, { name: "robots", content: "noindex, nofollow" }, { property: "og:title", content: "Attachements regroupés — IRVE Technologie" }, { property: "og:description", content: "Consultation privée des attachements de travaux." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Lot,
});

function Lot() {
  const { tokens } = Route.useParams(); const { m } = Route.useSearch();
  const fn = useServerFn(getAttachementsLotPublic);
  const liste = tokens.split(".").filter(Boolean);
  const q = useQuery({ queryKey: ["attachements-lot", tokens], queryFn: () => fn({ data: { tokens: liste } }), retry: false });
  if (q.isLoading) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-primary" /></main>;
  if (!q.data) return <main className="grid min-h-screen place-items-center px-6 text-center"><div><BrandLogo className="mx-auto h-16 w-16" /><h1 className="mt-5 text-2xl font-bold">Lien invalide</h1><p className="text-muted-foreground">Contactez {COMPANY.raisonSociale} au {COMPANY.telephone}.</p></div></main>;
  const total = q.data.reduce((s, d: any) => s + Number(d.attachement.total_ht), 0);
  return <main className="min-h-screen bg-background">
    <header className="print:hidden border-b border-border bg-card"><div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-4"><BrandLogo className="h-11 w-11" /><div><strong>IRVE Technologie</strong><div className="text-xs uppercase text-primary">{q.data.length} attachement(s) · {euro(total)} HT</div></div><Button className="ml-auto" onClick={() => window.print()}><Printer /> Télécharger tout en un PDF</Button></div></header>
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="print:hidden rounded-md border border-border bg-card p-5 space-y-3">
        <p className="text-sm whitespace-pre-line">{m || "Bonjour, merci de trouver ci-dessous l’ensemble des attachements de travaux de la période."}</p>
        <ul className="text-sm space-y-1">{q.data.map((d: any) => <li key={d.attachement.id}>• <a className="text-primary underline" href={`#att-${d.attachement.id}`}>{d.attachement.numero}{clientFinalAttachement(d.attachement) ? ` — ${clientFinalAttachement(d.attachement)}` : ""}</a> · {euro(Number(d.attachement.total_ht))} HT · <a className="underline" href={`/attachement/${d.attachement.public_token}`}>valider individuellement</a></li>)}</ul>
        <p className="text-sm font-bold">Total : {euro(total)} HT</p>
      </section>
      {q.data.map((d: any, i: number) => <div key={d.attachement.id} id={`att-${d.attachement.id}`} style={i > 0 ? { breakBefore: "page" } : undefined}><AttachementPrint doc={d.attachement} items={d.items} /></div>)}
    </div>
  </main>;
}
