/** Villes desservies (Bretagne + Pays de la Loire) pour les pages locales du site. */
export interface VilleZone {
  slug: string;
  nom: string;
  departement: string;
  numero: string;
  region: "Bretagne" | "Pays de la Loire";
  communes: string[];
}

export const VILLES_ZONE: VilleZone[] = [
  { slug: "rennes", nom: "Rennes", departement: "Ille-et-Vilaine", numero: "35", region: "Bretagne", communes: ["Cesson-Sévigné", "Saint-Grégoire", "Bruz", "Pacé", "Chantepie", "Vern-sur-Seiche"] },
  { slug: "saint-malo", nom: "Saint-Malo", departement: "Ille-et-Vilaine", numero: "35", region: "Bretagne", communes: ["Dinard", "Cancale", "Saint-Jouan-des-Guérets", "Dinan", "Combourg"] },
  { slug: "brest", nom: "Brest", departement: "Finistère", numero: "29", region: "Bretagne", communes: ["Guipavas", "Plougastel-Daoulas", "Le Relecq-Kerhuon", "Gouesnou", "Landerneau"] },
  { slug: "quimper", nom: "Quimper", departement: "Finistère", numero: "29", region: "Bretagne", communes: ["Ergué-Gabéric", "Concarneau", "Douarnenez", "Pont-l'Abbé", "Fouesnant"] },
  { slug: "lorient", nom: "Lorient", departement: "Morbihan", numero: "56", region: "Bretagne", communes: ["Lanester", "Ploemeur", "Larmor-Plage", "Hennebont", "Quimperlé"] },
  { slug: "vannes", nom: "Vannes", departement: "Morbihan", numero: "56", region: "Bretagne", communes: ["Séné", "Theix-Noyalo", "Saint-Avé", "Auray", "Ploërmel"] },
  { slug: "saint-brieuc", nom: "Saint-Brieuc", departement: "Côtes-d'Armor", numero: "22", region: "Bretagne", communes: ["Plérin", "Ploufragan", "Langueux", "Lamballe", "Guingamp"] },
  { slug: "saint-nazaire", nom: "Saint-Nazaire", departement: "Loire-Atlantique", numero: "44", region: "Pays de la Loire", communes: ["Pornichet", "La Baule-Escoublac", "Trignac", "Montoir-de-Bretagne", "Guérande"] },
  { slug: "angers", nom: "Angers", departement: "Maine-et-Loire", numero: "49", region: "Pays de la Loire", communes: ["Avrillé", "Trélazé", "Les Ponts-de-Cé", "Beaucouzé", "Saint-Barthélemy-d'Anjou"] },
  { slug: "cholet", nom: "Cholet", departement: "Maine-et-Loire", numero: "49", region: "Pays de la Loire", communes: ["Saint-Léger-sous-Cholet", "Mauléon", "Beaupréau-en-Mauges", "Chemillé-en-Anjou"] },
  { slug: "le-mans", nom: "Le Mans", departement: "Sarthe", numero: "72", region: "Pays de la Loire", communes: ["Allonnes", "Coulaines", "Sargé-lès-le-Mans", "Changé", "Arnage"] },
  { slug: "laval", nom: "Laval", departement: "Mayenne", numero: "53", region: "Pays de la Loire", communes: ["Changé", "Bonchamp-lès-Laval", "Saint-Berthevin", "Château-Gontier", "Mayenne"] },
  { slug: "la-roche-sur-yon", nom: "La Roche-sur-Yon", departement: "Vendée", numero: "85", region: "Pays de la Loire", communes: ["Mouilleron-le-Captif", "La Ferrière", "Aizenay", "Les Herbiers", "Challans"] },
  { slug: "les-sables-d-olonne", nom: "Les Sables-d'Olonne", departement: "Vendée", numero: "85", region: "Pays de la Loire", communes: ["Talmont-Saint-Hilaire", "Saint-Gilles-Croix-de-Vie", "Brem-sur-Mer", "Olonne-sur-Mer"] },
];

export function trouverVille(slug: string): VilleZone | undefined {
  return VILLES_ZONE.find((v) => v.slug === slug);
}
