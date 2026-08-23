const fs = require('fs');
const NL = '\r\n';
let idx = fs.readFileSync('public/index.html', 'utf8');
let paye = fs.readFileSync('public/paye.html', 'utf8');

function rep(str, oldS, newS, label, all) {
  const cnt = str.split(oldS).length - 1;
  if (cnt < 1 || (!all && cnt !== 1)) { console.error('ANCRE ' + cnt + 'x: ' + label); process.exit(1); }
  return all ? str.split(oldS).join(newS) : str.replace(oldS, newS);
}

/* ================= INDEX.HTML ================= */

/* 1) Fusion cloud mdb_paye : ne jamais ecraser des donnees locales non vides par du vide + graine permanente */
const oldCloud = "          if (key === 'mdb_paye') {\r\n" +
"            if (val && typeof val === 'object' && !Array.isArray(val)) DB.set(key, val);\r\n" +
"            else if (!DB.get(key) || Array.isArray(DB.get(key))) DB.set(key, {});\r\n" +
"            continue;\r\n" +
"          }";
const newCloud = "          if (key === 'mdb_paye') {\r\n" +
"            var _lpP = DB.get(key);\r\n" +
"            if (!_lpP || typeof _lpP !== 'object' || Array.isArray(_lpP)) _lpP = {};\r\n" +
"            var _npP = (val && typeof val === 'object' && !Array.isArray(val)) ? val : {};\r\n" +
"            var _grdK = ['categories', 'services', 'fonctions', 'primesSpec', 'pointage'];\r\n" +
"            for (var _gk2 = 0; _gk2 < _grdK.length; _gk2++) { var _sk3 = _grdK[_gk2]; var _cv4 = _npP[_sk3]; if (!(Array.isArray(_cv4) && _cv4.length)) delete _npP[_sk3]; }\r\n" +
"            for (var _pk5 in _npP) _lpP[_pk5] = _npP[_pk5];\r\n" +
"            if (!_lpP.categories || !_lpP.categories.length) { try { _lpP.categories = woodSectorGridDataI(); } catch (_eg2) {} }\r\n" +
"            var _prevP = JSON.stringify(DB.get(key));\r\n" +
"            DB.set(key, _lpP);\r\n" +
"            if (JSON.stringify(_lpP) !== _prevP) markDirty(key);\r\n" +
"            continue;\r\n" +
"          }";
idx = rep(idx, oldCloud, newCloud, 'bloc cloud mdb_paye', true);

/* 2) Helpers : grille collee au demarrage + cellule Departement/Fonction */
const helperAnchor = "function getFonctionsI() { return getPayeSectionI('fonctions', []); }";
idx = rep(idx, helperAnchor,
  helperAnchor + NL +
  "function ensureGrillePersisteeI() {" + NL +
  "  try {" + NL +
  "    var pG = getPayeDataI();" + NL +
  "    if (!pG.categories || !pG.categories.length) {" + NL +
  "      pG.categories = woodSectorGridDataI();" + NL +
  "      DB.set('mdb_paye', pG);" + NL +
  "      if (typeof markDirty === 'function') markDirty('mdb_paye');" + NL +
  "      return true;" + NL +
  "    }" + NL +
  "  } catch (eG) {}" + NL +
  "  return false;" + NL +
  "}" + NL +
  "setTimeout(ensureGrillePersisteeI, 2500);" + NL +
  "setTimeout(ensureGrillePersisteeI, 8000);" + NL +
  "function deptFoncCellI(p) { var sD = String(p.service || '').trim(); var fD = String(p.fonction || '').trim(); var vD = (sD && fD) ? sD + '/' + fD : (sD || fD); return vD ? escH(vD) : '-'; }",
  "helpers grille + deptfonc");

/* 3) Tableau liste employes : colonnes identiques au module Paye */
const oldHeadList = "'<table style=\"margin-top:0\"><thead><tr><th>Matricule</th><th>Nom & Pr\u00e9noms</th><th>D\u00e9partement</th><th>Fonction</th><th>Cat\u00e9gorie</th>";
idx = rep(idx, oldHeadList,
  "'<table style=\"margin-top:0\"><thead><tr><th>Matricule & Nom</th><th>D\u00e9partement / Fonction</th><th>Cat\u00e9gorie</th>",
  "entete liste");
const oldRowList = "toLowerCase()) + '\"><td class=\"fw-600\">' + escH(p.matricule) + '</td><td><strong>' + escH(p.nom) + ' ' + escH(p.prenoms || '') + '</strong></td><td>' + escH(p.service || '-') + '</td><td>' + escH(p.fonction || '-') + '</td><td>'";
idx = rep(idx, oldRowList,
  "toLowerCase()) + '\"><td class=\"fw-600\"><strong>' + escH(p.matricule) + '</strong> - ' + escH(p.nom) + ' ' + escH(p.prenoms || '') + '</td><td>' + deptFoncCellI(p) + '</td><td>'",
  "ligne liste");

