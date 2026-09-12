import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Loader2, Mail, Plus, Printer, Receipt, Trash2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { DocumentPrint } from "@/components/DocumentPrint";
import { EmailReceipts } from "@/components/EmailReceipts";
import { computeTotals } from "@/lib/billing";
import {
  convertirEnFacture,
  envoyerDevis,
  getDevis,
  listEnvoisDevis,
  updateDevis,
  updateStatutDevis,
} from "@/lib/devis.functions";

export const Route = createFileRoute("/_authenticated/devis/$id")({
  head: () => ({
    meta: [
      { title: "Devis — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Aperçu, envoi et conversion en facture du devis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevisDetail,
});

const STATUTS = [
  { value: "brouillon", label: "Brouillon" },
  { value: "a_valider", label: "À valider" },
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
] as const;

type EditLine = {
  key: string;
  libelle: string;
  description: string;
  quantite: number;
  prix_unitaire: number;
  tva: number;
};

type EditState = {
  client_nom: string;
  client_email: string;
  client_telephone: string;
  client_adresse: string;
  client_cp_ville: string;
  objet: string;
  notes: string;
  date_emission: string;
  date_expiration: string;
  remise_pct: number;
  acompte_pct: number;
  conditions_paiement: string;
  lines: EditLine[];
};

type EditPayload = {
  id: string;
  client_nom: string;
  client_email: string | null;
  client_telephone: string | null;
  client_adresse: string | null;
  client_cp_ville: string | null;
  objet: string | null;
  notes: string | null;
  date_emission: string;
  date_expiration: string;
  remise_pct: number;
  acompte_pct: number;
  conditions_paiement: string | null;
  rendezvous_id: string | null;
  items: Array<{
    libelle: string;
    description: string | null;
    quantite: number;
    prix_unitaire: number;
    tva: number;
  }>;
};

function DevisDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchDevis = useServerFn(getDevis);
  const sendFn = useServerFn(envoyerDevis);
  const statutFn = useServerFn(updateStatutDevis);
  const updateFn = useServerFn(updateDevis);
  const convertFn = useServerFn(convertirEnFacture);
  const envoisFn = useServerFn(listEnvoisDevis);

  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [accentColor, setAccentColor] = useState("#1459d9");

  const query = useQuery({
    queryKey: ["devis", id],
    queryFn: () => fetchDevis({ data: { id } }),
    retry: 1,
  });
  const envois = useQuery({
    queryKey: ["devis-envois", id],
    queryFn: () => envoisFn({ data: { id } }),
    retry: 1,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(`devis-accent:${id}`);
    if (saved && /^#[0-9a-fA-F]{6}$/.test(saved)) setAccentColor(saved);
  }, [id]);

  useEffect(() => {
    if (!query.data || editState) return;
    const { devis, items } = query.data;
    setEditState({
      client_nom: devis.client_nom ?? "",
      client_email: devis.client_email ?? "",
      client_telephone: devis.client_telephone ?? "",
      client_adresse: devis.client_adresse ?? "",
      client_cp_ville: devis.client_cp_ville ?? "",
      objet: devis.objet ?? "",
      notes: devis.notes ?? "",
      date_emission: devis.date_emission,
      date_expiration: devis.date_expiration,
      remise_pct: Number(devis.remise_pct ?? 0),
      acompte_pct: Number(devis.acompte_pct ?? 0),
      conditions_paiement: devis.conditions_paiement ?? "",
      lines: items.map((line) => ({
        key: line.id,
        libelle: line.libelle ?? "",
        description: line.description ?? "",
        quantite: Number(line.quantite ?? 1),
        prix_unitaire: Number(line.prix_unitaire ?? 0),
        tva: Number(line.tva ?? 20),
      })),
    });
  }, [query.data, editState]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { id, message: message || null } }),
    onSuccess: (res) => {
      setError(null);
      setFeedback(
        res.sent
          ? "Devis envoyé au client par email."
          : res.reason === "email_not_configured"
            ? "Email non configuré (LOVABLE_API_KEY absente) — envoi non effectué."
            : "Adresse email bloquée (désinscription) — envoi non effectué.",
      );
      qc.invalidateQueries({ queryKey: ["devis"] });
      qc.invalidateQueries({ queryKey: ["devis-envois", id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Envoi impossible."),
  });

  const convert = useMutation({
    mutationFn: () => convertFn({ data: { id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      navigate({ to: "/factures/$id", params: { id: res.id } });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Conversion impossible."),
  });

  const statut = useMutation({
    mutationFn: (value: string) => statutFn({ data: { id, statut: value } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devis", id] });
      qc.invalidateQueries({ queryKey: ["devis"] });
    },
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editState) throw new Error("Aucun changement à enregistrer.");
      if (editState.client_nom.trim().length < 2) {
        throw new Error("Le nom client doit contenir au moins 2 caractères.");
      }
      if (editState.lines.length === 0) {
        throw new Error("Ajoutez au moins une ligne au devis.");
      }
      if (editState.lines.some((line) => line.libelle.trim().length < 1)) {
        throw new Error("Chaque ligne doit avoir un libellé.");
      }
      const payload: EditPayload = {
        id,
        client_nom: editState.client_nom,
        client_email: editState.client_email || null,
        client_telephone: editState.client_telephone || null,
        client_adresse: editState.client_adresse || null,
        client_cp_ville: editState.client_cp_ville || null,
        objet: editState.objet || null,
        notes: editState.notes || null,
        date_emission: editState.date_emission,
        date_expiration: editState.date_expiration,
        remise_pct: editState.remise_pct,
        acompte_pct: editState.acompte_pct,
        conditions_paiement: editState.conditions_paiement || null,
        rendezvous_id: query.data?.devis?.rendezvous_id ?? null,
        items: editState.lines.map((line) => ({
          libelle: line.libelle,
          description: line.description || null,
          quantite: line.quantite,
          prix_unitaire: line.prix_unitaire,
          tva: line.tva,
        })),
      };
      const result = await updateFn({ data: payload });
      return { result, payload };
    },
    onSuccess: async ({ payload }) => {
      const totals = computeTotals(payload.items, payload.remise_pct);
      qc.setQueryData(["devis", id], (old: any) => {
        if (!old?.devis || !Array.isArray(old?.items)) return old;
        return {
          ...old,
          devis: {
            ...old.devis,
            client_nom: payload.client_nom,
            client_email: payload.client_email,
            client_telephone: payload.client_telephone,
            client_adresse: payload.client_adresse,
            client_cp_ville: payload.client_cp_ville,
            objet: payload.objet,
            notes: payload.notes,
            date_emission: payload.date_emission,
            date_expiration: payload.date_expiration,
            remise_pct: payload.remise_pct,
            acompte_pct: payload.acompte_pct,
            conditions_paiement: payload.conditions_paiement,
            total_ht_brut: totals.total_ht_brut,
            total_remise: totals.total_remise,
            total_ht: totals.total_ht,
            total_tva: totals.total_tva,
            total_ttc: totals.total_ttc,
          },
          items: payload.items.map((line, idx) => ({
            id: `${id}-${idx}`,
            ordre: idx + 1,
            ...line,
          })),
        };
      });
      setError(null);
      setFeedback("Devis modifié avec succès.");
      setEditOpen(false);
      setEditState(null);
      await qc.invalidateQueries({ queryKey: ["devis", id] });
      await qc.invalidateQueries({ queryKey: ["devis"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Modification impossible."),
  });

  const editTotals = useMemo(() => {
    if (!editState) return null;
    return computeTotals(
      editState.lines.map((line) => ({
        libelle: line.libelle,
        description: line.description || null,
        quantite: line.quantite,
        prix_unitaire: line.prix_unitaire,
        tva: line.tva,
      })),
      editState.remise_pct,
    );
  }, [editState]);

  if (query.isLoading) {
    return (
      <ProShell>
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </ProShell>
    );
  }
  if (query.error || !query.data) {
    return (
      <ProShell>
        <p className="text-sm text-destructive">Devis introuvable.</p>
      </ProShell>
    );
  }

  const { devis, items } = query.data;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const lienClient = `${origin}/devis-client/${devis.public_token}`;
  const devisAccepteEnLigne = Boolean(devis.signed_at);

  return (
    <ProShell>
      <div className="print:hidden space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/devis"
            className="text-mono text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Devis
          </Link>
          <span className="text-mono text-xs text-primary">{devis.numero}</span>
          <select
            value={devis.statut}
            onChange={(e) => statut.mutate(e.target.value)}
            className="ml-auto bg-input border border-border rounded-sm px-3 py-2 text-mono text-xs"
          >
            {STATUTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-mono text-xs border border-border rounded-sm px-2 py-2">
            Couleur
            <input
              type="color"
              value={accentColor}
              onChange={(e) => {
                const value = e.target.value;
                setAccentColor(value);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(`devis-accent:${id}`, value);
                }
              }}
              className="h-6 w-8 bg-transparent border-0 p-0 cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary"
          >
            {editOpen ? "Fermer l'édition" : "Modifier le devis"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-2"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimer / PDF
          </button>
          {devis.facture_id ? (
            <Link
              to="/factures/$id"
              params={{ id: devis.facture_id }}
              className="border border-border rounded-sm px-4 py-2 text-mono text-xs text-primary inline-flex items-center gap-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Voir la facture
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => convert.mutate()}
              disabled={convert.isPending}
              className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {convert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
              Convertir en facture
            </button>
          )}
        </div>

        {editOpen && editState && (
          <section className="border border-border rounded-sm bg-card p-6 space-y-4">
            <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Modifier le devis
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <EditField
                label="Nom client"
                value={editState.client_nom}
                onChange={(v) => setEditState({ ...editState, client_nom: v })}
              />
              <EditField
                label="Objet"
                value={editState.objet}
                onChange={(v) => setEditState({ ...editState, objet: v })}
              />
              <EditField
                label="Email"
                value={editState.client_email}
                onChange={(v) => setEditState({ ...editState, client_email: v })}
              />
              <EditField
                label="Téléphone"
                value={editState.client_telephone}
                onChange={(v) => setEditState({ ...editState, client_telephone: v })}
              />
              <EditField
                label="Adresse"
                value={editState.client_adresse}
                onChange={(v) => setEditState({ ...editState, client_adresse: v })}
              />
              <EditField
                label="CP / Ville"
                value={editState.client_cp_ville}
                onChange={(v) => setEditState({ ...editState, client_cp_ville: v })}
              />
              <EditField
                label="Date émission"
                type="date"
                value={editState.date_emission}
                onChange={(v) => setEditState({ ...editState, date_emission: v })}
              />
              <EditField
                label="Date expiration"
                type="date"
                value={editState.date_expiration}
                onChange={(v) => setEditState({ ...editState, date_expiration: v })}
              />
              <EditField
                label="Remise (%)"
                type="number"
                value={String(editState.remise_pct)}
                onChange={(v) =>
                  setEditState({ ...editState, remise_pct: Math.max(0, Math.min(100, Number(v) || 0)) })
                }
              />
              <EditField
                label="Acompte (%)"
                type="number"
                value={String(editState.acompte_pct)}
                onChange={(v) =>
                  setEditState({ ...editState, acompte_pct: Math.max(0, Math.min(100, Number(v) || 0)) })
                }
              />
            </div>
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Conditions de paiement</span>
              <textarea
                rows={3}
                value={editState.conditions_paiement}
                onChange={(e) => setEditState({ ...editState, conditions_paiement: e.target.value })}
                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm resize-none"
              />
            </label>
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Notes</span>
              <textarea
                rows={3}
                value={editState.notes}
                onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm resize-none"
              />
            </label>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Lignes du devis</h3>
                <button
                  type="button"
                  onClick={() =>
                    setEditState({
                      ...editState,
                      lines: [
                        ...editState.lines,
                        {
                          key: crypto.randomUUID(),
                          libelle: "Ligne libre",
                          description: "",
                          quantite: 1,
                          prix_unitaire: 0,
                          tva: 20,
                        },
                      ],
                    })
                  }
                  className="border border-border rounded-sm px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:border-primary hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                </button>
              </div>
              {editState.lines.map((line) => (
                <div key={line.key} className="border border-border rounded-sm p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={line.libelle}
                      onChange={(e) =>
                        setEditState({
                          ...editState,
                          lines: editState.lines.map((l) =>
                            l.key === line.key ? { ...l, libelle: e.target.value } : l,
                          ),
                        })
                      }
                      className="flex-1 bg-input border border-border rounded-sm px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditState({
                          ...editState,
                          lines: editState.lines.filter((l) => l.key !== line.key),
                        })
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={line.description}
                    onChange={(e) =>
                      setEditState({
                        ...editState,
                        lines: editState.lines.map((l) =>
                          l.key === line.key ? { ...l, description: e.target.value } : l,
                        ),
                      })
                    }
                    className="w-full bg-input border border-border rounded-sm px-3 py-2 text-sm resize-none"
                    placeholder="Description (optionnelle)"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <EditField
                      label="Qté"
                      type="number"
                      value={String(line.quantite)}
                      onChange={(v) =>
                        setEditState({
                          ...editState,
                          lines: editState.lines.map((l) =>
                            l.key === line.key ? { ...l, quantite: Math.max(1, Number(v) || 1) } : l,
                          ),
                        })
                      }
                    />
                    <EditField
                      label="PU HT"
                      type="number"
                      value={String(line.prix_unitaire)}
                      onChange={(v) =>
                        setEditState({
                          ...editState,
                          lines: editState.lines.map((l) =>
                            l.key === line.key ? { ...l, prix_unitaire: Math.max(0, Number(v) || 0) } : l,
                          ),
                        })
                      }
                    />
                    <EditField
                      label="TVA %"
                      type="number"
                      value={String(line.tva)}
                      onChange={(v) =>
                        setEditState({
                          ...editState,
                          lines: editState.lines.map((l) =>
                            l.key === line.key ? { ...l, tva: Math.max(0, Number(v) || 0) } : l,
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>

            {editTotals && (
              <p className="text-xs text-muted-foreground">
                Nouveau total TTC estimé :{" "}
                <span className="text-mono font-semibold">
                  {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                    editTotals.total_ttc,
                  )}
                </span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={
                  saveEdit.isPending ||
                  editState.client_nom.trim().length < 2 ||
                  editState.lines.length === 0
                }
                onClick={() => {
                  setError(null);
                  setFeedback(null);
                  saveEdit.mutate();
                }}
                className="hero-grad text-primary-foreground text-mono text-xs px-5 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {saveEdit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer les modifications
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditState(null);
                }}
                className="border border-border rounded-sm px-4 py-2 text-mono text-xs hover:border-primary hover:text-primary"
              >
                Annuler
              </button>
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="border border-border rounded-sm bg-card p-6 space-y-3">
            <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Envoyer au client
            </h2>
            {devisAccepteEnLigne && (
              <div className="rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-mono text-xs text-emerald-700 dark:text-emerald-300">
                Devis déjà accepté en ligne — {devis.signataire_nom ?? "Client"} le{" "}
                {new Date(devis.signed_at!).toLocaleString("fr-FR")}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {devis.client_email
                ? `Destinataire : ${devis.client_email}`
                : "Aucune adresse email sur ce devis — ajoutez-la pour pouvoir l'envoyer."}
            </p>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message personnalisé (optionnel)"
              disabled={devisAccepteEnLigne}
              className="w-full bg-input border border-border rounded-sm px-4 py-3 text-sm resize-none"
            />
            <div className="flex flex-wrap items-center gap-4">
              {!devisAccepteEnLigne ? (
                <button
                  type="button"
                  disabled={!devis.client_email || send.isPending}
                  onClick={() => {
                    setFeedback(null);
                    setError(null);
                    send.mutate();
                  }}
                  className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Envoyer le devis
                </button>
              ) : (
                <span className="inline-flex items-center rounded-sm border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Statut: envoyé puis accepté
                </span>
              )}
              {devis.sent_at && (
                <span className="text-mono text-xs text-muted-foreground">
                  Dernier envoi : {new Date(devis.sent_at).toLocaleString("fr-FR")}
                </span>
              )}
            </div>
            {feedback && <p className="text-mono text-xs text-primary">{feedback}</p>}
            {error && <p className="text-mono text-xs text-destructive">{error}</p>}

            <div className="pt-4 border-t border-border space-y-2">
              <div className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Lien client (consultation, PDF, acceptation)
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={lienClient}
                  className="flex-1 bg-input border border-border rounded-sm px-3 py-2 text-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(lienClient);
                    setFeedback("Lien client copié.");
                  }}
                  className="border border-border rounded-sm px-3 py-2 text-mono text-xs hover:border-primary hover:text-primary inline-flex items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Historique d&apos;envois
              </h2>
              {devisAccepteEnLigne && (
                <div className="text-[12px] border-b border-border pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-mono font-bold">
                      {new Date(devis.signed_at!).toLocaleString("fr-FR")}
                    </span>
                    <span className="text-mono text-[10px] text-emerald-700 dark:text-emerald-300 uppercase">
                      Accepté
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {devis.signataire_nom ?? "Client"} a accepté le devis en ligne.
                  </div>
                </div>
              )}
              {(envois.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun envoi enregistré.</p>
              ) : (
                <ul className="space-y-2.5">
                  {(envois.data ?? []).map((e) => (
                    <li key={e.id} className="text-[12px] border-b border-border pb-2 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-mono font-bold">
                          {new Date(e.created_at).toLocaleString("fr-FR")}
                        </span>
                        <span
                          className={
                            e.resultat === "envoye"
                              ? "text-mono text-[10px] text-primary uppercase"
                              : "text-mono text-[10px] text-destructive uppercase"
                          }
                        >
                          {e.resultat === "envoye" ? "Envoyé" : "Bloqué"}
                        </span>
                      </div>
                      <div className="text-muted-foreground">{e.destinataire}</div>
                      {e.message && <div className="text-muted-foreground italic">{e.message}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-border rounded-sm bg-card p-6 space-y-2">
              <h2 className="text-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
                Suivi de signature
              </h2>
              <TrackRow
                label="Envoyé"
                value={devis.sent_at ? new Date(devis.sent_at).toLocaleString("fr-FR") : null}
              />
              <TrackRow
                label="Première ouverture"
                value={devis.viewed_at ? new Date(devis.viewed_at).toLocaleString("fr-FR") : null}
              />
              <TrackRow
                label="Dernière ouverture"
                value={
                  devis.last_viewed_at
                    ? new Date(devis.last_viewed_at).toLocaleString("fr-FR")
                    : null
                }
              />
              <TrackRow
                label="Nombre de consultations"
                value={devis.view_count ? String(devis.view_count) : null}
              />
              <TrackRow
                label="Accepté en ligne"
                value={
                  devis.signed_at
                    ? `${devis.signataire_nom ?? "Client"} — ${new Date(devis.signed_at).toLocaleString("fr-FR")}`
                    : null
                }
              />
              {devis.signature_client && (
                <img
                  src={devis.signature_client}
                  alt="Signature du client"
                  className="mt-2 h-16 w-full object-contain object-left bg-background border border-border rounded-sm"
                />
              )}
            </div>

            <EmailReceipts email={devis.client_email} />

          </div>
        </div>
      </div>

      <div className="mt-8 print:mt-0">
        <DocumentPrint
          type="devis"
          accentColor={accentColor}
          doc={{
            numero: devis.numero,
            date_emission: devis.date_emission,
            date_limite: devis.date_expiration,
            client_nom: devis.client_nom,
            client_email: devis.client_email,
            client_telephone: devis.client_telephone,
            client_adresse: devis.client_adresse,
            client_cp_ville: devis.client_cp_ville,
            objet: devis.objet,
            remise_pct: devis.remise_pct,
            acompte_pct: devis.acompte_pct,
            conditions_paiement: devis.conditions_paiement,
            notes: devis.notes,
          }}
          items={items}
          signature={{
            signature_client: devis.signature_client,
            signataire_nom: devis.signataire_nom,
            signed_at: devis.signed_at,
          }}
        />
      </div>
    </ProShell>
  );
}

function TrackRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px] border-b border-border pb-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? "text-mono font-bold text-right" : "text-mono text-muted-foreground"}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date" | "number";
}) {
  return (
    <label className="block">
      <span className="text-mono text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm"
      />
    </label>
  );
}
