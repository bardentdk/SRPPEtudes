// Questionnaire « Étude Carburants Réunion 2026 », décrit une seule fois : cette définition sert au
// formulaire du site, à la validation côté serveur, à la copie dans la Google Sheet et à l'agrégation.
// Ajouter ou modifier une question ici suffit ; changer l'`id` d'une question existante casse
// la continuité des réponses déjà enregistrées.

import type { Public } from "../types";

export const VERSION_SCHEMA = 1;

export type Valeur = string | string[] | number | null;
export type Reponses = Record<string, Valeur>;
export type Etape = "profil" | "activite" | "sp98" | "e85" | "engagement" | "coordonnees";

interface Base {
  id: string;
  etape: Etape;
  label: string;
  /** Libellé propre à un public (« vos clients », « vos membres »…). */
  labelPar?: Partial<Record<Public, string>>;
  aide?: string;
  publics?: Public[];
  /** Condition d'affichage, évaluée sur les réponses déjà données. */
  si?: (r: Reponses) => boolean;
  requis?: boolean;
  /** Donnée personnelle : stockée à part, jamais publiée ni envoyée à l'IA. */
  personnel?: boolean;
}

export type Question =
  | (Base & { type: "choix" | "multi"; options: string[]; optionsPar?: Partial<Record<Public, string[]>> })
  | (Base & { type: "curseur"; min: number; max: number; pas: number; defaut: number; unite: string })
  | (Base & { type: "nombre"; min: number; max: number; unite: string })
  | (Base & { type: "echelle"; bas: string; haut: string })
  | (Base & { type: "commune" })
  | (Base & { type: "texte"; long?: boolean; email?: boolean });

export const PROFILS: Record<string, Public> = {
  "Particulier": "part",
  "Concessionnaire automobile": "pro",
  "Concessionnaire moto": "pro",
  "Loueur de véhicules": "pro",
  "Garage, atelier ou préparateur": "pro",
  "Gestionnaire de flotte d'entreprise": "pro",
  "Club ou association automobile": "club",
  "Club ou association moto": "club",
  "Gérant de station-service": "station",
  "Distributeur ou réseau pétrolier": "station",
  "Acteur de la filière canne": "filiere",
};

export const ETAPES: { id: Etape; titre: string }[] = [
  { id: "profil", titre: "Votre profil" },
  { id: "activite", titre: "Votre situation" },
  { id: "sp98", titre: "Le SP98" },
  { id: "e85", titre: "L'E85 local" },
  { id: "engagement", titre: "Soutenir le projet" },
  { id: "coordonnees", titre: "Vos coordonnées" },
];

const ZONES = ["Nord (Saint-Denis, Sainte-Marie)", "Ouest (Le Port, La Possession, Saint-Paul)",
  "Route des Tamarins / Saint-Leu", "Sud (Saint-Pierre, Le Tampon, Saint-Louis)",
  "Est (Saint-André, Saint-Benoît)", "Les Hauts"];
const LETTRE = "Signer une lettre de soutien adressée à la SRPP et à la Préfecture";
const ACHETEURS: Public[] = ["part", "pro", "club"];

