// Hypothèses du modèle de viabilité. Ce ne sont pas des données officielles :
// chaque valeur est un ordre de grandeur à confirmer avec la SRPP, les distributeurs
// ou la filière canne. Elles sont toutes réglables dans l'interface.

export interface Hypothese {
  label: string;
  unite: string;
  defaut: number;
  min: number;
  max: number;
  pas: number;
  note: string;
}

export const SP98 = {
  prixSP95: { label: "Prix SP95 de référence", unite: "€/L", defaut: 2.0, min: 1.5, max: 2.5, pas: 0.01, note: "Hypothèse de départ du projet. Dernier prix préfectoral relevé : voir Sources." },
  captation: { label: "Part de l'essence basculant vers le SP98", unite: "%", defaut: 5, min: 1, max: 25, pas: 0.5, note: "En métropole le SP98 pèse environ 1/5 des ventes d'essence ; marché plus sensible au prix ici, d'où une hypothèse prudente." },
  partVpPremium: { label: "VP essence pour lesquels le 98 est préconisé", unite: "%", defaut: 6, min: 1, max: 20, pas: 0.5, note: "Sportives, turbos à forte compression. À remplacer par le comptage des concessionnaires." },
  litresParVp: { label: "Consommation annuelle d'un VP", unite: "L/an", defaut: 900, min: 500, max: 1500, pas: 50, note: "≈ 11 000 km à 8 L/100 km." },
  partMotos: { label: "Motos (>50 cm³) roulant au 98", unite: "%", defaut: 30, min: 0, max: 80, pas: 5, note: "Beaucoup de motos haut de gamme préconisent le 98." },
  litresParMoto: { label: "Consommation annuelle d'une moto", unite: "L/an", defaut: 300, min: 100, max: 800, pas: 25, note: "" },
  surcoutProduit: { label: "Surcoût produit + fret (vs SP95)", unite: "€/L", defaut: 0.08, min: 0.02, max: 0.2, pas: 0.01, note: "Écart de cotation SP98/SP95 et fret de petits volumes." },
  coutsFixes: { label: "Coûts fixes annuels de la filière dédiée", unite: "k€/an", defaut: 400, min: 100, max: 1500, pas: 25, note: "Cuve ou isotanks dédiés, logistique séparée, amortissement des pompes pilotes." },
  margeDistrib: { label: "Marge distributeur additionnelle", unite: "€/L", defaut: 0.03, min: 0, max: 0.1, pas: 0.005, note: "" },
  primeAcceptable: { label: "Surcoût maximal acceptable à la pompe", unite: "€/L", defaut: 0.25, min: 0.05, max: 0.5, pas: 0.01, note: "Au-delà, la demande s'effondre (hypothèse)." },
  nbPilotes: { label: "Stations pilotes", unite: "stations", defaut: 6, min: 1, max: 30, pas: 1, note: "" },
  volMinStation: { label: "Volume minimal par pompe pilote", unite: "m³/an", defaut: 100, min: 20, max: 400, pas: 10, note: "En dessous, la pompe n'est pas rentable pour le distributeur." },
} satisfies Record<string, Hypothese>;

export const E85 = {
  tauxMelasse: { label: "Mélasse produite par tonne de canne", unite: "t/t", defaut: 0.035, min: 0.02, max: 0.05, pas: 0.001, note: "3 à 4 % de la canne broyée." },
  litresParTMelasse: { label: "Éthanol par tonne de mélasse", unite: "L/t", defaut: 270, min: 200, max: 320, pas: 5, note: "Fermentation classique (1re génération)." },
  partMelasse: { label: "Part de la mélasse mobilisable", unite: "%", defaut: 30, min: 0, max: 100, pas: 5, note: "La mélasse alimente aujourd'hui les distilleries de rhum." },
  tauxPaille: { label: "Paille sèche par tonne de canne", unite: "t/t", defaut: 0.14, min: 0.08, max: 0.2, pas: 0.01, note: "Feuilles et têtes laissées au champ." },
  partPaille: { label: "Part de la paille récoltable", unite: "%", defaut: 40, min: 0, max: 70, pas: 5, note: "Une partie doit rester au sol (fertilité, érosion)." },
  litresParTSec: { label: "Éthanol par tonne de matière sèche (2G)", unite: "L/t", defaut: 280, min: 150, max: 350, pas: 10, note: "Éthanol cellulosique : technologie coûteuse, peu d'unités industrielles." },
  tauxBagasse: { label: "Bagasse (humide) par tonne de canne", unite: "t/t", defaut: 0.3, min: 0.25, max: 0.35, pas: 0.01, note: "≈ 50 % d'humidité." },
  partBagasse: { label: "Part de la bagasse détournée des centrales", unite: "%", defaut: 0, min: 0, max: 50, pas: 5, note: "La bagasse produit aujourd'hui de l'électricité à Bois-Rouge et au Gol." },
  mwhParTBagasse: { label: "Électricité produite par tonne de bagasse", unite: "MWh/t", defaut: 0.45, min: 0.3, max: 0.6, pas: 0.01, note: "Ordre de grandeur des centrales bagasse-charbon de l'île." },
  partEthanolE85: { label: "Teneur moyenne en éthanol de l'E85", unite: "%", defaut: 75, min: 60, max: 85, pas: 1, note: "Norme : 60 à 85 % selon la saison." },
  partFlex: { label: "VP essence équipés flex-fuel ou boîtier homologué", unite: "%", defaut: 3, min: 0, max: 30, pas: 0.5, note: "Montée en charge progressive ; boîtiers homologués depuis 2017." },
  surconso: { label: "Surconsommation en E85", unite: "%", defaut: 25, min: 10, max: 40, pas: 1, note: "Pouvoir calorifique de l'éthanol plus faible." },
  coutEthanol1G: { label: "Coût de production éthanol de mélasse", unite: "€/L", defaut: 0.6, min: 0.3, max: 1.2, pas: 0.05, note: "" },
  coutEthanol2G: { label: "Coût de production éthanol de paille/bagasse", unite: "€/L", defaut: 1.1, min: 0.6, max: 2, pas: 0.05, note: "" },
  taxeE85: { label: "Taxe spéciale de consommation sur l'E85", unite: "€/L", defaut: 0.1, min: 0, max: 0.6, pas: 0.01, note: "Fixée par le Conseil régional : levier politique principal." },
} satisfies Record<string, Hypothese>;

export type Valeurs<T> = { [K in keyof T]: number };

export function defauts<T extends Record<string, Hypothese>>(h: T): Valeurs<T> {
  return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, v.defaut])) as Valeurs<T>;
}

export const TVA_DOM = 0.085;
export const LOGISTIQUE_E85 = 0.1; // €/L, distribution et stockage de l'E85
export const COUT_SP_HT = 0.8; // €/L, coût hors taxes de la fraction essence de l'E85
