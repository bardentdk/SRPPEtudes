import type { Commune, Dashboard, Famille, PalierPrix, Questionnaire, Station } from "./types";
import { COUT_SP_HT, E85, LOGISTIQUE_E85, PCI_ETHANOL, SP98, TVA_DOM, USINE, USINE_1G, type Valeurs } from "./hypotheses";

export type FiltreStatut = "tous" | "part" | "pro";

export const INDICATEURS = {
  densite: { label: "Densité de population", unite: "hab./km²" },
  population: { label: "Population", unite: "hab." },
  motorisation: { label: "Ménages ayant au moins une voiture", unite: "%" },
  multi: { label: "Ménages ayant deux voitures ou plus", unite: "%" },
  revenu: { label: "Niveau de vie médian", unite: "€/an" },
  vp_essence: { label: "VP essence", unite: "véhicules" },
  vp_essence_1000: { label: "VP essence pour 1 000 hab.", unite: "‰" },
  part_essence: { label: "Part de l'essence dans le parc VP", unite: "%" },
  vp_essence_station: { label: "VP essence par station", unite: "véh./station" },
  motos: { label: "Motos neuves immatriculées (10 ans)", unite: "motos" },
  canne_ha: { label: "Surface en canne", unite: "ha" },
  canne_part: { label: "Part de la commune en canne", unite: "%" },
  reponses: { label: "Réponses au questionnaire", unite: "réponses" },
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
    case "motorisation": return (c.part_motorises ?? 0) * 100;
    case "multi": return (c.part_multi ?? 0) * 100;
    case "revenu": return c.niveau_vie_median ?? 0;
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
    case "reponses": return d.questionnaire?.disponible ? (d.questionnaire.par_commune?.[c.code] ?? 0) : 0;
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

const kmEntre = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lat - b.lat) * 110.57, (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180));

// --- Questionnaire ---------------------------------------------------------------

export type QuestionnaireActif = Extract<Questionnaire, { disponible: true }>;
export type SourceDemande = "questionnaire" | "hypothese";

export function questionnaireActif(d: Dashboard): QuestionnaireActif | null {
  const q = d.questionnaire;
  return q?.disponible && q.reponses > 0 ? q : null;
}

/** Parts « à chaque fois » et « au moins de temps en temps » pour une valeur (surcoût ou prix),
 *  par interpolation linéaire entre les paliers du questionnaire, bornée aux paliers extrêmes. */
export function lirePalier(paliers: PalierPrix[], x: number) {
  const p = [...paliers].sort((a, b) => a.valeur - b.valeur);
  const lerp = (k: "chaque" | "parfois") => {
    if (x <= p[0].valeur) return p[0][k];
    const j = p.findIndex((v) => v.valeur >= x);
    if (j === -1) return p[p.length - 1][k];
    const a = p[j - 1], b = p[j];
    return a[k] + ((b[k] - a[k]) * (x - a.valeur)) / (b.valeur - a.valeur);
  };
  const chaque = lerp("chaque");
  const parfois = lerp("parfois");
  return { chaque, auMoinsParfois: chaque + parfois, adoption: chaque + parfois / 2, horsPaliers: x < p[0].valeur || x > p[p.length - 1].valeur };
}

// --- SP98 ----------------------------------------------------------------------

export type Verdict = "viable" | "fragile" | "non_viable";

export function coutsFixesSP98(h: Valeurs<typeof SP98>) {
  return h.coutsFixes + (h.nbPilotes * h.investStation) / h.dureeAmort; // k€/an
}

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

  const fixes = coutsFixesSP98(h);
  const logistique = volume > 0 ? fixes / volume : Infinity; // k€ / m³ = €/L
  const surcoutHT = h.surcoutProduit + logistique + h.margeDistrib;
  const surcoutTTC = surcoutHT * (1 + TVA_DOM);
  const prixSP98 = h.prixSP95 + surcoutTTC;
  const volParStation = volume / h.nbPilotes;
  // volume à partir duquel le surcoût TTC ne dépasse plus le maximum acceptable
  const margeDispo = h.primeAcceptable / (1 + TVA_DOM) - h.surcoutProduit - h.margeDistrib;
  const seuil = margeDispo > 0 ? fixes / margeDispo : Infinity;

  const prixOk = surcoutTTC <= h.primeAcceptable;
  const stationsOk = volParStation >= h.volMinStation;
  const verdict: Verdict = prixOk && stationsOk ? "viable"
    : surcoutTTC <= h.primeAcceptable * 1.3 && volParStation >= h.volMinStation * 0.7 ? "fragile"
    : "non_viable";

  return {
    conso, vpEssencePart, motos, volDescendant, volVp, volMotos, volAscendant, volume, seuil, fixes,
    decomposition: {
      produit: h.surcoutProduit, logistique, marge: h.margeDistrib, tva: surcoutHT * TVA_DOM,
    },
    surcoutTTC, prixSP98, volParStation, prixOk, stationsOk, verdict,
  };
}

