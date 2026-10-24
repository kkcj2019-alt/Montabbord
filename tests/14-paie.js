'use strict';
/* tests/14-paie.js — paie : taux parametrables reellement appliques, plafonds */
const vm = require('vm');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');
function run(rapport) {
  rapport.section('14. Paie : taux et plafonds');
  function cas(nom, code) {
    let h;
    try { h = chargerApp('paye.html', storeRealiste()); } catch (e) { rapport.ko(nom + ' : chargement (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(code, h.ctx, { timeout: 30000 })).trim(); } catch (e) { rapport.ko(nom + ' : exception ' + e.message); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res); else rapport.ko(nom + '  ->  ' + res);
  }
  cas('Reduction charges de famille plafonnee a 5 parts', `
    var a = getRICF(1), b = getRICF(1.5), c = getRICF(5), d = getRICF(7);
    (a === 0 && b === 5500 && c === 44000 && d === 44000) ? 'OK : 1->0, 1.5->5500, 5->44000, 7->44000' : 'ECHEC : ' + [a, b, c, d].join('/')`);
  cas('Bareme ITS 2024 (mensuel)', `
    var t1 = calcITS(75000), t2 = calcITS(240000), t3 = calcITS(500000), t4 = calcITS(1000000);
    (t1 === 0 && t2 === 26400 && t3 === 81000 && t4 === 192000) ? 'OK : 75k=0, 240k=26 400, 500k=81 000, 1M=192 000'
      : 'ECHEC : ' + [t1, t2, t3, t4].join('/')`);
  cas('Part patronale retraite : suit le taux parametre (plus de 7,70 % en dur)', `
    var emps = (typeof getPersonnelActifs === 'function' ? getPersonnelActifs() : []).filter(function (e) { return (parseFloat(e.salaire_base) || 0) > 0; });
    if (!emps.length) {
      var L = JSON.parse(localStorage.getItem('mdb_employes') || '[]');
      L.push({ id: 'empT', matricule: 'T1', nom: 'TEST', prenoms: 'X', salaire_base: 300000, statut: 'actif', categorie: 'mensuel', type_contrat: 'CDI', nb_parts: 1, date_embauche: '2020-01-01', mode_pointage: 'forfait' });
      localStorage.setItem('mdb_employes', JSON.stringify(L));
      emps = (typeof getPersonnelActifs === 'function' ? getPersonnelActifs() : []).filter(function (e) { return (parseFloat(e.salaire_base) || 0) > 0; });
    }
    if (!emps.length) { 'OK : (pas d\\'employe salarie dans le jeu de test)'; }
    else {
      var e = emps[0], mois = '2026-09';
      TAX_RULES.cnps_pat_ret = 0.08; window._payrollCache = {};
      var c = calculatePayroll(e, mois);
      var it = (c.items || []).filter(function (x) { return x.n === '61'; })[0];
      (it && it.retPat === Math.floor(it.base * 0.08) && it.tauxPat === '8,00') ? 'OK : retPat = base x 8 % (' + it.retPat + ')'
        : 'ECHEC : ' + JSON.stringify(it);
    }`);
}
module.exports = { run: run };
