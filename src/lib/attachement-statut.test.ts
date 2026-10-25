import { describe, expect, it } from "bun:test";
import { blocageAnnulation } from "./attachement-statut";

describe("blocageAnnulation", () => {
  it("autorise l'annulation d'un brouillon jamais envoyé", () => {
    expect(blocageAnnulation({ facture_id: null, sent_at: null })).toEqual(null);
  });
  it("bloque l'annulation d'un attachement déjà envoyé", () => {
    expect(blocageAnnulation({ facture_id: null, sent_at: "2026-10-25T16:49:40Z" })).toEqual(
      "Cet attachement a déjà été envoyé au client : il ne peut pas être annulé. Modifiez-le puis renvoyez-le.",
    );
  });
  it("bloque l'annulation d'un attachement déjà facturé", () => {
    expect(blocageAnnulation({ facture_id: "f1", sent_at: "2026-10-25T16:49:40Z" })).toEqual(
      "Cet attachement est déjà facturé : annulez plutôt la facture.",
    );
  });
});
