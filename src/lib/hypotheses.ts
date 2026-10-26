// Hypothèses du modèle de viabilité. Ce ne sont pas des données officielles :
// chaque valeur est un ordre de grandeur à confirmer avec la SRPP, les distributeurs
// ou la filière canne. Elles sont toutes réglables dans l'interface, et citent leur
// source quand une référence publique existe (sinon : estimation, signalée dans la note).

export interface Hypothese {
  label: string;
  unite: string;
  defaut: number;
  min: number;
  max: number;
  pas: number;
  note: string;
  source?: { titre: string; url: string };
}

const SRC = {
  michigan: { titre: "Michigan Senate Fiscal Agency (2008)", url: "https://capitol.legislature.mi.gov/documents/2007-2008/billanalysis/Senate/htm/2007-SFA-1196-A.htm" },
  omnicane: { titre: "Omnicane, distillerie de Maurice (BEI, 2013)", url: "https://www.africa-energy.com/news-centre/article/mauritius-eib-loan-omnicane-ethanol-project" },
  omnicaneRdt: { titre: "Omnicane, bioéthanol (2024)", url: "https://omnicane.com/bioethanol" },
  adlc: { titre: "Autorité de la concurrence, décision 21-D-25", url: "https://www.autoritedelaconcurrence.fr/sites/default/files/integral_texts/2021-11/21d25.pdf" },
  sra: { titre: "Sugar Regulatory Administration (Philippines)", url: "https://www.sra.gov.ph/view_file/bioethanol_reference_price/28XHRop7fS0J2RK" },
  raizen: { titre: "Raízen Bonfim, éthanol 2G (2024)", url: "https://www.bloomberglinea.com/2024/05/31/raizen-opens-the-worlds-largest-second-generation-ethanol-plant/" },
  nrel: { titre: "NREL, Humbird et al. (2011)", url: "https://www.nrel.gov/docs/fy11osti/47764.pdf" },
  ctbe: { titre: "Cardoso et al., Scientia Agricola (2013)", url: "https://revistas.usp.br/sa/en/article/view/78517" },
  kit: { titre: "KIT, coûts de transport de la biomasse (2008)", url: "https://www.itas.kit.edu/pub/v/2008/kapp08a.pdf" },
  podari: { titre: "Clariant Sunliquid Podari", url: "https://bioenergyinternational.com/groundbreaking-held-for-clariants-sunliquid-cellulosic-ethanol-plant/" },
  platts: { titre: "S&P Global Platts, éthanol T2 FOB Rotterdam", url: "https://www.spglobal.com/energy/en/pricing-benchmarks/our-methodology/subscriber-notes/092525-platts-corrects-ethanol-t2-fob-rotterdam-sept-24-assessment" },
  quinet: { titre: "France Stratégie, guide de l'évaluation socio-économique", url: "https://www.strategie.gouv.fr/sites/strategie.gouv.fr/files/atoms/files/fs-guide-evaluation-d-evaluation-vac-final_0.pdf" },
  prefecture: { titre: "Préfecture de La Réunion, prix des carburants (mai 2026)", url: "https://guide-reunion.fr/fileadmin/images/actus/gaz-carburant/2026-04-29-communique-prix-du-carburant-en-mai-2026.pdf" },
};

