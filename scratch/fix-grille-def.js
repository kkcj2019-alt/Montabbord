const fs = require('fs');
const NL = '\r\n';
let idx = fs.readFileSync('public/index.html', 'utf8');
let paye = fs.readFileSync('public/paye.html', 'utf8');

function rep(str, oldS, newS, label, all) {
  const cnt = str.split(oldS).length - 1;
  if (cnt < 1 || (!all && cnt !== 1)) { console.error('ANCRE ' + cnt + 'x: ' + label); process.exit(1); }
  return all ? str.split(oldS).join(newS) : str.replace(oldS, newS);
}

/* ===== INDEX.HTML ===== */

/* 1) Local prioritaire : une liste locale non vide ne peut plus etre remplacee par le cloud */
idx = rep(idx,
"            for (var _gk2 = 0; _gk2 < _grdK.length; _gk2++) { var _sk3 = _grdK[_gk2]; var _cv4 = _npP[_sk3]; if (!(Array.isArray(_cv4) && _cv4.length)) delete _npP[_sk3]; }",
"            for (var _gk2 = 0; _gk2 < _grdK.length; _gk2++) { var _sk3 = _grdK[_gk2]; var _lv5 = _lpP[_sk3]; if (Array.isArray(_lv5) && _lv5.length) { delete _npP[_sk3]; continue; } var _cv4 = _npP[_sk3]; if (!(Array.isArray(_cv4) && _cv4.length)) delete _npP[_sk3]; }",
'local d abord', true);

/* 2) Marqueur grille collee */
idx = rep(idx,
"            if (!_lpP.categories || !_lpP.categories.length) { try { _lpP.categories = woodSectorGridDataI(); } catch (_eg2) {} }",
"            if (_lpP.grilleWood !== true) { try { _lpP.categories = woodSectorGridDataI(); _lpP.grilleWood = true; } catch (_eg2) {} }\r\n            else if (!_lpP.categories || !_lpP.categories.length) { try { _lpP.categories = woodSectorGridDataI(); } catch (_eg3) {} }",
'marqueur cloud', true);

/* 3) Seed au demarrage : remplace une seule fois les vieilles listes par la grille complete */
idx = rep(idx,
"    if (!pG.categories || !pG.categories.length) {\r\n      pG.categories = woodSectorGridDataI();\r\n      DB.set('mdb_paye', pG);",
"    if (!pG.categories || !pG.categories.length || pG.grilleWood !== true) {\r\n      pG.categories = woodSectorGridDataI();\r\n      pG.grilleWood = true;\r\n      DB.set('mdb_paye', pG);",
'seed marqueur');

fs.writeFileSync('public/index.html', idx);

/* ===== PAYE.HTML ===== */

/* 4) Local prioritaire + marqueur + republication */
paye = rep(paye,
"(function(){var KEYS=['categories','services','fonctions','primesSpec','pointage'];var _cur=DB.getMain(PAYE_KEY)||{};var _inc=data[PAYE_KEY]||{};for(var ki2=0;ki2<KEYS.length;ki2++){var k3=KEYS[ki2];var ic2=_inc[k3],cc3=_cur[k3];if((!Array.isArray(ic2)||!ic2.length)&&Array.isArray(cc3)&&cc3.length)_inc[k3]=cc3;}if(!_inc.categories||!_inc.categories.length){try{_inc.categories=woodSectorGridData();}catch(e4){}}DB.setMain(PAYE_KEY,_inc);})()",
"(function(){var KEYS=['categories','services','fonctions','primesSpec','pointage'];var _cur=DB.getMain(PAYE_KEY)||{};var _inc=data[PAYE_KEY]||{};var _chg7=false;for(var ki2=0;ki2<KEYS.length;ki2++){var k3=KEYS[ki2];var cc3=_cur[k3];if(Array.isArray(cc3)&&cc3.length)_inc[k3]=cc3;}if(_cur.grilleWood===true){_inc.grilleWood=true;_inc.categories=_cur.categories;}else{if(!_inc.categories||!_inc.categories.length){try{_inc.categories=woodSectorGridData();_inc.grilleWood=true;_chg7=true;}catch(e4){}}}DB.setMain(PAYE_KEY,_inc);if(_chg7)pushPayeCloud();})()",
'garde paye locale dabord', true);

fs.writeFileSync('public/paye.html', paye);
console.log('Local prioritaire + grille definitive OK');
