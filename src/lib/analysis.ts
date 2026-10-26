import type { Commune, Dashboard, Famille, Station } from "./types";
import { COUT_SP_HT, E85, LOGISTIQUE_E85, SP98, TVA_DOM, type Valeurs } from "./hypotheses";

export type FiltreStatut = "tous" | "part" | "pro";

export const INDICATEURS = {
  densite: { label: "Densité de population", unite: "hab./km²" },
  population: { label: "Population", unite: "hab." },
  vp_essence: { label: "VP essence", unite: "véhicules" },
  vp_essence_1000: { label: "VP essence pour 1 000 hab.", unite: "‰" },
  part_essence: { label: "Part de l'essence dans le parc VP", unite: "%" },
  vp_essence_station: { label: "VP essence par station", unite: "véh./station" },
  motos: { label: "Motos neuves immatriculées (10 ans)", unite: "motos" },
  canne_ha: { label: "Surface en canne", unite: "ha" },
  canne_part: { label: "Part de la commune en canne", unite: "%" },
} as const;
export type Indicateur = keyof typeof INDICATEURS;

export function serie(d: Dashboard, code: string, fam: Famille, statut: FiltreStatut, i: number) {
  const s = d.parc.par_commune[code]?.[fam];
  if (!s) return 0;
  return statut === "tous" ? s.part[i] + s.pro[i] : s[statut][i];
}

export function valeurCommune(d: Dashboard, c: Commune, ind: Indicateur, statut: FiltreStatut, i: number): number {
  const essence = serie(d, c.code, "essence", statut, i);
  switch (ind) {
    case "densite": return c.densite;
    case "population": return c.population;
    case "vp_essence": return essence;
    case "vp_essence_1000": return c.population ? (essence / c.population) * 1000 : 0;
    case "part_essence": {
      const total = (["essence", "diesel", "elec", "autre"] as const).reduce((a, f) => a + serie(d, c.code, f, statut, i), 0);
      return total ? (essence / total) * 100 : 0;
    }
    case "vp_essence_station": return c.stations ? essence / c.stations : 0;
    case "motos": return c.motos_10ans;
    case "canne_ha": return c.canne_ha;
    case "canne_part": return c.surface_km2 ? (c.canne_ha / (c.surface_km2 * 100)) * 100 : 0;
  }
}

export function totalIle(d: Dashboard, fam: Famille, statut: FiltreStatut, i: number) {
  return Object.keys(d.communes).reduce((a, code) => a + serie(d, code, fam, statut, i), 0);
}

export function derniereConso(d: Dashboard) {
  const r = d.conso["La Réunion"];
  const n = r.annees.length - 1;
  return { annee: r.annees[n], essence_m3: r.essence_m3[n], gazole_m3: r.gazole_m3[n], evolution: r.essence_m3[n] / r.essence_m3[n - 1] - 1 };
}

// --- SP98 ----------------------------------------------------------------------

export type Verdict = "viable" | "fragile" | "non_viable";

export function scenarioSP98(d: Dashboard, h: Valeurs<typeof SP98>) {
  const last = d.parc.annees.length - 1;
  const conso = derniereConso(d);
  const vpEssencePart = totalIle(d, "essence", "part", last);
  const motos = Object.values(d.communes).reduce((a, c) => a + c.motos_10ans, 0);

  const volDescendant = conso.essence_m3 * (h.captation / 100);
  const volVp = (vpEssencePart * (h.partVpPremium / 100) * h.litresParVp) / 1000;
  const volMotos = (motos * (h.partMotos / 100) * h.litresParMoto) / 1000;
  const volAscendant = volVp + volMotos;
  const volume = Math.min(volDescendant, volAscendant); // on retient le plus prudent des deux

  const logistique = volume > 0 ? (h.coutsFixes * 1000) / (volume * 1000) : Infinity;
  const surcoutHT = h.surcoutProduit + logistique + h.margeDistrib;
  const surcoutTTC = surcoutHT * (1 + TVA_DOM);
  const prixSP98 = h.prixSP95 + surcoutTTC;
  const volParStation = volume / h.nbPilotes;
  // volume à partir duquel le surcoût TTC ne dépasse plus le maximum acceptable
  const margeDispo = h.primeAcceptable / (1 + TVA_DOM) - h.surcoutProduit - h.margeDistrib;
  const seuil = margeDispo > 0 ? h.coutsFixes / margeDispo : Infinity;

  const prixOk = surcoutTTC <= h.primeAcceptable;
  const stationsOk = volParStation >= h.volMinStation;
  const verdict: Verdict = prixOk && stationsOk ? "viable"
    : surcoutTTC <= h.primeAcceptable * 1.3 && volParStation >= h.volMinStation * 0.7 ? "fragile"
    : "non_viable";

  return {
    conso, vpEssencePart, motos, volDescendant, volVp, volMotos, volAscendant, volume, seuil,
    decomposition: {
      produit: h.surcoutProduit, logistique, marge: h.margeDistrib, tva: surcoutHT * TVA_DOM,
    },
    surcoutTTC, prixSP98, volParStation, prixOk, stationsOk, verdict,
  };
}

export interface PoidsStations { trafic: number; demande: number; densite: number }

