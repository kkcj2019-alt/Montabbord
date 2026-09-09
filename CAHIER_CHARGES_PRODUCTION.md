# CAHIER DES CHARGES — Module Production & Modules Complémentaires

> **Objectif** : Documenter les fonctionnalités de l'application ACSER (acser-sas.com) à intégrer dans Montabbord.
> **Principe** : Seuls les modules/fonctionnalités **absents de Montabbord** sont documentés ici. Les modules déjà existants (Facturation, Trésorerie, Paie de base, RH de base, Comptabilité, Actif, Administration) ne sont pas répétés.

---

## TABLE DES MATIÈRES

1. [Architecture Générale](#1-architecture-générale)
2. [Module Production](#2-module-production)
3. [Module Stock Avancé](#3-module-stock-avancé)
4. [Module Articles & Nomenclature](#4-module-articles--nomenclature)
5. [Module Traitement Thermique](#5-module-traitement-thermique)
6. [Module Maintenance (Prestations)](#6-module-maintenance-prestations)
7. [Module RH Avancé](#7-module-rh-avancé)
8. [Module Rapports](#8-module-rapports)
9. [Module Commandes Clients Avancé](#9-module-commandes-clients-avancé)
10. [Module Livraisons Clients Avancé](#10-module-livraisons-clients-avancé)
11. [Coût de Revient](#11-coût-de-revient)
12. [Structure de Données Complète](#12-structure-de-données-complète)
13. [API Endpoints Nécessaires](#13-api-endpoints-nécessaires)
14. [Système de Permissions](#14-système-de-permissions)

---

## 1. Architecture Générale

### 1.1 Structure de la sidebar (nouveaux menus)

```
EXPLOITATION
  ├── Production              ← NOUVEAU
  │   ├── Nouvelle Saisie
  │   └── Historique Production
  ├── Stock Avancé            ← ENRICHI (remplace/augmente stock existant)
  │   ├── Gestion Palettes
  │   ├── Produits Finis
  │   ├── Semi-Finis
  │   ├── Matière Première
  │   ├── Marchandises
  │   ├── Consommables
  │   └── Inventaire
  └── Traitement Thermique    ← NOUVEAU
      ├── Opérations
      └── Types de Produits

NOMENCLATURE ARTICLES         ← NOUVEAU
  └── Articles
      ├── Catalogue Produits
      ├── Fiche Technique
      ├── Définitions Composants
      ├── Marchandises
      └── Gestion des Essences

APPROVISIONNEMENT             ← NOUVEAU (complète achats existants)
  └── Achat
      ├── Produits Finis
      ├── Semi-Finis
      ├── Matière Première
      ├── Marchandises
      └── Consommable et Divers

LOGISTIQUE ET COMMERCIAL
  ├── Commandes               ← ENRICHI (déjà existant, ajouter fonctionnalités)
  ├── Livraisons              ← ENRICHI
  ├── Journal de Vente        ← NOUVEAU
  ├── Coût de Revient         ← NOUVEAU
  └── Prestations             ← NOUVEAU
      ├── Préventive
      └── Corrective

GÉNÉRAL
  ├── Rapports                ← NOUVEAU (module dédié)
  └── RH & Présence           ← ENRICHI (RH existe, ajouter pointage avancé)
```

### 1.2 Système de rôles & permissions

Chaque menu/sous-menu a une clé de permission. Exemples :

| Menu | Permission |
|------|-----------|
| Production > Saisie | `production.saisie` |
| Production > Historique | `production.history` |
| Stock > Palettes | `stock.palettes` |
| Stock > MP | `stock.raw-materials` |
| Articles > Catalogue | `articles.catalogue` |
| Articles > Fiche Tech | `articles.fiche-technique` |
| Traitement > Opérations | `thermal.operations` |
| RH > Présence | `attendance.presence` |
| RH > Congés | `attendance.leaves-annual` |

**Logique** : Un user a un rôle → le rôle a des permissions → chaque page vérifie `canAccessSection(permissionKey)` avant affichage.

---

## 2. Module Production

### 2.1 Page : Nouvelle Saisie (`/production`)

**But** : Enregistrer une session de production (quantités produites par article, par phase).

#### Formulaire de saisie
| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| Date | date | Oui | Date de la session de production |
| Article / Produit | select/search | Oui | Article produit (lié au catalogue) |
| Phase | select | Oui | Phase de production (I à VI) |
| Quantité | number | Oui | Nombre d'unités produites |
| Employé(s) | multi-select | Non | Ouvriers affectés |
| Heures de travail | number | Non | Heures totales de la session |
| Observations | textarea | Non | Notes libres |

#### Phases de production (étapes du processus bois)
| Phase | Code | Description |
|-------|------|-------------|
| I | SORTIE_DU_BOIS | Sortie du bois (réception matière première) |
| II | LATTES | Découpe en lattes |
| III | PLOTS | Fabrication de plots |
| IV | CONTREPLAQUE | Contreplaqué |
| V | ASSEMBLAGE | Assemblage (produits finis) |
| VI | EN_COURS | En cours de production |

#### Logique métier
- Quand on crée une saisie → le stock de l'article en cours d'incrémente
- Quand on valide → le stock fini est mis à jour
- Les pertes sont enregistrées séparément (onglet historique)
- Chaque saisie peut être liée à un **Ordre de Production**

#### Actions disponibles
| Bouton | Action |
|--------|--------|
| Enregistrer | Sauvegarde brouillon |
| Valider | Valide la production, met à jour les stocks |
| Annuler | Supprime la saisie |
| Imprimer | Génère un bon de production PDF |
| Exporter Excel | Exporte la liste |

### 2.2 Page : Historique Production (`/production/history`)

**Tableau** colonnes :
| Colonne | Description |
|---------|-------------|
| N° | Numéro auto-généré |
| Date | Date de la saisie |
| Article | Produit concerné |
| Phase | Phase de production |
| Quantité | Qté produite |
| Pertes | Qté perdue (si applicable) |
| Employé(s) | Ouvriers |
| Statut | Brouillon / Validé / Abandonné |
| Actions | Voir / Modifier / Supprimer |

**Onglets** :
- **Saisies** : historique des productions
- **Pertes** : historique des pertes de production

**Filtres** : date (depuis/jusqu'article), phase, statut, employé

### 2.3 Page : Ordres de Production (`/production-orders`)

**But** : Planifier et suivre les ordres de fabrication.

#### Liste des ordres
| Colonne | Description |
|---------|-------------|
| N° OP | Numéro d'ordre (auto: OP-XXXX) |
| Date prévue | Date cible |
| Article | Produit à fabriquer |
| Quantité prévue | Qté demandée |
| Quantité réalisée | Qté produite (cumul) |
| Progression | % avancement |
| Statut | Brouillon / En cours / Terminé / Annulé |
| Priorité | Haute / Moyenne / Basse |

#### Formulaire nouvel ordre (`/production-orders/new`)
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Article | select | Oui |
| Quantité prévue | number | Oui |
| Date prévue | date | Oui |
| Priorité | select | Oui |
| Date de début | date | Non |
| Notes | textarea | Non |

#### Détail d'un ordre (`/production-orders/:id`)
Onglets :
1. **Informations** : données générales
2. **Articles / Composants** : liste des composants nécessaires (fiche technique)
3. **Personnel affecté** : ouvriers assignés
4. **Documents** : fichiers joints
5. **Historique** : journal des modifications
6. **Jours de production** : suivi journalier

#### Logique des statuts
```
Brouillon → En cours → Terminé
                     → Annulé
```

#### API endpoint dédié
- `GET /production-orders/stats` : statistiques (nb en cours, terminés, retard)
- `PUT /production-orders/:id/status` : changer le statut
- `PUT /production-orders/:id/progress` : mettre à jour la progression
- `POST /production-orders/:id/items` : ajouter un composant
- `POST /production-orders/:id/personnel` : affecter un employé
- `GET /production-orders/:id/history` : historique
- `GET /production-orders/next-number` : prochain numéro
- `GET /production-orders/stock-check/:code?volume=:vol` : vérifier stock dispo
- `GET /production-orders/product-components/:id` : composants d'un produit
- `GET /production-orders/report` : rapport de production

### 2.4 Réparations (`/repairs`)

**But** : Gérer les réparations de palettes.

| Champ | Type |
|-------|------|
| Date | date |
| Palette / Produit | select |
| Type de réparation | select |
| Coût | number |
| Employé | select |
| Observations | textarea |

#### API
- `GET /palette-repairs`
- `POST /palette-repairs`
- `DELETE /palette-repairs/:id`

---

## 3. Module Stock Avancé

> Montabbord a un stock de base. ACSER a une gestion multi-catégories beaucoup plus poussée.

### 3.1 Catégories de stock

| Catégorie | Description | Logic spécifique |
|-----------|-------------|-----------------|
| **Palettes** | Palettes finies | Suivi par type, état (neuf/réparé), stock par emplacement |
| **Produits Finis** | PF issus de la production | Mis à jour par les saisies de production |
| **Semi-Finis** | Produits intermédiaires | Consommés par la phase suivante |
| **Matière Première** | Bois brut, entrées par achats | Gestion par essence, volume, BL fournisseur |
| **Marchandises** | Produits achetés pour revente | Pas de transformation |
| **Consommables** | Fourrages, clous, colles | Consommation interne |

### 3.2 Gestion Palettes (`/stock`)

**Tableau principal** :
| Colonne | Description |
|---------|-------------|
| Code | Code unique palette |
| Désignation | Nom/description |
| Type | Type de palette |
| État | Neuf / Réparé / Hors service |
| Quantité | Stock disponible |
| Emplacement | Position physique |
| Valeur | Prix unitaire × qté |

**Actions** :
- Ajouter palette
- Modifier
- Déplacer (changement d'emplacement)
- Réparer (passe en status "réparation")
- Inventaire physique

### 3.3 Matière Première (`/stock/raw-materials`)

**Onglets** :
| Onglet | Description |
|--------|-------------|
| **Global (Actif)** | Vue globale du stock MP |
| **Résumé Initial** | Stock initial en début de période |
| **WIP** | Work In Progress (en cours de transformation) |
| **BL** | MP reçue par bons de livraison fournisseur |

**Formulaire d'entrée** :
| Champ | Type |
|-------|------|
| Essences de bois | select |
| Volume (m³) | number |
| Fournisseur | select |
| BL Référence | text |
| Prix unitaire | number |
| Date réception | date |

#### Mouvements de stock
```
Entrées : Achats fournisseurs, Récoltage, Retour production
Sorties : Consommation production, Ventes, Pertes
```

**API mouvements** :
| Endpoint | Description |
|----------|-------------|
| `GET /movements` | Liste des mouvements |
| `GET /movements?code=:code` | Mouvements d'un article |
| `POST /movements` | Nouveau mouvement |
| `PUT /movements/:id` | Modifier |
| `DELETE /movements/:id` | Supprimer |

### 3.4 Inventaire (`/inventory`)

**But** : Comptage physique周期ique.

| Champ | Type |
|-------|------|
| Date inventaire | date |
| Catégorie | select |
| Articles comptés | nombre |
| Écarts trouvés | nombre |
| Statut | Brouillon / Validé |

**API** :
- `GET /inventories` / `POST /inventories` / `PUT /inventories/:id`
- `POST /inventories/:id/validate` : valider l'inventaire

### 3.5 Mouvements de stock (`/stock/movements`)

Chaque mouvement a :
| Champ | Type |
|-------|------|
| Date | date |
| Type | Entrée / Sortie / Transfert |
| Article | select |
| Quantité | number |
| Prix unitaire | number |
| Référence | text (BC, BL, OP...) |
| Motif | textarea |
| Utilisateur | auto |

---

## 4. Module Articles & Nomenclature

### 4.1 Catalogue Produits (`/articles`)

**Tableau** :
| Colonne | Description |
|---------|-------------|
| Code | Code article (auto-généré) |
| Désignation | Nom du produit |
| Catégorie | PF / Semi-finis / MP / Marchandise / Réparation / Thermique |
| Unité | m² / m³ / unité / kg |
| Prix de revient | Coût calculé |
| Prix de vente | Prix catalogue |
| Stock actuel | Quantité en stock |
| Statut | Actif / Inactif |

**Formulaire** :
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Code | text | Auto |
| Désignation | text | Oui |
| Catégorie | select | Oui |
| Unité | select | Oui |
| Essences | select (multi) | Non |
| Prix de revient | number | Calculé |
| Prix de vente | number | Non |
| Dimensions | text | Non |
| Poids | number | Non |
| Image | file | Non |

#### Catégories d'articles
| Code | Libellé |
|------|---------|
| LATTES | Lattes |
| finished | Produits finis |
| semi | Semi-finis |
| merchandise | Marchandises |
| repair | Réparations |
| thermal | Thermique |
| article | Articles divers |

### 4.2 Fiche Technique (`/articles/fiche-technique`)

**But** : Définir la nomenclature (composition) d'un produit fini.

**Exemple** : Une palette = 4 plots + 8 lattes + 12 clous

| Champ | Type |
|-------|------|
| Produit fini | select |
| Composant (article) | select |
| Quantité par unité | number |
| Phase | select (I-VI) |
| Ordre | number (ordre d'assemblage) |

**Logique** : Quand on crée un Ordre de Production pour un produit fini, les composants de la fiche technique sont proposés automatiquement.

### 4.3 Définitions Composants (`/articles/definitions`)

**But** : Lister les composants bruts nécessaires pour chaque article.

| Champ | Type |
|-------|------|
| Article parent | select |
| Composant | select |
| Quantité | number |
| Unité | select |
| Coût unitaire | number |

### 4.4 Essences de Bois (`/articles/species`)

| Champ | Type |
|-------|------|
| Code | text |
| Nom | text |
| Nom scientifique | text |
| Densité | number |
| Origine | text |
| Prix m³ | number |
| Notes | textarea |

**API** : CRUD complet `/wood-species`

### 4.5 Marchandises (`/articles/merchandises`)

| Champ | Type |
|-------|------|
| Code | text |
| Désignation | text |
| Fournisseur | select |
| Prix d'achat | number |
| Prix de vente | number |
| Stock | number |

---

## 5. Module Traitement Thermique

### 5.1 Opérations (`/thermal/operations`)

**But** : Suivre les traitements thermiques des produits (séchage, autoclave...).

**Tableau** :
| Colonne | Description |
|---------|-------------|
| N° | Numéro auto |
| Date début | Date de début |
| Date fin | Date de fin (prévue/réelle) |
| Produits | Articles traités |
| Type traitement | Séchage / Autoclave / Autre |
| Température | °C |
| Durée | heures |
| Statut | Planifié / En cours / Terminé |
| Client | Si traitement pour un client externe |

**Formulaire** :
| Champ | Type | Obligatoire |
|-------|------|-------------|
| Type traitement | select | Oui |
| Date début | date | Oui |
| Date fin prévue | date | Non |
| Produits (multi) | select | Oui |
| Température | number | Non |
| Durée prévue (h) | number | Non |
| Client | select | Non |
| Notes | textarea | Non |

### 5.2 Types de Produits Thermiques (`/thermal/product-types`)

| Champ | Type |
|-------|------|
| Code | text |
| Désignation | text |
| Température recommandée | number |
| Durée recommandée | number |
| Prix unitaire | number |

**API** : CRUD `/thermal-products`

### 5.3 Clients Traitement (`/thermal/clients`)

Les clients externes qui confient des produits au traitement thermique. (Utilise le module Tiers existant avec un flag `type=thermal_client`)

### 5.4 Vue Globale (`/thermal/global`)

Vue d'ensemble de tous les traitements en cours, terminés, planifiés. Tableau avec filtres et KPIs.

### 5.5 Rapports (`/thermal/reports`)

Rapports de production thermique par période, par client, par type de traitement.

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /thermal-treatments` | Liste |
| `POST /thermal-treatments` | Créer |
| `PUT /thermal-treatments/:id` | Modifier |
| `DELETE /thermal-treatments/:id` | Supprimer |
| `GET /thermal-treatments/next-numbers` | Prochains numéros |
| `GET /thermal-treatments/generated-code` | Générer code |
| `GET /thermal-treatments/:id/lines` | Lignes d'un traitement |
| `PUT /thermal-treatments/:id/lines` | Modifier lignes |
| `DELETE /thermal-treatments/:id/lines` | Supprimer lignes |

---

## 6. Module Maintenance (Prestations)

### 6.1 Maintenance Préventive (`/prestation/preventive`)

**But** : Planifier et suivre les maintenances régulières.

| Champ | Type | Obligatoire |
|-------|------|-------------|
| Équipement | select | Oui |
| Type maintenance | select | Oui |
| Date prévue | date | Oui |
| Date réalisée | date | Non |
| Fréquence | select (hebdo/mensuel/trimestriel/annuel) | Oui |
| Technicien | select | Non |
| Coût estimé | number | Non |
| Coût réel | number | Non |
| Statut | Planifié / En cours / Terminé |
| Observations | textarea | Non |

### 6.2 Maintenance Corrective (`/prestation/corrective`)

**But** : Enregistrer les pannes et réparations.

| Champ | Type | Obligatoire |
|-------|------|-------------|
| Équipement | select | Oui |
| Date panne | date | Oui |
| Description panne | textarea | Oui |
| Priorité | Haute / Moyenne / Basse | Oui |
| Technicien assigné | select | Non |
| Date résolution | date | Non |
| Description réparation | textarea | Non |
| Coût | number | Non |
| Statut | Signalé / En cours / Résolu |

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /prestation-preventive` | Liste préventive |
| `POST /prestation-preventive` | Créer |
| `PUT /prestation-preventive/:id` | Modifier |
| `DELETE /prestation-preventive/:id` | Supprimer |
| `GET /prestation-corrective` | Liste corrective |
| `POST /prestation-corrective` | Créer |
| `PUT /prestation-corrective/:id` | Modifier |
| `DELETE /prestation-corrective/:id` | Supprimer |

---

## 7. Module RH Avancé

> Montabbord a : Employés, Contrats, Acomptes & Prêts, Paie complète.
> ACSER ajoute : Pointage biométrique, Congés, EPI, Sanctions, Départements, Fonctions.

### 7.1 Tableau de Bord RH (`/hr/dashboard`)

**KPIs** :
- Effectif total
- Présents aujourd'hui
- Absents aujourd'hui
- En congé
- Contrats expirant bientôt
- EPI expirant

**Graphiques** :
- Répartition par département
- Taux de présence mensuel
- Évolution effectif

### 7.2 Départements (`/hr/departements`)

| Champ | Type |
|-------|------|
| Code | text |
| Nom | text |
| Responsable | select (employé) |
| Description | textarea |
| Budget | number |

**API** : CRUD `/departments`

### 7.3 Fonctions / Postes (`/hr/job-positions`)

| Champ | Type |
|-------|------|
| Code | text |
| Intitulé | text |
| Département | select |
| Niveau hiérarchique | number |
| Salaire minimum | number |
| Salaire maximum | number |
| Description | textarea |

**API** : CRUD `/job-positions`

### 7.4 Présence & Pointage Avancé (`/hr/presence`)

> Montabbord a un pointage de base dans paye.html. ACSER a un système plus avancé avec terminal biométrique.

**Fonctionnalités** :
- Pointage journalier (arrivée, pause déjeuner, reprise, fin)
- Pointage nuit (début, fin)
- Calcul automatiques heures jour/nuit/supplémentaires
- Marquage faute société
- Vue hebdomadaire
- Vue mensuelle avec heures totales
- Import depuis terminal biométrique
- Remplissage automatique du mois
- Résumé mensuel par employé

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /presence/daily` | Pointage du jour |
| `POST /presence/mark` | Marquer présence |
| `POST /presence/clear-date` | Effacer une date |
| `GET /presence/departments` | Départements |
| `GET /presence/report` | Rapport |
| `GET /presence/monthly-hours` | Heures mensuelles |
| `POST /presence/save-hours` | Sauvegarder heures |
| `PUT /presence/update-settings` | Paramètres |
| `GET /presence/rattrapage-summary` | Résumé rattrapage |
| `POST /presence/auto-fill-month` | Auto-remplir mois |
| `POST /presence/bulk-delete` | Suppression groupée |

### 7.5 Pointage Journalier (`/hr/attendance-daily`)

| Champ | Type |
|-------|------|
| Employé | select |
| Date | date |
| Statut | Présent / Absent / Congé / Permission |
| Heure arrivée | time |
| Heure départ | time |
| Heures jour | number (auto) |
| Heures nuit | number (auto) |
| Heures sup | number (auto) |
| Notes | textarea |

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /attendance-daily` | Liste |
| `GET /attendance-daily/monthly?month=:m&year=:y` | Mensuel |
| `POST /attendance-daily/batch` | Import batch |
| `PUT /attendance-daily/:id/validate` | Valider |
| `POST /attendance-daily/auto-fill-month` | Auto-remplir |

### 7.6 Rapports de Présence (`/hr/attendance-reports`)

| Type | Endpoint | Description |
|------|----------|-------------|
| Individuel | `GET /attendance-reports/individual` | Rapport par employé |
| Collectif | `GET /attendance-reports/collective` | Rapport global |
| Absences | `GET /attendance-reports/absences` | Liste absences |
| Dashboard | `GET /attendance-reports/dashboard` | KPIs présence |

### 7.7 Gestion EPI (`/hr/epi-management`)

**Équipements de Protection Individuelle**

**Inventaire EPI** :
| Champ | Type |
|-------|------|
| Code | text |
| Désignation | text |
| Catégorie | select (casque, gant, chaussure, lunettes...) |
| Quantité stock | number |
| Seuil minimum | number |
| Prix unitaire | number |
| Fournisseur | select |

**Affectations** :
| Champ | Type |
|-------|------|
| Employé | select |
| EPI | select |
| Date affectation | date |
| Date expiration | date |
| Statut | Actif / Expiré / Retourné |

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /epi-items` | Liste EPI |
| `GET /epi-assignments` | Affectations |
| `POST /epi-assignments` | Nouvelle affectation |
| `GET /epi-stock` | Stock |
| `GET /epi-stock/alerts` | Alertes stock bas |
| `GET /epi-purchases` | Achats EPI |

### 7.8 Congés Annuels (`/hr/leaves-annual`)

| Champ | Type |
|-------|------|
| Employé | select |
| Type congé | Annuel / Maladie / Maternité / Paternité |
| Date début | date |
| Date fin | date |
| Jours | number (calculé) |
| Motif | textarea |
| Statut | En attente / Approuvé / Refusé |
| Approuvé par | auto |

**API** :
- `GET /hr-annual-leaves` / `POST /hr-annual-leaves` / `PUT /hr-annual-leaves/:id`

### 7.9 Congés Exceptionnels (`/hr/leaves-exceptional`)

Même structure que congés annuels mais pour événements exceptionnels (décès, mariage, etc.).

**API** : `GET /hr-exceptional-leaves` / `POST` / `PUT`

### 7.10 Demandes & Explications (`/hr/requests`)

| Champ | Type |
|-------|------|
| Employé | select |
| Type | Demande / Explication |
| Objet | text |
| Description | textarea |
| Date | date |
| Statut | En attente / Traité / Clôturé |
| Réponse | textarea |
| Traité par | auto |

**API** : `GET /hr-explanation-requests` / `POST` / `PUT`

### 7.11 Sanctions Disciplinaires (`/hr/sanctions`)

| Champ | Type |
|-------|------|
| Employé | select |
| Type | Avertissement / Blâme / Suspension / Licenciement |
| Date | date |
| Motif | textarea |
| Décision | textarea |
| Date effet | date |
| Pièce jointe | file |

**API** : `GET /hr-sanctions` / `POST` / `PUT`

### 7.12 Face ID (`/hr/enroll-face`)

Enregistrement biométrique facial pour pointage. (Fonctionnalité avancée, peut être omise dans un premier temps.)

---

## 8. Module Rapports

### 8.1 Page Rapports (`/reports`)

**Types de rapports disponibles** :

| Rapport | Description | Filtres |
|---------|-------------|---------|
| Production mensuel | Synthèse production par mois | Période, article |
| Stock movements | Mouvements de stock | Période, catégorie |
| Ventes mensuelles | CA par mois/client | Période, client |
| Achats mensuels | Achats par fournisseur | Période, fournisseur |
| RH - Présence | Taux de présence | Période, département |
| RH - Congés | Soldes congés | Employé |
| Traitement thermique | Production thermique | Période, client |
| Maintenance | Interventions | Période, type |
| Coût de revient | Analyse coûts | Article |

**Export** : PDF, Excel

---

## 9. Module Commandes Clients Avancé

> Montabbord a déjà les commandes clients. ACSER ajoute des fonctionnalités.

### 9.1 Statuts de commande
```
Brouillon → Validée → En production → Partiellement livrée → Toute livrée → Facturée
                          → Annulée
```

### 9.2 Fonctionnalités ajoutées

| Fonctionnalité | Description |
|----------------|-------------|
| Lien production | Voir si la commande est en cours de production |
| Livraisons partielles | Livrer par lots |
| Suivi avancement | % livré vs % commandé |
| Historique | Journal des changements de statut |

**API ajoutée** :
- `PUT /client-orders/:id/status` : changer statut
- `GET /client-orders/unbilled?client_id=:id` : commandes non facturées

---

## 10. Module Livraisons Clients Avancé

> Montabbord a déjà les livraisons. ACSER ajoute des fonctionnalités.

### 10.1 Statuts de livraison
```
Brouillon → Validée → Livrée → Facturée
           → Annulée
```

### 10.2 Fonctionnalités ajoutées

| Fonctionnalité | Description |
|----------------|-------------|
| Revenus | CA réalisé par livraison |
| Livraisons non facturées | Liste des livrées non facturées |
| Numérotation auto | Prochain numéro |
| Revenus par client/stats | Graphiques |

**API ajoutée** :
| Endpoint | Description |
|----------|-------------|
| `GET /client-deliveries/revenue-stats` | Stats revenus |
| `GET /client-deliveries/unbilled` | Non facturées |
| `GET /client-deliveries/next-number` | Prochain N° |
| `PUT /client-deliveries/:id/status` | Changer statut |

---

## 11. Coût de Revient

### 11.1 Page Coût de Revient (`/cost-price`)

**But** : Calculer le coût de revient complet d'un produit.

#### Méthode de calcul
```
Coût de revient = Coût matière première + Coût main d'œuvre + Charges indirectes
```

#### Types de coûts additionnels
| Type | Description |
|------|-------------|
| Main d'œuvre directe | Salaires ouvriers production |
| Charges factory | Électricité, eau, maintenance |
| Emballage | Cartons, films |
| Transport | Livraison matières premières |
| Autre | Divers |

**API** :
| Endpoint | Description |
|----------|-------------|
| `GET /product-cost-types` | Types de coûts |
| `POST /product-cost-types` | Créer type |
| `GET /product-additional-costs` | Coûts additionnels |
| `PUT /product-additional-costs/:id` | Modifier |
| `GET /products/:id/cost-simulation` | Simulation coût |
| `PUT /articles/:id/cost-price` | Mettre à jour coût |

---

## 12. Structure de Données Complète

### Tables nouvelles (à créer dans Supabase/localStorage)

#### `productions` (Saisies de production)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | Date de la saisie |
| article_id | uuid | FK → articles |
| phase | enum | Phase I-VI |
| quantite | number | Qté produite |
| pertes | number | Qté perdue |
| employes | jsonb | Liste employés |
| heures | number | Heures de travail |
| statut | enum | draft/validated/abandoned |
| observations | text | Notes |
| created_at | timestamp | |
| user_id | uuid | FK → users |

#### `production_orders` (Ordres de production)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| numero | text | OP-XXXX (auto) |
| article_id | uuid | FK → articles |
| quantite_prevue | number | |
| quantite_realisee | number | Cumul |
| date_prevue | date | |
| date_debut | date | |
| date_fin | date | |
| priorité | enum | haute/moyenne/basse |
| statut | enum | draft/en_cours/termine/annule |
| progression | number | % (0-100) |
| notes | text | |
| created_at | timestamp | |
| user_id | uuid | |

#### `production_order_items` (Composants d'un OP)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| order_id | uuid | FK → production_orders |
| article_id | uuid | FK → articles (composant) |
| quantite | number | Qté nécessaire |
| quantite_utilisee | number | Qté réellement utilisée |
| phase | enum | |

#### `production_order_personnel` (Personnel affecté)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| order_id | uuid | FK → production_orders |
| employee_id | uuid | FK → employees |
| role | text | Rôle (Chef d'équipe, Ouvrier...) |
| date_affectation | date | |

#### `production_order_documents` (Documents joints)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| order_id | uuid | FK → production_orders |
| nom | text | Nom du fichier |
| url | text | URL/chemin |
| type | text | Type MIME |

#### `production_losses` (Pertes de production)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| article_id | uuid | FK |
| quantite | number | |
| motif | text | |
| production_id | uuid | FK (lié à une saisie) |

#### `articles` (Catalogue produits)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | Unique, auto-généré |
| designation | text | Nom |
| categorie | enum | finished/semi/merchandise/lattes/repair/thermal/article |
| unite | enum | m2/m3/unite/kg |
| essences | jsonb | Liste essences |
| prix_revient | number | |
| prix_vente | number | |
| dimensions | text | |
| poids | number | |
| image | text | URL |
| statut | enum | active/inactive |
| created_at | timestamp | |

#### `article_configurations` (Configurations/fiches techniques)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| article_id | uuid | FK (produit parent) |
| composant_id | uuid | FK (composant) |
| quantite | number | Qté par unité |
| phase | enum | Phase de montage |
| ordre | number | Ordre d'assemblage |
| actif | boolean | Configuration active |

#### `wood_species` (Essences de bois)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| nom | text | |
| nom_scientifique | text | |
| densite | number | |
| origine | text | |
| prix_m3 | number | |
| notes | text | |

#### `raw_materials` (Matières premières)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| essence_id | uuid | FK |
| volume | number | m³ |
| prix_unitaire | number | |
| fournisseur_id | uuid | |
| statut | enum | active/consumed |

#### `semi_finished` (Semi-finis)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| quantite | number | |
| phase | enum | |
| prix | number | |

#### `consumables` (Consommables)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| quantite | number | |
| prix_unitaire | number | |
| seuil_alerte | number | |

#### `merchandises` (Marchandises)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| fournisseur_id | uuid | |
| prix_achat | number | |
| prix_vente | number | |
| stock | number | |

#### `movements` (Mouvements de stock)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| type | enum | entree/sortie/transfert |
| article_id | uuid | |
| article_code | text | |
| article_type | enum | raw_material/semi_finished/finished/merchandise/consumable |
| quantite | number | |
| prix_unitaire | number | |
| reference | text | BC, BL, OP... |
| motif | text | |
| stock_before | number | Stock avant mouvement |
| user_id | uuid | |

#### `inventories` (Inventaires)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| categorie | enum | |
| articles_comptes | number | |
| ecarts | number | |
| statut | enum | draft/validated |
| user_id | uuid | |

#### `thermal_treatments` (Traitements thermiques)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| numero | text | Auto |
| type_traitement | enum | sechage/autoclave/autre |
| date_debut | date | |
| date_fin_prevue | date | |
| date_fin_reelle | date | |
| temperature | number | |
| duree | number | heures |
| client_id | uuid | |
| statut | enum | planifie/en_cours/termine |
| notes | text | |
| created_at | timestamp | |

#### `thermal_treatment_lines` (Lignes de traitement)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| treatment_id | uuid | FK |
| article_id | uuid | FK |
| quantite | number | |
| volume | number | |

#### `thermal_products` (Types de produits thermiques)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| temperature_recommandee | number | |
| duree_recommandee | number | |
| prix_unitaire | number | |

#### `prestation_preventive` (Maintenance préventive)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| equipement | text | |
| type_maintenance | text | |
| date_prevue | date | |
| date_realisee | date | |
| frequence | enum | hebdo/mensuel/trimestriel/annuel |
| technicien | text | |
| cout_estime | number | |
| cout_reel | number | |
| statut | enum | planifie/en_cours/termine |
| observations | text | |

#### `prestation_corrective` (Maintenance corrective)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| equipement | text | |
| date_panne | date | |
| description_panne | text | |
| priorite | enum | haute/moyenne/basse |
| technicien | text | |
| date_resolution | date | |
| description_reparation | text | |
| cout | number | |
| statut | enum | signale/en_cours/resolu |

#### `departments` (Départements RH)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| nom | text | |
| responsable_id | uuid | FK |
| description | text | |
| budget | number | |

#### `job_positions` (Fonctions/Postes)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| intitule | text | |
| departement_id | uuid | FK |
| niveau | number | |
| salaire_min | number | |
| salaire_max | number | |
| description | text | |

#### `presence` (Pointage avancé)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| date | date | |
| statut | enum | present/absent/conge/permission |
| heure_arrivee | time | |
| heure_depart | time | |
| heures_jour | number | |
| heures_nuit | number | |
| heures_sup | number | |
| faute_societe | boolean | |
| notes | text | |

#### `attendance_daily` (Présence journalière)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| date | date | |
| statut | enum | present/absent/conge/permission |
| heure_arrivee | time | |
| heure_depart | time | |
| heures_jour | number | |
| heures_nuit | number | |
| notes | text | |
| valide | boolean | |

#### `epi_items` (Équipements de protection)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| code | text | |
| designation | text | |
| categorie | text | |
| quantite_stock | number | |
| seuil_minimum | number | |
| prix_unitaire | number | |
| fournisseur | text | |

#### `epi_assignments` (Affectations EPI)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| epi_id | uuid | FK |
| date_affectation | date | |
| date_expiration | date | |
| statut | enum | actif/expire/retourne |

#### `epi_stock` (Stock EPI)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| epi_id | uuid | FK |
| quantite | number | |
| mouvement | enum | entree/sortie/ajustement |
| date | date | |
| motif | text | |

#### `hr_annual_leaves` (Congés annuels)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| type_conge | enum | annuel/maladie/maternite/paternite |
| date_debut | date | |
| date_fin | date | |
| jours | number | |
| motif | text | |
| statut | enum | en_attente/approuve/refuse |

#### `hr_exceptional_leaves` (Congés exceptionnels)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| type_conge | text | |
| date_debut | date | |
| date_fin | date | |
| jours | number | |
| motif | text | |
| statut | enum | |

#### `hr_sanctions` (Sanctions disciplinaires)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| type | enum | avertissement/blame/suspension/licenciement |
| date | date | |
| motif | text | |
| decision | text | |
| date_effet | date | |
| piece_jointe | text | URL |

#### `hr_explanation_requests` (Demandes & explications)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| employee_id | uuid | FK |
| type | enum | demande/explication |
| objet | text | |
| description | text | |
| date | date | |
| statut | enum | en_attente/traite/cloture |
| reponse | text | |

#### `palette_repairs` (Réparations palettes)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| palette_id | uuid | FK |
| type_reparation | text | |
| cout | number | |
| employee_id | uuid | FK |
| observations | text | |

#### `palette_proformas` (Proformas palettes)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| numero | text | Auto |
| client_id | uuid | FK |
| date | date | |
| lignes | jsonb | |
| total | number | |
| statut | enum | draft/valide/envoye/accepte/refuse |

#### `supplier_deliveries` (Livraisons fournisseurs)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| supplier_id | uuid | FK |
| date | date | |
| reference | text | |
| articles | jsonb | |
| montant | number | |
| statut | enum | |

#### `repair_services` (Services de réparation)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| designation | text | |
| tarif | number | |
| description | text | |

#### `wip_volume` (Volume Work In Progress)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| volume | number | |
| article_id | uuid | |

#### `recolisage` (Récoltage)
| Colonne | Type | Description |
|---------|------|-------------|
| id | uuid | PK |
| date | date | |
| volume | number | |
| essence_id | uuid | |
| source | text | |

#### `app_settings` (Paramètres applicatifs)
| Colonne | Type | Description |
|---------|------|-------------|
| key | text | PK |
| value | jsonb | |
| updated_at | timestamp | |

---

## 13. API Endpoints Nécessaires

> Liste complète de tous les endpoints à implémenter côté backend (Supabase Edge Functions ou API REST).

### Production
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/productions` | Liste saisies |
| POST | `/productions` | Créer saisie |
| PUT | `/productions/:id` | Modifier |
| DELETE | `/productions/:id` | Supprimer |
| GET | `/productions/next-number` | Prochain N° |
| GET | `/production-orders` | Liste ordres |
| POST | `/production-orders` | Créer ordre |
| PUT | `/production-orders/:id` | Modifier |
| DELETE | `/production-orders/:id` | Supprimer |
| GET | `/production-orders/stats` | Statistiques |
| GET | `/production-orders/next-number` | Prochain N° |
| PUT | `/production-orders/:id/status` | Changer statut |
| PUT | `/production-orders/:id/progress` | Mettre à jour progression |
| POST | `/production-orders/:id/items` | Ajouter composant |
| DELETE | `/production-orders/:id/items/:itemId` | Supprimer composant |
| POST | `/production-orders/:id/personnel` | Affecter personnel |
| DELETE | `/production-orders/:id/personnel/:personId` | Retirer personnel |
| POST | `/production-orders/:id/documents` | Ajouter document |
| DELETE | `/production-orders/:id/documents/:docId` | Supprimer document |
| GET | `/production-orders/:id/history` | Historique |
| GET | `/production-orders/report` | Rapport |
| GET | `/production-orders/product-components/:id` | Composants produit |
| GET | `/production-orders/stock-check/:code` | Vérifier stock |
| GET | `/production-orders/:id/days` | Jours de production |
| PUT | `/production-orders/:id/days` | Modifier jours |

### Articles
| Méthode | Endpoint |
|---------|----------|
| GET/POST | `/articles` |
| GET/PUT/DELETE | `/articles/:id` |
| GET | `/articles/codes` |
| GET | `/articles/with-components` |
| PUT | `/articles/:id/cost-price` |
| POST | `/articles/validate-matricule` |
| GET | `/products/:id/configurations` |
| POST | `/products/:id/configurations` |
| PUT | `/products/:id/configurations/:configId/activate` |
| GET | `/products/:id/cost-simulation` |
| GET | `/products/components/:id` |

### Stock
| Méthode | Endpoint |
|---------|----------|
| GET/POST | `/movements` |
| GET/PUT/DELETE | `/movements/:id` |
| GET/POST | `/inventories` |
| PUT/DELETE | `/inventories/:id` |
| POST | `/inventories/:id/validate` |
| GET/PUT | `/wip-volume` |
| POST/GET | `/recolisage` |
| GET/POST | `/raw-materials` |
| PUT/DELETE | `/raw-materials/:id` |
| GET/POST | `/semi-finished` |
| PUT/DELETE | `/semi-finished/:id` |
| GET/POST | `/consumables` |
| PUT/DELETE | `/consumables/:id` |
| GET/POST | `/merchandises` |
| PUT/DELETE | `/merchandises/:id` |

### Traitement Thermique
| Méthode | Endpoint |
|---------|----------|
| GET/POST | `/thermal-treatments` |
| PUT/DELETE | `/thermal-treatments/:id` |
| GET | `/thermal-treatments/next-numbers` |
| GET | `/thermal-treatments/generated-code` |
| GET/PUT/DELETE | `/thermal-treatments/:id/lines` |
| GET/POST | `/thermal-products` |
| PUT/DELETE | `/thermal-products/:id` |

### Maintenance
| Méthode | Endpoint |
|---------|----------|
| GET/POST/PUT/DELETE | `/prestation-preventive` |
| GET/POST/PUT/DELETE | `/prestation-corrective` |

### RH Avancé
| Méthode | Endpoint |
|---------|----------|
| GET/POST/PUT/DELETE | `/departments` |
| GET/POST/PUT/DELETE | `/job-positions` |
| GET/POST/PUT/DELETE | `/attendance-daily` |
| GET | `/attendance-daily/monthly` |
| POST | `/attendance-daily/batch` |
| PUT | `/attendance-daily/:id/validate` |
| POST | `/attendance-daily/auto-fill-month` |
| GET | `/attendance-reports/individual` |
| GET | `/attendance-reports/collective` |
| GET | `/attendance-reports/absences` |
| GET | `/attendance-reports/dashboard` |
| GET/POST/PUT | `/presence/daily` |
| POST | `/presence/mark` |
| POST | `/presence/clear-date` |
| GET | `/presence/departments` |
| GET | `/presence/report` |
| GET | `/presence/monthly-hours` |
| POST | `/presence/save-hours` |
| PUT | `/presence/update-settings` |
| GET | `/presence/rattrapage-summary` |
| POST | `/presence/auto-fill-month` |
| POST | `/presence/bulk-delete` |
| GET/POST | `/epi-items` |
| PUT/DELETE | `/epi-items/:id` |
| GET/POST | `/epi-assignments` |
| PUT/DELETE | `/epi-assignments/:id` |
| GET | `/epi-assignments/expiring` |
| GET | `/epi-stock` |
| POST | `/epi-stock/adjust` |
| GET | `/epi-stock/movements` |
| GET | `/epi-stock/alerts` |
| GET/POST | `/epi-purchases` |
| PUT/DELETE | `/epi-purchases/:id` |
| GET/POST | `/hr-annual-leaves` |
| PUT | `/hr-annual-leaves/:id` |
| GET/POST | `/hr-exceptional-leaves` |
| PUT | `/hr-exceptional-leaves/:id` |
| GET/POST | `/hr-sanctions` |
| PUT | `/hr-sanctions/:id` |
| GET/POST | `/hr-explanation-requests` |
| PUT | `/hr-explanation-requests/:id` |
| GET | `/hr-summary` |
| POST | `/employees/:id/face-id` |
| GET | `/employees/expiring-contracts` |

### Commandes & Livraisons Avancé
| Méthode | Endpoint |
|---------|----------|
| PUT | `/client-orders/:id/status` |
| GET | `/client-orders/unbilled` |
| PUT | `/client-deliveries/:id/status` |
| GET | `/client-deliveries/revenue-stats` |
| GET | `/client-deliveries/unbilled` |
| GET | `/client-deliveries/next-number` |

### Palettes
| Méthode | Endpoint |
|---------|----------|
| GET/POST | `/palette-repairs` |
| DELETE | `/palette-repairs/:id` |
| GET/POST | `/palette-proformas` |
| PUT | `/palette-proformas/:id` |
| PUT | `/palette-proformas/:id/status` |
| DELETE | `/palette-proformas/:id` |
| GET | `/palette-proformas/next-number` |

### Récoltage
| Méthode | Endpoint |
|---------|----------|
| POST | `/recolisage` |
| GET | `/recolisage/history` |
| PUT | `/recolisage/update` |

### Livraisons Fournisseurs
| Méthode | Endpoint |
|---------|----------|
| GET/POST | `/supplier-deliveries` |
| PUT/DELETE | `/supplier-deliveries/:id` |
| GET | `/supplier-deliveries/supplier/:id` |

### Coût de Revient
| Méthode | Endpoint |
|---------|----------|
| GET/POST/PUT/DELETE | `/product-cost-types` |
| GET/PUT | `/product-additional-costs/:id` |
| GET | `/product-additional-costs` |

### Rapports
| Méthode | Endpoint |
|---------|----------|
| GET | `/reports` (avec params type, period, etc.) |

### Paramètres
| Méthode | Endpoint |
|---------|----------|
| GET | `/app-settings?key=:key` |
| POST | `/app-settings` |

---

## 14. Système de Permissions

### Clés de permissions complètes

| Module | Sous-module | Permission Key |
|--------|-------------|---------------|
| Production | Saisie | `production.saisie` |
| Production | Historique | `production.history` |
| Stock | Palettes | `stock.palettes` |
| Stock | Matière Première | `stock.raw-materials` |
| Stock | Marchandises | `stock.merchandises` |
| Stock | Consommables | `stock.consumables` |
| Stock | Inventaire | `stock.inventory` |
| Articles | Catalogue | `articles.catalogue` |
| Articles | Fiche Technique | `articles.fiche-technique` |
| Articles | Définitions | `articles.definitions` |
| Articles | Marchandises | `articles.merchandises` |
| Articles | Essences | `articles.species` |
| Achats | Produits Finis | `achat.finished` |
| Achats | Semi-Finis | `achat.semi-finished` |
| Achats | Matière Première | `achat.raw-materials` |
| Achats | Marchandises | `achat.merchandises` |
| Achats | Consommables | `achat.consumables` |
| Traitement | Opérations | `thermal.operations` |
| Traitement | Types Produits | `thermal.types` |
| Maintenance | Préventive | `prestation.preventive` |
| Maintenance | Corrective | `prestation.corrective` |
| RH | Dashboard | `attendance.dashboard` |
| RH | Employés | `attendance.employees` |
| RH | Départements | `attendance.departments` |
| RH | Fonctions | `attendance.job-positions` |
| RH | Présence | `attendance.presence` |
| RH | EPI | `attendance.epi` |
| RH | Congés Annuels | `attendance.leaves-annual` |
| RH | Congés Exceptionnels | `attendance.leaves-exceptional` |
| RH | Demandes | `attendance.requests` |
| RH | Sanctions | `attendance.sanctions` |
| Commandes | — | `orders` |
| Livraisons | — | `deliveries` |
| Clients | — | `clients` |
| Fournisseurs | — | `suppliers` |
| Rapports | — | `reports` |
| Alertes | — | `alerts` |
| Paramètres | — | `settings` |

---

## 15. Graphiques & Tableaux de Bord

### Dashboard Production
- Production du mois (quantité)
- OP en cours
- OP terminés ce mois
- Taux de rendement

### Dashboard Stock
- Stock actuel par catégorie
- Alertes rupture
- Mouvements du mois (entrées/sorties)
- Stock initial vs actuel

### Dashboard RH
- Effectif par département
- Taux de présence
- Congés en cours
- EPI expirant

### Dashboard Traitement Thermique
- Traitements en cours
- Traitements terminés ce mois
- Volume traité

---

> **Fin du cahier des charges**
> Document généré le 09/09/2026 à partir de l'analyse du code source de acser-sas.com
