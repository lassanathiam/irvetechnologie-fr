import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { RapportDonneurDoc } from "@/components/RapportDonneurDoc";
import { RapportOriginalDoc } from "@/components/RapportOriginalDoc";
import { SignaturePad } from "@/components/SignaturePad";
import { getPvASigner, signerPvClient } from "@/lib/rapport-modeles.functions";
import { normaliserStructure } from "@/lib/rapport-modeles";

export const Route = createFileRoute("/signer-pv/$token")({
  head: () => ({
    meta: [
      { title: "Signature du PV de réception" },
      { name: "description", content: "Signature en ligne du procès-verbal de réception de votre borne de recharge." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Signature du PV de réception" },
      { property: "og:description", content: "Signez en ligne le PV de réception de votre borne." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignerPv,
});

type Val = string | boolean | null;

function SignerPv() {
  const { token } = Route.useParams();
  const getFn = useServerFn(getPvASigner);
  const signFn = useServerFn(signerPvClient);
  const { data, isLoading, error } = useQuery({ queryKey: ["pv-signer", token], queryFn: () => getFn({ data: { token } }) });
  const [nom, setNom] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const sign = useMutation({ mutationFn: () => signFn({ data: { token, nom: nom ?? data?.rapport.signataire_nom ?? "", signature: sig ?? "" } }) });

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>;
  if (error || !data) return <div className="grid min-h-screen place-items-center bg-white p-6 text-center text-slate-700">Lien invalide ou PV introuvable.</div>;
  const r = data.rapport;
  const structure = normaliserStructure(data.modele.structure);
  const valeurs = (r.valeurs ?? {}) as Record<string, Val>;
  const fini = data.dejaSigne || sign.isSuccess;
  const sigAffichee = sign.isSuccess ? sig : r.signature_client;
  const nomVal = nom ?? r.signataire_nom ?? "";

  return (
    <div className="min-h-screen bg-slate-100 py-4 text-slate-900">
      <div className="mx-auto max-w-[210mm] space-y-4 px-3">
        <h1 className="text-lg font-bold">Signature du PV de réception</h1>
        <div className="overflow-x-auto rounded-lg bg-white">
          {structure.original ? (
            <RapportOriginalDoc structure={structure} valeurs={valeurs} signatureClient={sigAffichee} signatureTechnicien={r.signature_technicien} />
          ) : (
            <RapportDonneurDoc structure={structure} logo={data.modele.logo_data} donneur={data.modele.donneur_ordre} valeurs={valeurs} signatureClient={sigAffichee} signatureTechnicien={r.signature_technicien} signataireNom={nomVal} technicien={r.technicien ?? ""} />
          )}
        </div>
        {fini ? (
          <p className="flex items-center gap-2 rounded-lg bg-white p-4 font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Merci, le PV est signé.</p>
        ) : (
          <div className="space-y-3 rounded-lg bg-white p-4">
            <label className="block text-sm font-medium">Votre nom
              <input className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3" value={nomVal} onChange={(e) => setNom(e.target.value)} />
            </label>
            <SignaturePad label="Votre signature" value={sig} onChange={setSig} />
            {sign.error && <p className="text-sm text-red-700">{(sign.error as Error).message}</p>}
            <button
              disabled={!sig || nomVal.trim().length < 2 || sign.isPending}
              onClick={() => sign.mutate()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 font-semibold text-white disabled:opacity-50"
            >
              {sign.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Je signe le PV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