export function classementStations(d: Dashboard, poids: PoidsStations) {
  const last = d.parc.annees.length - 1;
  const demande = (s: Station) => {
    const c = d.communes[s.commune];
    return c?.stations ? serie(d, s.commune, "essence", "part", last) / c.stations : 0;
  };
  const max = (f: (s: Station) => number) => Math.max(1, ...d.stations.map(f));
  const maxT = max((s) => s.tmja_proche);
  const maxD = max(demande);
  const maxP = max((s) => d.communes[s.commune]?.densite ?? 0);
  const somme = poids.trafic + poids.demande + poids.densite || 1;
  return d.stations
    .map((s) => {
      const parts = {
        trafic: s.tmja_proche / maxT,
        demande: demande(s) / maxD,
        densite: (d.communes[s.commune]?.densite ?? 0) / maxP,
      };
      const score = (parts.trafic * poids.trafic + parts.demande * poids.demande + parts.densite * poids.densite) / somme;
      return { ...s, nom: d.communes[s.commune]?.nom ?? s.commune, parts, score: Math.round(score * 100) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Retient les meilleures stations en imposant un écart minimal entre deux pilotes. */
export function choisirPilotes<T extends { lat: number; lon: number }>(classement: T[], n: number, ecartKm = 3) {
  const km = (a: T, b: T) => Math.hypot((a.lat - b.lat) * 110.57, (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180));
  const retenues: T[] = [];
  for (const s of classement) {
    if (retenues.length === n) break;
    if (retenues.every((r) => km(r, s) >= ecartKm)) retenues.push(s);
  }
  return retenues;
}

// --- E85 -----------------------------------------------------------------------

export function scenarioE85(d: Dashboard, h: Valeurs<typeof E85>, annee: number, prixSP95: number) {
  const campagne = d.campagnes.find((c) => c.annee === annee) ?? d.campagnes[d.campagnes.length - 1];
  const t = campagne.tonnes;
  const last = d.parc.annees.length - 1;
  const conso = derniereConso(d);

  const melasse = t * h.tauxMelasse * (h.partMelasse / 100);
  const ethMelasse = melasse * h.litresParTMelasse;
  const paille = t * h.tauxPaille * (h.partPaille / 100);
  const ethPaille = paille * h.litresParTSec;
  const bagasse = t * h.tauxBagasse * (h.partBagasse / 100);
  const ethBagasse = bagasse * 0.5 * h.litresParTSec; // 50 % de matière sèche
  const ethanol = ethMelasse + ethPaille + ethBagasse;
  const offreE85 = ethanol / (h.partEthanolE85 / 100);

  const vpFlex = totalIle(d, "essence", "tous", last) * (h.partFlex / 100);
  const demandeE85 = vpFlex * 900 * (1 + h.surconso / 100);
  const couverture = demandeE85 > 0 ? offreE85 / demandeE85 : 0;
  const ventes = Math.min(offreE85, demandeE85);
  const essenceEvitee = (ventes / (1 + h.surconso / 100)) / 1000; // m³ d'essence remplacés
  const electricitePerdue = bagasse * h.mwhParTBagasse;

  const coutEthanol = ethanol > 0 ? (ethMelasse * h.coutEthanol1G + (ethPaille + ethBagasse) * h.coutEthanol2G) / ethanol : h.coutEthanol1G;
  const ht = (h.partEthanolE85 / 100) * coutEthanol + (1 - h.partEthanolE85 / 100) * COUT_SP_HT + LOGISTIQUE_E85 + h.taxeE85;
  const prixE85 = ht * (1 + TVA_DOM);
  const prixEquivalent = prixE85 * (1 + h.surconso / 100); // coût ramené au kilomètre d'un litre de SP95

  const prixOk = prixSP95 - prixEquivalent >= 0;
  const ressourceOk = offreE85 >= demandeE85;
  const electriciteOk = electricitePerdue === 0;
  const verdict: Verdict = prixOk && ressourceOk && electriciteOk ? "viable" : prixOk ? "fragile" : "non_viable";

  return {
    prixOk, ressourceOk, electriciteOk, verdict,
    campagne, melasse, ethMelasse, paille, ethPaille, bagasse, ethBagasse, ethanol, offreE85,
    vpFlex, demandeE85, couverture, essenceEvitee, partEssenceEvitee: essenceEvitee / conso.essence_m3,
    electricitePerdue, coutEthanol, prixE85, prixEquivalent, gainParLitreEquivalent: prixSP95 - prixEquivalent,
  };
}

// --- Formats -------------------------------------------------------------------

// Geist n'a pas d'espace fine insécable (U+202F) : on la remplace par une espace insécable.
const sp = (v: string) => v.replace(/\u202f/g, "\u00a0");
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfc = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = {
  n: (v: number) => sp(nf.format(v)),
  n1: (v: number) => sp(nf1.format(v)),
  eur: (v: number) => (Number.isFinite(v) ? `${sp(nf2.format(v))} €` : "—"),
  pct: (v: number) => `${sp(nf1.format(v * 100))} %`,
  m3: (v: number) => (Number.isFinite(v) ? `${sp(nf.format(v))} m³` : "—"),
  compact: (v: number) => sp(nfc.format(v)),
};
