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

## Limites connues

- Aucune source publique ne compte les véhicules pour lesquels le 98 est préconisé : c'est l'hypothèse la plus sensible du modèle SP98.
- Les stations viennent de la BPE 2021 (INSEE), sans enseigne ni volumes vendus.
- Les coûts (logistique, production d'éthanol, taxes) sont des ordres de grandeur, réglables dans l'interface.
