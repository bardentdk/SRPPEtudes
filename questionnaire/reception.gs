/**
 * Étude Carburants Réunion 2026 : point de réception des réponses du questionnaire du site.
 *
 * Le site (route /api/reponses) envoie chaque réponse ici ; le script l'ajoute en ligne dans
 * l'onglet « Réponses site » de la feuille, en créant les colonnes manquantes au fil de l'eau.
 *
 * Mise en service (une fois) :
 *   1. Créer une Google Sheet, puis Extensions → Apps Script, et coller ce fichier.
 *   2. Paramètres du projet → Propriétés du script : ajouter JETON = une longue chaîne aléatoire
 *      (la même que la variable SHEET_WEBHOOK_TOKEN dans Vercel).
 *   3. Déployer → Nouveau déploiement → Application Web : « Exécuter en tant que : moi »,
 *      « Qui a accès : tout le monde ». Copier l'URL dans SHEET_WEBHOOK_URL (Vercel).
 */

const ONGLET = "Réponses site";

function doPost(e) {
  let corps;
  try {
    corps = JSON.parse(e.postData.contents);
  } catch (err) {
    return reponse({ ok: false, erreur: "JSON invalide" });
  }
  const jeton = PropertiesService.getScriptProperties().getProperty("JETON");
  if (!jeton || corps.jeton !== jeton) return reponse({ ok: false, erreur: "Jeton refusé" });
  if (!corps.ligne || typeof corps.ligne !== "object") return reponse({ ok: false, erreur: "Ligne absente" });

  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    const feuille = SpreadsheetApp.getActiveSpreadsheet();
    const onglet = feuille.getSheetByName(ONGLET) || feuille.insertSheet(ONGLET);
    const entetes = onglet.getLastColumn() ? onglet.getRange(1, 1, 1, onglet.getLastColumn()).getValues()[0] : [];
    Object.keys(corps.ligne).forEach((cle) => {
      if (entetes.indexOf(cle) === -1) entetes.push(cle);
    });
    onglet.getRange(1, 1, 1, entetes.length).setValues([entetes]).setFontWeight("bold");
    onglet.setFrozenRows(1);
    // Une réponse déjà copiée (relance depuis l'admin) n'est pas dupliquée.
    const ids = onglet.getLastRow() > 1 ? onglet.getRange(2, 1, onglet.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
    if (ids.indexOf(corps.ligne.id) === -1) {
      onglet.appendRow(entetes.map((cle) => (corps.ligne[cle] === undefined ? "" : protegerFormule(corps.ligne[cle]))));
    }
  } finally {
    verrou.releaseLock();
  }
  return reponse({ ok: true });
}

/** Empêche qu'un texte saisi dans le questionnaire soit interprété comme une formule. */
function protegerFormule(valeur) {
  return typeof valeur === "string" && /^[=+\-@]/.test(valeur) ? "'" + valeur : valeur;
}

function reponse(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}
