import { describe, expect, it } from "bun:test";
import { clientFinalAttachement, titreAttachement } from "./attachement-titre";

describe("clientFinalAttachement", () => {
  it("lit le client final sur un attachement initial de la semaine", () => {
    expect(clientFinalAttachement({ objet: "Semaine 42 (12/10/2026 au 18/10/2026) — LEBORGNE Bruno" })).toBe("LEBORGNE Bruno");
  });

  it("lit le client final sur un document TS séparé", () => {
    expect(clientFinalAttachement({ objet: "TS · Travaux supplémentaires — AT-2026-0026 — Semaine 42 (12/10/2026 au 18/10/2026) — KERSBERT Christophe" })).toBe("KERSBERT Christophe");
  });

  it("ne sort pas la plage de dates quand l'objet ne contient aucun client", () => {
    expect(clientFinalAttachement({ objet: "Attachement semaine 42 — du 12/10/2026 au 18/10/2026" })).toBeNull();
  });

  it("ne sort pas le numéro de l'attachement initial quand le client est inconnu", () => {
    expect(clientFinalAttachement({ objet: "TS · Travaux supplémentaires — AT-2026-0074 — Semaine 42 (12/10/2026 au 18/10/2026)" })).toBeNull();
  });

  it("reste muet sur un objet hors semaine", () => {
    expect(clientFinalAttachement({ objet: "Pose de bornes de recharge" })).toBeNull();
    expect(clientFinalAttachement({ objet: null })).toBeNull();
  });

  it("affiche le client dans le titre de la liste", () => {
    expect(titreAttachement({ numero: "AT-2026-0077", objet: "TS · Travaux supplémentaires — AT-2026-0026 — Semaine 42 (12/10/2026 au 18/10/2026) — KERSBERT Christophe" })).toBe("AT-2026-0077 — KERSBERT Christophe");
    expect(titreAttachement({ numero: "AT-2026-0074", objet: "Pose de bornes de recharge" })).toBe("AT-2026-0074");
  });
});