export const SP98 = {
  prixSP95: { label: "Prix SP95 de référence", unite: "€/L", defaut: 2.0, min: 1.5, max: 2.5, pas: 0.01, note: "Hypothèse de départ du projet (1,78 à 1,93 €/L relevés en 2026).", source: SRC.prefecture },
  captation: { label: "Part de l'essence basculant vers le SP98 à +0,10 €/L", unite: "%", defaut: 5, min: 1, max: 25, pas: 0.5, note: "Utilisée quand la demande ne vient pas du questionnaire. En métropole, le SP98 pèse environ 1/5 des ventes d'essence." },
  prixRejet: { label: "Surcoût auquel plus personne n'achète", unite: "€/L", defaut: 0.4, min: 0.2, max: 0.8, pas: 0.01, note: "Fixe la pente de la demande hypothétique (estimation)." },
  partVpPremium: { label: "VP essence pour lesquels le 98 est préconisé", unite: "%", defaut: 6, min: 1, max: 20, pas: 0.5, note: "Remplacé par la médiane déclarée des professionnels dès que le questionnaire en compte assez." },
  litresParVp: { label: "Consommation annuelle d'un VP", unite: "L/an", defaut: 900, min: 500, max: 1500, pas: 50, note: "≈ 11 000 km à 8 L/100 km." },
  partMotos: { label: "Motos (>50 cm³) roulant au 98", unite: "%", defaut: 30, min: 0, max: 80, pas: 5, note: "Beaucoup de motos haut de gamme préconisent le 98." },
  litresParMoto: { label: "Consommation annuelle d'une moto", unite: "L/an", defaut: 300, min: 100, max: 800, pas: 25, note: "" },
  surcoutProduit: { label: "Surcoût produit + fret (vs SP95)", unite: "€/L", defaut: 0.08, min: 0.02, max: 0.2, pas: 0.01, note: "Écart de cotation SP98/SP95 et fret de petits volumes (estimation)." },
  coutsFixes: { label: "Coûts fixes logistiques annuels", unite: "k€/an", defaut: 300, min: 50, max: 1500, pas: 25, note: "Cuve ou isotanks dédiés au dépôt, logistique séparée (estimation)." },
  investStation: { label: "Investissement par station pilote", unite: "k€", defaut: 40, min: 5, max: 150, pas: 5, note: "Conversion d'une cuve existante ≈ 9 k€, cuve et pompe neuves ≈ 69 k€.", source: SRC.michigan },
  dureeAmort: { label: "Durée d'amortissement des stations", unite: "ans", defaut: 10, min: 5, max: 20, pas: 1, note: "" },
  margeDistrib: { label: "Marge distributeur additionnelle", unite: "€/L", defaut: 0.03, min: 0, max: 0.15, pas: 0.005, note: "Remplacée par la médiane déclarée des stations quand elle est disponible." },
  primeAcceptable: { label: "Surcoût maximal acceptable à la pompe", unite: "€/L", defaut: 0.25, min: 0.05, max: 0.5, pas: 0.01, note: "Seuil du verdict quand la demande ne vient pas du questionnaire." },
  nbPilotes: { label: "Stations pilotes", unite: "stations", defaut: 6, min: 1, max: 30, pas: 1, note: "" },
  volMinStation: { label: "Volume minimal par pompe pilote", unite: "m³/an", defaut: 100, min: 20, max: 400, pas: 10, note: "En dessous, la pompe n'est pas rentable pour le distributeur (estimation)." },
} satisfies Record<string, Hypothese>;

export const E85 = {
  tauxMelasse: { label: "Mélasse produite par tonne de canne", unite: "t/t", defaut: 0.033, min: 0.02, max: 0.05, pas: 0.001, note: "≈ 33 kg par tonne de canne à La Réunion.", source: SRC.adlc },
  litresParTMelasse: { label: "Éthanol par tonne de mélasse", unite: "L/t", defaut: 270, min: 200, max: 300, pas: 5, note: "Omnicane : 282 L/t ; Inde : 262 à 265 L/t.", source: SRC.omnicaneRdt },
  partMelasse: { label: "Part de la mélasse mobilisable", unite: "%", defaut: 30, min: 0, max: 100, pas: 5, note: "La mélasse alimente aujourd'hui les distilleries de rhum et la turbine éthanol d'Albioma." },
  tauxPaille: { label: "Paille sèche par tonne de canne", unite: "t/t", defaut: 0.14, min: 0.08, max: 0.2, pas: 0.01, note: "Feuilles et têtes laissées au champ (estimation)." },
  partPaille: { label: "Part de la paille récoltable", unite: "%", defaut: 40, min: 0, max: 70, pas: 5, note: "Une partie doit rester au sol : fertilité, érosion." },
  litresParTSec: { label: "Éthanol par tonne de matière sèche (2G)", unite: "L/t", defaut: 270, min: 200, max: 330, pas: 10, note: "NREL vise 330 L/t ; Podari obtient ≈ 250 L/t.", source: SRC.nrel },
  tauxBagasse: { label: "Bagasse (humide) par tonne de canne", unite: "t/t", defaut: 0.32, min: 0.25, max: 0.35, pas: 0.01, note: "320 kg par tonne de canne (DAAF 2023)." },
  partBagasse: { label: "Part de la bagasse détournée des centrales", unite: "%", defaut: 0, min: 0, max: 50, pas: 5, note: "La bagasse produit de l'électricité à Bois-Rouge et au Gol." },
  mwhParTBagasse: { label: "Électricité produite par tonne de bagasse", unite: "MWh/t", defaut: 0.45, min: 0.3, max: 0.6, pas: 0.01, note: "Ordre de grandeur des centrales bagasse de l'île (estimation)." },
  partEthanolE85: { label: "Teneur moyenne en éthanol de l'E85", unite: "%", defaut: 75, min: 60, max: 85, pas: 1, note: "Norme : 60 à 85 % selon la saison." },
  partFlex: { label: "VP essence équipés flex-fuel ou boîtier homologué", unite: "%", defaut: 3, min: 0, max: 30, pas: 0.5, note: "Montée en charge progressive ; boîtiers homologués depuis 2017." },
  surconso: { label: "Surconsommation en E85", unite: "%", defaut: 25, min: 10, max: 40, pas: 1, note: "Pouvoir calorifique de l'éthanol plus faible." },
  taxeE85: { label: "Taxe spéciale de consommation sur l'E85", unite: "€/L", defaut: 0.1, min: 0, max: 0.8, pas: 0.01, note: "Fixée par le Conseil régional (≈ 0,78 €/L sur l'essence en 2025) : levier politique principal." },
} satisfies Record<string, Hypothese>;

