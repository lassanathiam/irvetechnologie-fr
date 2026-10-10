import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, FileUp, Loader2, Printer, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { RapportDonneurDoc } from "@/components/RapportDonneurDoc";
import { RapportOriginalDoc } from "@/components/RapportOriginalDoc";
import {
  analyserFeuilleRapport,
  creerModeleJetable,
  enregistrerRapportRempli,
  envoyerRapportRempli,
  getRapportChantier,
} from "@/lib/rapport-modeles.functions";
import { normaliserStructure } from "@/lib/rapport-modeles";

export const Route = createFileRoute("/_authenticated/chantier-rapport/$rdvId")({
  head: () => ({
    meta: [
      { title: "Rapport du donneur d'ordre — IRVE Technologie" },
      { name: "description", content: "Remplissez et faites signer le rapport du donneur d'ordre sur le chantier." },
      { property: "og:title", content: "Rapport du donneur d'ordre" },
      { property: "og:description", content: "Rapport de chantier signé sur téléphone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RapportChantierPage,
});

type Val = string | boolean | null;
type ModeleRow = {
  id: string;
  nom: string;
  donneur_ordre: string;
  logo_data: string | null;
  email_destinataire: string | null;
  structure: unknown;
};

function RapportChantierPage() {
  return (
    <ProShell>
      <RapportChantierPageInner />
    </ProShell>
  );
}

function RapportChantierPageInner() {
  const { rdvId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getRapportChantier);
  const saveFn = useServerFn(enregistrerRapportRempli);
  const sendFn = useEnvoiConfirme(envoyerRapportRempli, "Confirmer l'envoi du rapport de travaux ?");
  const { data, isLoading, error } = useQuery({
    queryKey: ["rapport-chantier", rdvId],
    queryFn: () => getFn({ data: { rendezvous_id: rdvId } }),
  });

  const [modeleId, setModeleId] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, Val>>({});
  const [sigC, setSigC] = useState<string | null>(null);
  const [sigT, setSigT] = useState<string | null>(null);
  const [nomClient, setNomClient] = useState("");
  const [technicien, setTechnicien] = useState("");
  const [email, setEmail] = useState("");
  const [rempliId, setRempliId] = useState<string | null>(null);
  const [apercu, setApercu] = useState(false);
  const [modeleLocal, setModeleLocal] = useState<ModeleRow | null>(null);
  const [pvClient, setPvClient] = useState("");
  const [pvBusy, setPvBusy] = useState(false);
  const analyserFn = useServerFn(analyserFeuilleRapport);
  const jetableFn = useServerFn(creerModeleJetable);

  const modele = data?.modeles.find((m) => m.id === modeleId) ?? (modeleLocal && modeleLocal.id === modeleId ? modeleLocal : null);

  async function importerPv(file: File) {
    if (!pvClient) {
      toast.error("Choisissez d'abord le client (donneur d'ordre).");
      return;
    }
    if (file.size > 9_000_000) {
      toast.error("Fichier trop lourd (9 Mo maximum).");
      return;
    }
    setPvBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Lecture du fichier impossible."));
        r.readAsDataURL(file);
      });
      const analyse = await analyserFn({ data: { data_url: dataUrl } });
      const structure = {
        ...analyse,
        original: { data_url: dataUrl, type: file.type === "application/pdf" ? "pdf" : "image" },
      };
      const saved = await jetableFn({
        data: {
          nom: `PV ${pvClient} — ${data?.rdv.client_nom ?? "chantier"}`,
          donneur_ordre: pvClient,
          structure,
        },
      });
      setModeleLocal(saved as ModeleRow);
      setModeleId(saved.id);
      setValeurs({});
      toast.success("PV prêt : vérifiez les champs préremplis puis complétez.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPvBusy(false);
    }
  }
  const structure = modele ? normaliserStructure(modele.structure) : null;

  // Initialisation depuis le chantier / rapport existant
  useEffect(() => {
    if (!data) return;
    const m = data.modele;
    setModeleId(m?.id ?? null);
    setEmail(data.rempli?.sent_to || m?.email_destinataire || data.email_donneur || "");
    const r = data.rempli;
    if (r) {
      setRempliId(r.id);
      setValeurs((r.valeurs as Record<string, Val>) ?? {});
      setSigC(r.signature_client);
      setSigT(r.signature_technicien);
      setNomClient(r.signataire_nom ?? data.rdv.client_nom);
      setTechnicien(r.technicien ?? data.rdv.technicien ?? "");
    } else {
      setNomClient(data.rdv.client_nom);
      setTechnicien(data.rdv.technicien ?? "");
    }
  }, [data]);

  // Préremplissage automatique des champs connus
  useEffect(() => {
    if (!data || !structure || data.rempli) return;
    const rdv = data.rdv;
    const auto: Record<string, string> = {
      client_nom: rdv.client_nom,
      adresse: [rdv.adresse, rdv.cp_ville].filter(Boolean).join(", "),
      date: new Date(rdv.termine_at ?? Date.now()).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }),
      technicien: rdv.technicien ?? "",
      telephone: rdv.client_telephone ?? "",
      entreprise: "IRVE Technologie",
      projet: rdv.designation || rdv.titre || "",
      phase: /tri/i.test(rdv.phase_installation ?? "") ? "Triphasée" : rdv.phase_installation ? "Monophasée" : "",
      ville: (rdv.cp_ville ?? "").replace(/^\s*\d{5}\s*/, ""),
    };
    setValeurs((v) => {
      const n = { ...v };
      for (const s of structure.sections)
        for (const c of s.champs) if (c.auto && n[c.id] == null) n[c.id] = auto[c.auto] ?? null;
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, modeleId]);

  const save = useMutation({
    mutationFn: () =>
      modeleId ? saveFn({
        data: {
          id: rempliId,
          modele_id: modeleId,
          rendezvous_id: rdvId,
          valeurs,
          signature_client: sigC,
          signature_technicien: sigT,
          signataire_nom: nomClient,
          technicien,
        },
      }) : Promise.reject(new Error("Choisissez un modèle de rapport.")),
    onSuccess: (r) => {
      setRempliId(r.id);
      qc.invalidateQueries({ queryKey: ["rapport-chantier", rdvId] });
      toast.success(sigC && sigT ? "Rapport signé et enregistré" : "Brouillon enregistré");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: async () => {
      const r = await save.mutateAsync();
      return sendFn({ data: { id: r.id, destinataire: email } });
    },
    onSuccess: () => {
      toast.success("Rapport envoyé avec les photos");
      qc.invalidateQueries({ queryKey: ["rapport-chantier", rdvId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="m-6 h-6 w-6 animate-spin" />;
  if (error || !data) return <p className="p-6 text-destructive">{(error as Error)?.message ?? "Chantier introuvable."}</p>;

  const set = (id: string, v: Val) => setValeurs((x) => ({ ...x, [id]: v }));
  const signe = Boolean(sigC && sigT);

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <Link to="/planning" className="inline-flex items-center gap-1 text-sm text-muted-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Planning
      </Link>
      <div className="print:hidden">
        <h1 className="pro-title text-2xl">Rapport — {data.rdv.client_nom}</h1>
        <p className="text-sm text-muted-foreground">
          {data.rdv.partenaire ? `Donneur d'ordre : ${data.rdv.partenaire}` : "Aucun donneur d'ordre indiqué"}
          {data.rempli?.sent_at ? ` · envoyé le ${new Date(data.rempli.sent_at).toLocaleString("fr-FR")}` : ""}
        </p>
      </div>

      <div className="neo-dashboard-panel space-y-3 rounded-lg border border-border p-3 print:hidden">
        <h2 className="text-sm font-bold">Importer un PV juste pour ce chantier</h2>
        <p className="text-xs text-muted-foreground">
          Photo ou PDF de la feuille papier : elle reste telle quelle, vous la remplissez dessus. Rien n'est enregistré comme modèle réutilisable.
        </p>
        <label className="block text-sm">Client (donneur d'ordre)
          <select
            value={pvClient}
            onChange={(e) => setPvClient(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">— Choisir —</option>
            {(data.donneurs ?? []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary text-sm font-semibold ${pvBusy ? "opacity-50" : ""}`}>
          {pvBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {pvBusy ? "Lecture de la feuille…" : "Prendre en photo ou choisir le PV"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={pvBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importerPv(f);
            }}
          />
        </label>
      </div>

      {!data.modeles.length ? (
        <p className="rounded-lg border border-border p-4 text-sm">
          Aucun modèle de rapport. <Link to="/rapports/modeles" className="text-primary underline">Créer un modèle</Link>
        </p>
      ) : (
        <label className="block text-sm print:hidden">Modèle
          <select
            value={modeleId ?? ""}
            onChange={(e) => {
              setModeleId(e.target.value || null);
              setEmail(data.modeles.find((m) => m.id === e.target.value)?.email_destinataire || data.email_donneur || "");
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          >
            <option value="">— Choisir —</option>
            {data.modeles.map((m) => <option key={m.id} value={m.id}>{m.donneur_ordre} — {m.nom}</option>)}
          </select>
        </label>
      )}

      {modele && structure && (apercu ? (
        <>
          {structure.original ? (
            <RapportOriginalDoc structure={structure} valeurs={valeurs} signatureClient={sigC} signatureTechnicien={sigT} />
          ) : (
            <RapportDonneurDoc structure={structure} logo={modele.logo_data} donneur={modele.donneur_ordre} valeurs={valeurs} signatureClient={sigC} signatureTechnicien={sigT} signataireNom={nomClient} technicien={technicien} signedAt={data.rempli?.signed_at} />
          )}
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={() => setApercu(false)}>Revenir au formulaire</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Imprimer / PDF</Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-white p-3">
            {modele.logo_data && <img src={modele.logo_data} alt={modele.donneur_ordre} className="h-10 max-w-[140px] object-contain" />}
            <span className="font-bold text-slate-900">{structure.titre}</span>
          </div>
          {structure.sections.map((s, si) => (
            <div key={si} className="neo-dashboard-panel space-y-3 rounded-lg border border-border p-3">
              {s.titre && <h2 className="text-sm font-bold uppercase text-primary">{s.titre}</h2>}
              {s.champs.map((c) => {
                const v = valeurs[c.id];
                if (c.type === "case")
                  return (
                    <label key={c.id} className="flex min-h-11 items-center gap-3 text-sm">
                      <input type="checkbox" className="h-6 w-6" checked={v === true} onChange={(e) => set(c.id, e.target.checked)} />
                      {c.label}
                    </label>
                  );
                if (c.type === "ouinon")
                  return (
                    <div key={c.id} className="text-sm">
                      <div className="mb-1">{c.label}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {[["oui", "Oui"], ["non", "Non"], ["na", "N/A"]].map(([k, l]) => (
                          <button key={k} type="button" onClick={() => set(c.id, k!)} className={`min-h-11 rounded-lg border text-sm font-semibold ${v === k ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  );
                if (c.type === "zone")
                  return (
                    <label key={c.id} className="block text-sm">{c.label}
                      <Textarea value={(v as string) ?? ""} onChange={(e) => set(c.id, e.target.value)} />
                    </label>
                  );
                return (
                  <label key={c.id} className="block text-sm">{c.label}
                    <Input inputMode={c.type === "nombre" ? "decimal" : undefined} value={(v as string) ?? ""} onChange={(e) => set(c.id, e.target.value)} />
                  </label>
                );
              })}
            </div>
          ))}

          <div className="neo-dashboard-panel space-y-3 rounded-lg border border-border p-3">
            <label className="block text-sm">Technicien<Input value={technicien} onChange={(e) => setTechnicien(e.target.value)} /></label>
            <SignaturePad label="Signature technicien" value={sigT} onChange={setSigT} />
            <label className="block text-sm">Nom du client signataire<Input value={nomClient} onChange={(e) => setNomClient(e.target.value)} /></label>
            <SignaturePad label="Signature client" value={sigC} onChange={setSigC} />
          </div>

          <label className="block text-sm">Envoyer à
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email du donneur d'ordre" />
          </label>

          <div className="sticky bottom-2 flex flex-wrap gap-2 rounded-lg bg-background/90 p-2 backdrop-blur">
            <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
            </Button>
            <Button variant="outline" onClick={() => setApercu(true)}><Printer className="h-4 w-4" /> Aperçu</Button>
            <Button className="flex-1" disabled={!signe || !email || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Signé : envoyer avec les photos
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
