// Éléments de carte partagés, sans dépendance à Leaflet (importable côté serveur).

export interface Couches {
  communes: boolean;
  stations: boolean;
  trafic: boolean;
  canne: boolean;
  sucrerie: boolean;
}

export interface StationClassee {
  id: number; lat: number; lon: number; nom: string; score: number; tmja_proche: number; dist_rn_km: number;
}

// Rampe séquentielle bleue (étapes 100 → 600), classes par quantiles.
export const RAMPE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"];

export function seuils(values: number[], classes = RAMPE.length) {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: classes - 1 }, (_, i) => sorted[Math.floor(((i + 1) / classes) * sorted.length)]);
}

export function couleur(v: number, s: number[]) {
  const i = s.findIndex((t) => v < t);
  return RAMPE[i === -1 ? RAMPE.length - 1 : i];
}