export const QUESTIONS: Question[] = [
  // --- Profil -------------------------------------------------------------------
  { id: "profil", etape: "profil", type: "choix", label: "Vous répondez en tant que", options: Object.keys(PROFILS), requis: true },
  { id: "commune", etape: "profil", type: "commune", label: "Commune principale de votre activité ou de votre domicile", requis: true },

  // --- Particuliers ---------------------------------------------------------------
  { id: "vehicule", etape: "activite", publics: ["part"], type: "choix", requis: true, label: "Quel est votre véhicule principal ?",
    options: ["Voiture essence", "Voiture hybride essence", "Moto de plus de 125 cm³", "Moto ou scooter de 125 cm³ ou moins", "Voiture diesel ou électrique"] },
  { id: "preconisation", etape: "activite", publics: ["part"], type: "choix", requis: true, label: "Quel carburant le constructeur préconise-t-il ?",
    options: ["SP98 uniquement", "SP95 ou SP98", "SP95", "Je ne sais pas"], si: (r) => r.vehicule !== "Voiture diesel ou électrique" },
  { id: "litres_mois", etape: "activite", publics: ["part"], type: "curseur", requis: true, label: "Combien de litres de carburant achetez-vous par mois ?",
    min: 0, max: 300, pas: 5, defaut: 60, unite: "L/mois", aide: "Un plein de citadine fait environ 40 L." },

  // --- Professionnels de l'automobile ------------------------------------------
  { id: "vehicules_an", etape: "activite", publics: ["pro"], type: "nombre", requis: true, min: 0, max: 100000, unite: "véhicules/an",
    label: "Combien de véhicules essence vendez-vous, gérez-vous ou entretenez-vous par an ?" },
  { id: "part98", etape: "activite", publics: ["pro"], type: "curseur", requis: true, min: 0, max: 100, pas: 1, defaut: 10, unite: "%",
    label: "Pour quelle part de ces véhicules le constructeur préconise-t-il le SP98 ?" },
  { id: "marques", etape: "activite", publics: ["pro"], type: "texte", label: "Marques ou modèles concernés (facultatif)" },

  // --- Clubs ----------------------------------------------------------------------
  { id: "membres", etape: "activite", publics: ["club"], type: "nombre", requis: true, min: 1, max: 10000, unite: "membres", label: "Combien de membres compte votre club ?" },
  { id: "vehicules98", etape: "activite", publics: ["club"], type: "nombre", requis: true, min: 0, max: 10000, unite: "véhicules",
    label: "Combien de véhicules de vos membres sont préconisés au SP98 par leur constructeur ?" },

  // --- Stations et distributeurs --------------------------------------------------
  { id: "nb_stations", etape: "activite", publics: ["station"], type: "nombre", requis: true, min: 1, max: 300, unite: "stations", label: "Combien de stations-service exploitez-vous ?" },
  { id: "volume_m3", etape: "activite", publics: ["station"], type: "nombre", requis: true, min: 0, max: 300000, unite: "m³/an",
    label: "Quel volume d'essence vendez-vous par an, toutes stations confondues ?" },
  { id: "demande98", etape: "activite", publics: ["station"], type: "choix", requis: true, label: "Vos clients vous demandent-ils du SP98 ?", options: ["Souvent", "Parfois", "Jamais"] },
  { id: "cuve", etape: "activite", publics: ["station"], type: "choix", requis: true, label: "Disposez-vous d'une cuve ou d'un compartiment libérable pour un nouveau carburant ?",
    options: ["Oui", "Oui, après travaux", "Non"] },
  { id: "invest_station", etape: "activite", publics: ["station"], type: "curseur", requis: true, min: 0, max: 150000, pas: 5000, defaut: 20000, unite: "€",
    label: "Quel investissement accepteriez-vous par station pour une pompe et une cuve dédiées ?", aide: "Conversion d'une cuve existante ≈ 9 000 € ; cuve et pompe neuves ≈ 70 000 €." },
  { id: "marge_attendue", etape: "activite", publics: ["station"], type: "curseur", requis: true, min: 0, max: 0.25, pas: 0.01, defaut: 0.08, unite: "€/L",
    label: "Quelle marge de distribution attendez-vous sur un litre de nouveau carburant ?" },
  { id: "carburants", etape: "activite", publics: ["station"], type: "multi", label: "Quel carburant envisageriez-vous de distribuer ?", options: ["SP98", "E85"] },
  { id: "contraintes", etape: "activite", publics: ["station"], type: "multi", label: "Quelles contraintes vous freineraient ?",
    options: ["Place en cuve", "Coût d'investissement", "Approvisionnement en petits volumes", "Réglementation et sécurité", "Demande trop faible"] },

  // --- Filière canne -------------------------------------------------------------
  { id: "fi_type", etape: "activite", publics: ["filiere"], type: "choix", requis: true, label: "Vous êtes",
    options: ["Planteur", "Sucrerie", "Distillerie", "Coopérative ou groupement", "Autre acteur de la filière"] },
  { id: "fi_tonnage", etape: "activite", publics: ["filiere"], type: "nombre", requis: true, min: 0, max: 2000000, unite: "t/an",
    label: "Quel tonnage de canne livrez-vous ou traitez-vous par an ?" },
  { id: "fi_paille_part", etape: "activite", publics: ["filiere"], type: "curseur", min: 0, max: 100, pas: 5, defaut: 25, unite: "%",
    label: "Quelle part de la paille de canne (feuilles, têtes) pourrait être récupérée ?", aide: "Une partie doit rester au sol pour la fertilité." },
  { id: "fi_prix_paille", etape: "activite", publics: ["filiere"], type: "curseur", min: 0, max: 150, pas: 5, defaut: 50, unite: "€/t",
    label: "À quel prix céderiez-vous une tonne de paille, bord de champ ?", si: (r) => Number(r.fi_paille_part) > 0 },
  { id: "fi_melasse_t", etape: "activite", publics: ["filiere"], type: "nombre", min: 0, max: 100000, unite: "t/an",
    label: "Quelle quantité de mélasse pourrait être orientée vers l'éthanol carburant ?", si: (r) => r.fi_type === "Sucrerie" || r.fi_type === "Distillerie" },
  { id: "fi_prix_melasse", etape: "activite", publics: ["filiere"], type: "curseur", min: 0, max: 300, pas: 5, defaut: 110, unite: "€/t",
    label: "À quel prix céderiez-vous une tonne de mélasse ?", si: (r) => Number(r.fi_melasse_t) > 0 },
  { id: "fi_role", etape: "activite", publics: ["filiere"], type: "multi", label: "Quel rôle pourriez-vous jouer dans une unité d'éthanol ?",
    options: ["Fournisseur de matière première", "Partenaire ou actionnaire", "Acheteur de coproduits", "Aucun"] },
  { id: "fi_site", etape: "activite", publics: ["filiere"], type: "choix", label: "Quel site vous semblerait le plus pertinent ?",
    options: ["Près de l'usine de Bois-Rouge (Est)", "Près de l'usine du Gol (Sud)", "Sur une distillerie existante", "Sans avis"] },

  // --- SP98 (acheteurs) ---------------------------------------------------------
  { id: "problemes", etape: "sp98", publics: ACHETEURS, type: "multi",
    label: "Quels problèmes constatez-vous faute de SP98 ?",
    labelPar: { pro: "Quels problèmes vos clients rencontrent-ils faute de SP98 ?", club: "Quels problèmes vos membres rencontrent-ils faute de SP98 ?" },
    options: ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Aucun problème"],
    optionsPar: {
      pro: ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Réserves sur la garantie constructeur", "Clients qui réclament du SP98", "Aucun problème"],
      club: ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Réserves sur la garantie constructeur", "Aucun problème"],
    } },
  { id: "wtp98_chaque", etape: "sp98", publics: ACHETEURS, type: "curseur", requis: true, min: 0, max: 0.4, pas: 0.01, defaut: 0.1, unite: "€/L",
    label: "Jusqu'à quel surcoût par rapport au SP95 achèteriez-vous du SP98 à chaque plein ?",
    labelPar: { pro: "Jusqu'à quel surcoût la plupart de vos clients achèteraient-ils du SP98 ?", club: "Jusqu'à quel surcoût la plupart de vos membres achèteraient-ils du SP98 ?" },
    aide: "En métropole, l'écart est en général de 0,08 à 0,12 €/L. Placez le curseur sur 0 si vous n'en achèteriez pas." },
  { id: "wtp98_parfois", etape: "sp98", publics: ACHETEURS, type: "curseur", requis: true, min: 0, max: 0.4, pas: 0.01, defaut: 0.15, unite: "€/L",
    label: "Et jusqu'à quel surcoût en achèteriez-vous de temps en temps ?",
    labelPar: { pro: "Et jusqu'à quel surcoût une partie de vos clients en achèterait-elle ?", club: "Et jusqu'à quel surcoût une partie de vos membres en achèterait-elle ?" },
    aide: "Au moins égal au surcoût précédent." },
  { id: "zones", etape: "sp98", publics: ACHETEURS, type: "multi", label: "Où les premières pompes SP98 seraient-elles le plus utiles ?", options: ZONES },

  // --- E85 (acheteurs) ----------------------------------------------------------
  { id: "e85_connaissance", etape: "e85", publics: ACHETEURS, type: "choix", requis: true, label: "Connaissez-vous l'E85 (superéthanol) ?",
    labelPar: { pro: "Vos clients connaissent-ils l'E85 (superéthanol) ?", club: "Vos membres connaissent-ils l'E85 (superéthanol) ?" },
    options: ["Oui, bien", "Oui, de nom", "Non"] },
  { id: "e85_compat", etape: "e85", publics: ["part"], type: "choix", requis: true, label: "Votre véhicule peut-il rouler à l'E85 ?",
    options: ["Oui, il est flex-fuel", "Oui, avec un boîtier déjà installé", "Non", "Je ne sais pas"] },
  { id: "flex_stock", etape: "e85", publics: ["pro"], type: "nombre", min: 0, max: 10000, unite: "véhicules", label: "Combien de véhicules flex-fuel (compatibles E85) avez-vous en stock ou en parc ?" },
  { id: "flex_membres", etape: "e85", publics: ["club"], type: "nombre", min: 0, max: 10000, unite: "véhicules", label: "Combien de véhicules de vos membres peuvent rouler à l'E85 ?" },
  { id: "wtpe85", etape: "e85", publics: ACHETEURS, type: "curseur", requis: true, min: 0.8, max: 1.6, pas: 0.05, defaut: 1.1, unite: "€/L",
    label: "Jusqu'à quel prix au litre rouleriez-vous à l'E85, avec un véhicule compatible ?",
    labelPar: { pro: "Jusqu'à quel prix au litre vos clients rouleraient-ils à l'E85 ?", club: "Jusqu'à quel prix au litre vos membres rouleraient-ils à l'E85 ?" },
    aide: "Un véhicule consomme environ 25 % de plus en E85 : l'équivalent pour la même distance s'affiche sous le curseur." },
  { id: "boitier_budget", etape: "e85", publics: ["part"], type: "curseur", min: 0, max: 2000, pas: 50, defaut: 500, unite: "€",
    label: "Quel budget accepteriez-vous pour faire installer un boîtier E85 homologué ?", aide: "Pose en garage : environ 700 à 1 500 € ; certaines régions l'aident.",
    si: (r) => r.e85_compat === "Non" || r.e85_compat === "Je ne sais pas" },
  { id: "boitiers_pro", etape: "e85", publics: ["pro"], type: "choix", label: "Proposeriez-vous la pose de boîtiers E85 homologués ?",
    options: ["Oui, nous le faisons déjà", "Oui, si la demande existe", "Non"] },
  { id: "importance_locale", etape: "e85", publics: ACHETEURS, type: "echelle", bas: "Aucune", haut: "Très grande",
    label: "Quelle importance accordez-vous à un carburant produit localement, à partir de la canne ?" },

  // --- Engagement (tous) ---------------------------------------------------------
  { id: "engagement", etape: "engagement", type: "multi", label: "Accepteriez-vous de…",
    options: ["Signer une pétition de soutien", "Relayer ce questionnaire auprès de vos proches", "Recevoir les résultats de l'étude"],
    optionsPar: {
      pro: [LETTRE, "Relayer ce questionnaire auprès de vos clients", "Participer à une réunion de présentation", "Recevoir les résultats de l'étude"],
      club: [LETTRE, "Relayer ce questionnaire auprès de vos membres", "Organiser une présentation au club", "Recevoir les résultats de l'étude"],
      station: ["Accueillir une pompe pilote", LETTRE, "Participer à une réunion de présentation", "Recevoir les résultats de l'étude"],
      filiere: [LETTRE, "Participer à une réunion de présentation", "Recevoir les résultats de l'étude"],
    } },
  { id: "remarques", etape: "engagement", type: "texte", long: true, label: "Remarques ou suggestions (facultatif)" },

  // --- Coordonnées (facultatives) -----------------------------------------------
  { id: "contact_nom", etape: "coordonnees", type: "texte", personnel: true, label: "Nom et prénom" },
  { id: "contact_structure", etape: "coordonnees", type: "texte", personnel: true, label: "Structure" },
  { id: "contact_email", etape: "coordonnees", type: "texte", email: true, personnel: true, label: "Adresse e-mail" },
  { id: "contact_consentement", etape: "coordonnees", type: "multi", personnel: true, label: "Consentement",
    options: ["J'accepte d'être recontacté au sujet de cette étude. Mes coordonnées ne seront ni publiées ni transmises."] },
];

