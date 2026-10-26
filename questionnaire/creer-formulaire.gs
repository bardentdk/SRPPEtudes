/**
 * Étude Carburants Réunion 2026 : création du questionnaire de demande (SP98 et E85).
 *
 * À coller dans un projet Google Apps Script (script.google.com), puis exécuter creerFormulaire().
 * Le script crée :
 *   - le Google Form, avec un parcours adapté au profil du répondant ;
 *   - la Google Sheet de réponses liée ;
 *   - un onglet « export » qui recopie les réponses SANS les colonnes personnelles
 *     (nom, structure, e-mail, consentement, remarques libres). C'est le seul onglet
 *     destiné à être publié en CSV et lu par pipeline/run.py.
 *
 * Chaque exécution crée un nouveau formulaire : ne la relancer que pour repartir de zéro.
 */

const TITRE = "Étude Carburants Réunion 2026";
const SOUS_TITRE = "Enquête sur la demande en SP98 et en E85";

const COMMUNES = ["Bras-Panon", "Cilaos", "Entre-Deux", "L'Étang-Salé", "La Plaine-des-Palmistes", "La Possession",
  "Le Port", "Le Tampon", "Les Avirons", "Les Trois-Bassins", "Petite-Île", "Saint-André", "Saint-Benoît",
  "Saint-Denis", "Saint-Joseph", "Saint-Leu", "Saint-Louis", "Saint-Paul", "Saint-Philippe", "Saint-Pierre",
  "Sainte-Marie", "Sainte-Rose", "Sainte-Suzanne", "Salazie"];

// Intitulés des questions dont les réponses ne doivent jamais sortir de la feuille.
const PERSONNEL = ["Nom et prénom", "Structure", "Adresse e-mail", "Consentement", "Remarques ou suggestions"];

