const fs = require('fs');
let t = fs.readFileSync('public/paye.html', 'utf8');

const START = "/* Grille Salariale INDUSTRIE DU BOIS";
const END = "function loadOrg()";
const iS = t.indexOf(START);
const iE = t.indexOf(END);
if (iS < 0 || iE < 0 || iE <= iS) { console.error('MARQUEURS INTROUVABLES'); process.exit(1); }

const nouveau = [
"/* Grille Salariale INDUSTRIE DU BOIS en Cote d'Ivoire",
"   Source : Bareme Officiel des Salaires Minima Categoriels Conventionnels 2015",
"   (Arrete n°2015-855/MEMEASFP/CAB du 30/12/2015), section INDUSTRIE DU BOIS p.10-14.",
"   Revalorisation +12% lors du passage du SMIG a 75 000 FCFA (Decret n°2022-986 du 21/12/2022).",
"   Ouvriers / Agents de maitrise / Chauffeurs : taux HORAIRE 2015 x 1.12 x 173h33 ;",
"   Employes / Cadres : salaire MENSUEL 2015 x 1.12. Categorie 1 = SMIG 75 000 fixe. */",
"function loadWoodSectorGrid() {",
"  if (!confirm('Charger la grille salariale officielle du secteur du bois ?\\nBareme 2015 (arrete n°2015-855 du 30/12/2015) revalorise de +12% (SMIG 75 000 FCFA).\\nLes categories existantes seront remplacees.')) return;",
"  var H = 173.33;",
"  var RH = function(hX) { return Math.round(hX * 1.12 * H); }; /* horaire 2015 -> mensuel revalorise */",
"  var RM = function(mX) { return Math.round(mX * 1.12); };    /* mensuel 2015 -> mensuel revalorise */",
"  var grid = [",
"    /* === OUVRIERS (taux horaires bareme bois p.10) === */",
"    { code: 'SMIG', libelle: 'Ouvrier - 1ere categorie - Maneuvre (SMIG M0)', salaire_min: 75000, type: 'Ouvrier' },",
"    { code: 'O2', libelle: 'Ouvrier - 2eme categorie - MS', salaire_min: RH(390), type: 'Ouvrier' },",
"    { code: 'O3A', libelle: 'Ouvrier - 3eme categorie A - OS1A', salaire_min: RH(391), type: 'Ouvrier' },",
"    { code: 'O3B', libelle: 'Ouvrier - 3eme categorie B - OS1B', salaire_min: RH(400), type: 'Ouvrier' },",
"    { code: 'O4A', libelle: 'Ouvrier - 4eme categorie A - OS2A', salaire_min: RH(401), type: 'Ouvrier' },",
"    { code: 'O4B', libelle: 'Ouvrier - 4eme categorie B - OS2B', salaire_min: RH(422), type: 'Ouvrier' },",
"    { code: 'O5A', libelle: 'Ouvrier - 5eme categorie A - OP1A', salaire_min: RH(432), type: 'Ouvrier' },",
"    { code: 'O5B', libelle: 'Ouvrier - 5eme categorie B - OP1B', salaire_min: RH(447), type: 'Ouvrier' },",
"    { code: 'O6A', libelle: 'Ouvrier - 6eme categorie A - OP2A', salaire_min: RH(459), type: 'Ouvrier' },",
"    { code: 'O6B', libelle: 'Ouvrier - 6eme categorie B - OP2B', salaire_min: RH(511), type: 'Ouvrier' },",
"    { code: 'O7', libelle: 'Ouvrier - 7eme categorie - OP3', salaire_min: RH(691), type: 'Ouvrier' },",
"    /* === EMPLOYES (salaires mensuels bareme bois p.13) === */",
"    { code: 'E1', libelle: 'Employe - 1ere categorie (SMIG)', salaire_min: 75000, type: 'Employ\\u00e9' },",
"    { code: 'E2', libelle: 'Employe - 2eme categorie', salaire_min: RM(74921), type: 'Employ\\u00e9' },",
"    { code: 'E3', libelle: 'Employe - 3eme categorie', salaire_min: RM(76196), type: 'Employ\\u00e9' },",
"    { code: 'E4', libelle: 'Employe - 4eme categorie', salaire_min: RM(81721), type: 'Employ\\u00e9' },",
"    { code: 'E5', libelle: 'Employe - 5eme categorie', salaire_min: RM(97486), type: 'Employ\\u00e9' },",
"    { code: 'E6', libelle: 'Employe - 6eme categorie', salaire_min: RM(110487), type: 'Employ\\u00e9' },",
"    { code: 'E7A', libelle: 'Employe - 7eme categorie A', salaire_min: RM(111644), type: 'Employ\\u00e9' },",
"    { code: 'E7B', libelle: 'Employe - 7eme categorie B', salaire_min: RM(119912), type: 'Employ\\u00e9' },",
"    /* === AGENTS DE MAITRISE (taux horaires bareme bois p.12) === */",
"    { code: 'MNP', libelle: 'Agent de maitrise - Debutant (MNP)', salaire_min: RH(604), type: 'Agent de ma\\u00eetrise' },",
"    { code: 'M1', libelle: 'Agent de maitrise - 1ere categorie (M1)', salaire_min: RH(685), type: 'Agent de ma\\u00eetrise' },",
"    { code: 'M2', libelle: 'Agent de maitrise - 2eme categorie (M2)', salaire_min: RH(733), type: 'Agent de ma\\u00eetrise' },",
"    { code: 'M3', libelle: 'Agent de maitrise - 3eme categorie (M3)', salaire_min: RH(876), type: 'Agent de ma\\u00eetrise' },",
"    { code: 'M4', libelle: 'Agent de maitrise - 4eme categorie (M4)', salaire_min: RH(953), type: 'Agent de ma\\u00eetrise' },",
"    { code: 'M5', libelle: 'Agent de maitrise - 5eme categorie (M5)', salaire_min: RH(1032), type: 'Agent de ma\\u00eetrise' },",
"    /* === CADRES (salaires de base bareme bois p.11) === */",
"    { code: 'C1A', libelle: 'Cadre - 1ere categorie A', salaire_min: RM(153699), type: 'Cadre' },",
"    { code: 'C1B', libelle: 'Cadre - 1ere categorie B', salaire_min: RM(176935), type: 'Cadre' },",
"    { code: 'C2A', libelle: 'Cadre - 2eme categorie A', salaire_min: RM(185836), type: 'Cadre' },",
"    { code: 'C2B', libelle: 'Cadre - 2eme categorie B', salaire_min: RM(210906), type: 'Cadre' },",
"    { code: 'C3A', libelle: 'Cadre - 3eme categorie A', salaire_min: RM(219239), type: 'Cadre' },",
"    { code: 'C3B', libelle: 'Cadre - 3eme categorie B', salaire_min: RM(328731), type: 'Cadre' },",
"    /* === CHAUFFEURS (taux horaires bareme bois p.11) === */",
"    { code: 'CH-A', libelle: 'Chauffeur A - voiture tourisme / < 3T', salaire_min: RH(403), type: 'Chauffeur' },",
"    { code: 'CH-B', libelle: 'Chauffeur B - poids lourds 3T a 5T', salaire_min: RH(424), type: 'Chauffeur' },",
"    { code: 'CH-C', libelle: 'Chauffeur C - poids lourds > 5T', salaire_min: RH(439), type: 'Chauffeur' },",
"    { code: 'CH-D', libelle: 'Chauffeur D - transport en commun', salaire_min: RH(443), type: 'Chauffeur' }",
"  ];",
"  setCategories(grid);",
"  loadCategories();",
"  toast('Grille secteur du bois chargee : Bareme Officiel 2015 (arrete n°2015-855) + revalorisation 12% (SMIG 75 000)', 'success');",
"}",
""
].join("\r\n");

t = t.slice(0, iS) + nouveau + t.slice(iE);
fs.writeFileSync('public/paye.html', t);

/* Verif rapide du calcul M3 */
var H = 173.33;
console.log('M3 -> ' + Math.round(876 * 1.12 * H) + ' (attendu ~170058)');
console.log('OK grille bois remplacee');
