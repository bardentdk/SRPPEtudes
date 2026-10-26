# Carburants Réunion : SP98 importé et E85 local

Tableau de bord d'aide à la décision pour deux projets présentés à la SRPP :

- **SP98 importé** : la demande justifie-t-elle une filière dédiée, à quel prix à la pompe, dans quelles stations pilotes ?
- **E85 produit localement** à partir de la canne (mélasse, paille, bagasse) : quelle ressource, quelle concurrence avec le rhum et l'électricité, quel prix ?

Toutes les données viennent de sources publiques officielles (SDES, INSEE, IGN, Région Réunion, DAAF, Préfecture). Le détail est dans l'onglet « Données et sources ».

## Structure

```
pipeline/run.py                 collecte + traitement (Python, bibliothèque standard uniquement)
pipeline/manual/*.csv           données publiées seulement en PDF (prix préfectoraux, campagnes sucrières)
public/data/dashboard.json      résultat agrégé, versionné, lu par l'application
src/lib/analysis.ts             calculs de viabilité (fonctions pures)
src/lib/hypotheses.ts           hypothèses du modèle, avec leur justification
src/components/                 interface (Leaflet, Recharts, Tailwind)
src/app/api/refresh/route.ts    bouton « Actualiser » : déclenche le workflow GitHub
src/lib/questionnaire/          schéma du questionnaire, agrégation, accès serveur
db/migrations/, scripts/        schéma SQL (Neon), migrations et création des comptes admin
src/app/questionnaire, /admin   questionnaire public et espace admin (routes API sous src/app/api)
questionnaire/reception.gs      copie des réponses dans Google Sheets
public/brand/                   logo en SVG et PNG transparents (sombre pour fond clair, clair pour fond sombre)
.github/workflows/refresh-data.yml   collecte planifiée (lundi 3 h UTC) ou à la demande
```

## En local

```bash
npm install
```

```bash
python3 pipeline/run.py --force
```

```bash
npm run dev
```

Sans `--force`, le pipeline réutilise les fichiers du cache `pipeline/.cache/` s'ils ont moins de 24 h.

## Les trois façons d'actualiser les données

1. **Ligne de commande** : `python3 pipeline/run.py --force`, puis commit de `public/data/dashboard.json`.
2. **Bouton « Actualiser les données »** du site déployé : la route `/api/refresh` lance le workflow GitHub Actions. Celui-ci commite les nouvelles données, ce qui redéclenche le déploiement Vercel (environ 3 minutes en tout). Le bouton refuse un nouveau lancement pendant 10 minutes.
3. **Planification** : le workflow tourne chaque lundi à 3 h UTC. Pour changer la fréquence, modifiez `cron` dans `.github/workflows/refresh-data.yml`.

## Déploiement Vercel

1. Poussez le dépôt sur GitHub, puis importez-le dans Vercel (framework détecté automatiquement).
2. Dans GitHub, Settings > Actions > General : autorisez les workflows en « Read and write permissions ».
3. Créez un jeton GitHub *fine-grained* limité à ce dépôt, avec la permission **Actions : Read and write**.
4. Dans Vercel, Settings > Environment Variables, renseignez les variables listées dans `.env.example`.

Sans ces variables, le site fonctionne normalement ; seul le bouton d'actualisation est désactivé.

## Mettre à jour les saisies manuelles

- `pipeline/manual/prix_prefecture.csv` : prix maximums mensuels (communiqués de la préfecture). Passez `verifie` à `oui` une fois la valeur contrôlée sur l'arrêté.
- `pipeline/manual/campagnes_sucrieres.csv` : tonnage de chaque campagne (notes de conjoncture DAAF). La campagne 2025 sera à ajouter dès la publication de son bilan.

## Questionnaire de demande

Le questionnaire est une page du site, `/questionnaire`. Les questions sont décrites une seule fois dans `src/lib/questionnaire/schema.ts`, avec leur type (choix, curseur, nombre…), les publics concernés et leurs conditions d'affichage. Cette même description sert au formulaire, à la validation côté serveur, à la copie dans la Sheet et à l'agrégation. Changer l'`id` d'une question casse la continuité des réponses déjà enregistrées.

