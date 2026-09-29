import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Download, Loader2, Mail, MessageCircle, PenLine, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { PdfZones, detecterZones, ouvrirPdf } from "@/components/PdfZones";
import { SignaturePad } from "@/components/SignaturePad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOSSIERS, STATUT_DOC, ZONE_LABEL, nouvelleZone, type Role, type Signataire, type Zone, type ZoneType } from "@/lib/documents";
import { enregistrerPreparation, envoyerPourSignature, getDocument, signerIrve } from "@/lib/documents.functions";

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

function DocumentPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const lire = useServerFn(getDocument);
  const sauver = useServerFn(enregistrerPreparation);
  const signer = useServerFn(signerIrve);
  const envoyer = useServerFn(envoyerPourSignature);
  const { data, isLoading, error } = useQuery({ queryKey: ["document", id], queryFn: () => lire({ data: { id } }) });

  const [pdf, setPdf] = useState<Awaited<ReturnType<typeof ouvrirPdf>> | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [client, setClient] = useState<Signataire>({ role: "client", nom: "", email: "", telephone: "" });
  const [irveNom, setIrveNom] = useState("Lassana Thiam");
  const [paraphes, setParaphes] = useState(true);
  const [page, setPage] = useState(0);
  const [role, setRole] = useState<Role>("client");
  const [busy, setBusy] = useState<string | null>(null);
  const [signe, setSigne] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [par, setPar] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.url) return;
    ouvrirPdf(data.url).then(setPdf).catch(() => toast.error("Impossible d'ouvrir le PDF"));
    setZones((data.doc.zones as unknown as Zone[]) ?? []);
    const s = (data.doc.signataires as unknown as Signataire[]) ?? [];
    const c = s.find((x) => x.role === "client");
    if (c) setClient({ ...c, email: c.email ?? "", telephone: c.telephone ?? "" });
    const i = s.find((x) => x.role === "irve");
    if (i?.nom) setIrveNom(i.nom);
  }, [data]);

  if (isLoading) return <ProShell><p className="p-6">Chargement…</p></ProShell>;
  if (error || !data) return <ProShell><p className="p-6 text-destructive">{error instanceof Error ? error.message : "Document introuvable"}</p></ProShell>;
  const doc = data.doc;
  const st = STATUT_DOC[doc.statut] ?? STATUT_DOC["brouillon"]!;
  const signataires = (doc.signataires as unknown as Signataire[]) ?? [];
  const irveSigne = signataires.some((s) => s.role === "irve" && s.signed_at);
  const verrouille = doc.statut === "signe";

  const enregistrer = async () => {
    if (!pdf) return;
    await sauver({ data: { id, nbPages: pdf.numPages, zones, signataires: [{ role: "irve", nom: irveNom, ...(signataires.find((s) => s.role === "irve") ?? {}) }, client].map((s) => ({ ...s, nom: s.role === "irve" ? irveNom : client.nom })) } });
  };

  const detecter = async () => {
    if (!pdf) return;
    setBusy("detect");
    try {
      const z = await detecterZones(pdf, paraphes);
      setZones(z);
      toast.success(`${z.length} emplacement(s) proposé(s). Déplacez-les si besoin.`);
    } finally {
      setBusy(null);
    }
  };

  const ajouter = (type: ZoneType) => setZones([...zones, nouvelleZone(type, role, page, 0.4, 0.45)]);

  const faireSigner = async () => {
    if (!sig) return toast.error("Dessinez votre signature.");
    setBusy("sign");
    try {
      await enregistrer();
      const r = await signer({ data: { id, signature: sig, paraphe: par, nom: irveNom } });
      toast.success(r.termine ? "Document signé et finalisé." : "Votre signature est posée. Envoyez maintenant au client.");
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
    if (avecEmail && !client.email) return toast.error("Indiquez l'email du client.");
    if (!client.nom) return toast.error("Indiquez le nom du client.");
    setBusy("send");
    try {
      await enregistrer();
      const r = await envoyer({ data: { id, email: client.email || null, envoyerEmail: avecEmail } });
      setLien(r.lien);
      if (avecEmail) r.emailEnvoye ? toast.success("Email envoyé au client.") : toast.error("L'email n'a pas pu partir. Utilisez le lien ci-dessous (SMS / WhatsApp).");
      qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const nbZones = (r: Role) => zones.filter((z) => z.role === r).length;

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

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <PdfZones pdf={pdf} zones={verrouille ? [] : zones} onChange={verrouille ? undefined : setZones} />
          </div>

          {!verrouille && (
            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <section className="space-y-2 rounded-lg border border-border bg-card p-3">
                <h2 className="text-sm font-bold">1. Emplacements</h2>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={paraphes} onChange={(e) => setParaphes(e.target.checked)} /> Paraphe sur chaque page</label>
                <Button className="w-full" variant="secondary" onClick={detecter} disabled={!pdf || busy === "detect"}>
                  {busy === "detect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Détecter automatiquement
                </Button>
                <p className="text-xs text-muted-foreground">Ou ajoutez à la main :</p>
                <div className="flex gap-2 text-xs">
                  <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="h-8 flex-1 rounded border border-input bg-background px-2">
                    <option value="client">Pour le client</option>
                    <option value="irve">Pour IRVE Technologie</option>
                  </select>
                  <select value={page} onChange={(e) => setPage(Number(e.target.value))} className="h-8 rounded border border-input bg-background px-2">
                    {Array.from({ length: pdf?.numPages ?? 1 }, (_, i) => <option key={i} value={i}>Page {i + 1}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(ZONE_LABEL) as ZoneType[]).map((t) => (
                    <button key={t} type="button" onClick={() => ajouter(t)} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">+ {ZONE_LABEL[t]}</button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground"><span className="font-bold text-sky-600">Bleu</span> = IRVE ({nbZones("irve")}) · <span className="font-bold text-amber-600">Orange</span> = client ({nbZones("client")}). Glissez les zones pour les déplacer.</p>
              </section>

              <section className="space-y-2 rounded-lg border border-border bg-card p-3">
                <h2 className="text-sm font-bold">2. Signataires</h2>
                <Input value={irveNom} onChange={(e) => setIrveNom(e.target.value)} placeholder="Signataire IRVE Technologie" />
                <Input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} placeholder="Nom du client" />
                <Input type="email" value={client.email ?? ""} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="Email du client" />
                <Input value={client.telephone ?? ""} onChange={(e) => setClient({ ...client, telephone: e.target.value })} placeholder="Téléphone du client" />
                <Button variant="ghost" size="sm" onClick={() => enregistrer().then(() => toast.success("Préparation enregistrée"))}>Enregistrer la préparation</Button>
              </section>

              <section className="space-y-2 rounded-lg border border-border bg-card p-3">
                <h2 className="text-sm font-bold">3. Que voulez-vous faire ?</h2>
                {nbZones("irve") > 0 && !irveSigne && (
                  signe ? (
                    <div className="space-y-2">
                      <SignaturePad label="Votre signature" value={sig} onChange={setSig} />
                      {zones.some((z) => z.role === "irve" && z.type === "paraphe") && <SignaturePad label="Votre paraphe (initiales)" value={par} onChange={setPar} />}
                      <Button className="w-full" onClick={faireSigner} disabled={busy === "sign"}>{busy === "sign" && <Loader2 className="h-4 w-4 animate-spin" />} Valider ma signature</Button>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => setSigne(true)}><PenLine className="h-4 w-4" /> Je signe maintenant</Button>
                  )
                )}
                {irveSigne && <p className="text-xs text-emerald-600">✓ Signé par IRVE Technologie</p>}
                {nbZones("client") > 0 && (
                  <>
                    <Button className="w-full" variant="secondary" onClick={() => faireEnvoyer(true)} disabled={busy === "send"}><Mail className="h-4 w-4" /> Envoyer au client par email</Button>
                    <Button className="w-full" variant="outline" onClick={() => faireEnvoyer(false)} disabled={busy === "send"}><Send className="h-4 w-4" /> Obtenir le lien de signature</Button>
                  </>
                )}
                <Button className="w-full" variant="ghost" onClick={() => data.url && telechargerFichier(data.url, doc.nom)}><Download className="h-4 w-4" /> Télécharger pour l'envoyer moi-même</Button>
                {lien && (
                  <div className="space-y-2 rounded border border-border p-2 text-xs">
                    <p className="break-all">{lien}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(lien).then(() => toast.success("Lien copié"))}><Copy className="h-3 w-3" /> Copier</Button>
                      <a className="inline-flex items-center gap-1 rounded border border-border px-2 text-xs" target="_blank" rel="noreferrer"
                        href={`https://wa.me/${(client.telephone ?? "").replace(/\D/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(`Bonjour, merci de signer ce document : ${lien}`)}`}>
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    </div>
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
