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
  regenererLienPartenaire,
  reinitialiserPinPartenaire,
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

/** Couleurs d'identification : chaque partenaire est reconnaissable sur la carte et le planning. */
const COULEURS = [
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#059669",
  "#0f766e",
  "#475569",
];

function PartenairesAdmin() {
  const fetchAll = useServerFn(listPartenaires);
  const save = useServerFn(savePartenaire);
  const remove = useServerFn(deletePartenaire);
  const resetPin = useServerFn(reinitialiserPinPartenaire);
  const nouveauLien = useServerFn(regenererLienPartenaire);
  const list = useQuery({ queryKey: ["partenaires"], queryFn: () => fetchAll() });

  const [nom, setNom] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [couleur, setCouleur] = useState(COULEURS[0]!);
  const [delai, setDelai] = useState("30");
  const [fiche, setFiche] = useState({
    raison_sociale: "",
    adresse: "",
    cp_ville: "",
    siret: "",
    tva_intracom: "",
    contact_nom: "",
    telephone: "",
  });
  const [editionId, setEditionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);


  /**
   * Les liens partenaires pointent vers le site publié (accessible à tous).
   * L'aperçu de travail est protégé : un partenaire y verrait une page d'erreur.
   */
  const lien = (token: string) => `${COMPANY.siteUrl}/partenaire/${token}`;

  type Partenaire = NonNullable<typeof list.data>[number];
  /** Reprend tous les champs existants d'un partenaire pour ne rien effacer. */
  const base = (p: Partenaire) => ({
    id: p.id,
    nom: p.nom,
    actif: p.actif,
    notes: p.notes,
    couleur: p.couleur ?? "#0284c7",
    email: p.email,
    delai_paiement_jours: p.delai_paiement_jours ?? 30,
    raison_sociale: p.raison_sociale,
    adresse: p.adresse,
    cp_ville: p.cp_ville,
    pays: p.pays ?? "France",
    siret: p.siret,
    tva_intracom: p.tva_intracom,
    contact_nom: p.contact_nom,
    telephone: p.telephone,
  });

  async function ajouter() {
    setError(null);
    if (nom.trim().length < 2) {
      setError("Indiquez le nom du partenaire.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          nom: nom.trim(),
          actif: true,
          notes: notes.trim() || null,
          couleur,
          email: email.trim() || null,
          delai_paiement_jours: delai || 30,
          ...fiche,
        },
      });
      setNom("");
      setNotes("");
      setEmail("");
      setDelai("30");
      setFiche({
        raison_sociale: "",
        adresse: "",
        cp_ville: "",
        siret: "",
        tva_intracom: "",
        contact_nom: "",
        telephone: "",
      });
      setCouleur(COULEURS[(list.data?.length ?? 0) % COULEURS.length]!);

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
          <label className="block sm:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">
              Email du partenaire (reçoit le bilan et les photos à l&apos;archivage du chantier)
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
              placeholder="contact@pure-energie.fr"
            />
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">
              Délai de paiement convenu (jours)
            </span>
            <input
              inputMode="numeric"
              value={delai}
              onChange={(e) => setDelai(e.target.value)}
              className={INPUT}
              placeholder="45"
            />
          </label>
          <div className="sm:col-span-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Fiche de facturation</p>
            <p className="text-xs text-muted-foreground mt-1">
              À compléter avant d&apos;envoyer le lien : ces informations figurent sur les factures de
              sous-traitance (destinataire, adresse de siège, TVA).
            </p>
          </div>
          {(
            [
              ["raison_sociale", "Raison sociale (nom sur la facture)", "PURE ÉNERGIE SAS"],
              ["adresse", "Adresse du siège", "12 rue des Lilas"],
              ["cp_ville", "Code postal et ville", "44000 Nantes"],
              ["siret", "SIRET", "123 456 789 00012"],
              ["tva_intracom", "Numéro de TVA", "FR12345678900"],
              ["contact_nom", "Personne de contact", "Marie Dupont"],
              ["telephone", "Téléphone", "02 40 00 00 00"],
            ] as const
          ).map(([cle, label, ph]) => (
            <label className="block" key={cle}>
              <span className="text-mono text-xs text-muted-foreground">{label}</span>
              <input
                value={fiche[cle]}
                onChange={(e) => setFiche((f) => ({ ...f, [cle]: e.target.value }))}
                className={INPUT}
                placeholder={ph}
              />
            </label>
          ))}
          <div className="sm:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">
              Couleur du partenaire (repère sur la carte et le planning)
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {COULEURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => setCouleur(c)}
                  style={{ background: c }}
                  className={`h-9 w-9 rounded-full border-2 transition ${
                    couleur === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
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
                      <p className="font-medium inline-flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
                          style={{ background: p.couleur ?? "#0284c7" }}
                        />
                        {p.nom}
                        <span className="text-muted-foreground font-normal text-sm">
                          — {p.dossiers} dossier{p.dossiers > 1 ? "s" : ""}
                        </span>
                      </p>
                      {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.email ? `Email : ${p.email}` : "Aucun email — pas de bilan envoyé"}{" "}
                        <button
                          type="button"
                          onClick={async () => {
                            const saisie = window.prompt(
                              `Email de ${p.nom} pour recevoir le bilan de chantier :`,
                              p.email ?? "",
                            );
                            if (saisie === null) return;
                            try {
                              await save({
                                data: { ...base(p), email: saisie.trim() || null },
                              });
                              await list.refetch();
                            } catch (e) {
                              window.alert(
                                e instanceof Error ? e.message : "Enregistrement impossible.",
                              );
                            }
                          }}
                          className="underline hover:text-primary"
                        >
                          modifier
                        </button>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Paiement à {p.delai_paiement_jours ?? 30} jours après la fin du chantier{" "}
                        <button
                          type="button"
                          onClick={async () => {
                            const saisie = window.prompt(
                              `Délai de paiement convenu avec ${p.nom} (en jours) :`,
                              String(p.delai_paiement_jours ?? 30),
                            );
                            if (saisie === null) return;
                            try {
                              await save({
                                data: { ...base(p), delai_paiement_jours: saisie.trim() || 30 },
                              });
                              await list.refetch();
                            } catch (e) {
                              window.alert(
                                e instanceof Error ? e.message : "Enregistrement impossible.",
                              );
                            }
                          }}
                          className="underline hover:text-primary"
                        >
                          modifier
                        </button>
                      </p>
                      <p className="text-xs mt-1">
                        {p.adresse ? (
                          <span className="text-muted-foreground">
                            {p.raison_sociale || p.nom} · {p.adresse} {p.cp_ville ?? ""}
                            {p.tva_intracom ? ` · TVA ${p.tva_intracom}` : ""}
                            {p.siret ? ` · SIRET ${p.siret}` : ""}
                          </span>
                        ) : (
                          <span className="text-destructive">
                            Fiche de facturation incomplète — adresse de siège manquante
                          </span>
                        )}{" "}
                        <button
                          type="button"
                          onClick={() => setEditionId(editionId === p.id ? null : p.id)}
                          className="underline hover:text-primary text-muted-foreground"
                        >
                          {editionId === p.id ? "fermer" : "modifier la fiche"}
                        </button>
                      </p>

                      {editionId === p.id && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            try {
                              await save({
                                data: {
                                  ...base(p),
                                  raison_sociale: String(fd.get("raison_sociale") ?? ""),
                                  adresse: String(fd.get("adresse") ?? ""),
                                  cp_ville: String(fd.get("cp_ville") ?? ""),
                                  siret: String(fd.get("siret") ?? ""),
                                  tva_intracom: String(fd.get("tva_intracom") ?? ""),
                                  contact_nom: String(fd.get("contact_nom") ?? ""),
                                  telephone: String(fd.get("telephone") ?? ""),
                                },
                              });
                              setEditionId(null);
                              await list.refetch();
                            } catch (err) {
                              window.alert(
                                err instanceof Error ? err.message : "Enregistrement impossible.",
                              );
                            }
                          }}
                          className="mt-3 grid gap-2 sm:grid-cols-2 border-t border-border pt-3"
                        >
                          {(
                            [
                              ["raison_sociale", "Raison sociale", p.raison_sociale],
                              ["adresse", "Adresse du siège", p.adresse],
                              ["cp_ville", "Code postal et ville", p.cp_ville],
                              ["siret", "SIRET", p.siret],
                              ["tva_intracom", "Numéro de TVA", p.tva_intracom],
                              ["contact_nom", "Personne de contact", p.contact_nom],
                              ["telephone", "Téléphone", p.telephone],
                            ] as const
                          ).map(([cle, label, valeur]) => (
                            <label className="block" key={cle}>
                              <span className="text-mono text-[11px] text-muted-foreground">
                                {label}
                              </span>
                              <input name={cle} defaultValue={valeur ?? ""} className={INPUT} />
                            </label>
                          ))}
                          <div className="sm:col-span-2">
                            <button
                              type="submit"
                              className="bg-primary text-primary-foreground rounded-sm px-3 py-2 text-xs font-semibold min-h-10"
                            >
                              Enregistrer la fiche
                            </button>
                          </div>
                        </form>
                      )}

                      <p className="text-[11px] text-mono mt-2 break-all text-muted-foreground">
                        {lien(p.token)}
                      </p>
                      <p className="text-[11px] text-mono mt-1">
                        {p.pin_defini_at ? (
                          <span className="text-primary">
                            Code à 6 chiffres actif
                            {p.dernier_acces_at
                              ? ` · dernier accès ${new Date(p.dernier_acces_at).toLocaleDateString("fr-FR")}`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            Code non créé — le partenaire le choisira à sa première visite
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Réinitialiser le code de ${p.nom} ? Il choisira un nouveau code à sa prochaine visite (le lien ne change pas).`,
                              )
                            )
                              return;
                            await resetPin({ data: { id: p.id } });
                            await list.refetch();
                          }}
                          className="text-mono text-xs font-semibold px-3 py-2 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          Réinitialiser le code
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Générer un nouveau lien pour ${p.nom} ? L'ancien lien et son code cessent immédiatement de fonctionner.`,
                              )
                            )
                              return;
                            await nouveauLien({ data: { id: p.id } });
                            await list.refetch();
                          }}
                          className="text-mono text-xs font-semibold px-3 py-2 rounded-sm border border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                        >
                          Nouveau lien
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {COULEURS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Couleur ${c} pour ${p.nom}`}
                            onClick={async () => {
                              await save({
                                data: { ...base(p), couleur: c },
                              });
                              await list.refetch();
                            }}
                            style={{ background: c }}
                            className={`h-6 w-6 rounded-full border-2 ${
                              (p.couleur ?? "") === c ? "border-foreground" : "border-transparent"
                            }`}
                          />
                        ))}
                      </div>
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
                          await save({
                            data: { ...base(p), actif: !p.actif },

                          });

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
