/**
 * Étude Carburants Réunion 2026 : questionnaire de demande (SP98 et E85), version 2.
 *
 * À coller dans le projet Google Apps Script du questionnaire, puis exécuter :
 *   - reconstruireFormulaire() : vide le formulaire existant (FORM_ID), le reconstruit et le relie
 *     à une NOUVELLE feuille de réponses. Le lien de réponse ne change pas ;
 *   - creerFormulaire() : crée un formulaire neuf (nouveau lien), pour repartir de zéro.
 *
 * Chaque public (particulier, professionnel de l'automobile, club, station ou distributeur,
 * filière canne) suit son propre parcours : Google Forms ne gère les conditions que section
 * par section. Les intitulés diffèrent d'un public à l'autre pour garder une colonne par question.
 *
 * L'onglet « export » de la feuille recopie les réponses SANS les colonnes personnelles ou libres
 * (liste PERSONNEL). C'est le seul onglet destiné à être publié en CSV et lu par pipeline/run.py,
 * qui s'appuie sur les débuts d'intitulés : toute modification de libellé doit y être reportée
 * (pipeline/questionnaire.py).
 */

const FORM_ID = "1_qjc0BfJ0OFrzIUcbfDXkIp9qbWzyQE8oRuzp4-wYIk";
const TITRE = "Étude Carburants Réunion 2026";
const SOUS_TITRE = "Enquête sur la demande en SP98 et en E85";

const COMMUNES = ["Bras-Panon", "Cilaos", "Entre-Deux", "L'Étang-Salé", "La Plaine-des-Palmistes", "La Possession",
  "Le Port", "Le Tampon", "Les Avirons", "Les Trois-Bassins", "Petite-Île", "Saint-André", "Saint-Benoît",
  "Saint-Denis", "Saint-Joseph", "Saint-Leu", "Saint-Louis", "Saint-Paul", "Saint-Philippe", "Saint-Pierre",
  "Sainte-Marie", "Sainte-Rose", "Sainte-Suzanne", "Salazie"];

// Intitulés (début) des colonnes qui ne doivent jamais sortir de la feuille.
const PERSONNEL = ["Nom et prénom", "Structure", "Adresse e-mail", "Consentement", "Remarques ou suggestions",
  "Marques ou modèles"];

const PALIERS_SP98 = ["+0,10 €/L", "+0,15 €/L", "+0,20 €/L", "+0,25 €/L", "+0,30 €/L"];
const PRIX_E85 = ["0,90 €/L", "1,00 €/L", "1,10 €/L", "1,20 €/L", "1,30 €/L", "1,40 €/L"];
const ACHAT_PERSO = ["Oui, à chaque plein", "Oui, de temps en temps", "Non"];
const ACHAT_GROUPE = ["Oui, la plupart", "Oui, une partie", "Non"];
const AIDE_SP98 = "Pour mémoire, la différence est en général de 0,08 à 0,12 €/L en métropole.";
const AIDE_E85 = "Un véhicule consomme environ 25 % de plus en E85 qu'en SP95 : à 1,20 €/L, l'E85 revient à environ 1,50 € pour la même distance.";
const ZONES = ["Nord (Saint-Denis, Sainte-Marie)", "Ouest (Le Port, La Possession, Saint-Paul)",
  "Route des Tamarins / Saint-Leu", "Sud (Saint-Pierre, Le Tampon, Saint-Louis)",
  "Est (Saint-André, Saint-Benoît)", "Les Hauts"];
const CONNAISSANCE_E85 = ["Oui, bien", "Oui, de nom", "Non"];

function creerFormulaire() {
  const form = FormApp.create(TITRE);
  const ss = SpreadsheetApp.create(`${TITRE} · réponses`);
  construire(form, ss);
}

function reconstruireFormulaire() {
  const form = FormApp.openById(FORM_ID);
  form.getItems().forEach((item) => form.deleteItem(item));
  try {
    form.removeDestination();
  } catch (e) {
    // aucune feuille liée
  }
  const ss = SpreadsheetApp.create(`${TITRE} · réponses v2`);
  construire(form, ss);
}

