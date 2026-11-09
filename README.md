# BOT Discord du Commando Kieffer

Bot du serveur Discord du CK : recrutement, liens avec le forum, profils, informations. Il reçoit les
interactions Discord en HTTP (pas de connexion permanente à la gateway) sur `POST /interactions`.

## Installation

Node.js 20 ou plus récent.

```sh
npm install
cp .env.example .env   # puis remplir les valeurs
npm start              # ou `npm run dev` pour relancer à chaque modification
```

En production le bot tourne avec pm2, derrière Apache (`discord.commandokieffer.com` → `localhost:3000`).

Au démarrage, le bot installe les commandes manquantes, met à jour celles qui ont changé et supprime
celles listées dans `REMOVED_COMMANDS` (`src/commands/definitions.js`).

## Configuration

- `.env` : identifiants, rôles, base de données, API du forum. Voir `.env.example`. Le bot refuse de
  démarrer sans `APP_ID`, `GUILD_ID`, `DISCORD_TOKEN` et `PUBLIC_KEY`, et signale les autres variables absentes.
- `data/content.json` : textes et liens affichés aux membres (jeu actuel, sites du CK, spé, liens du profil).
  Il peut être modifié sans toucher au code ; il est vérifié au démarrage (un lien doit être en https).
  Redémarrer le bot après modification.

## Forum

Les comptes XenForo (pseudo, groupe principal, groupes secondaires) sont modifiés via l'API REST du forum,
au nom du compte `CK_FORUM_API_USER` (33, Ohliger, par défaut), qui doit être administrateur : XenForo
recalcule les permissions et applique ses propres règles (pseudo unique...). Ce compte étant super-administrateur,
XenForo ne protège pas les autres super-administrateurs.
Les fiches de recrutement sont postées au nom de la recrue.

La base de données reste utilisée pour ce que l'API ne connaît pas : la colonne `xf_user.discord_id`, les
tables du CK (`infos_recrutement`, `complaint`, `medal_attribut`) et les compteurs du panel.

L'API doit être appelée en https (`https://forum.commandokieffer.com/index.php/api` en production). Seul le
forum de test local (`http://forum.commandokieffer.ch/index.php/api`, sous WAMP) est accepté en http, car la
clé d'API est une clé super-utilisateur.

## Tests

```sh
npm test
```

Les tests utilisent le runner intégré à Node (`node:test`), sans dépendance supplémentaire. Discord, le forum
et la base de données sont remplacés par des doublures : aucun test ne fait d'appel réseau.

## Organisation du code

```
app.js                  point d'entrée : configuration, serveur HTTP, enregistrement des commandes
data/content.json       textes et liens modifiables
src/
  config.js             lecture et vérification des variables d'environnement
  content.js            chargement et vérification de data/content.json
  logger.js             logs horodatés, secrets masqués
  container.js          assemblage des dépendances
  server.js             serveur Express et route /interactions
  ranks.js              troops, bordées, pseudos et rôles
  clients/              appels HTTP à Discord et au forum, accès MySQL
  services/             appels Discord utilisés par le bot, accès aux données du forum
  features/             logique de chaque commande
  interactions/         aiguillage des commandes et formulaires, réponses
  forms/                formulaires (modals) Discord
  commands/             définition et enregistrement des commandes
  security/             droits, signature Discord, validation des identifiants
test/                   tests, même arborescence que src/
```

Les messages d'erreur affichés aux membres se terminent par un code (`CODE U32`, `CODE R307`...) qui
permet de retrouver l'erreur détaillée dans les logs.
