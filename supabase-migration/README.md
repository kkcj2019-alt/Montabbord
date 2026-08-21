# Guide : Créer votre compte et paramétrer Supabase

> ⏱️ Durée : ~10 minutes. Gratuit pour commencer (plan Free suffisant).

---

## Étape 1 — Créer le compte

1. Allez sur **https://supabase.com**
2. Cliquez sur **Start your project** (ou **Sign Up**)
3. Inscrivez-vous avec :
   - votre compte **GitHub** (le plus rapide), ou
   - un email + mot de passe

## Étape 2 — Créer le projet

1. Une fois connecté, cliquez sur **New project**
2. Remplissez :
   - **Name** : `montabbord`
   - **Database Password** : générez un mot de passe fort et **sauvegardez-le** (vous en aurez besoin pour les migrations de données). Il ne sera plus affiché ensuite.
   - **Region** : choisissez la plus proche (ex: `West EU (Paris)` ou `Central EU (Frankfurt)`)
   - **Plan** : Free
3. Cliquez sur **Create new project** et patientez ~2 minutes (provisioning).

## Étape 3 — Exécuter le schéma SQL

1. Dans le menu de gauche, cliquez sur **SQL Editor** (icône `>_`)
2. Cliquez sur **New query**
3. Ouvrez le fichier `schema.sql` (dans ce dossier), copiez **tout** son contenu et collez-le dans l'éditeur
4. Cliquez sur **Run** (ou `Ctrl+Enter`)
5. Vous devez voir `Success. No rows returned` ✅

Vérification : dans le menu **Table Editor**, vous devez voir vos 7 tables :
`enterprises`, `enterprise_index`, `sessions`, `backups`, `license_keys`, `reset_codes`, `super_admin_config`

## Étape 4 — Récupérer les clés de connexion

1. Menu de gauche → **Project Settings** (⚙️ en bas) → **API**
2. Notez ces 3 informations (vous en aurez besoin pour la migration du code, PAS maintenant) :

| Clé | Où la trouver | Exemple |
|---|---|---|
| **Project URL** | Section "Project URL" | `https://abcdefgh.supabase.co` |
| **anon public key** | Section "Project API Keys" → `anon` / `public` | `eyJhbGciOi...` (longue chaîne) |
| **service_role key** | Même section → `service_role` | ⚠️ Secret — ne jamais mettre côté navigateur |

> 🔒 La clé `anon` est celle qui remplacera la config Firebase dans votre HTML.
> La clé `service_role` ne sert que pour des scripts serveur (migration de données).

## Étape 5 — Activer l'authentification par email/mot de passe

1. Menu de gauche → **Authentication** → **Providers**
2. **Email** doit être activé (c'est le cas par défaut)
3. Dans **Authentication → Sign In / Up**, vous pouvez désactiver
   **"Confirm email"** pendant la migration (pour reproduire le comportement
   Firebase actuel qui crée les comptes sans vérification email).
   Vous pourrez la réactiver plus tard.

## Étape 6 — Sauvegarder vos données Firestore (déjà fait ✅)

Votre fichier `firestore_backup.json` à la racine contient déjà une exportation
de vos données. Pour une sauvegarde complète et fraîche au moment de la
migration, on utilisera aussi l'export officiel Firestore (je m'en occuperai
quand vous donnerez le OK).

---

## ✅ Checklist de préparation

- [ ] Compte Supabase créé
- [ ] Projet `montabbord` créé (mot de passe DB sauvegardé)
- [ ] `schema.sql` exécuté sans erreur
- [ ] 7 tables visibles dans Table Editor
- [ ] Project URL + anon key notées en lieu sûr
- [ ] "Confirm email" désactivé dans Authentication

Une fois cette checklist terminée, dites-le-moi avec votre **OK**, et je
commencerai la migration du code (sans toucher à ce que vous êtes en train
de modifier — je travaillerai sur une copie/branche si vous préférez).