/** Économie de la filière SP98 selon le surcoût pratiqué : la demande baisse quand le surcoût monte.
 *  Demande issue du questionnaire (part des véhicules concernés × adoption déclarée) ou de l'hypothèse. */
export function economieSP98(d: Dashboard, h: Valeurs<typeof SP98>, q: QuestionnaireActif | null, voulu: SourceDemande) {
  const conso = derniereConso(d);
  const courbe = q?.prix_sp98?.global ?? null;
  const source: SourceDemande = voulu === "questionnaire" && courbe ? "questionnaire" : "hypothese";
  const eligible = q?.eligibilite?.pros_part98_mediane ?? h.partVpPremium / 100;
  const marge = h.margeDistrib;
  const fixes = coutsFixesSP98(h);

  const part = (p: number) => source === "questionnaire"
    ? eligible * lirePalier(courbe!, p).adoption
    : Math.min(2, Math.max(0, (h.prixRejet - p) / (h.prixRejet - 0.1))) * (h.captation / 100);

  const points: { surcout: number; volume: number; resultat: number; margeStations: number; ca: number }[] = [];
  for (let p = 0.05; p <= 0.4001; p += 0.01) {
    const surcout = Math.round(p * 100) / 100;
    const volume = conso.essence_m3 * part(surcout); // m³
    const contribution = volume * (surcout / (1 + TVA_DOM) - h.surcoutProduit - marge); // k€
    points.push({ surcout, volume, resultat: contribution - fixes, margeStations: volume * marge, ca: volume * (h.prixSP95 + surcout) });
  }
  const optimum = points.reduce((a, b) => (b.resultat > a.resultat ? b : a));
  const rentable = points.filter((p) => p.resultat >= 0);
  return {
    source, eligible, marge, fixes, points, optimum,
    plageRentable: rentable.length ? [rentable[0].surcout, rentable[rentable.length - 1].surcout] as const : null,
    a: (surcout: number) => points.reduce((a, b) => (Math.abs(b.surcout - surcout) < Math.abs(a.surcout - surcout) ? b : a)),
  };
}

// --- Implantation des pompes ------------------------------------------------------

export const FACTEURS = {
  trafic: { label: "Trafic RN à moins de 500 m", note: "Comptages routiers 2023 (Région)" },
  densite: { label: "Densité de population", note: "INSEE" },
  motorisation: { label: "Ménages motorisés", note: "Recensement 2023 (INSEE)" },
  multi: { label: "Ménages multi-motorisés", note: "Recensement 2023 (INSEE)" },
  parc: { label: "VP essence par station", note: "Parc SDES ÷ stations BPE de la commune" },
  revenu: { label: "Niveau de vie médian", note: "Filosofi 2023 (INSEE)" },
  demande: { label: "Réponses au questionnaire", note: "Pour 10 000 habitants" },
  zones: { label: "Zones demandées", note: "Question « où les premières pompes… »" },
  usine: { label: "Proximité de l'usine d'éthanol", note: "Utile pour l'E85" },
} as const;
export type Facteur = keyof typeof FACTEURS;
export type Poids = Record<Facteur, number>;

export const POIDS_DEFAUT: Record<"sp98" | "e85", Poids> = {
  sp98: { trafic: 40, densite: 15, motorisation: 10, multi: 10, parc: 25, revenu: 15, demande: 20, zones: 20, usine: 0 },
  e85: { trafic: 30, densite: 15, motorisation: 15, multi: 5, parc: 20, revenu: 0, demande: 20, zones: 10, usine: 30 },
};

const ZONE_COMMUNES: Record<string, string[]> = {
  "Nord (Saint-Denis, Sainte-Marie)": ["Saint-Denis", "Sainte-Marie"],
  "Ouest (Le Port, La Possession, Saint-Paul)": ["Le Port", "La Possession", "Saint-Paul"],
  "Route des Tamarins / Saint-Leu": ["Saint-Leu", "Les Trois-Bassins"],
  "Sud (Saint-Pierre, Le Tampon, Saint-Louis)": ["Saint-Pierre", "Le Tampon", "Saint-Louis"],
  "Est (Saint-André, Saint-Benoît)": ["Saint-André", "Saint-Benoît"],
  "Les Hauts": ["Cilaos", "Salazie", "La Plaine-des-Palmistes", "Entre-Deux"],
};

