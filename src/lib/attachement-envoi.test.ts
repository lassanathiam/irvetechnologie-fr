import { describe, expect, it } from "bun:test";
import { etatEnvoi, nomsAttachement } from "./attachement-envoi";

describe("etatEnvoi", () => {
  it("brouillon jamais envoyé = pas encore envoyé", () => expect(etatEnvoi({ statut: "brouillon", sent_at: null })).toBe("a_envoyer"));
  it("envoyé sans réponse = en attente", () => expect(etatEnvoi({ statut: "envoye", sent_at: "2026-11-14T10:00:00Z" })).toBe("envoye"));
  it("brouillon marqué envoyé (date d'envoi) = en attente", () => expect(etatEnvoi({ statut: "brouillon", sent_at: "2026-11-14T10:00:00Z" })).toBe("envoye"));
  it("accepté = validé", () => expect(etatEnvoi({ statut: "accepte", sent_at: "2026-11-14T10:00:00Z" })).toBe("valide"));
  it("facture liée = facturé, même si accepté", () => expect(etatEnvoi({ statut: "accepte", facture_id: "f1" })).toBe("facture"));
  it("annulé reste annulé", () => expect(etatEnvoi({ statut: "annule", sent_at: "2026-11-14T10:00:00Z" })).toBe("annule"));
});

describe("nomsAttachement", () => {
  it("affiche le nom du chantier quand l'objet ne porte que des dates", () =>
    expect(nomsAttachement({ numero: "AT-2026-0083", objet: "Attachement semaine 47 — du 16/11/2026 au 22/11/2026", chantiers: [{ client_nom: "BOCLAUD Véronique" }] })).toBe("BOCLAUD Véronique"));
  it("retombe sur le nom écrit dans l'objet", () =>
    expect(nomsAttachement({ numero: "AT-2026-0080", objet: "Semaine 45 (02/11/2026 au 08/11/2026) — MALANDAIN Simon" })).toBe("MALANDAIN Simon"));
  it("sinon le numéro", () => expect(nomsAttachement({ numero: "AT-2026-0090", objet: "Attachement semaine 47 — du 16/11/2026 au 22/11/2026" })).toBe("AT-2026-0090"));
});
