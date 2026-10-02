// ============= Full file contents =============
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { RapportDonneurDoc } from "@/components/RapportDonneurDoc";
import PhotoLightbox from "@/components/PhotoLightbox";
import { getRapportDonneurPublic } from "@/lib/rapport-modeles.functions";
import { normaliserStructure } from "@/lib/rapport-modeles";

export const Route = createFileRoute("/rapport-donneur/$token")({
  head: () => ({
    meta: [
      { title: "Rapport d'intervention signé" },
      { name: "description", content: "Consultation privée d'un rapport d'intervention signé." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Rapport d'intervention signé" },
      { property: "og:description", content: "Consultation privée d'un rapport d'intervention." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicRapport,
});

function PublicRapport() {
  const { token } = Route.useParams();
  const [photoOuverte, setPhotoOuverte] = useState<number | null>(null);
  const getFn = useServerFn(getRapportDonneurPublic);
  const { data, isLoading, error } = useQuery({ queryKey: ["rapport-donneur", token], queryFn: () => getFn({ data: { token } }) });
  if (isLoading) return <div className="grid min-h-screen place-items-center bg-white"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>;
  if (error || !data) return <div className="grid min-h-screen place-items-center bg-white text-slate-700">Rapport introuvable.</div>;
  const r = data.rapport;
  const photos = data.photos ?? [];
  return (
    <div className="min-h-screen bg-slate-100 py-4 print:bg-white print:py-0">
      <div className="mx-auto mb-3 flex max-w-[210mm] flex-wrap gap-2 px-3 print:hidden">
        <button onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 font-semibold text-white"><Printer className="h-4 w-4" /> Imprimer / PDF</button>
        {data.zip_url && <a href={data.zip_url} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-semibold text-slate-800"><Download className="h-4 w-4" /> Photos (ZIP)</a>}
      </div>
      <div className="shadow print:shadow-none">
        <RapportDonneurDoc
          structure={normaliserStructure(data.modele.structure)}
          logo={data.modele.logo_data}
          donneur={data.modele.donneur_ordre}
          valeurs={(r.valeurs as Record<string, string | boolean | null>) ?? {}}
          signatureClient={r.signature_client}
          signatureTechnicien={r.signature_technicien}
          signataireNom={r.signataire_nom}
          technicien={r.technicien}
          signedAt={r.signed_at}
        />
      </div>
      {photos.length > 0 && (
        <div className="mx-auto mt-6 max-w-[210mm] px-3 pb-10 print:hidden">
          <h2 className="mb-1 text-base font-bold text-slate-800">Photos du chantier</h2>
          <p className="mb-3 text-sm text-slate-500">Touchez une photo pour l'agrandir, puis faites-la glisser pour voir toutes les photos.</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhotoOuverte(i)}
                aria-label={`Agrandir la photo : ${p.libelle}`}
                className="overflow-hidden rounded-md border border-slate-200 bg-white"
              >
                <img src={p.url} alt={p.libelle} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      {photoOuverte != null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          index={Math.max(0, Math.min(photoOuverte, photos.length - 1))}
          onIndexChange={setPhotoOuverte}
          onClose={() => setPhotoOuverte(null)}
        />
      )}
    </div>
  );
}
