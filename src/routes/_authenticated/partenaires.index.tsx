import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Handshake, Loader2, Plus, Trash2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { COMPANY } from "@/lib/company";
import {
  deletePartenaire,
  listPartenaires,
  savePartenaire,
} from "@/lib/partenaires.functions";

export const Route = createFileRoute("/_authenticated/partenaires/")({
  head: () => ({
    meta: [
      { title: "Partenaires — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Créer les liens de saisie des partenaires et sous-traitants : chaque partenaire saisit ses dossiers et ne voit que les siens.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PartenairesAdmin,
});

const INPUT =
  "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

function PartenairesAdmin() {
  const fetchAll = useServerFn(listPartenaires);
  const save = useServerFn(savePartenaire);
  const remove = useServerFn(deletePartenaire);
  const list = useQuery({ queryKey: ["partenaires"], queryFn: () => fetchAll() });

  const [nom, setNom] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  /**
   * Les liens partenaires pointent vers le site publié (accessible à tous).
   * L'aperçu de travail est protégé : un partenaire y verrait une page d'erreur.
   */
  const lien = (token: string) => `${COMPANY.siteUrl}/partenaire/${token}`;

  async function ajouter() {
    setError(null);
    if (nom.trim().length < 2) {
      setError("Indiquez le nom du partenaire.");
      return;
    }
    setBusy(true);
    try {
      await save({ data: { nom: nom.trim(), actif: true, notes: notes.trim() || null } });
      setNom("");
      setNotes("");
      await list.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ProShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight inline-flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" /> Partenaires
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque partenaire reçoit un lien privé pour saisir ses dossiers (client, adresse,
            montant, date ou « rendez-vous à prendre »). Il ne voit que ses propres dossiers, jamais
            vos devis, factures ou autres chantiers.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Les liens fonctionnent sur le site en ligne (www.irvetechnologie.fr). Après chaque
            modification, pensez à publier pour que vos partenaires voient la dernière version.
          </p>
        </header>

        <section className="bg-card border border-border rounded-xl p-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Nom du partenaire</span>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className={INPUT}
              placeholder="Pure Énergie"
            />
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Note interne</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={INPUT}
              placeholder="Contact, conditions tarifaires…"
            />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button
              type="button"
              onClick={ajouter}
              disabled={busy}
              className="bg-primary text-primary-foreground rounded-sm px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer le lien
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </section>

        <section className="space-y-3">
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </p>
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun partenaire pour le moment.</p>
          ) : (
            <ul className="grid gap-3">
              {list.data!.map((p) => (
                <li key={p.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {p.nom}
                        <span className="text-muted-foreground font-normal text-sm">
                          {" "}
                          — {p.dossiers} dossier{p.dossiers > 1 ? "s" : ""}
                        </span>
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                      <p className="text-[11px] text-mono mt-2 break-all text-muted-foreground">
                        {lien(p.token)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(lien(p.token));
                          setCopie(p.id);
                          setTimeout(() => setCopie(null), 2000);
                        }}
                        className="text-mono text-xs font-semibold px-3 py-2 rounded-sm border border-border inline-flex items-center gap-1.5 hover:border-primary hover:text-primary"
                      >
                        <Copy className="h-3.5 w-3.5" /> {copie === p.id ? "Copié" : "Copier le lien"}
                      </button>
                      <span
                        className={`text-mono text-xs font-semibold px-3 py-2 rounded-sm border select-none ${
                          p.actif
                            ? "border-primary/40 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {p.actif ? "Actif" : "Désactivé"}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const msg = p.actif
                            ? `Désactiver le lien de ${p.nom} ? Il ne pourra plus saisir de dossier.`
                            : `Réactiver le lien de ${p.nom} ?`;
                          if (!window.confirm(msg)) return;
                          await save({ data: { id: p.id, nom: p.nom, actif: !p.actif, notes: p.notes } });
                          await list.refetch();
                        }}
                        className="text-mono text-xs font-semibold px-3 py-2 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        {p.actif ? "Désactiver" : "Réactiver"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Supprimer le lien de ${p.nom} ?`)) return;
                          await remove({ data: { id: p.id } });
                          await list.refetch();
                        }}
                        className="text-muted-foreground hover:text-destructive p-2"
                        aria-label={`Supprimer ${p.nom}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ProShell>
  );
}