function construire(form, ss) {
  const contact = Session.getActiveUser().getEmail();
  form
    .setTitle(`${TITRE} · ${SOUS_TITRE}`)
    .setDescription(
      "Le SP98 n'est pas distribué à La Réunion et aucun carburant n'y est produit à partir de la canne. " +
      "Cette enquête mesure la demande réelle et les conditions économiques, pour les croiser avec une étude de faisabilité " +
      "construite sur les données publiques officielles. Les questions s'adaptent à votre profil.\n\n" +
      "Durée : environ 5 minutes. Les réponses sont anonymes, sauf si vous choisissez de laisser vos coordonnées à la fin.\n\n" +
      `Données personnelles : les réponses sont collectées par ${TITRE} (contact : ${contact}) dans le seul but de cette étude. ` +
      "Les coordonnées facultatives ne sont jamais publiées ni transmises ; seuls des résultats agrégés sont diffusés. " +
      "Elles sont conservées 12 mois après la fin de l'étude. Vous pouvez demander leur consultation, rectification ou suppression à l'adresse ci-dessus."
    )
    .setProgressBar(true)
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setConfirmationMessage(
      "Merci pour votre participation. Les résultats agrégés seront partagés avec les acteurs de la filière. " +
      "N'hésitez pas à transmettre ce questionnaire à votre réseau."
    );

  // --- Page 1 : profil ---------------------------------------------------------
  const profil = form.addMultipleChoiceItem().setTitle("Vous répondez en tant que").setRequired(true);
  form.addListItem().setTitle("Commune principale de votre activité ou de votre domicile")
    .setChoiceValues(COMMUNES).setRequired(true);

  // --- Particuliers ------------------------------------------------------------
  const pagePart = section(form, "Votre véhicule");
  choix(form, "Quel est votre véhicule principal ?",
    ["Voiture essence", "Voiture hybride essence", "Moto de plus de 125 cm³", "Moto ou scooter de 125 cm³ ou moins",
      "Voiture diesel ou électrique"], true);
  choix(form, "Quel carburant le constructeur préconise-t-il ?", ["SP98 uniquement", "SP95 ou SP98", "SP95", "Je ne sais pas"], true);
  choix(form, "Combien de litres de carburant achetez-vous par mois ?", ["Moins de 40 L", "40 à 79 L", "80 à 149 L", "150 L ou plus"], true);

  section(form, "Le SP98 et vous");
  cases(form, "Quels problèmes constatez-vous faute de SP98 ?",
    ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Aucun problème"]);
  grille(form, "Achèteriez-vous du SP98 s'il coûtait plus cher que le SP95 de…", AIDE_SP98, PALIERS_SP98, ACHAT_PERSO);
  cases(form, "Où les premières pompes SP98 vous seraient-elles le plus utiles ?", ZONES);

  section(form, "L'E85 et vous", "L'E85 (superéthanol) contient jusqu'à 85 % d'éthanol. Il pourrait être produit à La Réunion à partir de la canne à sucre.");
  choix(form, "Connaissez-vous l'E85 ?", CONNAISSANCE_E85, true);
  choix(form, "Votre véhicule peut-il rouler à l'E85 ?",
    ["Oui, il est flex-fuel", "Oui, avec un boîtier déjà installé", "Non", "Je ne sais pas"], true);
  grille(form, "Rouleriez-vous à l'E85 (avec un véhicule compatible) s'il coûtait…", AIDE_E85, PRIX_E85, ACHAT_PERSO);
  choix(form, "Quel budget accepteriez-vous pour faire installer un boîtier E85 homologué ?",
    ["Aucun", "Moins de 500 €", "500 à 999 €", "1 000 à 1 499 €", "1 500 € ou plus"]);
  echelle(form, "Quelle importance accordez-vous à un carburant produit localement, à partir de la canne ?", "Aucune", "Très grande");

  section(form, "Soutenir le projet");
  cases(form, "Accepteriez-vous de… (particulier)",
    ["Signer une pétition de soutien", "Relayer ce questionnaire auprès de vos proches", "Recevoir les résultats de l'étude"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- Professionnels de l'automobile ------------------------------------------
  const pagePro = section(form, "Votre activité", "Concessionnaires, loueurs, garages et gestionnaires de flotte.");
  choix(form, "Combien de véhicules essence vendez-vous, gérez-vous ou entretenez-vous par an ?",
    ["Moins de 50", "50 à 199", "200 à 499", "500 à 999", "1 000 ou plus"], true);
  choix(form, "Pour quelle part de ces véhicules le constructeur préconise-t-il le SP98 ?",
    ["Aucun", "Moins de 5 %", "5 à 10 %", "10 à 25 %", "25 à 50 %", "Plus de 50 %", "Je ne sais pas"], true);
  form.addParagraphTextItem().setTitle("Marques ou modèles concernés (facultatif)");

  section(form, "Le SP98 pour vos clients");
  cases(form, "Quels problèmes vos clients rencontrent-ils faute de SP98 ?",
    ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Réserves sur la garantie constructeur",
      "Clients qui réclament du SP98", "Aucun problème"]);
  grille(form, "Vos clients achèteraient-ils du SP98 s'il coûtait plus cher que le SP95 de…", AIDE_SP98, PALIERS_SP98, ACHAT_GROUPE);
  cases(form, "Où les premières pompes SP98 seraient-elles le plus utiles à vos clients ?", ZONES);

  section(form, "L'E85 pour vos clients", "L'E85 (superéthanol) pourrait être produit à La Réunion à partir de la canne à sucre.");
  choix(form, "Vos clients connaissent-ils l'E85 ?", CONNAISSANCE_E85, true);
  choix(form, "Combien de véhicules flex-fuel (compatibles E85) avez-vous en stock ou en parc ?",
    ["Aucun", "1 à 5", "6 à 20", "Plus de 20", "Je ne sais pas"]);
  grille(form, "Vos clients rouleraient-ils à l'E85 s'il coûtait…", AIDE_E85, PRIX_E85, ACHAT_GROUPE);
  choix(form, "Proposeriez-vous la pose de boîtiers E85 homologués ?",
    ["Oui, nous le faisons déjà", "Oui, si la demande existe", "Non"]);

  section(form, "Soutenir le projet");
  cases(form, "Accepteriez-vous de… (professionnel)",
    ["Signer une lettre de soutien adressée à la SRPP et à la Préfecture", "Relayer ce questionnaire auprès de vos clients",
      "Participer à une réunion de présentation"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- Clubs ---------------------------------------------------------------------
  const pageClub = section(form, "Votre club ou association");
  choix(form, "Combien de membres compte votre club ?", ["Moins de 20", "20 à 49", "50 à 99", "100 à 249", "250 ou plus"], true);
  choix(form, "Combien de véhicules de vos membres sont préconisés au SP98 par leur constructeur ?",
    ["Aucun", "1 à 9", "10 à 24", "25 à 49", "50 ou plus", "Je ne sais pas"], true);

  section(form, "Le SP98 pour vos membres");
  cases(form, "Quels problèmes vos membres rencontrent-ils faute de SP98 ?",
    ["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation", "Réserves sur la garantie constructeur", "Aucun problème"]);
  grille(form, "Vos membres achèteraient-ils du SP98 s'il coûtait plus cher que le SP95 de…", AIDE_SP98, PALIERS_SP98, ACHAT_GROUPE);
  cases(form, "Où les premières pompes SP98 seraient-elles le plus utiles à vos membres ?", ZONES);

  section(form, "L'E85 pour vos membres", "L'E85 (superéthanol) pourrait être produit à La Réunion à partir de la canne à sucre.");
  choix(form, "Vos membres connaissent-ils l'E85 ?", CONNAISSANCE_E85, true);
  choix(form, "Combien de véhicules de vos membres peuvent rouler à l'E85 ?", ["Aucun", "1 à 9", "10 ou plus", "Je ne sais pas"]);
  grille(form, "Vos membres rouleraient-ils à l'E85 s'il coûtait…", AIDE_E85, PRIX_E85, ACHAT_GROUPE);

  section(form, "Soutenir le projet");
  cases(form, "Accepteriez-vous de… (club)",
    ["Signer une lettre de soutien adressée à la SRPP et à la Préfecture", "Relayer ce questionnaire auprès de vos membres",
      "Organiser une présentation au club"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- Stations-service et distributeurs ----------------------------------------
  const pageStation = section(form, "Votre activité de distribution", "Gérants de station-service et réseaux de distribution.");
  choix(form, "Combien de stations-service exploitez-vous ?", ["1", "2 à 5", "6 à 20", "Plus de 20"], true);
  choix(form, "Quel volume d'essence vendez-vous par an (toutes stations confondues) ?",
    ["Moins de 500 m³", "500 à 999 m³", "1 000 à 2 999 m³", "3 000 à 9 999 m³", "10 000 m³ ou plus"], true);
  choix(form, "Vos clients vous demandent-ils du SP98 ?", ["Souvent", "Parfois", "Jamais"], true);
  choix(form, "Disposez-vous d'une cuve ou d'un compartiment libérable pour un nouveau carburant ?",
    ["Oui", "Oui, après travaux", "Non"], true);
  choix(form, "Quel investissement accepteriez-vous par station pour une pompe et une cuve dédiées ?",
    ["Aucun", "Moins de 20 000 €", "20 000 à 49 999 €", "50 000 à 99 999 €", "100 000 € ou plus"], true);
  choix(form, "Quelle marge de distribution attendez-vous sur un litre de nouveau carburant ?",
    ["Moins de 0,05 €/L", "0,05 à 0,09 €/L", "0,10 à 0,14 €/L", "0,15 €/L ou plus"], true);

  section(form, "Nouveaux carburants");
  cases(form, "Quel carburant envisageriez-vous de distribuer ?", ["SP98", "E85"]);
  cases(form, "Quelles contraintes vous freineraient ?",
    ["Place en cuve", "Coût d'investissement", "Approvisionnement en petits volumes", "Réglementation et sécurité", "Demande trop faible"]);
  cases(form, "Accepteriez-vous de… (station)",
    ["Accueillir une pompe pilote", "Signer une lettre de soutien adressée à la SRPP et à la Préfecture",
      "Participer à une réunion de présentation"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- Filière canne -----------------------------------------------------------
  const pageFiliere = section(form, "Votre activité dans la filière canne");
  choix(form, "Vous êtes", ["Planteur", "Sucrerie", "Distillerie", "Coopérative ou groupement", "Autre acteur de la filière"], true);
  choix(form, "Quel tonnage de canne livrez-vous ou traitez-vous par an ?",
    ["Moins de 500 t", "500 à 1 999 t", "2 000 à 9 999 t", "10 000 t ou plus", "Non concerné"], true);
  choix(form, "Quelle part de la paille de canne (feuilles, têtes) pourrait être récupérée ?",
    ["Aucune", "Moins de 25 %", "25 à 49 %", "50 % ou plus", "Je ne sais pas"]);
  choix(form, "À quel prix céderiez-vous une tonne de paille, bord de champ ?",
    ["Moins de 30 €/t", "30 à 49 €/t", "50 à 79 €/t", "80 €/t ou plus", "Je ne la céderais pas"]);
  choix(form, "Quelle quantité de mélasse pourrait être orientée vers l'éthanol carburant ?",
    ["Aucune", "Moins de 1 000 t", "1 000 à 4 999 t", "5 000 t ou plus", "Non concerné"]);
  choix(form, "À quel prix céderiez-vous une tonne de mélasse ?",
    ["Moins de 100 €/t", "100 à 149 €/t", "150 à 199 €/t", "200 €/t ou plus", "Non concerné"]);

  section(form, "Une unité de production d'éthanol à La Réunion");
  cases(form, "Quel rôle pourriez-vous jouer dans une unité d'éthanol ?",
    ["Fournisseur de matière première", "Partenaire ou actionnaire", "Acheteur de coproduits", "Aucun"]);
  choix(form, "Quel site vous semblerait le plus pertinent ?",
    ["Près de l'usine de Bois-Rouge (Est)", "Près de l'usine du Gol (Sud)", "Sur une distillerie existante", "Sans avis"]);
  cases(form, "Accepteriez-vous de… (filière)",
    ["Signer une lettre de soutien adressée à la SRPP et à la Préfecture", "Participer à une réunion de présentation"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- Coordonnées (tous) -------------------------------------------------------
  const pageContact = section(form, "Vos coordonnées (facultatif)",
    "Uniquement si vous souhaitez être recontacté (lettre de soutien, résultats de l'étude). Laissez vide pour rester anonyme.");
  form.addTextItem().setTitle("Nom et prénom");
  form.addTextItem().setTitle("Structure");
  form.addTextItem().setTitle("Adresse e-mail")
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addCheckboxItem().setTitle("Consentement")
    .setChoiceValues(["J'accepte d'être recontacté au sujet de cette étude. Mes coordonnées ne seront ni publiées ni transmises."]);

  // --- Parcours : le profil choisit le premier écran ; la fin de chaque parcours mène aux coordonnées.
  // Un saut de page fixe la destination de la section qui le précède.
  profil.setChoices([
    ["Particulier", pagePart],
    ["Concessionnaire automobile", pagePro], ["Concessionnaire moto", pagePro], ["Loueur de véhicules", pagePro],
    ["Garage, atelier ou préparateur", pagePro], ["Gestionnaire de flotte d'entreprise", pagePro],
    ["Club ou association automobile", pageClub], ["Club ou association moto", pageClub],
    ["Gérant de station-service", pageStation], ["Distributeur ou réseau pétrolier", pageStation],
    ["Acteur de la filière canne", pageFiliere],
  ].map(([label, page]) => profil.createChoice(label, page)));
  [pagePro, pageClub, pageStation, pageFiliere].forEach((page) => page.setGoToPage(pageContact));

  // --- Feuille de réponses et onglet export --------------------------------------
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  creerExport(ss);
  const vide = ss.getSheetByName("Feuille 1") || ss.getSheetByName("Sheet1");
  if (vide && ss.getSheets().length > 2) ss.deleteSheet(vide);

  Logger.log("Formulaire (édition) : " + form.getEditUrl());
  Logger.log("Formulaire (réponse) : " + form.getPublishedUrl());
  Logger.log("Feuille de réponses : " + ss.getUrl());
}

function section(form, titre, aide) {
  const page = form.addPageBreakItem().setTitle(titre);
  if (aide) page.setHelpText(aide);
  return page;
}

function choix(form, titre, options, obligatoire) {
  return form.addMultipleChoiceItem().setTitle(titre).setChoiceValues(options).setRequired(!!obligatoire);
}

function cases(form, titre, options) {
  return form.addCheckboxItem().setTitle(titre).setChoiceValues(options);
}

function grille(form, titre, aide, lignes, colonnes) {
  return form.addGridItem().setTitle(titre).setHelpText(aide).setRows(lignes).setColumns(colonnes).setRequired(true);
}

function echelle(form, titre, bas, haut) {
  return form.addScaleItem().setTitle(titre).setBounds(1, 5).setLabels(bas, haut);
}

/** Onglet « export » : recopie chaque colonne de réponses, sauf les colonnes personnelles. */
function creerExport(ss) {
  const reponses = ss.getSheets().find((s) => s.getFormUrl());
  const entetes = reponses.getRange(1, 1, 1, reponses.getLastColumn()).getValues()[0];
  const exportSheet = ss.getSheetByName("export") || ss.insertSheet("export");
  exportSheet.clear();
  let col = 1;
  entetes.forEach((titre, i) => {
    if (PERSONNEL.some((p) => String(titre).startsWith(p))) return;
    const lettre = colonne(i + 1);
    exportSheet.getRange(1, col++).setFormula(`=ARRAYFORMULA('${reponses.getName()}'!${lettre}:${lettre})`);
  });
  Logger.log(`Onglet export : ${col - 1} colonnes sur ${entetes.length} (colonnes personnelles exclues).`);
}

function colonne(n) {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
