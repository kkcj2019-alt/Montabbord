const fs = require('fs');
let nRep = 0;

/* ===================== paye.html ===================== */
let p = fs.readFileSync('public/paye.html', 'utf8');
function repP(oldS, newS, label, all) {
  let done = false;
  while (true) {
    const i = p.indexOf(oldS);
    if (i < 0) break;
    p = p.slice(0, i) + newS + p.slice(i + oldS.length);
    nRep++; done = true;
    if (!all) break;
  }
  if (!done) { console.error('INTROUVABLE (paye): ' + label); process.exit(1); }
}

/* loadCategories ne doit pas planter si la section Grille n'est pas affichee */
repP("  var tbody = document.getElementById('cat-tbody');\r\n  tbody.innerHTML = '';",
     "  var tbody = document.getElementById('cat-tbody');\r\n  if (!tbody) return;\r\n  tbody.innerHTML = '';",
     'garde tbody');

/* Le cloud ne doit jamais effacer les categories locales par un etat vide */
repP("if (data[PAYE_KEY] && typeof data[PAYE_KEY] === 'object' && !Array.isArray(data[PAYE_KEY])) DB.setMain(PAYE_KEY, data[PAYE_KEY]);",
     "(function(){var _cur=DB.getMain(PAYE_KEY);var _inc=data[PAYE_KEY];var _ic=_inc.categories;var _cc=_cur?_cur.categories:null;if((!Array.isArray(_ic)||!_ic.length)&&Array.isArray(_cc)&&_cc.length){_inc.categories=_cc;}DB.setMain(PAYE_KEY,_inc);})()",
     'protection categories cloud', true);

/* Charger la grille des l'ouverture du module */
repP("document.addEventListener('DOMContentLoaded', function() {\r\n  initData();",
     "document.addEventListener('DOMContentLoaded', function() {\r\n  initData();\r\n  try { loadCategories(); } catch (eLC) {}",
     'boot grille');

fs.writeFileSync('public/paye.html', p);

/* ===================== index.html ===================== */
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE (index): ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
  nRep++;
}

/* Copie de la grille bois du module Paye dans l'app principale */
const srcPaye = fs.readFileSync('public/paye.html', 'utf8');
const fnStart = srcPaye.indexOf('function woodSectorGridData()');
if (fnStart < 0) { console.error('INTROUVABLE: woodSectorGridData dans paye'); process.exit(1); }
let fnEnd = srcPaye.indexOf('\nfunction ', fnStart);
if (fnEnd < 0) fnEnd = srcPaye.length;
const fnCopy = srcPaye.slice(fnStart, fnEnd).trim().replace('function woodSectorGridData()', 'function woodSectorGridDataI()');

rep("function getCategoriesI() { return getPayeSectionI('categories', []); }",
    fnCopy + "\r\nfunction getCategoriesI() { var _cG = getPayeSectionI('categories', []); if (!_cG || !_cG.length) _cG = woodSectorGridDataI(); return _cG; }",
    'grille fallback index');

/* Formulaire : Nom / Prenoms comme dans le module Paye */
rep('  html += \'<div class="form-group"><label>Nom complet *</label><input type="text" id="empNom" value="\' + escH(e ? e.nom : \'\') + \'"></div>\';',
    [
      "  var _famE = e ? (e.nom || '') : '';",
      "  var _preE = e ? (e.prenoms || '') : '';",
      "  if (_preE && _famE.length > _preE.length && _famE.slice(-_preE.length) === _preE) { _famE = _famE.slice(0, _famE.length - _preE.length).trim(); }",
      "  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Nom *</label><input type=\"text\" id=\"empNomFam\" value=\"' + escH(_famE) + '\"></div>';",
      "  html += '<div class=\"form-group\"><label>Pr\\u00e9noms</label><input type=\"text\" id=\"empPrenoms\" value=\"' + escH(_preE) + '\"></div></div>';"
    ].join('\r\n'),
    'champs nom prenoms');

/* Sauvegarde : reconstituer le nom complet + stocker les prenoms */
rep("  var nom = document.getElementById('empNom').value.trim();",
    "  var nomFamV = document.getElementById('empNomFam').value.trim();\r\n  var prenomsV = document.getElementById('empPrenoms') ? document.getElementById('empPrenoms').value.trim() : '';\r\n  var nom = (nomFamV + (prenomsV ? ' ' + prenomsV : '')).trim();",
    'save lecture champs');
rep("employes[i].matricule = matricule; employes[i].nom = nom; employes[i].abreviation = abreviation;",
    "employes[i].matricule = matricule; employes[i].nom = nom; employes[i].prenoms = prenomsV; employes[i].abreviation = abreviation;",
    'save update prenoms');
rep("var nEmp = {id:DB.genId(), matricule:matricule, nom:nom, abreviation:abreviation,",
    "var nEmp = {id:DB.genId(), matricule:matricule, nom:nom, prenoms:prenomsV, abreviation:abreviation,",
    'save nouveau prenoms');

fs.writeFileSync('public/index.html', t);
console.log('OK - ' + nRep + ' remplacements');
