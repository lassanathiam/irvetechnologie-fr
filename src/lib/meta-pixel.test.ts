import { describe, expect, it } from "bun:test";

// Faux navigateur minimal : on observe ce qui serait envoyé à Meta.
const appels: unknown[][] = [];
(globalThis as unknown as { window: unknown }).window = {
  fbq: (...args: unknown[]) => appels.push(args),
};
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({}),
  head: { appendChild: () => {} },
};

const { appliquerPixelMeta, pixelMetaDemande } = await import("./meta-pixel");

describe("pixel Meta et accord publicité", () => {
  it("n'envoie aucune demande sans accord publicité", () => {
    appliquerPixelMeta(false);
    pixelMetaDemande("abc");
    expect(appels.some((a) => a[0] === "track")).toBe(false);
  });

  it("envoie la demande avec son identifiant après accord", () => {
    appliquerPixelMeta(true);
    pixelMetaDemande("abc");
    expect(appels).toContainEqual(["track", "Lead", {}, { eventID: "demande-abc" }]);
  });

  it("coupe l'envoi quand l'accord est retiré", () => {
    appliquerPixelMeta(false);
    const avant = appels.length;
    pixelMetaDemande("def");
    expect(appels.slice(avant).some((a) => a[0] === "track")).toBe(false);
    expect(appels).toContainEqual(["consent", "revoke"]);
  });
});