Circuit d'une réponse :
1. **`POST /api/reponses`** : validation par le schéma, puis protections anti-spam (champ piège, 20 s minimum de remplissage, 5 envois par heure et par connexion).
2. **Neon** (Postgres) : la réponse va dans `reponses`, les coordonnées éventuelles dans `contacts`, une table à part. Seules les routes serveur accèdent à la base, avec `DATABASE_URL`, par des requêtes paramétrées.
3. **Google Sheet** : une copie est envoyée via `questionnaire/reception.gs`, une application web Apps Script protégée par jeton. En cas d'échec, l'admin peut relancer la copie.
4. **Tableau de bord** : `GET /api/questionnaire/agregats` calcule en direct des agrégats anonymes. Toute répartition sur moins de 3 réponses est masquée. Le résultat est mis en cache 5 minutes.

## Espace admin

`/admin` : connexion par e-mail et mot de passe (Better Auth, inscription fermée, 5 essais par 5 minutes), réservée aux adresses listées dans `ADMIN_EMAILS`. L'accès est vérifié côté serveur dans la page et dans chaque route `/api/admin/*` ; le proxy (`src/proxy.ts`) ne fait que rediriger.

On y trouve :
- des filtres (public, commune, période, coordonnées), la recherche et le tri ;
- la fiche détaillée de chaque réponse, coordonnées comprises ;
- l'export CSV, avec ou sans coordonnées ;
- la suppression d'une réponse (droit à l'effacement) ;
- l'**analyse IA** : synthèse par Groq des réponses filtrées. Groq ne reçoit aucune coordonnée, et les e-mails, numéros, liens et pseudonymes sont retirés des textes libres.

## Mise en service du questionnaire

1. Dans Neon, utilisez la branche **dev** pour les essais et la branche **production** pour les vraies réponses.
2. Renseignez les variables de `.env.example` : dans `.env.local` avec la chaîne de la branche dev, et dans Vercel avec celle de la production.
3. Appliquez les migrations. Sans option, le script affiche la base visée et ce qui reste à appliquer :

   ```bash
   node --env-file=.env.local scripts/migrer.mjs --appliquer
   ```

4. Créez un compte admin. Le mot de passe est saisi sans écho, et seul son hachage est stocké :

   ```bash
   node --env-file=.env.local scripts/creer-admin.mjs
   ```

5. Déployez `questionnaire/reception.gs` (instructions en tête du fichier), puis créez une clé API sur console.groq.com.

## Modèle économique

- **SP98** : le résultat annuel de la filière est calculé pour chaque surcoût entre +0,05 et +0,40 €/L. La demande vient soit du questionnaire (part des véhicules concernés × adoption déclarée), soit d'une hypothèse de captation.
- **E85, unité de production** : une distillerie de mélasse (1G) et une unité de paille de canne (2G) sont comparées côte à côte. Pour chacune : investissement, exploitation, matière, transport, VAN, TRI, délai de retour, emplois et importations évitées.
- **Implantation** : chaque station-service reçoit un score pondéré sur 9 facteurs (trafic, densité, motorisation des ménages, niveau de vie, parc essence, questionnaire, proximité de l'usine…). Les premières pompes sont choisies avec un écart minimal entre elles.

Les valeurs par défaut viennent de références publiques, citées sous chaque curseur (`src/lib/hypotheses.ts`). Les valeurs sans source sont signalées comme des estimations.

## Limites connues

- Aucune source publique ne compte les véhicules pour lesquels le 98 est préconisé : c'est l'hypothèse la plus sensible du modèle SP98.
- Les stations viennent de la BPE 2021 (INSEE), sans enseigne ni volumes vendus.
- Les coûts (logistique, production d'éthanol, taxes) sont des ordres de grandeur, réglables dans l'interface.
