# Plan de migration Firestore → Supabase (pour plus tard, sur votre OK)

> ⚠️ **Rien de tout ceci n'est exécuté actuellement.** Ce document décrit
> ce qui sera fait quand vous aurez fini vos modifications en cours et
> donné votre accord.

---

## Vue d'ensemble

| | Avant (Firebase) | Après (Supabase) |
|---|---|---|
| Base de données | Firestore (NoSQL) | PostgreSQL + JSONB |
| Authentification | Firebase Auth | Supabase Auth |
| Temps réel | `onSnapshot` | Supabase Realtime |
| Hébergement app | Firebase Hosting | **Firebase Hosting (inchangé)** |
| Hors-ligne | `enablePersistence` | IndexedDB / à définir |

**Principe clé** : les données métier (`mdb_clients`, `mdb_factures`,
`mdb_bc`, `mdb_caisses`, `mdb_stocks`, `mdb_employes`, `mdb_comptabilite`,
`mdb_reglements`, paie...) restent stockées telles quelles dans une colonne
JSONB → **zéro perte, zéro transformation** de vos données.

---

## Phase 1 — Migration des données (sans toucher au code)

1. Export complet et frais de Firestore (via `firebase firestore:export`
   ou lecture de toutes les collections avec le SDK admin)
2. Script Node.js `migrate.js` :
   - lit chaque document `enterprises/{uid}` (+ sous-collections sessions/backups)
   - insère dans PostgreSQL : table `enterprises`, colonne `data` (JSONB)
   - migre `enterpriseIndex`, `licenseKeys`, `resetCodes`, `superAdmin/config`
3. Vérification : comptage des enregistrements source vs destination,
   contrôle d'intégrité par échantillonnage (clients, factures, BC...)
4. **Création des utilisateurs** dans Supabase Auth (mêmes emails/mots de passe)

⚠️ Point important : les mots de passe Firebase ne sont pas exportables.
Deux options possibles (à choisir au moment venu) :
- **Option A** : réinitialisation de mot de passe obligatoire au 1er login
- **Option B** : garder Firebase Auth uniquement pour l'authentification,
  et utiliser Supabase seulement comme base de données (moins de changements)

## Phase 2 — Migration du code

Fichiers concernés : `public/index.html` (~113 appels), `public/paye.html` (3 appels).

1. Ajouter le SDK `@supabase/supabase-js` (fichier local dans `public/`,
   comme pour firebase-sdk)
2. Créer un petit module adaptateur `db.js` qui expose les mêmes fonctions
   que maintenant (getDoc, setDoc, onSnapshot...) mais vers Supabase →
   **minimise les modifications dans votre code métier**
3. Remplacer progressivement les appels Firestore par l'adaptateur
4. Adapter la connexion (login entreprise/utilisateur) à Supabase Auth
5. Tester chaque module : clients, bons de commande, caisse, situation,
   paie, factures, stocks...

## Phase 3 — Bascule

1. Sauvegarde finale Firestore
2. Migration des données delta (créées entre-temps)
3. Déploiement sur Firebase Hosting (inchangé)
4. Période de double-vérification avant désactivation Firestore

---

## Concernant l'écrasement des données

Vous mentionnez que Firebase « écrase à chaque fois » vos données. C'est le
comportement actuel : chaque appareil écrit le document entier de
l'entreprise (`set(..., {merge:true})`), donc deux personnes connectées en
même temps peuvent s'écraser mutuellement.

Supabase ne corrige pas ça automatiquement — c'est un choix d'architecture —
mais la migration est l'occasion de l'améliorer si vous voulez :
- **Option simple** : garder le modèle actuel (document JSONB entier),
  comportement identique
- **Option améliorée** : écrire section par section (clients séparés de la
  caisse, etc.) via des clés JSONB distinctes → moins d'écrasements
- **Option complète** : normaliser en tables relationnelles (plus long)

Ma recommandation : commencer avec l'option simple (migration fidèle et
sûre), puis améliorer ensuite sans risque.

## Renforcement sécurité (après migration)

Les règles Firestore actuelles sont très ouvertes (`allow read/write: if true`).
Avec Supabase on pourra verrouiller proprement :
- chaque entreprise ne lit/écrit QUE ses propres lignes (`auth.uid() = id`)
- `license_keys` modifiables uniquement par le super admin
- suppression des politiques transitoires du `schema.sql`