function creerFormulaire() {
  const contact = Session.getActiveUser().getEmail();
  const form = FormApp.create(TITRE);
  form
    .setTitle(`${TITRE} · ${SOUS_TITRE}`)
    .setDescription(
      "Le SP98 n'est pas distribué à La Réunion et aucun carburant n'y est produit à partir de la canne. " +
      "Cette enquête mesure la demande réelle auprès des professionnels et des passionnés de l'automobile et de la moto, " +
      "pour la croiser avec une étude de faisabilité construite sur les données publiques officielles.\n\n" +
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

  // --- 1. Profil -------------------------------------------------------------
  const profil = form.addMultipleChoiceItem().setTitle("Vous répondez en tant que").setRequired(true);
  form.addListItem().setTitle("Commune principale de votre activité ou de votre domicile")
    .setChoiceValues(COMMUNES).setRequired(true);

  // --- 2a. Professionnels ----------------------------------------------------
  const pagePro = form.addPageBreakItem().setTitle("Votre activité")
    .setHelpText("Concessionnaires, loueurs, garages et gestionnaires de flotte.");
  form.addMultipleChoiceItem()
    .setTitle("Combien de véhicules essence vendez-vous, gérez-vous ou entretenez-vous par an ?")
    .setChoiceValues(["Moins de 50", "50 à 199", "200 à 499", "500 à 999", "1 000 ou plus"]).setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle("Pour quelle part de ces véhicules le constructeur préconise-t-il le SP98 ?")
    .setChoiceValues(["Aucun", "Moins de 5 %", "5 à 10 %", "10 à 25 %", "25 à 50 %", "Plus de 50 %", "Je ne sais pas"])
    .setRequired(true);
  form.addParagraphTextItem().setTitle("Marques ou modèles concernés (facultatif)");

  // --- 2b. Clubs -------------------------------------------------------------
  const pageClub = form.addPageBreakItem().setTitle("Votre club ou association");
  form.addMultipleChoiceItem().setTitle("Combien de membres compte votre club ?")
    .setChoiceValues(["Moins de 20", "20 à 49", "50 à 99", "100 à 249", "250 ou plus"]).setRequired(true);
  form.addMultipleChoiceItem()
    .setTitle("Combien de véhicules de vos membres sont préconisés au SP98 par leur constructeur ?")
    .setChoiceValues(["Aucun", "1 à 9", "10 à 24", "25 à 49", "50 ou plus", "Je ne sais pas"]).setRequired(true);

  // --- 2c. Particuliers ------------------------------------------------------
  const pagePart = form.addPageBreakItem().setTitle("Votre véhicule");
  form.addMultipleChoiceItem().setTitle("Quel est votre véhicule principal ?")
    .setChoiceValues(["Voiture essence", "Voiture hybride essence", "Moto de plus de 125 cm³", "Moto ou scooter de 125 cm³ ou moins"])
    .showOtherOption(true).setRequired(true);
  form.addMultipleChoiceItem().setTitle("Quel carburant le constructeur préconise-t-il ?")
    .setChoiceValues(["SP98 uniquement", "SP95 ou SP98", "SP95", "Je ne sais pas"]).setRequired(true);
  form.addMultipleChoiceItem().setTitle("Combien de litres de carburant achetez-vous par mois ?")
    .setChoiceValues(["Moins de 40 L", "40 à 79 L", "80 à 149 L", "150 L ou plus"]).setRequired(true);

  // --- 3. SP98 (tous) --------------------------------------------------------
  const pageSp98 = form.addPageBreakItem().setTitle("Le SP98")
    .setHelpText("Pour les professionnels et les clubs, répondez pour vos clients ou vos membres.");
  form.addCheckboxItem().setTitle("Quels problèmes constatez-vous faute de SP98 ?")
    .setChoiceValues(["Cliquetis ou bruits moteur", "Perte de performance", "Surconsommation",
      "Réserves sur la garantie constructeur", "Clients ou membres qui réclament du SP98", "Aucun problème"])
    .showOtherOption(true);
  form.addGridItem()
    .setTitle("Achèteriez-vous du SP98 s'il coûtait plus cher que le SP95 de…")
    .setHelpText("Pour mémoire, la différence est en général de 0,08 à 0,12 €/L en métropole.")
    .setRows(["+0,10 €/L", "+0,15 €/L", "+0,20 €/L", "+0,25 €/L", "+0,30 €/L"])
    .setColumns(["Oui, à chaque plein", "Oui, de temps en temps", "Non"])
    .setRequired(true);
  form.addCheckboxItem().setTitle("Où les premières pompes SP98 vous seraient-elles le plus utiles ?")
    .setChoiceValues(["Nord (Saint-Denis, Sainte-Marie)", "Ouest (Le Port, La Possession, Saint-Paul)",
      "Route des Tamarins / Saint-Leu", "Sud (Saint-Pierre, Le Tampon, Saint-Louis)",
      "Est (Saint-André, Saint-Benoît)", "Les Hauts"]);

  // --- 4. E85 (tous) ---------------------------------------------------------
  form.addPageBreakItem().setTitle("L'E85 produit localement")
    .setHelpText("L'E85 (superéthanol) contient jusqu'à 85 % d'éthanol. Il pourrait être produit à La Réunion à partir de résidus de la canne à sucre.");
  form.addMultipleChoiceItem().setTitle("Connaissez-vous l'E85 ?")
    .setChoiceValues(["Oui, je l'ai déjà utilisé", "Oui, de nom", "Non"]).setRequired(true);
  form.addMultipleChoiceItem().setTitle("Combien de véhicules flex-fuel (compatibles E85) avez-vous en parc, en stock ou chez vos membres ?")
    .setChoiceValues(["Aucun", "1 à 5", "6 à 20", "Plus de 20", "Je ne sais pas"]);
  form.addScaleItem().setTitle("Seriez-vous prêt à installer un boîtier E85 homologué (environ 700 à 1 500 €) ?")
    .setBounds(1, 5).setLabels("Pas du tout", "Tout à fait");
  form.addMultipleChoiceItem().setTitle("Jusqu'à quel prix achèteriez-vous de l'E85 ?")
    .setHelpText("Un véhicule consomme environ 25 % de plus en E85 qu'en SP95.")
    .setChoiceValues(["Moins de 1,00 €/L", "1,00 à 1,19 €/L", "1,20 à 1,39 €/L", "1,40 €/L ou plus", "Je n'en achèterais pas"]);
  form.addScaleItem().setTitle("Quelle importance accordez-vous à un carburant produit localement, à partir de la canne ?")
    .setBounds(1, 5).setLabels("Aucune", "Très grande");

  // --- 5. Engagement ---------------------------------------------------------
  form.addPageBreakItem().setTitle("Soutenir le projet");
  form.addCheckboxItem().setTitle("Accepteriez-vous de…")
    .setChoiceValues(["Signer une lettre de soutien adressée à la SRPP et à la Préfecture",
      "Relayer ce questionnaire auprès de votre réseau", "Participer à une réunion de présentation",
      "Accueillir une pompe pilote (stations-service)"]);
  form.addParagraphTextItem().setTitle("Remarques ou suggestions");

  // --- 6. Coordonnées (facultatives) -----------------------------------------
  form.addPageBreakItem().setTitle("Vos coordonnées (facultatif)")
    .setHelpText("Uniquement si vous souhaitez être recontacté (lettre de soutien, résultats de l'étude). Laissez vide pour rester anonyme.");
  form.addTextItem().setTitle("Nom et prénom");
  form.addTextItem().setTitle("Structure");
  form.addTextItem().setTitle("Adresse e-mail")
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  form.addCheckboxItem().setTitle("Consentement")
    .setChoiceValues(["J'accepte d'être recontacté au sujet de cette étude. Mes coordonnées ne seront ni publiées ni transmises."]);

  // --- Parcours selon le profil ----------------------------------------------
  profil.setChoices([
    profil.createChoice("Concessionnaire automobile", pagePro),
    profil.createChoice("Concessionnaire moto", pagePro),
    profil.createChoice("Loueur de véhicules", pagePro),
    profil.createChoice("Garage, atelier ou préparateur", pagePro),
    profil.createChoice("Gestionnaire de flotte d'entreprise", pagePro),
    profil.createChoice("Club ou association automobile", pageClub),
    profil.createChoice("Club ou association moto", pageClub),
    profil.createChoice("Particulier", pagePart),
  ]);
  // une section se termine au saut de page suivant : on renvoie pros et clubs vers le SP98
  pageClub.setGoToPage(pageSp98);
  pagePart.setGoToPage(pageSp98);

  // --- Feuille de réponses et onglet export ----------------------------------
  const ss = SpreadsheetApp.create(`${TITRE} · réponses`);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  creerExport(ss);

  Logger.log("Formulaire (édition) : " + form.getEditUrl());
  Logger.log("Formulaire (réponse) : " + form.getPublishedUrl());
  Logger.log("Feuille de réponses : " + ss.getUrl());
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