/** Score de chaque station (0-100) : somme pondérée de facteurs normalisés entre le minimum et le maximum observés. */
export function classementImplantation(d: Dashboard, poids: Poids, q: QuestionnaireActif | null, site?: { lat: number; lon: number } | null) {
  const last = d.parc.annees.length - 1;
  const zoneDe = (nom: string) => Object.entries(ZONE_COMMUNES).find(([, c]) => c.includes(nom))?.[0];
  const brut = (s: Station): Record<Facteur, number> => {
    const c = d.communes[s.commune];
    const zone = c ? zoneDe(c.nom) : undefined;
    return {
      trafic: s.tmja_proche,
      densite: c?.densite ?? 0,
      motorisation: c?.part_motorises ?? 0,
      multi: c?.part_multi ?? 0,
      parc: c?.stations ? serie(d, s.commune, "essence", "tous", last) / c.stations : 0,
      revenu: c?.niveau_vie_median ?? 0,
      demande: c && q?.par_commune ? ((q.par_commune[c.code] ?? 0) / c.population) * 10000 : 0,
      zones: zone && q?.zones ? q.zones[zone] ?? 0 : 0,
      usine: site ? -kmEntre(s, site) : 0,
    };
  };
  const valeurs = d.stations.map(brut);
  const cles = Object.keys(FACTEURS) as Facteur[];
  const bornes = Object.fromEntries(cles.map((k) => {
    const v = valeurs.map((x) => x[k]);
    return [k, [Math.min(...v), Math.max(...v)]];
  })) as Record<Facteur, [number, number]>;
  const somme = cles.reduce((a, k) => a + poids[k], 0) || 1;
  return d.stations
    .map((s, i) => {
      const parts = Object.fromEntries(cles.map((k) => {
        const [min, max] = bornes[k];
        return [k, max > min ? (valeurs[i][k] - min) / (max - min) : 0];
      })) as Record<Facteur, number>;
      const score = cles.reduce((a, k) => a + parts[k] * poids[k], 0) / somme;
      return { ...s, nom: d.communes[s.commune]?.nom ?? s.commune, parts, score: Math.round(score * 100) };
    })
    .sort((a, b) => b.score - a.score);
}

/** Retient les meilleures stations en imposant un écart minimal entre deux pilotes. */
export function choisirPilotes<T extends { lat: number; lon: number }>(classement: T[], n: number, ecartKm = 3) {
  const retenues: T[] = [];
  for (const s of classement) {
    if (retenues.length === n) break;
    if (retenues.every((r) => kmEntre(r, s) >= ecartKm)) retenues.push(s);
  }
  return retenues;
}

// --- Unité de production d'éthanol --------------------------------------------------

export type Filiere = "1G" | "2G";
type ParamsFiliere = Valeurs<typeof USINE_1G> & { transport?: number };

function campagneDe(d: Dashboard, annee: number) {
  return d.campagnes.find((c) => c.annee === annee) ?? d.campagnes[d.campagnes.length - 1];
}

/** Bilan d'une unité 1G (mélasse, sur le site d'une sucrerie) ou 2G (paille collectée dans un rayon). */
export function usineEthanol(d: Dashboard, hE85: Valeurs<typeof E85>, hU: Valeurs<typeof USINE>, hF: ParamsFiliere,
  filiere: Filiere, site: { lat: number; lon: number }, annee: number) {
  const campagne = campagneDe(d, annee);
  let matiere: number; // t (mélasse) ou t MS (paille)
  let litres: number;
  let distanceMoy = 0;
  let surfaceCaptee = d.canne.surface_ha;
  if (filiere === "1G") {
    matiere = campagne.tonnes * hE85.tauxMelasse * (hE85.partMelasse / 100);
    litres = matiere * hE85.litresParTMelasse;
  } else {
    const captees = d.canne.mailles.map((m) => ({ ...m, km: kmEntre(m, site) })).filter((m) => m.km <= hU.rayon);
    surfaceCaptee = captees.reduce((a, m) => a + m.ha, 0);
    distanceMoy = surfaceCaptee ? captees.reduce((a, m) => a + m.ha * m.km, 0) / surfaceCaptee : 0;
    const canne = campagne.tonnes * (surfaceCaptee / d.canne.surface_ha);
    matiere = canne * hE85.tauxPaille * (hE85.partPaille / 100);
    litres = matiere * hE85.litresParTSec;
  }
  const capacite = litres / 1000; // m³/an
  const capex = hF.capex * capacite;
  const opex = hF.opex * litres;
  const achats = matiere * hF.prixMatiere;
  const transport = matiere * distanceMoy * 1.3 * (hF.transport ?? 0); // 1,3 : détour des routes
  const ca = litres * hU.prixVente;
  const ebe = ca - opex - achats - transport;
  const r = hU.taux / 100;
  const annuite = (taux: number) => (1 - (1 + taux) ** -hU.duree) / taux;
  const van = -capex + ebe * annuite(r);
  let tri: number | null = null;
  if (ebe > 0 && ebe * hU.duree > capex) {
    let lo = 0.0001, hi = 1;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (-capex + ebe * annuite(mid) > 0) lo = mid; else hi = mid;
    }
    tri = lo;
  }
  const coutRevient = litres > 0 ? (capex / annuite(r) + opex + achats + transport) / litres : Infinity;
  const reference = filiere === "1G" ? 20000 : 50000;
  return {
    filiere, campagne, matiere, litres, capacite, surfaceCaptee, distanceMoy,
    capex, opex, achats, transport, ca, ebe, van, tri,
    retour: ebe > 0 ? capex / ebe : Infinity,
    coutRevient,
    emplois: capacite > 0 ? Math.max(5, Math.round(hF.emplois * (capacite / reference) ** 0.7)) : 0,
    importsEvites: litres * PCI_ETHANOL * hU.prixCifEssence,
  };
}

