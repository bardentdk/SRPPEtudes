// Les 24 communes de La Réunion (nom → code INSEE), pour le questionnaire et sa validation côté serveur.
export const COMMUNES: Record<string, string> = {
  "Bras-Panon": "97402",
  "Cilaos": "97424",
  "Entre-Deux": "97403",
  "L'Étang-Salé": "97404",
  "La Plaine-des-Palmistes": "97406",
  "La Possession": "97408",
  "Le Port": "97407",
  "Le Tampon": "97422",
  "Les Avirons": "97401",
  "Les Trois-Bassins": "97423",
  "Petite-Île": "97405",
  "Saint-André": "97409",
  "Saint-Benoît": "97410",
  "Saint-Denis": "97411",
  "Saint-Joseph": "97412",
  "Saint-Leu": "97413",
  "Saint-Louis": "97414",
  "Saint-Paul": "97415",
  "Saint-Philippe": "97417",
  "Saint-Pierre": "97416",
  "Sainte-Marie": "97418",
  "Sainte-Rose": "97419",
  "Sainte-Suzanne": "97420",
  "Salazie": "97421",
};

export const NOMS_COMMUNES = Object.keys(COMMUNES);
