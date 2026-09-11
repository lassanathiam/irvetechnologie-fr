import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanySeal } from "./CompanySeal";
import { DocumentPrint } from "./DocumentPrint";

describe("document seal rendering", () => {
  it("affiche le visuel numérique combiné cachet + signature", () => {
    const html = renderToStaticMarkup(<CompanySeal />);
    expect(html).toContain("/cachet-signature-irve.svg");
  });

  it("injecte le cachet entreprise dans un devis imprimable", () => {
    const html = renderToStaticMarkup(
      <DocumentPrint
        type="devis"
        doc={{
          numero: "D-2026-001",
          date_emission: "2026-09-11",
          date_limite: "2026-10-11",
          client_nom: "Client test",
          remise_pct: 0,
        }}
        items={[
          {
            libelle: "Pose borne",
            quantite: 1,
            prix_unitaire: 500,
            tva: 20,
          },
        ]}
      />,
    );
    expect(html).toContain("/cachet-signature-irve.svg");
    expect(html).toContain("Cachet et signature numériques");
  });
});
