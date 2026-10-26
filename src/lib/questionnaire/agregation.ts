// Agrégation des réponses au questionnaire pour le tableau de bord public.
// Sortie : uniquement des comptages, des parts et des médianes. Toute répartition calculée sur
// moins de SEUIL_K répondants est masquée (null), pour qu'un répondant ne soit pas reconnaissable.

import type { CourbePrix, PalierPrix, Public, Questionnaire } from "../types";
import { QUESTIONS, type Reponses } from "./schema";

export const SEUIL_K = 3;
const PUBLICS: Public[] = ["part", "pro", "club", "station", "filiere"];
const ACHETEURS = ["part", "pro", "club"] as const;
const PALIERS_SP98 = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4];
const PALIERS_E85 = [0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];

export interface LigneReponse {
  public: Public;
  profil: string;
  commune_code: string | null;
  cree_le: string;
  donnees: Reponses;
}

type Comptes = Record<string, number>;

const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const nombres = (lignes: LigneReponse[], id: string) => lignes.map((l) => nombre(l.donnees[id])).filter((v): v is number => v != null);

function mediane(v: number[]) {
  if (v.length < SEUIL_K) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function moyenne(v: number[]) {
  return v.length >= SEUIL_K ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

function compte(lignes: LigneReponse[], id: string): Comptes {
  const out: Comptes = {};
  for (const l of lignes) {
    const v = l.donnees[id];
    for (const x of Array.isArray(v) ? v : v != null && v !== "" ? [String(v)] : []) out[x] = (out[x] ?? 0) + 1;
  }
  return out;
}

/** Comptes par tranche pour une valeur numérique : [libellé, borne haute exclue]. */
function tranches(lignes: LigneReponse[], id: string, bornes: [string, number][]): Comptes {
  const out: Comptes = {};
  for (const v of nombres(lignes, id)) {
    const t = bornes.find(([, max]) => v < max)?.[0] ?? bornes[bornes.length - 1][0];
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

/** Courbe de demande : pour chaque palier, part prête à payer au moins ce prix
 *  « à chaque fois » (chaque) ou seulement « de temps en temps » (parfois). */
function courbe(lignes: LigneReponse[], paliers: number[], idChaque: string, idParfois: string | null, poids?: (l: LigneReponse) => number): PalierPrix[] | null {
  const valides = lignes.filter((l) => nombre(l.donnees[idChaque]) != null);
  if (valides.length < SEUIL_K) return null;
  const w = (l: LigneReponse) => (poids ? poids(l) : 1);
  const total = valides.reduce((a, l) => a + w(l), 0) || 1;
  return paliers.map((p) => {
    let chaque = 0, parfois = 0;
    for (const l of valides) {
      if ((nombre(l.donnees[idChaque]) ?? -1) >= p - 1e-9) chaque += w(l);
      else if (idParfois && (nombre(l.donnees[idParfois]) ?? -1) >= p - 1e-9) parfois += w(l);
    }
    const r = (x: number) => Math.round((x / total) * 1000) / 1000;
    return { valeur: p, chaque: r(chaque), parfois: r(parfois), non: r(total - chaque - parfois) };
  });
}

function fusion(courbes: [PalierPrix[] | null, number][]): PalierPrix[] | null {
  const ok = courbes.filter((c): c is [PalierPrix[], number] => c[0] != null);
  if (!ok.length) return null;
  const total = ok.reduce((a, [, n]) => a + n, 0);
  const moy = (i: number, k: "chaque" | "parfois" | "non") => Math.round((ok.reduce((a, [c, n]) => a + c[i][k] * n, 0) / total) * 1000) / 1000;
  return ok[0][0].map((p, i) => ({ valeur: p.valeur, chaque: moy(i, "chaque"), parfois: moy(i, "parfois"), non: moy(i, "non") }));
}

function courbes(par: Record<Public, LigneReponse[]>, paliers: number[], idChaque: string, idParfois: string | null): CourbePrix {
  const parPublic = Object.fromEntries(ACHETEURS.map((p) => [p, courbe(par[p], paliers, idChaque, idParfois)])) as CourbePrix["par_public"];
  return {
    global: fusion(ACHETEURS.map((p) => [parPublic[p], par[p].length])),
    part_pondere: courbe(par.part, paliers, idChaque, idParfois, (l) => nombre(l.donnees.litres_mois) ?? 0),
    par_public: parPublic,
  };
}

const optionsTous = (id: string) => {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q || !("options" in q)) return [];
  return [...new Set([...q.options, ...Object.values(q.optionsPar ?? {}).flat()])];
};

/** Comptes de cases cochées, avec toutes les options (même à zéro) pour des graphiques stables. */
function coches(lignes: LigneReponse[], id: string): Comptes {
  const c = compte(lignes, id);
  return Object.fromEntries(optionsTous(id).map((o) => [o, c[o] ?? 0]));
}

function bloc<T extends object>(lignes: LigneReponse[], contenu: () => T): { n: number } & Partial<T> {
  return { n: lignes.length, ...(lignes.length >= SEUIL_K ? contenu() : ({} as Partial<T>)) };
}

export function agreger(lignes: LigneReponse[]): Questionnaire {
  if (!lignes.length) return { disponible: true, seuil_k: SEUIL_K, reponses: 0 };
  const par = Object.fromEntries(PUBLICS.map((p) => [p, lignes.filter((l) => l.public === p)])) as Record<Public, LigneReponse[]>;
  const acheteurs = ACHETEURS.flatMap((p) => par[p]);
  const commune: Comptes = {};
  for (const l of lignes) if (l.commune_code) commune[l.commune_code] = (commune[l.commune_code] ?? 0) + 1;
  const preco = par.part.map((l) => l.donnees.preconisation);
  const nbPart = par.part.length;
  const part98 = mediane(nombres(par.pro, "part98"));

  return {
    disponible: true,
    seuil_k: SEUIL_K,
    reponses: lignes.length,
    derniere_reponse: lignes.reduce((a, l) => (l.cree_le > a ? l.cree_le : a), lignes[0].cree_le),
    profils: compte(lignes, "profil"),
    publics: Object.fromEntries(PUBLICS.map((p) => [p, par[p].length])) as Record<Public, number>,
    par_commune: commune,
    prix_sp98: courbes(par, PALIERS_SP98, "wtp98_chaque", "wtp98_parfois"),
    prix_e85: courbes(par, PALIERS_E85, "wtpe85", null),
    eligibilite: {
      part_sp98_uniquement: nbPart >= SEUIL_K ? Math.round((preco.filter((v) => v === "SP98 uniquement").length / nbPart) * 1000) / 1000 : null,
      part_sp98_possible: nbPart >= SEUIL_K ? Math.round((preco.filter((v) => v === "SP98 uniquement" || v === "SP95 ou SP98").length / nbPart) * 1000) / 1000 : null,
      pros_part98_mediane: part98 != null ? part98 / 100 : null,
      litres_mois_moyen: moyenne(nombres(par.part, "litres_mois")),
    },
    problemes: coches(acheteurs, "problemes"),
    zones: coches(acheteurs, "zones"),
    engagement: coches(lignes, "engagement"),
    e85: {
      connaissance: compte(acheteurs, "e85_connaissance"),
      compat_part: compte(par.part, "e85_compat"),
      budget_boitier: tranches(par.part, "boitier_budget", [["Aucun", 1], ["Moins de 500 €", 500], ["500 à 999 €", 1000], ["1 000 € ou plus", Infinity]]),
      flex_pro: tranches(par.pro, "flex_stock", [["Aucun", 1], ["1 à 5", 6], ["6 à 20", 21], ["Plus de 20", Infinity]]),
      boitiers_pro: compte(par.pro, "boitiers_pro"),
      local_moyenne: moyenne(nombres(acheteurs, "importance_locale")),
      local_n: nombres(acheteurs, "importance_locale").length,
    },
    stations: bloc(par.station, () => ({
      volume_m3_median: mediane(nombres(par.station, "volume_m3")),
      demande98: compte(par.station, "demande98"),
      cuve: compte(par.station, "cuve"),
      investissement_median: mediane(nombres(par.station, "invest_station")),
      marge_mediane: mediane(nombres(par.station, "marge_attendue")),
      carburants: coches(par.station, "carburants"),
      contraintes: coches(par.station, "contraintes"),
    })),
    filiere: bloc(par.filiere, () => ({
      types: compte(par.filiere, "fi_type"),
      paille: tranches(par.filiere, "fi_paille_part", [["Aucune", 1], ["Moins de 25 %", 25], ["25 à 49 %", 50], ["50 % ou plus", Infinity]]),
      prix_paille_median: mediane(nombres(par.filiere, "fi_prix_paille")),
      melasse: tranches(par.filiere, "fi_melasse_t", [["Aucune", 1], ["Moins de 1 000 t", 1000], ["1 000 à 4 999 t", 5000], ["5 000 t ou plus", Infinity]]),
      prix_melasse_median: mediane(nombres(par.filiere, "fi_prix_melasse")),
      roles: coches(par.filiere, "fi_role"),
      sites: compte(par.filiere, "fi_site"),
    })),
  };
}