/** Unité de production d'éthanol : paramètres communs aux deux filières. */
export const USINE = {
  prixVente: { label: "Prix de vente de l'éthanol", unite: "€/L", defaut: 0.68, min: 0.5, max: 1.1, pas: 0.01, note: "Éthanol T2 FOB Rotterdam : 660 à 690 €/m³ en 2024-2025.", source: SRC.platts },
  taux: { label: "Taux d'actualisation", unite: "%", defaut: 6, min: 3, max: 10, pas: 0.5, note: "4,5 % pour l'évaluation publique, davantage pour un investisseur privé.", source: SRC.quinet },
  duree: { label: "Durée d'exploitation", unite: "ans", defaut: 25, min: 15, max: 30, pas: 1, note: "" },
  prixCifEssence: { label: "Coût d'import de l'essence (CAF)", unite: "€/L", defaut: 0.7, min: 0.5, max: 0.9, pas: 0.01, note: "Valeur des importations évitées (estimation, 0,6 à 0,85 €/L)." },
  rayon: { label: "Rayon d'approvisionnement en paille", unite: "km", defaut: 15, min: 5, max: 40, pas: 1, note: "Au-delà, le transport pèse sur le coût (2G uniquement)." },
} satisfies Record<string, Hypothese>;

export const USINE_1G = {
  capex: { label: "Investissement par m³/an de capacité (1G)", unite: "€", defaut: 1000, min: 450, max: 1500, pas: 50, note: "Omnicane (Maurice) : 23 M€ pour 24 ML/an ; Inde : ≈ 450 €.", source: SRC.omnicane },
  opex: { label: "Coûts d'exploitation hors mélasse (1G)", unite: "€/L", defaut: 0.2, min: 0.1, max: 0.35, pas: 0.01, note: "Estimation ; coût de conversion philippin ≈ 0,35 €/L capital compris.", source: SRC.sra },
  prixMatiere: { label: "Prix de la mélasse", unite: "€/t", defaut: 110, min: 60, max: 150, pas: 5, note: "Distilleries réunionnaises : 100 à 120 €/t.", source: SRC.adlc },
  emplois: { label: "Emplois directs pour 20 000 m³/an (1G)", unite: "ETP", defaut: 35, min: 25, max: 50, pas: 1, note: "Estimation ; les 3 distilleries de l'île emploient 190 personnes." },
} satisfies Record<string, Hypothese>;

export const USINE_2G = {
  capex: { label: "Investissement par m³/an de capacité (2G)", unite: "€", defaut: 2500, min: 1600, max: 3000, pas: 50, note: "Raízen Bonfim ≈ 2 580 €, GranBio ≈ 2 130 €, Crescentino ≈ 2 960 €.", source: SRC.raizen },
  opex: { label: "Coûts d'exploitation hors paille (2G)", unite: "€/L", defaut: 0.35, min: 0.25, max: 0.5, pas: 0.01, note: "Estimation ; enzymes ≈ 0,08 €/L chez NREL.", source: SRC.nrel },
  prixMatiere: { label: "Prix de la paille livrée", unite: "€/t MS", defaut: 70, min: 30, max: 100, pas: 5, note: "Brésil : 21 à 41 €/t ; parcelles réunionnaises petites et pentues, d'où une estimation plus haute.", source: SRC.ctbe },
  transport: { label: "Transport de la paille", unite: "€/t·km", defaut: 0.15, min: 0.07, max: 0.3, pas: 0.01, note: "Estimation ; les balles de paille sont peu denses.", source: SRC.kit },
  emplois: { label: "Emplois directs pour 50 000 m³/an (2G)", unite: "ETP", defaut: 80, min: 40, max: 120, pas: 5, note: "POET Liberty ≈ 40, Podari 100 à 120.", source: SRC.podari },
} satisfies Record<string, Hypothese>;

export type Valeurs<T> = { [K in keyof T]: number };

export function defauts<T extends Record<string, Hypothese>>(h: T): Valeurs<T> {
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.defaut])) as Valeurs<T>;
}

export const TVA_DOM = 0.085;
export const LOGISTIQUE_E85 = 0.1; // €/L, distribution et stockage de l'E85
export const COUT_SP_HT = 0.8; // €/L, coût hors taxes de la fraction essence de l'E85
export const PCI_ETHANOL = 0.67; // litre d'essence remplacé par litre d'éthanol, à énergie égale
