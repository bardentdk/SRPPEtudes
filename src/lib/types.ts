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
  menages: number | null;
  part_motorises: number | null;
  part_multi: number | null;
  niveau_vie_median: number | null;
  taux_pauvrete: number | null;
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

export type Public = "part" | "pro" | "club" | "station" | "filiere";
/** Un palier de prix (surcoût SP98 ou prix E85) : parts des réponses « à chaque fois », « parfois », « non ». */
export interface PalierPrix { valeur: number; chaque: number; parfois: number; non: number }
export interface CourbePrix {
  global: PalierPrix[] | null;
  part_pondere: PalierPrix[] | null;
  par_public: Record<"part" | "pro" | "club", PalierPrix[] | null>;
}
type Comptes = Record<string, number>;

/** Agrégats du questionnaire (pipeline/questionnaire.py). Les répartitions sous seuil_k répondants valent null ou sont absentes. */
export type Questionnaire =
  | { disponible: false }
  | {
      disponible: true;
      seuil_k: number;
      reponses: number;
      derniere_reponse?: string | null;
      profils?: Comptes;
      publics?: Record<Public, number>;
      par_commune?: Record<string, number>;
      prix_sp98?: CourbePrix;
      prix_e85?: CourbePrix;
      eligibilite?: {
        part_sp98_uniquement: number | null;
        part_sp98_possible: number | null;
        pros_part98_mediane: number | null;
        litres_mois_moyen: number | null;
      };
      problemes?: Comptes;
      zones?: Comptes;
      engagement?: Comptes;
      e85?: {
        connaissance: Comptes; compat_part: Comptes; budget_boitier: Comptes; flex_pro: Comptes; boitiers_pro: Comptes;
        local_moyenne: number | null; local_n: number;
      };
      stations?: {
        n: number; volume_m3_median?: number | null; demande98?: Comptes; cuve?: Comptes;
        investissement_median?: number | null; marge_mediane?: number | null; carburants?: Comptes; contraintes?: Comptes;
      };
      filiere?: {
        n: number; types?: Comptes; paille?: Comptes; prix_paille_median?: number | null; melasse?: Comptes;
        prix_melasse_median?: number | null; roles?: Comptes; sites?: Comptes;
      };
    };

export interface Dashboard {
  genere_le: string;
  communes: Record<string, Commune>;
  geo: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { code: string; nom: string }>;
  contour: [number, number][][];
  parc: { annees: number[]; par_commune: Record<string, Record<Famille, Serie>> };
  immat: { annees: number[]; series: Record<"essence" | "diesel" | "elec" | "autre" | "moto" | "cyclo", number[]>; periode_motos: string };
  conso: Record<string, { annees: number[]; essence_m3: number[]; gazole_m3: number[] }>;
  stations: Station[];
  tmja: { annee: number; sections: SectionRN[]; tendance: { annee: number; tmja_moyen: number }[] };
  canne: { parcelles: number; surface_ha: number; pas_maille_deg: number; par_commune: Record<string, number>; mailles: { lat: number; lon: number; ha: number }[] };
  sucrerie: { nom: string; type: "usine" | "balance"; lat: number; lon: number }[];
  campagnes: { annee: number; tonnes: number; richesse: number | null; source: string }[];
  prix: { mois: string; produit: string; prix: number; source: string; verifie: boolean }[];
  questionnaire?: Questionnaire;
  sources: Record<string, Source>;
}
