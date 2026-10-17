# Repeated Workflow Detector

Pipe screenpipe qui détecte, sans IA, un travail répété du type « un élément ouvert dans une app A est suivi de la création d'un nouvel enregistrement dans une app B », puis écrit le dossier complet que l'IA de construction (n8n) utilisera.

## Lancer

- Depuis l'app screenpipe : section des automatisations → « Repeated Workflow Detector » → lancer.
- En ligne de commande, depuis ce dossier, avec une clé d'API locale : `SCREENPIPE_LOCAL_API_KEY=… bun ./detect.ts --out ./output --handoff`

Options : `--start ISO`, `--end ISO` (par défaut : aujourd'hui depuis minuit), `--min-occurrences 3`, `--window-minutes 8`, `--webhook URL`, `--notify` (envoie aussi une notification depuis le script).

Dans l'app, le bouton « Find an automation » (Automatisations, à côté de la cloche) lance ce pipe, lit `handoff.json`, ajoute le Flow aux Recommendations et envoie la notification « New automation », dont le bouton Open ouvre l'écran de revue.

## Ce qu'il produit (dans `output/`)

| Fichier | Contenu |
|---|---|
| `result.md` / `result.json` | Séquences détectées, occurrences, preuves (numéros de captures) |
| `handoff.json` | Dossier pour l'IA de construction (format ci-dessous) |
| `handoff.md` | Le même dossier, lisible par un humain |
| `warnings.log` | Captures introuvables ou requêtes en échec, s'il y en a |

Si un webhook est configuré, `handoff.json` lui est envoyé en `POST` (JSON).

## Brancher l'IA de construction

Mettre l'adresse du webhook (par exemple un nœud Webhook n8n) dans `config.json` :

```json
{ "webhook": "https://…/webhook/…" }
```

Ou définir `SCREENPIPE_HANDOFF_WEBHOOK`, ou passer `--webhook URL`. Aucun identifiant Gmail ou Jira n'est jamais inclus dans le dossier.

## Format de `handoff.json` (`screenpipe.automation-handoff/v1`)

| Champ | Description |
|---|---|
| `problem` | La problématique en une phrase |
| `trigger` | App source, événement, compte (ex. boîte mail), URL |
| `target` | App cible, action, préfixe de clé (ex. `NOVA`), URL du site, modèle d'URL d'un enregistrement |
| `evidence` | Nombre d'occurrences (dont étoilées), sessions, jours, écart médian, clés créées |
| `observedSteps` | Actions répétées par l'utilisateur, dans l'ordre habituel |
| `examples[]` | Paires réelles `input` (texte du message capturé) → `output` (texte de l'enregistrement créé : type, résumé, description, personne assignée, étiquettes, priorité, dates) |
| `openQuestions` | Décisions que la détection ne peut pas trancher (règles de champs, message incomplet, validation humaine, réponse à l'expéditeur, identifiants) |
| `acceptanceTest` | Comment vérifier l'automatisation construite |
| `detector` | Méthode, sources, plage analysée, règle |

## Règle de détection

1. Lire les clics et changements de fenêtre (`GET /search?content_type=input`), par tranches de 30 minutes.
2. Classer chaque fenêtre : page d'accueil (on en part vers beaucoup d'autres pages), élément (un message, un document), enregistrement (clé du type `ABC-123` dans le titre).
3. Un enregistrement est nouveau s'il apparaît pour la première fois juste après un clic « Créer », « Create » ou équivalent.
4. Relier chaque création à l'élément d'une autre app ouvert dans les 8 minutes précédentes, de préférence celui dont le titre ressemble le plus.
5. Retenir la séquence si elle revient sur au moins 3 occasions séparées ou 2 jours différents. Les sessions étoilées servent d'exemples prioritaires.

Limites : seules les créations précédées d'un clic de type « Créer » et identifiées par une clé sont repérées ; les durées viennent de l'horodatage des événements, pas d'un temps de travail mesuré.
