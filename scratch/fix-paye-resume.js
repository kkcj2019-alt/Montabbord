const fs = require('fs');
const NL = '\r\n';
let paye = fs.readFileSync('public/paye.html', 'utf8');

function rep(str, oldS, newS, label, all) {
  const cnt = str.split(oldS).length - 1;
  if (cnt < 1 || (!all && cnt !== 1)) { console.error('ANCRE ' + cnt + 'x: ' + label); process.exit(1); }
  return all ? str.split(oldS).join(newS) : str.replace(oldS, newS);
}

/* Entete + ligne : colonne cumulee */
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

/* Garde cloud etendue + graine grille */
paye = rep(paye,
  "(function(){var _cur=DB.getMain(PAYE_KEY);var _inc=data[PAYE_KEY];var _ic=_inc.categories;var _cc=_cur?_cur.categories:null;if((!Array.isArray(_ic)||!_ic.length)&&Array.isArray(_cc)&&_cc.length){_inc.categories=_cc;}DB.setMain(PAYE_KEY,_inc);})()",
  "(function(){var KEYS=['categories','services','fonctions','primesSpec','pointage'];var _cur=DB.getMain(PAYE_KEY)||{};var _inc=data[PAYE_KEY]||{};for(var ki2=0;ki2<KEYS.length;ki2++){var k3=KEYS[ki2];var ic2=_inc[k3],cc3=_cur[k3];if((!Array.isArray(ic2)||!ic2.length)&&Array.isArray(cc3)&&cc3.length)_inc[k3]=cc3;}if(!_inc.categories||!_inc.categories.length){try{_inc.categories=woodSectorGridData();}catch(e4){}}DB.setMain(PAYE_KEY,_inc);})()",
  "paye garde cloud etendue", true);

fs.writeFileSync('public/paye.html', paye);
console.log('Partie paye OK');
