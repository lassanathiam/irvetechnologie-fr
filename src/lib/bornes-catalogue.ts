import borneHager from "@/assets/borne-hager.png";
import borneSchneider from "@/assets/borne-schneider.png";
import borneWallbox from "@/assets/borne-wallbox.png";
import borneTesla from "@/assets/borne-tesla.png";
import borneLegrand from "@/assets/borne-legrand.png";
import borneEvbox from "@/assets/borne-evbox.png";

export type BorneCatalogue = {
  id: string;
  nom: string;
  img: string;
  /** Puissance affichée, alignée sur PUISSANCES_BORNE. */
  puissance: "3,7 kW" | "7,4 kW" | "11 kW" | "22 kW";
  phase: "Monophasé" | "Triphasé";
  /** Petit atout affiché sous la borne. */
  atout: string;
  badge?: string;
};

export const BORNES_CATALOGUE: BorneCatalogue[] = [
  {
    id: "hager-witty",
    nom: "Hager Witty",
    img: borneHager,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Contrôle d'accès",
  },
  {
    id: "hager-witty-park",
    nom: "Hager Witty Park",
    img: borneHager,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Copropriété & parking",
  },
  {
    id: "schneider-charge",
    nom: "Schneider Charge",
    img: borneSchneider,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Évolutive, pilotage Linky",
    badge: "Le plus choisi",
  },
  {
    id: "schneider-evlink-pro",
    nom: "Schneider EVlink Pro",
    img: borneSchneider,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Usage professionnel",
  },
  {
    id: "wallbox-pulsar",
    nom: "Wallbox Pulsar Plus",
    img: borneWallbox,
    puissance: "11 kW",
    phase: "Triphasé",
    atout: "Compacte, pilotable",
  },
  {
    id: "tesla-wall-connector",
    nom: "Tesla Wall Connector",
    img: borneTesla,
    puissance: "11 kW",
    phase: "Triphasé",
    atout: "Câble intégré 7 m",
  },
  {
    id: "legrand-greenup",
    nom: "Legrand Green'up Premium",
    img: borneLegrand,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Fabrication française",
  },
  {
    id: "evbox-elvi",
    nom: "EVBox Elvi",
    img: borneEvbox,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Modulable, extérieur",
  },
];

export function trouverBorne(id: string | undefined | null): BorneCatalogue | null {
  if (!id) return null;
  return BORNES_CATALOGUE.find((b) => b.id === id) ?? null;
}
