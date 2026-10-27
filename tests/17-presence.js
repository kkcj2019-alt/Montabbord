'use strict';
/* tests/17-presence.js — fiche de presence du jour : rapport Direction (PDF)
   et delais de synchro temps reel entre postes. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');
function run(rapport) {
  rapport.section('17. Presence du jour et temps reel');
  let h;
  try { h = chargerApp('paye.html', storeRealiste()); } catch (e) { rapport.ko('chargement paye : ' + e.message); return; }
  let res;
  try {
    res = String(vm.runInContext(`(function(){
      var html = null;
      window.open = function(){ return { document: { open:function(){}, write: function(s){ html = (html||'') + s; }, close: function(){} }, focus: function(){}, print: function(){}, close: function(){} }; };
      var d = new Date(); var ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var data = fpjDonneesJour(ds);
      printRapportPresenceDirection(ds);
      if (!html) return 'ECHEC : aucun document produit';
      var ok = /RAPPORT DE PR/.test(html) && /présence|Présence/.test(html) && /absence|Absence/.test(html);
      var t = data.tot; var somme = t.pres + t.abs + t.np;
      return (ok && somme === t.eff) ? 'OK : effectif ' + t.eff + ' = ' + t.pres + ' pres. + ' + t.abs + ' abs. + ' + t.np + ' non pointes' : 'ECHEC : ' + JSON.stringify({ok:ok, eff:t.eff, somme:somme});
    })()`, h.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Rapport Direction : comptes coherents  ->  ' + res); else rapport.ko('Rapport Direction  ->  ' + res);

  try {
    res = String(vm.runInContext(`(function(){
      var a = { id:'a', status:'inactif', date_entree:'2024-01-02', date_sortie:'2026-09-04' };
      var b = { id:'b', status:'inactif', date_entree:'2026-09-01' };
      var c = { id:'c', status:'actif', date_entree:'2026-01-01' };
      var d = { id:'d', status:'actif', date_entree:'2026-11-01' };
      var r = [empActifLeJour(a,'2026-10-26'), empActifLeJour(a,'2026-09-04'), empActifLeJour(b,'2026-10-26'), empActifLeJour(c,'2026-10-26'), empActifLeJour(d,'2026-10-26')];
      return (r.join() === 'false,true,false,true,false') ? 'OK : sorti le 04/09 invisible le 26/10 (visible le 04/09), inactif sans date invisible, futur entrant invisible' : 'ECHEC ' + r.join();
    })()`, h.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Fiche de presence : seuls les employes en poste ce jour-la  ->  ' + res); else rapport.ko('Employes sortis dans la fiche du jour  ->  ' + res);

  try {
    const hi = chargerApp('index.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      var cur = { societe:{nom:'X'}, pointage:[{id:'p3',date:'2026-10-26'}], categories:[{code:'1A'}], pointage_tombstones:['p2'] };
      var bak = { societe:{nom:'Y',ncc:'1'}, pointage:[{id:'p1'},{id:'p2'},{id:'p3',date:'ancien'}], categories:[{code:'A',id:'c1'},{code:'B',id:'c2'}], services:[{id:'s1'}] };
      var r = _fusionPaieRecuperation(cur, bak).paye;
      var ids = r.pointage.map(function(x){return x.id;}).sort().join();
      var p3 = r.pointage.filter(function(x){return x.id==='p3';})[0].date;
      var sus1 = _snapshotSuspect({ mdb_employes:[1,2,3,4,5,6], mdb_paye:{ pointage:[] } });
      var sus2 = _snapshotSuspect({ mdb_employes:[1,2,3,4,5,6], mdb_paye:{ pointage:[{id:1}] } });
      return (ids === 'p1,p3' && p3 === '2026-10-26' && r.societe.nom === 'X' && r.societe.ncc === '1' && r.categories.length === 2 && r.services.length === 1 && sus1 && !sus2)
        ? 'OK : manquants ajoutes (p1), actuel garde (p3 du jour), supprime volontaire non ressuscite (p2), sauvegarde a Paie vide bloquee'
        : 'ECHEC ' + JSON.stringify({ids:ids,p3:p3,soc:r.societe,cat:r.categories.length,sus1:sus1,sus2:sus2});
    })()`, hi.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Recuperation de la Paie depuis une sauvegarde (fusion sans effacement)  ->  ' + res); else rapport.ko('Recuperation Paie  ->  ' + res);

  try {
    const ha = chargerApp('index.html', storeRealiste());
    vm.runInContext("window.currentUser = window.__currentUser = {id:'u1',login:'admin',nom:'Admin',isAdmin:true,isSuperAdmin:true,sections:{}};", ha.ctx);
    res = String(vm.runInContext(`(function(){
      navigateTo('accidents'); var ok1 = /Accidents du travail/.test(document.getElementById('content').innerHTML);
      showAccident(); var emp = (getEmployes()[0] || {}).id || 'e1';
      var set = function(i, v){ var e = document.getElementById(i); if (e) e.value = v; };
      set('at-emp', emp); set('at-date', '2026-10-20'); set('at-prise', 'entreprise'); set('at-frais-ent', '25000'); set('at-jours', '3');
      saveAccident(''); var l = getAccidents(); var a = l[l.length - 1];
      var x = ''; window.open = function(){ return { document: { write: function(s){ x += s; }, close: function(){} } }; }; printAccident(a.id);
      return (ok1 && a && a.numero === 'AT-2026-001' && a.frais_entreprise === 25000 && atRetardCNPS(a) && /FICHE D/.test(x)) ? 'OK : page, enregistrement AT-2026-001, alerte CNPS > 48 h, fiche imprimable' : 'ECHEC ' + JSON.stringify({ok1:ok1, a:a});
    })()`, ha.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('RH : registre des accidents du travail  ->  ' + res); else rapport.ko('Accidents du travail  ->  ' + res);

  try {
    const hp = chargerApp('paye.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      var emp = (getPersonnel()[0] || {}).id;
      localStorage.setItem('mdb_rh_accidents', JSON.stringify([{ id:'at1', numero:'AT-2026-001', employee_id: emp, date:'2026-10-05', arret_du:'2026-10-06', arret_au:'2026-10-09', date_reprise:'2026-10-12', date_reprise_reelle:'2026-10-14' }]));
      ptCongePointageAuto('2026-10');
      var pts = getPointageData().filter(function(r){ return r.employee_id === emp; });
      var at = pts.filter(function(r){ return r.at_auto; }).map(function(r){ return r.date; }).sort();
      var ret = pts.filter(function(r){ return r.retard_reprise_auto; }).map(function(r){ return r.date; }).sort();
      var r0 = pts.filter(function(r){ return r.at_auto; })[0] || {};
      ptCongePointageAuto('2026-10');
      var n2 = getPointageData().filter(function(r){ return r.employee_id === emp && r.at_auto; }).length;
      return (at.join() === '2026-10-06,2026-10-07,2026-10-08,2026-10-09' && ret.join() === '2026-10-12,2026-10-13' && r0.absent_paye === true && r0.h_j_manual === '8' && r0.transport_paid === false && n2 === 4)
        ? 'OK : 4 jours d’arret pointes 8 h payees sans transport, 12-13/10 absents (reprise reelle le 14), pas de doublon'
        : 'ECHEC ' + JSON.stringify({at:at, ret:ret, r0:r0, n2:n2});
    })()`, hp.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Accident du travail -> pointage automatique  ->  ' + res); else rapport.ko('AT pointage auto  ->  ' + res);
  try {
    const hc = chargerApp('index.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      window.currentUser = currentUser = { id:'u1', subUserId:'uK', caisseId:'cK', nom:'K' };
      var sortie = { typeOp:'transfert', sens:'sortie', caisseId:'cK', caisseDestId:'cA' };
      var entreeChezA = { typeOp:'transfert', sens:'entree', caisseId:'cA', caisseSourceId:'cK', caisseDestId:'cA' };
      var entreeChezK = { typeOp:'transfert', sens:'entree', caisseId:'cK', caisseSourceId:'cA', caisseDestId:'cK' };
      var r = [canValidateTransfert(sortie), canValidateTransfert(entreeChezA), canValidateTransfert(entreeChezK)];
      return r.join() === 'false,false,true' ? 'OK : l’envoyeur ne voit pas Approuver ; seul le destinataire approuve' : 'ECHEC ' + r.join();
    })()`, hc.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Caisse : transfert approuve par celui qui recoit  ->  ' + res); else rapport.ko('Approbation transfert  ->  ' + res);

  try {
    const hb = chargerApp('index.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      window.currentUser = currentUser = { id:'u1', nom:'Admin', isAdmin:true, caisseCentralisee:true };
      if (!getBanques().length) DB.set('mdb_banques', [{ id:'b1', nom:'BANQUE TEST' }]);
      if (!getCaisses().length) DB.set('mdb_caisses', [{ id:'c1', nom:'CAISSE TEST' }]);
      var n0 = getOperationsCaisse().length, b0 = getBanqueOperations().length;
      showApproBanque(); var set = function(i, v){ var e = document.getElementById(i); if (e) e.value = v; };
      set('abq-banque', getBanques()[0].id); set('abq-caisse', getCaisses()[0].id); set('abq-montant', '150000'); set('abq-date', '2026-10-26');
      saveApproBanque();
      var o = getOperationsCaisse().filter(function(x){ return x.typeOp === 'approBanque'; })[0];
      var b = o && getBanqueOperations().filter(function(x){ return x.caisseOpId === o.id; })[0];
      window.confirm = function(){ return true; }; try { deleteCaisse(o.id); } catch (eD) {}
      var reste = getBanqueOperations().filter(function(x){ return x.caisseOpId === o.id; }).length;
      return (o && b && o.sens === 'entree' && b.sens === 'sortie' && b.montant === 150000 && reste === 0) ? 'OK : caisse +150 000 (entree), banque -150 000 (sortie), suppression liee' : 'ECHEC ' + JSON.stringify({o:!!o, b:!!b, reste:reste});
    })()`, hb.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Caisse : appro depuis la banque  ->  ' + res); else rapport.ko('Appro banque  ->  ' + res);

  /* Montage : une saisie refaite APRES une suppression ne doit plus etre effacee a la synchro */
  try {
    const hm = chargerApp('paye.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      var day = '2026-10-02', e = 'e1';
      var old = { id:'m_old', employee_id:e, date:day, article_code:'E2', quantite:4 };
      var cloud = { pointageMontage:[old], pointageMontage_tombstones:[] };
      var tb = []; _payeAjouterTombCle(tb, old); tb.push('m_old');
      var t0 = Date.now(); while (Date.now() - t0 < 3) {}
      var neu = { id:'m_new', employee_id:e, date:day, article_code:'E2', quantite:9, updatedAt: Date.now() + 5 };
      var local = { pointageMontage:[neu], pointageMontage_tombstones: tb };
      var a = _payeMergeObj(JSON.parse(JSON.stringify(local)), JSON.parse(JSON.stringify(cloud)), false).pointageMontage;
      var b = _payeMergeObj(JSON.parse(JSON.stringify(cloud)), JSON.parse(JSON.stringify(local)), true).pointageMontage;
      var leg = _payeMergeObj({ pointageMontage:[neu], pointageMontage_tombstones:['cle:pt:e1|2026-10-02|e2'] }, { pointageMontage:[{ employee_id:e, date:day, article_code:'E2', quantite:4, id:'x' }] }, false).pointageMontage;
      var ok = a.length === 1 && a[0].quantite === 9 && b.length === 1 && b[0].quantite === 9 && leg.length === 1 && leg[0].quantite === 9;
      return ok ? 'OK : nouvelle saisie gardee (9), ancienne version effacee' : 'ECHEC ' + JSON.stringify({a:a, b:b, leg:leg});
    })()`, hm.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Montage : saisie refaite apres suppression conservee  ->  ' + res); else rapport.ko('Montage resaisie effacee  ->  ' + res);

  /* Index : meme regle (sinon l'appli principale effacait la ressaisie et la renvoyait au cloud) */
  try {
    const hi2 = chargerApp('index.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      var neu = { id:'m_new', employee_id:'e1', date:'2026-10-03', article_code:'E2', quantite:27, updatedAt: Date.now() };
      var vieux = { id:'m_old', employee_id:'e1', date:'2026-10-03', article_code:'E2', quantite:4 };
      var setLeg = _mdbTombPtSet(['cle:pt:e1|2026-10-03|e2', 'm_old']);
      var setDat = _mdbTombPtSet(['cle:pt:e1|2026-10-03|e2@' + (Date.now() - 60000)]);
      var setApres = _mdbTombPtSet(['cle:pt:e1|2026-10-03|e2@' + (Date.now() + 60000)]);
      var ok = !_mdbTombPtSupprime(setLeg, neu) && _mdbTombPtSupprime(setLeg, vieux) && !_mdbTombPtSupprime(setDat, neu) && _mdbTombPtSupprime(setApres, neu);
      return ok ? 'OK : ressaisie gardee, ancienne ligne et suppression posterieure respectees' : 'ECHEC';
    })()`, hi2.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Index : tombstones pointage dates  ->  ' + res); else rapport.ko('Index tombstones  ->  ' + res);

  /* Prime de production : couvercles et palettes « hors prime » exclus des barres */
  try {
    const hp = chargerApp('paye.html', storeRealiste());
    res = String(vm.runInContext(`(function(){
      setArticlesMontage([{code:'PAL114',designation:'PALETTES 114',prix:150,compte_prime:true},{code:'COUV114',designation:'COUVERCLES 114',prix:150,compte_prime:true},{code:'BBAG',designation:'BIG BAG',prix:150,compte_prime:false}]);
      setPointageMontage([{id:'a',employee_id:'e1',date:'2026-10-02',article_code:'PAL114',quantite:100},{id:'b',employee_id:'e1',date:'2026-10-02',article_code:'COUV114',quantite:40},{id:'c',employee_id:'e1',date:'2026-10-03',article_code:'BBAG',quantite:7}]);
      var q = ptPrimeProdQuantites('e1','2026-10');
      return (q.total === 100 && !q.parArt.COUV114 && !q.parArt.BBAG) ? 'OK : 100 palettes comptées (40 couvercles et 7 hors prime exclus)' : 'ECHEC ' + JSON.stringify(q);
    })()`, hp.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Prime production : seules les palettes qui comptent  ->  ' + res); else rapport.ko('Prime production couvercles  ->  ' + res);

  const pub = path.join(__dirname, '..', 'public');
  const idx = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  const prod = fs.readFileSync(path.join(pub, 'production.html'), 'utf8');
  const pay = fs.readFileSync(path.join(pub, 'paye.html'), 'utf8');
  const sdk = fs.readFileSync(path.join(pub, 'supabase-sdk', 'mdb-supabase.js'), 'utf8');
  const m1 = idx.match(/_pushTimer = setTimeout\(pushToCloud, (\d+)\);\s*\}/);
  const m2 = prod.match(/_prodPushT = setTimeout\(prodPushNow, (\d+)\)/);
  const m3 = pay.match(/\}, force \? 300 : (\d+)\);/);
  const vals = [m1 && +m1[1], m2 && +m2[1], m3 && +m3[1]];
  if (vals.every(v => v && v <= 1000)) rapport.ok('Envoi vers les autres postes en moins d\'1 s (index ' + vals[0] + ' ms, production ' + vals[1] + ' ms, paye ' + vals[2] + ' ms)');
  else rapport.ko('Delais d\'envoi trop longs : ' + vals.join('/'));
  if (/ouvertJusqua/.test(sdk) && /En direct/.test(sdk) && /width = '12px'/.test(sdk)) rapport.ok('Voyant de synchro discret (petit point, detail a l\'appui, texte seulement en cas d\'alerte)');
  else rapport.ko('Voyant temps reel absent');
}
module.exports = { run };
