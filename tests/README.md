# Suite de tests — Montabbord

Contrôle automatique des trois applications (`index.html`, `paye.html`, `production.html`).

## Lancer

```bash
npm test                 # tous les contrôles
node tests/run.js        # equivalent
node tests/run.js --only=03    # uniquement le rendu des pages
node tests/run.js --verbose    # detail
```

Code de sortie : **0** si tout passe, **1** sinon (utilisable dans un script ou en intégration continue).

Durée : environ 12 secondes. Aucune dépendance à installer, aucune connexion réseau.

## Ce qui est contrôlé

| Étape | Fichier | Ce qu'il vérifie |
|---|---|---|
| 1 | `01-syntaxe.js` | Chaque bloc `<script>` est analysé par le moteur JavaScript (pas de comptage d'accolades : c'est le moteur qui décide). |
| 2 | `02-fonctions.js` | Aucune fonction définie deux fois au niveau global. En JavaScript la dernière écrase les autres : un doublon est du code mort, et si les deux versions diffèrent, c'est une régression silencieuse. Le contrôle compare aussi le contenu des versions pour signaler les fonctionnalités perdues. |
| 3 | `03-pages.js` | **Toutes** les pages des trois applications sont rendues avec trois jeux de données : vide, réaliste, et **volontairement corrompu** (chaque section transformée en objet, en chaîne ou en nombre). Détecte les exceptions, et aussi l'écran d'erreur d'Exploitation qui masque une exception rattrapée. |
| 4 | `04-fonctionnalite.js` | Garde-fous sur les comportements corrigés ou spatiaux : pointage, détail d'inventaire, code de validation administrateur, modification d'achat, dette fournisseur, coût de revient, CUMP. |

## Le test des tests

`verifier-que-ca-detecte.js` sabote volontairement le code et vérifie que la suite le remarque.
C'est indispensable : une suite qui ne détecte rien ne protège de rien.

```bash
node tests/verifier-que-ca-detecte.js
```

Il simule trois régressions (lecture non protégée, bouton supprimé, calcul neutralisé) et doit
signaler un échec dans les trois cas, puis repasser au vert après restauration.

## Ajouter un contrôle

Dans `04-fonctionnalite.js`, ajouter une entrée au tableau retourné par `controles()` :

```js
{
  nom: 'Exploitation : mon controle',
  app: 'production.html',
  store: storeRealiste,
  code: `/* code exécuté dans l'application */ 'OK'`,
  attendu: 'OK'          // ou attenduPrefixe: 'OK'
}
```

Pour ajouter une page à tester, compléter la liste `pages` dans `DISPATCH` (`03-pages.js`).

## Organisation

```
tests/
  run.js                        lanceur
  01-syntaxe.js                 analyse des blocs de script
  02-fonctions.js               doublons et conflits de fonctions
  03-pages.js                   rendu de toutes les pages
  04-fonctionnalite.js          garde-fous fonctionnels
  verifier-que-ca-detecte.js    meta-test de la suite
  lib/
    extract.js                  extraction et analyse des fichiers
    sandbox.js                  DOM simulé + jeux de données
    rapport.js                  mise en forme du bilan
  smoke.js                      ancien contrôle statique (conservé)
```

## Conseils

- Lancer `npm test` **avant** de déployer.
- Ajouter un garde-fou dans `04-fonctionnalite.js` à chaque fois qu'on corrige un bug : c'est ce qui empêche le bug de revenir.
