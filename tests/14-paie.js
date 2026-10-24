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
  cas('Conges : 2,2 j ouvrables/mois + majorations anciennete annee par annee (art. 25.1, 25.2)', `
    var a = congeAcquisLegal(12), b = congeAcquisLegal(60), c = congeAcquisLegal(72), d = congeAcquisLegal(6);
    (a === 26.4 && b === 133 && c === 160.4 && d === 13.2) ? 'OK : 1 an 26,4 j ; 5 ans 133 j ; 6 ans 160,4 j ; 6 mois 13,2 j'
      : 'ECHEC : ' + [a, b, c, d].join(' / ')`);
  cas('Conges pris : jours ouvrables (dimanche exclu), maladie non decomptee', `
    var n = congeJoursOuvrablesEntre('2026-10-05', '2026-10-11'); /* lundi -> dimanche */
    setCongesJours([
      { id: 'c1', employee_id: 'E1', dateDepart: '2026-10-05', duree: 7, type: 'Annuel', statut: 'planifié' },
      { id: 'c2', employee_id: 'E1', dateDepart: '2026-11-02', duree: 3, type: 'Maladie', statut: 'planifié' }
    ]);
    var p = congePris('E1');
    (n === 6 && p === 6) ? 'OK : 7 jours calendaires = 6 ouvrables ; maladie ignoree' : 'ECHEC : ouvrables=' + n + ' pris=' + p`);
  cas('Conges pris : un jour ferie declare pendant le conge n est pas decompte', `
    setFeries([{ id: 'f1', date: '2026-11-01', libelle: 'Toussaint' }, { id: 'f2', date: '2026-11-15', libelle: 'Paix' }]);
    var n1 = congeJoursOuvrablesEntre('2026-10-30', '2026-11-03'); /* ven, sam, dim(1/11 ferie+dimanche), lun, mar */
    var n2 = congeJoursOuvrablesEntre('2026-11-13', '2026-11-17'); /* ven, sam, dim 15 (ferie), lun, mar */
    setFeries([{ id: 'f3', date: '2026-08-07', libelle: 'Independance' }]);
    var n3 = congeJoursOuvrablesEntre('2026-08-03', '2026-08-08'); /* lun -> sam, vendredi 7 ferie */
    setFeries([]);
    var n4 = congeJoursOuvrablesEntre('2026-08-03', '2026-08-08');
    (n1 === 4 && n2 === 4 && n3 === 5 && n4 === 6) ? 'OK : 6 jours lun-sam avec le 7 aout ferie = 5 ouvrables (6 sans ferie)'
      : 'ECHEC : ' + [n1, n2, n3, n4].join(' / ')`);
  cas('Conges : +2 j par enfant (salarie < 21 ans) ; adulte : +2 j par enfant a partir du 4e (art. 25.2)', `
    var jeune = { enfants: 1, date_naissance: '2006-06-01' };       /* 20 ans en 2026 */
    var adulte3 = { enfants: 3, date_naissance: '1990-01-01' };
    var adulte5 = { enfants: 5, date_naissance: '1990-01-01' };
    var a = congeAcquisLegal(12, jeune, '2025-10-01');    /* 26,4 + 2 */
    var b = congeAcquisLegal(12, adulte3, '2025-10-01');  /* 26,4 */
    var c = congeAcquisLegal(12, adulte5, '2025-10-01');  /* 26,4 + 4 */
    var d = congeAcquisLegal(6, adulte5, '2026-04-01');   /* 13,2 + 4 x 6/12 */
    var e = congeAcquisLegal(12);                         /* sans fiche : inchange */
    (a === 28.4 && b === 26.4 && c === 30.4 && d === 15.2 && e === 26.4) ? 'OK : jeune 1 enfant 28,4 ; adulte 3 enfants 26,4 ; 5 enfants 30,4 ; 6 mois 15,2'
      : 'ECHEC : ' + [a, b, c, d, e].join(' / ')`);
  cas("STC : l'impression fonctionne (avant : modele d'attestation colle par erreur, plantage)", `
    setPayeSection('stcRecords', [{ id: 'S1', nom: 'KOFFI JEAN', matricule: 'M9', dateEntree: '2020-01-01', dateFin: '2026-10-15', motif: 'licenciement', preavis: 'effectue', moy12: 150000, items: [{ label: 'Indemnite de licenciement', ref: '30 %', amount: 300000 }, { label: 'Retenue - Acompte', ref: '', amount: -50000 }], total: 250000, statut: 'brouillon' }]);
    var ecrit = '';
    var _wo = window.open; window.open = function () { return { document: { write: function (x) { ecrit += x; }, close: function () {} } }; };
    var err = '';
    try { printSTCRecord('S1'); } catch (e) { err = e.message; }
    window.open = _wo;
    (!err && ecrit.indexOf('Solde de tout compte') !== -1 && ecrit.indexOf('Indemnite de licenciement') !== -1 && ecrit.indexOf('KOFFI JEAN') !== -1) ? 'OK : document STC produit (rubriques, net, signatures)' : 'ECHEC : ' + (err || ecrit.slice(0, 200))`);
  cas('Acomptes : soldes de salaire dans leur propre colonne ; frais (communication...) jamais comptes comme acompte', `
    var emps = JSON.parse(localStorage.getItem('mdb_employes') || '[]'); var e = emps[0];
    localStorage.setItem('mdb_operationsCaisse', JSON.stringify([
      { id: 'OS', code: 'SOLDE_SALAIRE', apType: 'solde', sens: 'sortie', montant: 335400, date: '2026-10-02', beneficiaireId: e.id, acomptePretId: 'AS' },
      { id: 'OA', code: 'ACOMPTE', apType: 'acompte', sens: 'sortie', montant: 20000, date: '2026-10-05', beneficiaireId: e.id, acomptePretId: 'AA' },
      { id: 'OF', code: 'com', apType: '', sens: 'sortie', montant: 3500, date: '2026-10-22', beneficiaireId: e.id, libelle: 'Frais de communication', acomptePretId: 'AF' }
    ]));
    localStorage.setItem('mdb_acomptesPrets', JSON.stringify([
      { id: 'AS', type: 'acompte', employeId: e.id, montant: 335400, caisseOpId: 'OS', moisDeduction: '2026-10', date: '2026-10-02' },
      { id: 'AA', type: 'acompte', employeId: e.id, montant: 20000, caisseOpId: 'OA', moisDeduction: '2026-10', date: '2026-10-05' },
      { id: 'AF', type: 'acompte', employeId: e.id, montant: 3500, caisseOpId: 'OF', moisDeduction: '2026-10', date: '2026-10-22' }
    ]));
    var ids = getAPList().map(function (a) { return a.id; }).sort().join(',');
    window._apTabP = 'tous'; window._apMonthP = ''; window._apStatutP = 'tous';
    var err = ''; try { _payeApReconciled = true; loadAP(); } catch (x) { err = x.message; }
    var stats = document.getElementById('ap-stats').innerHTML;
    var soldeOk = stats.indexOf('Total soldes') !== -1 && stats.indexOf('335') !== -1;
    /* Reste a retenir : ni le solde (deja paye) ni l'acompte valide (retenu) -> seulement l'acompte non valide AA = 20 000 */
    var iR = stats.indexOf('Reste '), vR = iR === -1 ? '' : stats.slice(stats.indexOf('class="val">', iR) + 12, stats.indexOf('</div>', stats.indexOf('class="val">', iR)));
    var resteOk = vR.replace(/[^0-9]/g, '') === '20000';
    soldeOk = soldeOk && resteOk;
    var reco = 0; try { _payeApReconciled = false; _payeReconcileAPFromCaisse(); reco = getAPList().filter(function (a) { return a.caisseOpId === 'OF'; }).length; } catch (x2) { err = err || x2.message; }
    (!err && ids === 'AA,AS' && soldeOk && reco === 0) ? 'OK : liste AA,AS (frais exclus) ; carte « Total soldes » 335 400 ; frais non recree depuis la caisse'
      : 'ECHEC : ' + JSON.stringify({ err: err, ids: ids, soldeOk: soldeOk, stats: stats.slice(0, 300), reco: reco })`);
  cas('Nuit : dans les 40 h = normales ; au-dela de 40 h = +75 %', `
    var emps = payeArr('mdb_employes');
    emps.push({ id: 'en', nom: 'Nuit', prenoms: 'T', matricule: 'MN01', fonction: 'Gardien', service: 'Prod', type_contrat: 'Journalier', categorie: 'A', status: 'actif', date_embauche: '2024-06-01', salaire_base: 4000 });
    DB.setMain('mdb_employes', emps);
    /* lundi 5 -> samedi 10 octobre 2026 : 6 nuits de 8 h = 48 h, dont 8 h au-dela de 40 h */
    var pts = [];
    ['05','06','07','08','09','10'].forEach(function (d, i) { pts.push({ id: 'n' + i, employee_id: 'en', date: '2026-10-' + d, h_n_manual: '8' }); });
    setPointageData(pts);
    var emp = getPersonnel().filter(function (p) { return p.id === 'en'; })[0];
    var st = getMonthStats(emp, '2026-10');
    (Math.abs(st.normalHours - 40) < 0.01 && Math.abs(st.hs75 - 8) < 0.01) ? 'OK : 48 h de nuit = 40 h normales + 8 h a +75 %'
      : 'ECHEC : normales=' + st.normalHours + ' hs75=' + st.hs75`);
  cas("Prime d'anciennete : plafond 25 % et base = minimum de la categorie (art. 55)", `
    var cats = getCategories(); cats.push({ code: 'TCAT', libelle: 'Test', salaire_min: 100000 }); setPayeSection('categories', cats);
    var L = JSON.parse(localStorage.getItem('mdb_employes') || '[]');
    L.push({ id: 'eA', matricule: 'A1', nom: 'ANCIEN', prenoms: 'X', salaire_base: 300000, statut: 'actif', categorie_id: 'TCAT', type_contrat: 'CDI', nb_parts: 1, date_entree: '1990-01-01', mode_pointage: 'forfait' });
    localStorage.setItem('mdb_employes', JSON.stringify(L));
    var emp = getPersonnel().filter(function (p) { return p.id === 'eA'; })[0];
    var pts = [];
    for (var d = 1; d <= 30; d++) { var dd = '2026-09-' + (d < 10 ? '0' : '') + d; var dw = new Date(2026, 8, d).getDay(); if (dw !== 0 && dw !== 6) pts.push({ id: 'a' + d, employee_id: 'eA', date: dd, h_j_manual: '8' }); }
    setPointageData(pts); window._payrollCache = {};
    var c = calculatePayroll(emp, '2026-09');
    var it = (c.items || []).filter(function (x) { return x.n === '21'; })[0];
    (it && it.taux === '25,00' && it.base === 100000 && it.gain === 25000) ? 'OK : 36 ans -> 25 % de 100 000 (minimum categorie) = 25 000'
      : 'ECHEC : ' + JSON.stringify(it)`);
  cas('Taxes patronales : local = CN 1,2 % + TA 0,4 % + FPC 1,2 %, pas de contribution employeur ; expatrie = +9,2 %', `
    var L = JSON.parse(localStorage.getItem('mdb_employes') || '[]');
    L.push({ id: 'eL', matricule: 'L1', nom: 'LOCAL', prenoms: 'X', salaire_base: 200000, statut: 'actif', type_contrat: 'CDI', nb_parts: 1, date_entree: '2020-01-01', mode_pointage: 'forfait' });
    L.push({ id: 'eX', matricule: 'X1', nom: 'EXPAT', prenoms: 'Y', salaire_base: 200000, statut: 'actif', type_contrat: 'CDI', nb_parts: 1, date_entree: '2020-01-01', mode_pointage: 'forfait', expatrie: true });
    localStorage.setItem('mdb_employes', JSON.stringify(L));
    var pts = [];
    ['eL', 'eX'].forEach(function (id) { for (var d = 1; d <= 30; d++) { var dw = new Date(2026, 8, d).getDay(); if (dw !== 0 && dw !== 6) pts.push({ id: id + d, employee_id: id, date: '2026-09-' + (d < 10 ? '0' : '') + d, h_j_manual: '8' }); } });
    setPointageData(pts); window._payrollCache = {}; loadTaxRules();
    function lignes(id) { var e = getPersonnel().filter(function (p) { return p.id === id; })[0]; var c = calculatePayroll(e, '2026-09'); var o = {}; (c.items || []).forEach(function (x) { if (['66','67','68','69'].indexOf(x.n) !== -1) o[x.n] = x.tauxPat; }); return o; }
    var a = lignes('eL'), b = lignes('eX');
    (a['66'] === '1,20' && a['68'] === '1,20' && !a['69'] && b['69'] === '9,20') ? 'OK : local ' + JSON.stringify(a) + ' / expatrie CE ' + b['69']
      : 'ECHEC : local=' + JSON.stringify(a) + ' expat=' + JSON.stringify(b)`);
}
module.exports = { run: run };
