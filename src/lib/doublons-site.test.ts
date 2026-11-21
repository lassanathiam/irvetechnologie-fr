import { describe, expect, it } from "bun:test";
import { actionChantier, actionDevis, actionFacture, memeChantier, memeDevis, memeFacture, memePartenaire, pairesChantiers, pairesFactures, type ChantierDoublon, type FactureDoublon } from "./doublons-site";

const ch = (id: string, extra: Partial<ChantierDoublon> = {}): ChantierDoublon => ({ id, client_nom: "DUPONT Jean", adresse: "12 rue des Lilas", client_telephone: "0612345678", cp_ville: "44000 Nantes", statut: "planifie", date_debut: "2026-11-10", termine_at: null, created_at: `2026-11-0${id === "a" ? 1 : 2}`, ...extra });
const fa = (id: string, extra: Partial<FactureDoublon> = {}): FactureDoublon => ({ id, numero: id, client_nom: "ENSIO", objet: "Pose SAGE Pierre", total_ht: 150, statut: "envoyee", sent_at: "2026-11-01", paid_at: null, depose_at: null, attachement_id: null, bon_commande: null, date_emission: "2026-11-01", created_at: id, attachements: [], chantiers: [], ...extra });

describe("doublons de chantiers", () => {
  it("même client et même période = doublon ; visite de retour 3 mois plus tard = pas un doublon", () => {
    expect(memeChantier(ch("a"), ch("b"))).toBe(true);
    expect(memeChantier(ch("a"), ch("b", { date_debut: "2027-02-20" }))).toBe(false);
    expect(memeChantier(ch("a"), ch("b", { statut: "annule" }))).toBe(false);
  });
  it("garde celui qui a un attachement et interdit de supprimer un chantier relié", () => {
    const vide = { attachements: 0, devis: 0, photos: 0, fiches: 0, rapports: 0, autres: 0 };
    const p = pairesChantiers([ch("a", { liens: vide }), ch("b", { liens: { ...vide, attachements: 1 } })]);
    expect(p[0]!.garder.id).toBe("b");
    expect(actionChantier(p[0]!.doublon)).toBe("supprimer");
    expect(actionChantier(ch("c", { liens: { ...vide, photos: 3 } }))).toBeNull();
  });
});

describe("doublons de factures", () => {
  it("deux factures du même chantier chez le même client sont un doublon", () => {
    expect(memeFacture(fa("F1", { chantiers: ["r1"], objet: "a" }), fa("F2", { chantiers: ["r1"], objet: "b" }))).toBe(true);
    expect(memeFacture(fa("F1", { chantiers: ["r1"] }), fa("F2", { chantiers: ["r2"], total_ht: 120 }))).toBe(false);
    expect(memeFacture(fa("F1"), fa("F2", { statut: "annulee" }))).toBe(false);
  });
  it("deux commandes différentes au même montant ne sont pas un doublon (factures fibre récurrentes)", () => {
    expect(memeFacture(fa("F1", { client_nom: "INFRATEL SERVICES", objet: "Travaux fibre optique", total_ht: 488.88, bon_commande: "913228835" }), fa("F2", { client_nom: "INFRATEL SERVICES", objet: "Travaux fibre optique", total_ht: 488.88, bon_commande: "913195428" }))).toBe(false);
    expect(memeFacture(fa("F1", { bon_commande: "CST 02048734" }), fa("F2", { bon_commande: "CST02048734", objet: "autre" }))).toBe(true);
  });
  it("la facture d'un TS n'est pas un doublon de la facture initiale du même chantier", () => {
    expect(memeFacture(fa("F1", { chantiers: ["r1"] }), fa("F2", { chantiers: ["r1"], ts: true, objet: "TS" }))).toBe(false);
  });
  it("garde celle qui porte la commande", () => {
    const p = pairesFactures([fa("F1", { chantiers: ["r1"] }), fa("F2", { chantiers: ["r1"], bon_commande: "CST 02048734" })]);
    expect(p[0]!.garder.id).toBe("F2");
  });
  it("brouillon jamais envoyé = suppression ; émise = annulation ; payée = rien", () => {
    expect(actionFacture(fa("F", { statut: "brouillon", sent_at: null }))).toBe("supprimer");
    expect(actionFacture(fa("F"))).toBe("annuler");
    expect(actionFacture(fa("F", { statut: "payee", paid_at: "2026-11-20" }))).toBeNull();
  });
});

describe("doublons de devis", () => {
  const d = (id: string, extra = {}) => ({ id, numero: id, client_nom: "Mme Martin Claire", objet: "Borne 7 kW", total_ttc: 1800, statut: "envoye", sent_at: null, signed_at: null, facture_id: null, date_emission: null, ...extra });
  it("même client, même objet, même montant = doublon ; un devis signé n'est jamais supprimé", () => {
    expect(memeDevis(d("a"), d("b", { client_nom: "MARTIN Claire" }))).toBe(true);
    expect(memeDevis(d("a"), d("b", { total_ttc: 1900 }))).toBe(false);
    expect(actionDevis(d("a", { signed_at: "2026-11-01" }))).toBeNull();
    expect(actionDevis(d("a"))).toBe("supprimer");
  });
});

describe("doublons de fiches partenaires", () => {
  const p = (id: string, nom: string, type = "donneur_ordre") => ({ id, nom, type, actif: true, email: null });
  it("reconnaît PURE ENERDIES / PURENERGIES / PURE ÉNERGIES et INFRATEL SERVICES SAS", () => {
    expect(memePartenaire(p("a", "PURE ENERDIES"), p("b", "PURENERGIES"))).toBe(true);
    expect(memePartenaire(p("a", "PURE ÉNERGIES"), p("b", "PURENERGIES"))).toBe(true);
    expect(memePartenaire(p("a", "INFRATEL SERVICES"), p("b", "Infratel Services SAS"))).toBe(true);
  });
  it("ne confond pas deux noms différents ni deux types de fiche", () => {
    expect(memePartenaire(p("a", "ENSIO"), p("b", "AXIANS"))).toBe(false);
    expect(memePartenaire(p("a", "AXIANS"), p("b", "AXIANS", "sous_traitant"))).toBe(false);
  });
});

describe("doublons de fiches clients", () => {
  it("fusion : la fiche gardée récupère le SIRET du doublon sans perdre ses propres valeurs", async () => {
    const { completerClient, pairesClients } = await import("./doublons-site");
    const a = { id: "a", nom: "INFRATEL SERVICES", actif: true, siret: "338 170 046", raison_sociale: "INFRATEL SERVICES", created_at: "1" };
    const b = { id: "b", nom: "INFRATEL SERVICES", actif: true, siret: null, raison_sociale: "INFRATEL SERVICES", adresse: "1 rue X", created_at: "2" };
    const p = pairesClients([a, b]);
    expect(p.length).toBe(1);
    expect(completerClient(b, a)).toEqual({ siret: "338 170 046" });
    expect(completerClient(a, b)).toEqual({ adresse: "1 rue X" });
  });
});