export const publicDe = (r: Reponses): Public | null => PROFILS[String(r.profil ?? "")] ?? null;

export function labelDe(q: Question, p: Public | null) {
  return (p && q.labelPar?.[p]) || q.label;
}

export function optionsDe(q: Extract<Question, { options: string[] }>, p: Public | null) {
  return (p && q.optionsPar?.[p]) || q.options;
}

/** Questions affichées pour ces réponses : filtrées par public puis par condition. */
export function questionsVisibles(r: Reponses, etape?: Etape) {
  const p = publicDe(r);
  return QUESTIONS.filter((q) => (!etape || q.etape === etape) && (!q.publics || (p && q.publics.includes(p))) && (!q.si || q.si(r)));
}

export function etapesVisibles(r: Reponses) {
  return ETAPES.filter((e) => questionsVisibles(r, e.id).length > 0);
}

const vide = (v: Valeur | undefined) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erreurs de validation (id → message). Sert au navigateur et, à l'identique, au serveur. */
export function valider(r: Reponses, communes: string[], etape?: Etape) {
  const p = publicDe(r);
  const erreurs: Record<string, string> = {};
  for (const q of questionsVisibles(r, etape)) {
    const v = r[q.id];
    if (vide(v)) {
      if (q.requis) erreurs[q.id] = "Réponse obligatoire.";
      continue;
    }
    switch (q.type) {
      case "choix":
        if (typeof v !== "string" || !optionsDe(q, p).includes(v)) erreurs[q.id] = "Choix invalide.";
        break;
      case "multi":
        if (!Array.isArray(v) || v.some((x) => !optionsDe(q, p).includes(x))) erreurs[q.id] = "Choix invalide.";
        break;
      case "curseur":
      case "nombre":
        if (typeof v !== "number" || !Number.isFinite(v) || v < q.min || v > q.max) erreurs[q.id] = `Valeur attendue entre ${q.min} et ${q.max}.`;
        break;
      case "echelle":
        if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) erreurs[q.id] = "Note de 1 à 5.";
        break;
      case "commune":
        if (typeof v !== "string" || !communes.includes(v)) erreurs[q.id] = "Commune inconnue.";
        break;
      case "texte":
        if (typeof v !== "string" || v.length > 2000) erreurs[q.id] = "Texte trop long (2 000 caractères maximum).";
        else if (q.email && !EMAIL.test(v)) erreurs[q.id] = "Adresse e-mail invalide.";
        break;
    }
  }
  if (typeof r.wtp98_chaque === "number" && typeof r.wtp98_parfois === "number" && r.wtp98_parfois < r.wtp98_chaque) {
    erreurs.wtp98_parfois = "Doit être au moins égal au surcoût « à chaque plein ».";
  }
  const coordonnees = ["contact_nom", "contact_structure", "contact_email"].some((k) => !vide(r[k]));
  if ((!etape || etape === "coordonnees") && coordonnees && vide(r.contact_consentement)) {
    erreurs.contact_consentement = "Cochez le consentement pour que nous puissions conserver vos coordonnées.";
  }
  return erreurs;
}

/** Ne garde que les réponses aux questions visibles (une réponse masquée après coup est retirée). */
export function nettoyer(r: Reponses): Reponses {
  const ids = new Set(questionsVisibles(r).map((q) => q.id));
  return Object.fromEntries(Object.entries(r).filter(([k, v]) => ids.has(k) && !vide(v)));
}

export const ID_PERSONNELS = QUESTIONS.filter((q) => q.personnel).map((q) => q.id);
