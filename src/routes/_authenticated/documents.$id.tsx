import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Copy, Download, Loader2, Mail, MessageCircle, PenLine, Plus, Send, Sparkles, Stamp, Trash2, Undo2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { PdfZones, detecterZones, ouvrirPdf } from "@/components/PdfZones";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOSSIERS, STATUT_DOC, ZONE_LABEL, couleurSignataire, nouvelleZone, type Signataire, type Zone, type ZoneType } from "@/lib/documents";
import { annulerSignature, enregistrerPreparation, envoyerPourSignature, getDocument, remplacerFichierDocument, signerIrve } from "@/lib/documents.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/documents/$id")({
  head: () => ({
    meta: [
      { title: "Préparer la signature — IRVE Technologie Pro" },
      { name: "description", content: "Placez les zones de signature et envoyez le document." },
      { property: "og:title", content: "Préparer la signature — IRVE Technologie Pro" },
      { property: "og:description", content: "Placez les zones de signature et envoyez le document." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocumentPage,
});

async function telechargerFichier(url: string, nom: string) {
  const blob = await (await fetch(url)).blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nom}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function cachetIrve(): Promise<string> {
  const img = new Image();
  img.src = "/cachet-signature-irve.svg";
  await img.decode();
  const w = 800;
  const h = Math.round((w * (img.naturalHeight || 400)) / (img.naturalWidth || 800));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Le cachet ne peut pas être préparé.");
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/png");
}

type LienPret = { nom: string; lien: string; telephone?: string | null };

function nouveauClient(index: number): Signataire {
  return { role: "client", cle: `c${index + 1}`, nom: "", email: "", telephone: "" };
}

function DocumentPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const lire = useServerFn(getDocument);
  const sauver = useServerFn(enregistrerPreparation);
  const signer = useServerFn(signerIrve);
  const envoyer = useServerFn(envoyerPourSignature);
  const remplacer = useServerFn(remplacerFichierDocument);
  const annuler = useServerFn(annulerSignature);
  const [preparationPdf, setPreparationPdf] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["document", id], queryFn: () => lire({ data: { id } }) });

  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof ouvrirPdf>> | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [clients, setClients] = useState<Signataire[]>([nouveauClient(0)]);
  const [irveNom, setIrveNom] = useState("Lassana Thiam");
  const [paraphes, setParaphes] = useState(true);
  const [page, setPage] = useState(0);
  const [cible, setCible] = useState<string>("c1"); // "irve" ou cle d'un client
  const [busy, setBusy] = useState<string | null>(null);
  const [signe, setSigne] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [par, setPar] = useState<string | null>(null);
  const [liens, setLiens] = useState<LienPret[]>([]);
  const [envoiAuto, setEnvoiAuto] = useState(true);
  const [mode, setMode] = useState<"seul" | "deux" | "client" | null>(null);

  useEffect(() => {
    if (!data?.url) return;
    let annule = false;
    const url = data.url;
    (async () => {
      try {
        const { estPdfProtege, recreerPdfPropre } = await import("@/lib/pdf-signable");
        let bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        const clientASigne = ((data.doc.signataires as unknown as Signataire[]) ?? []).some((s) => s.role === "client" && s.signed_at);
        if (data.doc.statut !== "signe" && !clientASigne && (await estPdfProtege(bytes))) {
          // PDF protégé : on prépare une copie propre, sinon les signatures l'abîment.
          let repartir = false;
          if (data.doc.storage_path.startsWith("signes/") && data.urlOriginal) {
            bytes = new Uint8Array(await (await fetch(data.urlOriginal)).arrayBuffer());
            repartir = true;
          }
          setPreparationPdf(true);
          const propre = await recreerPdfPropre(bytes);
          const path = `propres/${id}-${Date.now()}.pdf`;
          const { error: up } = await supabase.storage.from("documents").upload(path, propre, { contentType: "application/pdf" });
          if (up) throw new Error(up.message);
          await remplacer({ data: { id, storage_path: path, repartir } });
          if (repartir) toast.info("Le document était protégé : il a été remis au propre. Signez à nouveau.");
          if (!annule) qc.invalidateQueries({ queryKey: ["document", id] });
          return;
        }
        const p = await ouvrirPdf(url);
        if (!annule) setPdf(p);
      } catch (e) {
        if (!annule) toast.error(e instanceof Error ? `Impossible d'ouvrir le PDF : ${e.message}` : "Impossible d'ouvrir le PDF");
      } finally {
        if (!annule) setPreparationPdf(false);
      }
    })();
    const zs = (data.doc.zones as unknown as Zone[]) ?? [];
    setZones(zs);
    const s = (data.doc.signataires as unknown as Signataire[]) ?? [];
    const cs = s.filter((x) => x.role === "client");
    if (cs.length) setClients(cs.map((c, i) => ({ ...c, cle: c.cle ?? `c${i + 1}`, email: c.email ?? "", telephone: c.telephone ?? "" })));
    const i = s.find((x) => x.role === "irve");
    if (i?.nom) setIrveNom(i.nom);
    setMode((m) => m ?? (zs.some((z) => z.role === "client") || i?.signed_at ? "deux" : "seul"));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const faireAnnuler = async () => {
    if (!window.confirm("Annuler la signature ? Le document repartira du fichier d'origine, sans cachet ni signature.")) return;
    setBusy("annuler");
    try {
      await annuler({ data: { id } });
      toast.success("Signature annulée : le document est revenu à son état d'origine.");
      setSigne(false);
      setSig(null);
      setPar(null);
      setLiens([]);
      await qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Annulation impossible");
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <ProShell><p className="p-6">Chargement…</p></ProShell>;
  if (error || !data) return <ProShell><p className="p-6 text-destructive">{error instanceof Error ? error.message : "Document introuvable"}</p></ProShell>;
  const doc = data.doc;
  const st = STATUT_DOC[doc.statut] ?? STATUT_DOC["brouillon"]!;
  const signataires = (doc.signataires as unknown as Signataire[]) ?? [];
  const irveSigne = signataires.some((s) => s.role === "irve" && s.signed_at);
  const verrouille = doc.statut === "signe";

  const nbPagesDoc = () => pdf?.numPages ?? Math.max(1, ...zones.map((z) => z.page + 1));

  const enregistrer = async (z: Zone[] = zones, cls: Signataire[] = clients) => {
    await sauver({
      data: {
        id,
        nbPages: nbPagesDoc(),
        zones: z,
        signataires: [
          { role: "irve", nom: irveNom, ...(signataires.find((s) => s.role === "irve") ?? {}) },
          ...cls.map((c, i) => ({ ...c, cle: c.cle ?? `c${i + 1}` })),
        ],
      },
    });
  };

  const detecter = async () => {
    if (!pdf) return;
    setBusy("detect");
    try {
      const z = await detecterZones(pdf, paraphes);
      // Les zones détectées « client » sont rattachées au premier signataire.
      setZones(z.map((zn) => (zn.role === "client" ? { ...zn, signataire: zn.signataire ?? clients[0]?.cle ?? "c1" } : zn)));
      toast.success(`${z.length} emplacement(s) proposé(s). Déplacez-les si besoin.`);
    } finally {
      setBusy(null);
    }
  };

  const ajouter = (type: ZoneType) => {
    const roleIrve = cible === "irve";
    setZones([...zones, nouvelleZone(type, roleIrve ? "irve" : "client", page, 0.4, 0.45, roleIrve ? null : cible)]);
  };

  const majClient = (i: number, patch: Partial<Signataire>) => setClients(clients.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const ajouterClient = () => {
    const c = nouveauClient(clients.length);
    setClients([...clients, c]);
    setCible(c.cle!);
  };
  const retirerClient = (i: number) => {
    const c = clients[i];
    if (!c || clients.length <= 1) return;
    if (zones.some((z) => z.signataire === c.cle) && !window.confirm(`Retirer ${c.nom || "ce signataire"} ? Ses zones seront supprimées du document.`)) return;
    setZones(zones.filter((z) => z.signataire !== c.cle));
    const reste = clients.filter((_, k) => k !== i);
    setClients(reste);
    if (cible === c.cle) setCible(reste[0]?.cle ?? "c1");
  };

  /** Envoie le lien à un signataire précis (email facultatif). */
  const envoyerA = async (c: Signataire, avecEmail: boolean): Promise<LienPret | null> => {
    const r = await envoyer({ data: { id, email: c.email || null, envoyerEmail: avecEmail && Boolean(c.email), cle: c.cle ?? null } });
    return { nom: c.nom || "Signataire", lien: r.lien, telephone: c.telephone };
  };

  const faireSigner = async (cachet?: string) => {
    const sig2 = cachet ?? sig;
    if (!sig2) return toast.error("Dessinez votre signature.");
    const aDeux = mode === "deux";
    const clientsAvecZones = clients.filter((c) => zones.some((z) => z.role === "client" && z.signataire === c.cle));
    if (aDeux) {
      for (const c of clientsAvecZones.length ? clientsAvecZones : clients.slice(0, 1)) {
        if (c.nom.trim().length < 2) return toast.error("Étape 2 : indiquez le nom de chaque signataire qui signera après vous.");
        if (envoiAuto && !c.email) return toast.error(`Étape 2 : indiquez l'email de ${c.nom || "chaque signataire"} (ou décochez l'envoi automatique).`);
      }
    }
    setBusy("sign");
    try {
      const derniere = nbPagesDoc() - 1;
      let z = zones;
      // Je signe seul : on retire les zones des clients pour finaliser directement.
      if (!aDeux) z = z.filter((x) => x.role !== "client");
      // À plusieurs sans zone client : on place la signature du premier client en bas de la dernière page.
      if (aDeux && !z.some((x) => x.role === "client")) z = [...z, nouvelleZone("signature", "client", derniere, 0.6, 0.8, clients[0]?.cle ?? "c1")];
      // Pas de zone IRVE : emplacement automatique en bas de la dernière page.
      if (!z.some((x) => x.role === "irve")) z = [...z, nouvelleZone("signature", "irve", derniere, 0.08, 0.8)];
      setZones(z);
      await enregistrer(z);
      const r = await signer({ data: { id, signature: sig2, paraphe: cachet ?? par, nom: irveNom } });
      if (!r.termine && aDeux) {
        const destinataires = clientsAvecZones.length ? clientsAvecZones : clients.slice(0, 1);
        const prets: LienPret[] = [];
        let echecs = 0;
        for (const c of destinataires) {
          try {
            const l = await envoyerA(c, envoiAuto);
            if (l) prets.push(l);
            if (envoiAuto && !c.email) echecs++;
          } catch {
            echecs++;
          }
        }
        setLiens(prets);
        if (envoiAuto && echecs === 0) toast.success("Signé et envoyé à chaque signataire par email.");
        else toast.success("Signé. Les liens sont prêts ci-dessous : copiez-les ou envoyez-les par WhatsApp.");
      } else {
        toast.success("Document signé et terminé. Téléchargez-le ou laissez-le dans la plateforme.");
      }
      setSigne(false);
      setPdf(null);
      qc.invalidateQueries({ queryKey: ["document", id] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const faireEnvoyer = async (avecEmail: boolean) => {
    const cibles = clients.filter((c) => !c.signed_at);
    if (!cibles.length) return toast.error("Tous les signataires ont déjà signé.");
    for (const c of cibles) {
      if (c.nom.trim().length < 2) return toast.error("Indiquez le nom de chaque signataire (étape 2).");
      if (avecEmail && !c.email) return toast.error(`Indiquez l'email de ${c.nom || "chaque signataire"}, ou utilisez « Créer un lien ».`);
    }
    setBusy("send");
    try {
      await enregistrer();
      const prets: LienPret[] = [];
      let echecs = 0;
      for (const c of cibles) {
        try {
          const l = await envoyerA(c, avecEmail);
          if (l) prets.push(l);
        } catch {
          echecs++;
        }
      }
      setLiens(prets);
      if (avecEmail) echecs === 0 ? toast.success("Email envoyé à chaque signataire.") : toast.error("Une partie des emails n'a pas pu partir. Utilisez les liens ci-dessous (SMS / WhatsApp).");
      qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const nbZones = (cle: string | null) => zones.filter((z) => (cle === "irve" ? z.role === "irve" : z.role === "client" && z.signataire === cle)).length;
  const clientsPrets = clients.every((c) => !zones.some((z) => z.role === "client" && z.signataire === c.cle) || c.nom.trim().length > 1);
  const preparationPrete = zones.length > 0 && clientsPrets;

  return (
    <ProShell>
      <div className="mx-auto max-w-6xl space-y-4">
        <Link to="/documents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Documents</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold">{doc.nom}</h1>
            <p className="text-xs text-muted-foreground">
              {DOSSIERS.find((d) => d.cle === doc.dossier)?.label} · <span className={`rounded-full px-2 py-0.5 font-bold ${st.cls}`}>{st.label}</span>
              {doc.viewed_at ? ` · Lu le ${new Date(doc.viewed_at).toLocaleString("fr-FR")}` : ""}
              {doc.signed_at ? ` · Signé le ${new Date(doc.signed_at).toLocaleString("fr-FR")}` : ""}
            </p>
          </div>
          <Button variant="outline" onClick={() => data.url && telechargerFichier(data.url, doc.nom)}><Download className="h-4 w-4" /> Télécharger</Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-border bg-muted/30 p-2 sm:p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-xs">
              <p className="font-semibold">Aperçu du document</p>
              <div className="flex flex-wrap gap-3 text-muted-foreground">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />IRVE Technologie ({nbZones("irve")})</span>
                {clients.map((c, i) => (
                  <span key={c.cle ?? i}><span className={`mr-1 inline-block h-2.5 w-2.5 rounded-sm ${couleurSignataire(i).pastille}`} />{c.nom || `Signataire ${i + 1}`} ({nbZones(c.cle ?? `c${i + 1}`)})</span>
                ))}
              </div>
            </div>
            {preparationPdf && (
              <p className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs"><Loader2 className="h-4 w-4 animate-spin" /> Document protégé détecté : préparation d'une copie signable…</p>
            )}
            <PdfZones pdf={pdf} zones={verrouille ? [] : irveSigne ? zones.filter((z) => z.role === "client") : zones} onChange={verrouille ? undefined : setZones} clients={clients} />
          </div>

          {verrouille && (
            <aside className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 lg:sticky lg:top-20 lg:self-start">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-600"><Check className="h-5 w-5" /> Document signé et terminé</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {signataires.filter((s) => s.signed_at).map((s, i) => (
                  <li key={i}>✓ {s.role === "irve" ? "IRVE Technologie" : s.nom} — {new Date(s.signed_at!).toLocaleString("fr-FR")}</li>
                ))}
              </ul>
              <Button className="w-full" onClick={() => data.url && telechargerFichier(data.url, doc.nom)}><Download className="h-4 w-4" /> Télécharger le document signé</Button>
              <Button className="w-full" variant="outline" asChild><Link to="/documents"><Check className="h-4 w-4" /> Laisser dans la plateforme</Link></Button>
              <Button className="w-full" variant="ghost" size="sm" onClick={faireAnnuler} disabled={busy === "annuler"}>
                {busy === "annuler" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Signature posée par erreur ? Annuler
              </Button>
            </aside>
          )}
          {!verrouille && (
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className={`flex items-start gap-3 rounded-lg border p-3 ${preparationPrete ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                {preparationPrete ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-bold">{preparationPrete ? "Prêt à signer ou envoyer" : "Préparation à terminer"}</p>
                  <p className="text-xs text-muted-foreground">
                    {zones.length === 0 ? "Ajoutez au moins une zone sur le document." : !clientsPrets ? "Indiquez le nom de chaque signataire." : `${zones.length} zone${zones.length > 1 ? "s" : ""} placée${zones.length > 1 ? "s" : ""}.`}
                  </p>
                </div>
              </div>

              <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <div><h2 className="text-sm font-bold">Placer les zones</h2><p className="text-xs text-muted-foreground">Choisissez où chacun doit écrire ou signer.</p></div>
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={paraphes} onChange={(e) => setParaphes(e.target.checked)} /> Ajouter un paraphe sur chaque page</label>
                <Button className="w-full" variant="secondary" onClick={detecter} disabled={!pdf || busy === "detect"}>
                  {busy === "detect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Proposer les zones automatiquement
                </Button>
                <p className="border-t border-border pt-2 text-xs font-semibold">Placer rapidement une signature (page choisie ci-dessous)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" disabled={!pdf || irveSigne} className="bg-sky-500 text-white hover:bg-sky-600" onClick={() => setZones([...zones, nouvelleZone("signature", "irve", page, 0.08, 0.78)])}>
                    <Stamp className="h-3.5 w-3.5" /> Signature IRVE
                  </Button>
                  {clients.map((c, i) => (
                    <Button key={c.cle ?? i} type="button" size="sm" disabled={!pdf} className={`${couleurSignataire(i).pastille} text-white hover:opacity-90`} onClick={() => setZones([...zones, nouvelleZone("signature", "client", page, 0.6, 0.78, c.cle ?? `c${i + 1}`)])}>
                      <PenLine className="h-3.5 w-3.5" /> {c.nom || `Signataire ${i + 1}`}
                    </Button>
                  ))}
                </div>
                <p className="border-t border-border pt-2 text-xs font-semibold">Ajouter une autre zone</p>
                <div className="flex gap-2 text-xs">
                  <select value={cible} onChange={(e) => setCible(e.target.value)} className="h-8 flex-1 rounded border border-input bg-background px-2">
                    {clients.map((c, i) => <option key={c.cle ?? i} value={c.cle ?? `c${i + 1}`}>Pour {c.nom || `le signataire ${i + 1}`}</option>)}
                    <option value="irve">Pour IRVE Technologie</option>
                  </select>
                  <select value={page} onChange={(e) => setPage(Number(e.target.value))} className="h-8 rounded border border-input bg-background px-2">
                    {Array.from({ length: pdf?.numPages ?? 1 }, (_, i) => <option key={i} value={i}>Page {i + 1}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ZONE_LABEL) as ZoneType[]).map((t) => (
                    <Button key={t} type="button" size="sm" variant="outline" onClick={() => ajouter(t)}>+ {ZONE_LABEL[t]}</Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Touchez et faites glisser une zone pour la déplacer. Utilisez la croix pour la supprimer.</p>
              </section>

              <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <div><h2 className="text-sm font-bold">Identifier les signataires</h2><p className="text-xs text-muted-foreground">Les coordonnées servent à envoyer le lien à chacun.</p></div>
                </div>
                <label className="space-y-1 text-xs font-semibold">Signataire IRVE Technologie<Input value={irveNom} onChange={(e) => setIrveNom(e.target.value)} placeholder="Nom et prénom" /></label>
                {clients.map((c, i) => (
                  <div key={c.cle ?? i} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-2 text-xs font-bold"><span className={`h-2.5 w-2.5 rounded-sm ${couleurSignataire(i).pastille}`} /><UserRound className="h-4 w-4" /> Signataire {i + 1}{c.signed_at ? " — ✓ a signé" : ""}</p>
                      {clients.length > 1 && !c.signed_at && (
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Retirer ce signataire" onClick={() => retirerClient(i)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                    <label className="space-y-1 text-xs font-semibold">Nom complet<Input value={c.nom} onChange={(e) => majClient(i, { nom: e.target.value })} placeholder="Nom et prénom" /></label>
                    <label className="space-y-1 text-xs font-semibold">Adresse email<Input type="email" value={c.email ?? ""} onChange={(e) => majClient(i, { email: e.target.value })} placeholder="client@exemple.fr" /></label>
                    <label className="space-y-1 text-xs font-semibold">Téléphone<Input value={c.telephone ?? ""} onChange={(e) => majClient(i, { telephone: e.target.value })} placeholder="06 00 00 00 00" /></label>
                  </div>
                ))}
                <Button variant="secondary" className="w-full" onClick={ajouterClient}><Plus className="h-4 w-4" /> Ajouter un signataire</Button>
                <Button variant="outline" className="w-full" onClick={() => enregistrer().then(() => toast.success("Préparation enregistrée"))}>Enregistrer sans envoyer</Button>
              </section>

              <section className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  <div><h2 className="text-sm font-bold">Qui signe ?</h2><p className="text-xs text-muted-foreground">Choisissez le cas, puis suivez le bouton.</p></div>
                </div>
                {!irveSigne && (
                  <div className="grid gap-2">
                    {([
                      ["seul", "Je signe seul", "Je signe, puis je télécharge ou je laisse dans la plateforme."],
                      ["deux", clients.length > 1 ? `Je signe, puis les ${clients.length} signataires` : "Je signe, puis le client", "Je signe d'abord, chaque signataire reçoit ensuite son lien."],
                      ["client", clients.length > 1 ? "Seuls les signataires signent" : "Seul le client signe", "J'envoie le document sans le signer."],
                    ] as const).map(([k, t, d]) => (
                      <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-md border p-2.5 text-left text-xs transition ${mode === k ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border hover:bg-muted"}`}>
                        <span className="block font-bold">{mode === k ? "● " : "○ "}{t}</span>
                        <span className="text-muted-foreground">{d}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!irveSigne && mode !== "client" && (
                  <div className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
                    <p className="text-xs font-bold">Ma signature IRVE Technologie</p>
                    {nbZones("irve") === 0 && <p className="text-xs text-muted-foreground">Aucune zone IRVE placée : votre signature sera posée en bas de la dernière page.</p>}
                    {mode === "deux" && (
                      <>
                        {nbZones(clients[0]?.cle ?? "c1") === 0 && <p className="text-xs text-muted-foreground">Aucune zone client placée : une signature sera prévue en bas de la dernière page.</p>}
                        <label className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={envoiAuto} onChange={(e) => setEnvoiAuto(e.target.checked)} /> Envoyer automatiquement à chaque signataire par email juste après ma signature</label>
                      </>
                    )}
                    {mode === "seul" && zones.some((z) => z.role === "client") && <p className="text-xs text-muted-foreground">Les zones des signataires seront retirées : le document sera terminé dès votre signature.</p>}
                    {signe ? (
                      <div className="space-y-2">
                        <SignaturePad label="Votre signature" value={sig} onChange={setSig} />
                        {zones.some((z) => z.role === "irve" && z.type === "paraphe") && <SignaturePad label="Votre paraphe (initiales)" value={par} onChange={setPar} />}
                        <Button className="w-full" onClick={() => faireSigner()} disabled={busy === "sign"}>{busy === "sign" && <Loader2 className="h-4 w-4 animate-spin" />} Valider ma signature</Button>
                        <Button className="w-full" variant="ghost" size="sm" onClick={() => setSigne(false)}>Revenir au cachet</Button>
                      </div>
                    ) : (
                      <>
                        <img src="/cachet-signature-irve.svg" alt="Cachet et signature IRVE Technologie" className="mx-auto h-16 object-contain" />
                        <Button className="w-full" disabled={busy === "sign"} onClick={async () => {
                          let c: string;
                          try { c = await cachetIrve(); } catch { return toast.error("Cachet introuvable"); }
                          await faireSigner(c);
                        }}>
                          {busy === "sign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stamp className="h-4 w-4" />} {mode === "deux" ? (envoiAuto ? "Signer avec le cachet et envoyer" : "Signer avec le cachet") : "Signer avec le cachet et terminer"}
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => setSigne(true)}><PenLine className="h-4 w-4" /> Signer à la main plutôt</Button>
                      </>
                    )}
                  </div>
                )}
                {irveSigne && (
                  <div className="space-y-1 rounded-md bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-600">
                    <p>✓ Signé par IRVE Technologie.</p>
                    {signataires.filter((s) => s.role === "client").map((s, i) => (
                      <p key={i}>{s.signed_at ? `✓ ${s.nom} a signé le ${new Date(s.signed_at).toLocaleString("fr-FR")}` : `… En attente de ${s.nom || "un signataire"}`}</p>
                    ))}
                  </div>
                )}
                {(mode === "client" || irveSigne) && clients.some((c) => !c.signed_at) && (
                  <>
                    {nbZones(clients[0]?.cle ?? "c1") === 0 && <p className="text-xs text-amber-600">Placez au moins une zone « Signature » pour un signataire (étape 1).</p>}
                    <Button className="w-full" onClick={() => faireEnvoyer(true)} disabled={busy === "send" || !preparationPrete}><Mail className="h-4 w-4" /> Envoyer par email{clients.filter((c) => !c.signed_at).length > 1 ? " à chaque signataire" : " au client"}</Button>
                    <Button className="w-full" variant="outline" onClick={() => faireEnvoyer(false)} disabled={busy === "send" || !preparationPrete}><Send className="h-4 w-4" /> Créer les liens (SMS / WhatsApp)</Button>
                  </>
                )}
                <Button className="w-full" variant="ghost" onClick={() => data.url && telechargerFichier(data.url, doc.nom)}><Download className="h-4 w-4" /> {irveSigne ? "Télécharger (signé par IRVE)" : "Télécharger"}</Button>
                {irveSigne && (
                  <Button className="w-full" variant="ghost" asChild><Link to="/documents"><Check className="h-4 w-4" /> Laisser dans la plateforme</Link></Button>
                )}
                {irveSigne && (
                  <Button className="w-full" variant="ghost" size="sm" onClick={faireAnnuler} disabled={busy === "annuler"}>
                    {busy === "annuler" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Annuler ma signature (erreur)
                  </Button>
                )}
                {liens.length > 0 && (
                  <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                    <p className="font-bold">Liens de signature prêts</p>
                    {liens.map((l, i) => (
                      <div key={i} className="space-y-1 border-t border-primary/20 pt-2 first:border-0 first:pt-0">
                        <p className="font-semibold">{l.nom}</p>
                        <p className="break-all text-muted-foreground">{l.lien}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(l.lien).then(() => toast.success("Lien copié"))}><Copy className="h-3 w-3" /> Copier</Button>
                          <Button size="sm" variant="outline" asChild><a target="_blank" rel="noreferrer" href={`https://wa.me/${(l.telephone ?? "").replace(/\D/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(`Bonjour, merci de signer ce document : ${l.lien}`)}`}><MessageCircle className="h-3 w-3" /> WhatsApp</a></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          )}
        </div>
      </div>
    </ProShell>
  );
}
