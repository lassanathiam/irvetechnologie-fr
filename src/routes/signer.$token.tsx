import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, FileSignature, Loader2, ShieldCheck } from "lucide-react";
import { PdfZones, ouvrirPdf } from "@/components/PdfZones";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDocumentPublic, refuserDocumentPublic, signerDocumentPublic } from "@/lib/documents.functions";
import { COMPANY } from "@/lib/company";

export const Route = createFileRoute("/signer/$token")({
  head: () => ({
    meta: [
      { title: "Signature de document — IRVE Technologie" },
      { name: "description", content: "Consultez et signez votre document en ligne." },
      { property: "og:title", content: "Signature de document — IRVE Technologie" },
      { property: "og:description", content: "Consultez et signez votre document en ligne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SignerPage,
});

function SignerPage() {
  const { token } = Route.useParams();
  const lire = useServerFn(getDocumentPublic);
  const signer = useServerFn(signerDocumentPublic);
  const refuser = useServerFn(refuserDocumentPublic);
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["signer", token], queryFn: () => lire({ data: { token } }), staleTime: Infinity });
  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof ouvrirPdf>> | null>(null);
  const [nom, setNom] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [par, setPar] = useState<string | null>(null);
  const [accord, setAccord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data?.url) ouvrirPdf(data.url).then(setPdf).catch(() => setMsg("Impossible d'afficher le document."));
    if (data?.clientNom) setNom((n) => n || data.clientNom);
  }, [data]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-white text-slate-700"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center bg-white p-6 text-slate-700">{error instanceof Error ? error.message : "Lien invalide."}</div>;

  const aParaphe = data.zones.some((z) => z.type === "paraphe");
  const signe = data.statut === "signe";
  const dejaSigne = data.dejaSigne && !signe;

  const valider = async () => {
    setMsg(null);
    if (nom.trim().length < 2) return setMsg("Indiquez votre nom complet.");
    if (!sig) return setMsg("Dessinez votre signature.");
    if (aParaphe && !par) return setMsg("Dessinez votre paraphe (initiales).");
    if (!accord) return setMsg("Cochez la case d'accord.");
    setBusy(true);
    try {
      await signer({ data: { token, signature: sig, paraphe: par, nom: nom.trim() } });
      setPdf(null);
      await refetch();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const telecharger = async () => {
    if (!data.url) return;
    const blob = await (await fetch(data.url)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.nom}.pdf`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100"><FileSignature className="h-5 w-5 text-slate-700" /></div>
          <div><p className="text-sm font-bold">{COMPANY.raisonSociale}</p><p className="text-xs text-slate-500">Signature sécurisée d’un document</p></div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg bg-white p-2">
          <div className="border-b border-slate-200 p-3"><p className="text-xs text-slate-500">Document à consulter</p><h1 className="font-bold">{data.nom}</h1></div>
          <PdfZones pdf={pdf} zones={signe ? [] : data.zones} remplissage={{ signature: sig ?? undefined, paraphe: par ?? undefined, nom, date: new Date().toLocaleDateString("fr-FR"), mention: "Lu et approuvé" }} />
        </div>
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {signe ? (
            <div className="space-y-3 rounded-lg bg-white p-4">
              <p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Document signé</p>
              {data.signedAt && <p className="text-sm">Le {new Date(data.signedAt).toLocaleString("fr-FR")}</p>}
              <Button className="w-full" onClick={telecharger}><Download className="h-4 w-4" /> Télécharger le PDF signé</Button>
            </div>
          ) : dejaSigne ? (
            <div className="space-y-3 rounded-lg bg-white p-4">
              <p className="flex items-center gap-2 font-bold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Merci, votre signature est enregistrée</p>
              {data.enAttente.length > 0 && <p className="text-sm text-slate-600">Le document sera définitif quand {data.enAttente.join(", ")} aura signé. Vous pourrez alors le télécharger ici.</p>}
            </div>
          ) : data.statut === "refuse" ? (
            <div className="rounded-lg bg-white p-4 text-sm">Vous avez refusé ce document.</div>
          ) : (
            <div className="space-y-4 rounded-lg bg-white p-4">
              <div><p className="text-base font-bold">Vos informations</p><p className="mt-1 text-xs text-slate-500">Lisez le document, complétez les éléments ci-dessous, puis signez.</p></div>
              <p className="text-sm">Les zones en orange seront remplies avec vos informations.</p>
              <label className="block space-y-1 text-xs font-semibold">Nom et prénom<Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre nom et prénom" className="bg-white" /></label>
              <SignaturePad label="Votre signature" value={sig} onChange={setSig} />
              {aParaphe && <SignaturePad label="Votre paraphe (initiales)" value={par} onChange={setPar} />}
              <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs"><input type="checkbox" checked={accord} onChange={(e) => setAccord(e.target.checked)} className="mt-0.5" /> J’ai lu le document et j’accepte de le signer électroniquement.</label>
              {msg && <p className="text-sm text-red-600">{msg}</p>}
              <Button className="w-full" onClick={valider} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Signer le document</Button>
              <Button variant="ghost" className="w-full" onClick={telecharger}><Download className="h-4 w-4" /> Télécharger</Button>
              <Button type="button" variant="ghost" size="sm" className="w-full text-xs text-slate-500 underline" onClick={async () => {
                const motif = prompt("Pourquoi refusez-vous ? (facultatif)") ?? "";
                await refuser({ data: { token, motif } });
                refetch();
              }}>Refuser de signer</Button>
              <p className="flex items-start gap-2 border-t border-slate-200 pt-3 text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 shrink-0" /> La date et les informations de validation sont conservées avec le document signé.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