// --- E85 -----------------------------------------------------------------------

/** Filière E85 : ressource, demande et prix. Le coût de l'éthanol vient des unités de production modélisées. */
export function scenarioE85(d: Dashboard, h: Valeurs<typeof E85>, annee: number, prixSP95: number,
  couts: { g1: number; g2: number }, q: QuestionnaireActif | null, voulu: SourceDemande) {
  const campagne = campagneDe(d, annee);
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

  const coutEthanol = ethanol > 0 ? (ethMelasse * couts.g1 + (ethPaille + ethBagasse) * couts.g2) / ethanol : couts.g1;
  const ht = (h.partEthanolE85 / 100) * coutEthanol + (1 - h.partEthanolE85 / 100) * COUT_SP_HT + LOGISTIQUE_E85 + h.taxeE85;
  const prixE85 = ht * (1 + TVA_DOM);
  const prixEquivalent = prixE85 * (1 + h.surconso / 100); // coût ramené au kilomètre d'un litre de SP95

  const courbe = q?.prix_e85?.global ?? null;
  const source: SourceDemande = voulu === "questionnaire" && courbe ? "questionnaire" : "hypothese";
  const adoption = source === "questionnaire" ? lirePalier(courbe!, prixE85).adoption : 1;
  const vpFlex = totalIle(d, "essence", "tous", last) * (h.partFlex / 100);
  const demandeE85 = vpFlex * 900 * (1 + h.surconso / 100) * adoption;
  const couverture = demandeE85 > 0 ? offreE85 / demandeE85 : 0;
  const ventes = Math.min(offreE85, demandeE85);
  const essenceEvitee = (ventes / (1 + h.surconso / 100)) / 1000; // m³ d'essence remplacés
  const electricitePerdue = bagasse * h.mwhParTBagasse;

  const prixOk = prixSP95 - prixEquivalent >= 0;
  const ressourceOk = offreE85 >= demandeE85;
  const electriciteOk = electricitePerdue === 0;
  const verdict: Verdict = prixOk && ressourceOk && electriciteOk ? "viable" : prixOk ? "fragile" : "non_viable";

  return {
    prixOk, ressourceOk, electriciteOk, verdict, source, adoption,
    campagne, melasse, ethMelasse, paille, ethPaille, bagasse, ethBagasse, ethanol, offreE85,
    vpFlex, demandeE85, couverture, ventes, essenceEvitee, partEssenceEvitee: essenceEvitee / conso.essence_m3,
    electricitePerdue, coutEthanol, prixE85, prixEquivalent, gainParLitreEquivalent: prixSP95 - prixEquivalent,
    chiffreAffaires: ventes * prixE85,
  };
}

// --- Formats -------------------------------------------------------------------

// Geist n'a pas d'espace fine insécable (U+202F) : on la remplace par une espace insécable.
const sp = (v: string) => v.replace(/ /g, " ");
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
  /** Montant en euros, abrégé : 1,2 M€, 350 k€. */
  euros: (v: number) => (Number.isFinite(v) ? `${sp(nfc.format(v))} €`.replace(/ ?k €/, " k€").replace(/ ?M €/, " M€").replace(/ ?Md €/, " Md€") : "—"),
};
