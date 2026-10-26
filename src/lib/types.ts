// Forme de public/data/dashboard.json, produit par pipeline/run.py.

export type Statut = "part" | "pro";
export type Serie = Record<Statut, number[]>;
export type Famille = "essence" | "diesel" | "elec" | "autre" | "essence_ca1";

export interface Commune {
  code: string;
  nom: string;
  population: number;
  surface_km2: number;
  densite: number;
  centre: [number, number];
  stations: number;
  motos_10ans: number;
  canne_ha: number;
}

export interface Station {
  id: number;
  lat: number;
  lon: number;
  commune: string;
  qualite: string | null;
  dist_rn_km: number;
  tmja_proche: number;
}

export interface SectionRN {
  route: string;
  tmja: number;
  coords: [number, number][];
}

export interface Source {
  label: string;
  producer: string;
  licence: string;
  page: string;
  lignes: number;
  recupere_le: string | null;
  millesime?: string | number | null;
}

export interface Dashboard {
  genere_le: string;
  communes: Record<string, Commune>;
  geo: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { code: string; nom: string }>;
  parc: { annees: number[]; par_commune: Record<string, Record<Famille, Serie>> };
  immat: { annees: number[]; series: Record<"essence" | "diesel" | "elec" | "autre" | "moto" | "cyclo", number[]>; periode_motos: string };
  conso: Record<string, { annees: number[]; essence_m3: number[]; gazole_m3: number[] }>;
  stations: Station[];
  tmja: { annee: number; sections: SectionRN[]; tendance: { annee: number; tmja_moyen: number }[] };
  canne: { parcelles: number; surface_ha: number; pas_maille_deg: number; par_commune: Record<string, number>; mailles: { lat: number; lon: number; ha: number }[] };
  sucrerie: { nom: string; type: "usine" | "balance"; lat: number; lon: number }[];
  campagnes: { annee: number; tonnes: number; richesse: number | null; source: string }[];
  prix: { mois: string; produit: string; prix: number; source: string; verifie: boolean }[];
  sources: Record<string, Source>;
}