/* 4) Impression : memes colonnes */
const oldHeadPrint = "<th>Matricule</th><th>Nom & Pr\u00e9noms</th><th>D\u00e9partement</th><th>Fonction</th><th>Cat\u00e9gorie</th>";
idx = rep(idx, oldHeadPrint,
  "<th>Matricule & Nom</th><th>D\u00e9partement / Fonction</th><th>Cat\u00e9gorie</th>",
  "entete impression");
const oldRowPrint = "'<tr><td>' + escH(p.matricule) + '</td><td>' + escH(p.nom + ' ' + (p.prenoms||'')) + '</td><td>' + escH(p.service || '-') + '</td><td>' + escH(p.fonction || '-') + '</td><td>'";
idx = rep(idx, oldRowPrint,
  "'<tr><td><strong>' + escH(p.matricule) + '</strong> - ' + escH(p.nom + ' ' + (p.prenoms||'')) + '</td><td>' + deptFoncCellI(p) + '</td><td>'",
  "ligne impression");

/* 5) CSV : memes colonnes */
idx = rep(idx,
  "var header = ['Matricule','Nom','Pr\u00e9noms','D\u00e9partement','Fonction','Cat\u00e9gorie','Date D\u00e9but','Date Fin','Type Contrat'];",
  "var header = ['Matricule & Nom','D\u00e9partement/Fonction','Cat\u00e9gorie','Date D\u00e9but','Date Fin','Type Contrat'];",
  "csv entete");
idx = rep(idx,
  "var row = [p.matricule||'', p.nom||'', p.prenoms||'', p.service||'', p.fonction||'', cat ? cat.libelle : (p.categorie_id||''), p.date_entree||'', df, typeContratLabelI(p)];",
  "var row = [((p.matricule||'') + ' - ' + (p.nom||'') + ' ' + (p.prenoms||'')).trim(), ((p.service||'') && (p.fonction||'')) ? (p.service.trim() + '/' + p.fonction.trim()) : ((p.service||'') || (p.fonction||'')), cat ? cat.libelle : (p.categorie_id||''), p.date_entree||'', df, typeContratLabelI(p)];",
  "csv ligne");

fs.writeFileSync('public/index.html', idx);

/* ================= PAYE.HTML ================= */

/* 6) Entete + ligne : meme colonne cumulee */
paye = rep(paye,
  "<th>Matricule & Nom</th><th>D\\u00e9partement</th><th>Fonction</th>",
  "<th>Matricule & Nom</th><th>D\\u00e9partement / Fonction</th>",
  "paye entete");
paye = rep(paye,
  "function loadPersonnel() {",
  "function deptFoncCell(p) { var sD = String(p.service || '').trim(); var fD = String(p.fonction || '').trim(); var vD = (sD && fD) ? sD + '/' + fD : (sD || fD); return vD ? escH(vD) : '-'; }\r\nfunction loadPersonnel() {",
  "paye helper");
paye = rep(paye,
  "'</td><td>' + escH(p.service || '-') + '</td><td>' + escH(p.fonction || '-') + '</td><td>'",
  "'</td><td>' + deptFoncCell(p) + '</td><td>'",
  "paye ligne", true);

/* 7) Garde cloud etendue : aucun tableau non-vide local ne peut etre efface par du vide + graine */
paye = rep(paye,
  "(function(){var _cur=DB.getMain(PAYE_KEY);var _inc=data[PAYE_KEY];var _ic=_inc.categories;var _cc=_cur?_cur.categories:null;if((!Array.isArray(_ic)||!_ic.length)&&Array.isArray(_cc)&&_cc.length){_inc.categories=_cc;}DB.setMain(PAYE_KEY,_inc);})()",
  "(function(){var KEYS=['categories','services','fonctions','primesSpec','pointage'];var _cur=DB.getMain(PAYE_KEY)||{};var _inc=data[PAYE_KEY]||{};for(var ki2=0;ki2<KEYS.length;ki2++){var k3=KEYS[ki2];var ic2=_inc[k3],cc3=_cur[k3];if((!Array.isArray(ic2)||!ic2.length)&&Array.isArray(cc3)&&cc3.length)_inc[k3]=cc3;}if(!_inc.categories||!_inc.categories.length){try{_inc.categories=woodSectorGridData();}catch(e4){}}DB.setMain(PAYE_KEY,_inc);})()",
  "paye garde cloud etendue");

fs.writeFileSync('public/paye.html', paye);
console.log('Patch grille permanente + listes identiques OK');
