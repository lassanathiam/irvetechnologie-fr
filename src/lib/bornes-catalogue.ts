import borneHager from "@/assets/borne-hager.png";
import borneSchneider from "@/assets/borne-schneider.png";
import borneSchneiderCharge from "@/assets/borne-schneider-charge.png";
import borneWallbox from "@/assets/borne-wallbox.png";
import borneTesla from "@/assets/borne-tesla.png";
import borneLegrand from "@/assets/borne-legrand.png";
import borneEvbox from "@/assets/borne-evbox.png";
import bornePedestal from "@/assets/borne-pedestal.png";
import borneZaptec from "@/assets/borne-zaptec.png";
import borneAlfen from "@/assets/borne-alfen.png";

export type BorneCatalogue = {
  id: string;
  nom: string;
  img: string;
  /** Puissance affichée, alignée sur PUISSANCES_BORNE. */
  puissance: "3,7 kW" | "7,4 kW" | "11 kW" | "22 kW";
  phase: "Monophasé" | "Triphasé";
  /** Petit atout affiché sous la borne. */
  atout: string;
  /** Usage conseillé, affiché sur la page complète. */
  usage: string;
  badge?: string;
  /** Affichée dans le bandeau de la page d'accueil. */
  vedette?: boolean;
};

export const BORNES_CATALOGUE: BorneCatalogue[] = [
  {
    id: "schneider-charge",
    nom: "Schneider Charge",
    img: borneSchneiderCharge,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Évolutive, pilotage Linky",
    usage: "Maison individuelle",
    badge: "Le plus choisi",
    vedette: true,
  },
  {
    id: "hager-witty",
    nom: "Hager Witty",
    img: borneHager,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Écran et contrôle d'accès",
    usage: "Maison, garage fermé",
    vedette: true,
  },
  {
    id: "legrand-greenup",
    nom: "Legrand Green'up Premium",
    img: borneLegrand,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Fabrication française",
    usage: "Maison individuelle",
    vedette: true,
  },
  {
    id: "wallbox-pulsar",
    nom: "Wallbox Pulsar Plus",
    img: borneWallbox,
    puissance: "11 kW",
    phase: "Triphasé",
    atout: "Compacte, câble intégré",
    usage: "Maison, application mobile",
    vedette: true,
  },
  {
    id: "tesla-wall-connector",
    nom: "Tesla Wall Connector",
    img: borneTesla,
    puissance: "11 kW",
    phase: "Triphasé",
    atout: "Câble intégré 7 m",
    usage: "Véhicules Tesla et autres marques",
    vedette: true,
  },
  {
    id: "evbox-elvi",
    nom: "EVBox Elvi",
    img: borneEvbox,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Modulable, usage extérieur",
    usage: "Maison, petite entreprise",
    vedette: true,
  },
  {
    id: "schneider-evlink-pro",
    nom: "Schneider EVlink Pro",
    img: borneSchneider,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Robuste, badge RFID",
    usage: "Entreprise, flotte",
  },
  {
    id: "hager-witty-park",
    nom: "Hager Witty Park",
    img: bornePedestal,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Deux véhicules par borne",
    usage: "Copropriété, parking",
  },
  {
    id: "borne-sur-pied-double",
    nom: "Borne sur pied double",
    img: bornePedestal,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Sans mur porteur",
    usage: "Parking extérieur",
  },
  {
    id: "zaptec-go",
    nom: "Zaptec Go",
    img: borneZaptec,
    puissance: "7,4 kW",
    phase: "Monophasé",
    atout: "Très compacte et discrète",
    usage: "Maison, petit garage",
  },
  {
    id: "alfen-eve",
    nom: "Alfen Eve Single",
    img: borneAlfen,
    puissance: "22 kW",
    phase: "Triphasé",
    atout: "Comptage certifié MID",
    usage: "Entreprise, refacturation",
  },
  {
    id: "prise-renforcee",
    nom: "Prise renforcée Green'up",
    img: borneLegrand,
    puissance: "3,7 kW",
    phase: "Monophasé",
    atout: "Solution la plus économique",
    usage: "Petits rouleurs, dépannage",
  },
];

export const BORNES_VEDETTES = BORNES_CATALOGUE.filter((b) => b.vedette);

export function trouverBorne(id: string | undefined | null): BorneCatalogue | null {
  if (!id) return null;
  return BORNES_CATALOGUE.find((b) => b.id === id) ?? null;
}
