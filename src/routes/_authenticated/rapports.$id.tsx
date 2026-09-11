import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2, Printer, Zap } from "lucide-react";
import { downloadElementAsPdf } from "@/lib/pdf-download";
import { COMPANY, LOGO_URL, dateFr } from "@/lib/company";
import { getRapport, getRapportPhotoUrls } from "@/lib/rapports.functions";
import { CompanySeal } from "@/components/CompanySeal";
import {
  type CheckState,
  PHOTOS_REQUISES,
  RAPPORT_TYPES,
  type RapportType,
  checklistFor,
  mesuresFor,
} from "@/lib/rapport-checklist";

export const Route = createFileRoute("/_authenticated/rapports/$id")({
  head: () => ({
    meta: [
      { title: "Rapport d'intervention IRVE — Impression PDF" },
      {
        name: "description",
        content: "Rapport de contrôle et de conformité d'installation de borne de recharge, prêt à imprimer et à signer.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RapportDetail,
});

const BOX: Record<CheckState, string> = { ok: "✕", nc: "✕", na: "✕" };

function RapportDetail() {
  const { id } = Route.useParams();
  const fetchRapport = useServerFn(getRapport);
  const { data: r, isLoading, error } = useQuery({
    queryKey: ["rapport", id],
    queryFn: () => fetchRapport({ data: { id } }),
    retry: 1,
  });
  const sheetRef = useRef<HTMLElement>(null);
  const [pdfEnCours, setPdfEnCours] = useState(false);

  async function telechargerPdf(numero: string) {
    const el = sheetRef.current;
    if (!el || pdfEnCours) return;
    setPdfEnCours(true);
    try {
      await downloadElementAsPdf(el, `Rapport-${numero}`);
      toast.success("Rapport téléchargé.");
    } catch {
      toast.error("Téléchargement impossible. Réessayez dans un instant.");
    } finally {
      setPdfEnCours(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-mono text-sm text-muted-foreground">Chargement du rapport…</p>
          <Link to="/rapports" className="text-mono text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline">
            Retour aux rapports
          </Link>
        </div>
      </div>
    );
  }

  if (error || !r) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center">
        <div>
          <p className="text-muted-foreground">Ce rapport est introuvable.</p>
          <Link to="/rapports" className="mt-4 inline-block text-mono text-primary hover:underline">
            Retour aux rapports
          </Link>
        </div>
      </div>
    );
  }

  const checklist = (r.checklist ?? {}) as Record<string, CheckState>;
  const mesures = (r.mesures ?? {}) as Record<string, string>;
  const typologie = (r.typologie ?? {}) as Record<string, string>;
  const type = (RAPPORT_TYPES[r.type as RapportType] ? r.type : "conformite") as RapportType;
  const meta = RAPPORT_TYPES[type];
  const photos = (Array.isArray(r.photos) ? r.photos : []) as { kind: string; path: string }[];
  const nc = Object.entries(checklist).filter(([, v]) => v === "nc").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/rapports" className="text-mono text-muted-foreground hover:text-primary inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Rapports
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void telechargerPdf(r.numero)}
              disabled={pdfEnCours}
              className="hero-grad text-primary-foreground rounded-sm px-4 py-2.5 text-mono inline-flex items-center gap-2 disabled:opacity-60"
            >
              {pdfEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {pdfEnCours ? "Préparation…" : "Télécharger le PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="border border-border rounded-sm px-4 py-2.5 text-mono inline-flex items-center gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimer
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10 print:p-0">
        <article ref={sheetRef} className="print-sheet relative bg-card border border-border rounded-sm print:border-0 print:rounded-none pb-28">
          <header className="p-8 border-b border-border flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              {LOGO_URL ? (
                <img src={LOGO_URL} alt={COMPANY.raisonSociale} className="h-14 w-auto" />
              ) : (
                <span className="hero-grad text-primary-foreground p-2.5 rounded-sm print:hidden">
                  <Zap className="h-6 w-6" strokeWidth={2.5} />
                </span>
              )}
              <div>
                <div className="text-lg font-semibold tracking-tight leading-none">{COMPANY.raisonSociale}</div>
                <div className="mt-1.5 inline-block border border-primary/60 rounded-sm px-2 py-1 text-mono text-[10px] font-bold text-primary">
                  {COMPANY.qualifications}
                </div>
                <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {COMPANY.adresse} · {COMPANY.cpVille}
                  <br />
                  {COMPANY.telephone} · {COMPANY.telephone2} · {COMPANY.email}
                  <br />
                  SIRET {COMPANY.siret} · TVA {COMPANY.tva} · {COMPANY.site}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-mono text-primary">{meta.label}</div>
              <div className="text-2xl font-extrabold tracking-tight">{r.numero}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Intervention du {dateFr(r.date_intervention)}
              </div>
            </div>
          </header>

          <section className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border border-b border-border text-sm">
            <div className="p-6">
              <div className="text-mono text-muted-foreground">Client</div>
              <div className="mt-2 leading-relaxed">
                <div className="font-medium">{r.client_nom}</div>
                <div className="text-muted-foreground">
                  {r.client_telephone && <>{r.client_telephone}<br /></>}
                  {r.client_email}
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="text-mono text-muted-foreground">Chantier</div>
              <div className="mt-2 leading-relaxed text-muted-foreground">
                {r.chantier_adresse && <>{r.chantier_adresse}<br /></>}
                {r.chantier_cp_ville}
              </div>
            </div>
          </section>

          <section className="p-6 border-b border-border">
            <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Matériel installé</div>
            <div className="grid sm:grid-cols-4 gap-4 text-sm">
              <Info label="Marque" value={r.borne_marque} />
              <Info label="Modèle" value={r.borne_modele} />
              <Info label="Puissance" value={r.borne_puissance ? `${r.borne_puissance} kW` : null} />
              <Info label="N° de série" value={r.borne_serie} />
            </div>
            {Object.keys(typologie).length > 0 && (
              <div className="mt-4 grid sm:grid-cols-4 gap-4 text-sm">
                <Info label="Puissance typologie" value={typologie.puissance} />
                <Info label="Raccordement" value={typologie.phase} />
                <Info label="Pose" value={typologie.pose} />
                <Info label="Cheminement" value={typologie.cheminement} />
              </div>
            )}
          </section>

          <section className="p-6 border-b border-border">
            <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Mesures relevées</div>
            <div className="grid sm:grid-cols-4 gap-4 text-sm">
              {mesuresFor(type).map((m) => (
                <Info
                  key={m.key}
                  label={m.label}
                  value={mesures[m.key] ? `${mesures[m.key]}${m.unit ? ` ${m.unit}` : ""}` : null}
                />
              ))}
            </div>
          </section>

          <section className="p-6 space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-mono text-primary">Points de contrôle</div>
              <div className="text-mono text-xs text-muted-foreground">
                C = conforme · NC = non conforme · SO = sans objet
              </div>
            </div>

            {checklistFor(type).map((section) => (
              <div key={section.key} className="break-inside-avoid">
                <div className="font-medium text-sm border-b border-border pb-1.5 mb-1">{section.title}</div>
                <ul>
                  {section.items.map((item) => {
                    const state = checklist[`${section.key}.${item.key}`];
                    return (
                      <li
                        key={item.key}
                        className="flex items-center gap-4 py-1.5 border-b border-border/60 text-sm"
                      >
                        <span className="flex-1">{item.label}</span>
                        <span className="flex items-center gap-3 text-mono text-[11px] text-muted-foreground shrink-0">
                          <Box on={state === "ok"} label="C" />
                          <Box on={state === "nc"} label="NC" />
                          <Box on={state === "na"} label="SO" />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          <section className="px-6 pb-6 grid sm:grid-cols-2 gap-4">
            <div className="border border-border rounded-sm p-4">
              <div className="text-mono text-muted-foreground text-xs">Observations / travaux réalisés</div>
              <p className="mt-2 text-sm whitespace-pre-line min-h-[60px]">{r.observations || "—"}</p>
            </div>
            <div className="border border-border rounded-sm p-4">
              <div className="text-mono text-muted-foreground text-xs">
                Réserves {nc > 0 ? `(${nc} point${nc > 1 ? "s" : ""} non conforme${nc > 1 ? "s" : ""})` : ""}
              </div>
              <p className="mt-2 text-sm whitespace-pre-line min-h-[60px]">{r.reserves || "Aucune réserve"}</p>
            </div>
          </section>

          {photos.length > 0 && (
            <section className="px-6 pb-6 break-inside-avoid">
              <div className="text-mono text-muted-foreground text-xs mb-3">Photos justificatives</div>
              <RapportPhotos photos={photos} />
            </section>
          )}

          <section className="px-6 pb-6">
            <p className="text-xs text-muted-foreground leading-relaxed border border-border rounded-sm p-4">
              {type === "assurance"
                ? `Je soussigné(e) ${r.technicien || COMPANY.raisonSociale}, intervenant pour le compte de ${COMPANY.raisonSociale} (SIRET ${COMPANY.siret}), déclare avoir réalisé l'installation de la borne de recharge décrite ci-dessus conformément aux règles de l'art et aux normes applicables (NF C 15-100 § infrastructure de recharge, IEC 61851 — charge en mode 3), avoir procédé aux essais et mesures consignés dans le présent rapport, et remettre l'installation en état de fonctionnement au client à la date d'intervention indiquée. Les valeurs mesurées ci-dessus ont été relevées sur site le jour de l'intervention.`
                : r.type === "conformite"
                ? "L'installation décrite ci-dessus a été réalisée et vérifiée conformément aux prescriptions de la norme NF C 15-100 (section infrastructure de recharge) et de la norme IEC 61851 (charge en mode 3). Le client déclare avoir pris connaissance du fonctionnement de la borne et des consignes de sécurité. Garantie de 12 mois pièces, main-d'œuvre et déplacement à compter de la date d'intervention."
                : "Le présent rapport constate l'état de l'installation à la date du contrôle. Les points relevés non conformes doivent être reprises avant mise ou remise en service de la borne."}
            </p>
          </section>

          <section className="px-6 pb-8 grid sm:grid-cols-2 gap-6 break-inside-avoid">
            <SignatureBlock
              title={`Technicien — ${r.technicien || COMPANY.raisonSociale}`}
              image={r.signature_technicien}
            />
            <SignatureBlock
              title={`Client — ${r.signataire_client || r.client_nom}`}
              image={r.signature_client}
            />
          </section>

          <footer className="px-6 py-4 border-t border-border text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between flex-wrap gap-2">
              <span>{COMPANY.raisonSociale} · {COMPANY.site}</span>
              <span>{r.numero} · {meta.label}</span>
            </div>
            <div>{COMPANY.qualificationsDetail}</div>
          </footer>

          <div className="absolute bottom-4 right-4 w-[105px]">
            <CompanySeal />
          </div>
        </article>
      </div>
    </div>
  );
}

function Box({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-grid place-items-center h-4 w-4 border rounded-[2px] leading-none text-[10px] ${
          on ? "border-primary text-primary font-bold" : "border-border"
        }`}
      >
        {on ? "X" : ""}
      </span>
      {label}
    </span>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-mono">{value || "—"}</div>
    </div>
  );
}

function SignatureBlock({
  title,
  image,
}: {
  title: string;
  image?: string | null;
}) {
  return (
    <div className="border border-border rounded-sm p-4">
      <div className="text-mono text-xs text-muted-foreground">{title}</div>
      <div className="mt-2 h-24 bg-white rounded-sm border border-border grid place-items-center overflow-hidden">
        {image ? <img src={image} alt="Signature" className="max-h-24 w-auto" /> : null}
      </div>
      <div className="text-[11px] text-muted-foreground mt-2">Date et signature</div>
    </div>
  );
}

function RapportPhotos({ photos }: { photos: { kind: string; path: string }[] }) {
  const fetchUrls = useServerFn(getRapportPhotoUrls);
  const { data } = useQuery({
    queryKey: ["rapport-photos", photos.map((p) => p.path).join(",")],
    queryFn: () => fetchUrls({ data: { paths: photos.map((p) => p.path) } }),
  });
  const label = (kind: string) =>
    PHOTOS_REQUISES.find((p) => p.key === kind)?.label ?? kind;

  return (
    <div className="grid grid-cols-2 gap-4">
      {photos.map((p) => {
        const url = data?.find((u) => u.path === p.path)?.url;
        return (
          <figure key={p.path} className="border border-border rounded-sm overflow-hidden">
            {url ? (
              <img src={url} alt={label(p.kind)} className="w-full h-44 object-cover" />
            ) : (
              <div className="w-full h-44 bg-muted" />
            )}
            <figcaption className="text-[11px] text-muted-foreground px-3 py-2">{label(p.kind)}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
