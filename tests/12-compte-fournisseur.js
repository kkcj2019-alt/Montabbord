'use strict';
/* =====================================================================
   tests/12-compte-fournisseur.js
   Compte fournisseur (app principale) :
   - bon de commande : inscription au compte au choix + montant libre ;
   - achat production saisi depuis la Gestion Commerciale : la dette suit
     la modification et disparait a la suppression ; le stock aussi.
   ===================================================================== */
const vm = require('vm');
const { storeRealiste, chargerApp, UTILISATEUR } = require('./lib/sandbox.js');

function run(rapport) {
  rapport.section('12. Compte fournisseur : bons de commande et achats');

  function cas(nom, code) {
    let h;
    try { h = chargerApp('index.html', storeRealiste()); }
    catch (e) { rapport.ko(nom + ' : chargement impossible (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(UTILISATEUR + code, h.ctx, { timeout: 30000 })).trim(); }
    catch (e) { rapport.ko(nom + ' : exception ' + (e && e.message ? e.message : e)); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res);
    else rapport.ko(nom + '  ->  ' + res);
  }

  const DETTE = `function _detteBcf(id) { return getDettesFournisseurs().filter(function (d) { return d.bcfId === id; }); }`;

  cas('Bon de commande : case decochee = rien au compte, meme confirme', DETTE + `
    var bc = { id: 'BCT1', numero: 'BCF-T1', fournisseurId: 'f1', statut: 'confirme', totalTTC: 1000, imputerCompte: false };
    syncBcfDette(bc);
    _detteBcf('BCT1').length === 0 ? 'OK : aucune dette' : 'ECHEC : ' + JSON.stringify(_detteBcf('BCT1'))`);

  cas('Bon de commande : montant libre inscrit au compte (6 recus sur 10), puis retour au total', DETTE + `
    var bc = { id: 'BCT2', numero: 'BCF-T2', fournisseurId: 'f1', statut: 'envoye', totalTTC: 1000, imputerCompte: true, montantCompte: 600 };
    syncBcfDette(bc);
    var m1 = (_detteBcf('BCT2')[0] || {}).montant;
    bc.montantCompte = 1250; syncBcfDette(bc);
    var m2 = (_detteBcf('BCT2')[0] || {}).montant;
    bc.montantCompte = null; syncBcfDette(bc);
    var m3 = (_detteBcf('BCT2')[0] || {}).montant;
    bc.statut = 'annule'; syncBcfDette(bc);
    var n4 = _detteBcf('BCT2').length;
    (m1 === 600 && m2 === 1250 && m3 === 1000 && n4 === 0 && bc.totalTTC === 1000)
      ? 'OK : 600 -> 1250 (plus que commande) -> 1000 (total) -> annule = retire ; bon intact'
      : 'ECHEC : ' + [m1, m2, m3, n4].join(' / ')`);

  cas('Bon de commande ancien (sans le choix) : regle d\'avant conservee', DETTE + `
    var bc = { id: 'BCT3', numero: 'BCF-T3', fournisseurId: 'f1', statut: 'brouillon', totalTTC: 800 };
    syncBcfDette(bc); var a = _detteBcf('BCT3').length;
    bc.statut = 'confirme'; syncBcfDette(bc); var b = (_detteBcf('BCT3')[0] || {}).montant;
    (a === 0 && b === 800) ? 'OK : brouillon = rien, confirme = 800' : 'ECHEC : ' + a + ' / ' + b`);

  cas('Bon de commande : formulaire -> enregistrement garde le choix et le montant', DETTE + `
    openBcFournisseurModal();
    document.getElementById('bcfFournisseur').value = 'f1';
    document.getElementById('bcfStatut').value = 'confirme';
    document.getElementById('bcfImputer').checked = true;
    document.getElementById('bcfMontantCompte').value = '4 500';
    document.getElementById('bcfTvaActive').checked = false;
    _bcfLignes = [{ designation: 'X', qte: 10, prixUnitaire: 1000 }];
    saveBcFournisseur();
    var b = getBonsCommandeFournisseurs().filter(function (x) { return x.numero === document.getElementById('bcfNumero').value; })[0]
         || getBonsCommandeFournisseurs()[getBonsCommandeFournisseurs().length - 1];
    var d = _detteBcf(b.id)[0] || {};
    (b.imputerCompte === true && b.montantCompte === 4500 && b.totalTTC === 10000 && d.montant === 4500)
      ? 'OK : bon 10 000, compte 4 500'
      : 'ECHEC : ' + JSON.stringify({ imp: b.imputerCompte, mc: b.montantCompte, ttc: b.totalTTC, dette: d.montant })`);

  cas('Achat (Gestion Commerciale) : modifier met a jour le compte et le stock, supprimer efface tout', `
    window.confirm = function () { return true; };
    function champ(id, v) { document.getElementById(id).value = v; }
    function enr(items, editId) {
      champ('ach_ref', 'BL-GC1'); champ('ach_date', '2026-10-20'); champ('ach_fournisseur', 'FOURNISSEUR X');
      champ('ach_receiver', ''); champ('ach_acheteur', '');
      window._apEditingId = editId || null;
      _tempAchatItems = items;
      saveApAchat({ preventDefault: function () {} }, 'finished');
    }
    function stock() { var t = 0; (apProdGet().stockFinished || []).forEach(function (l) { if (l.code === 'GC1') t += parseFloat(l.quantite) || 0; }); return t; }
    function dette(id) { return dbArr('mdb_dettesFournisseurs').filter(function (d) { return String(d.prodAchatId) === String(id); }); }
    enr([{ code: 'GC1', designation: 'GC 1', quantity: 10, unit_price: 100, total_price: 1000 }]);
    var a = (apProdGet().achats || [])[0];
    var s1 = stock(), d1 = (dette(a.id)[0] || {}).montant;
    enr([{ code: 'GC1', designation: 'GC 1', quantity: 4, unit_price: 100, total_price: 400 }], a.id);
    var s2 = stock(), d2 = (dette(a.id)[0] || {}).montant;
    deleteApAchat(a.id);
    var s3 = stock(), n3 = dette(a.id).length;
    (s1 === 10 && d1 === 1000 && s2 === 4 && d2 === 400 && s3 === 0 && n3 === 0)
      ? 'OK : stock 10 -> 4 -> 0, compte 1000 -> 400 -> supprime'
      : 'ECHEC : stock ' + [s1, s2, s3].join('/') + ' compte ' + [d1, d2, n3].join('/')`);

  cas('Achat EPI (Gestion Commerciale) : va dans le stock EPI de Production, et en repart', `
    window.confirm = function () { return true; };
    function champ(id, v) { document.getElementById(id).value = v; }
    champ('ach_ref', 'BL-EPIGC'); champ('ach_date', '2026-10-20'); champ('ach_fournisseur', 'F'); champ('ach_receiver', ''); champ('ach_acheteur', '');
    window._apEditingId = null;
    _tempAchatItems = [{ code: 'CASQ', designation: 'CASQUE', quantity: 6, unit_price: 2000, total_price: 12000 }];
    saveApAchat({ preventDefault: function () {} }, 'epi');
    var a = (apProdGet().achats || [])[0];
    function st() { var e = (apProdGet().epiCatalogue || []).filter(function (x) { return x.code === 'CASQ'; })[0]; return e ? e.stock : -1; }
    var s1 = st();
    var hist = (apProdGet().epiPurchases || []).filter(function (x) { return String(x.achat_id) === String(a.id); }).length;
    deleteApAchat(a.id);
    var s2 = st();
    var hist2 = (apProdGet().epiPurchases || []).filter(function (x) { return String(x.achat_id) === String(a.id); }).length;
    (s1 === 6 && hist === 1 && s2 === 0 && hist2 === 0) ? 'OK : catalogue EPI 6 -> 0, historique cree puis retire'
      : 'ECHEC : ' + [s1, hist, s2, hist2].join('/')`);

  cas('Fiche personnel : champs Nationalite et Personnel expatrie presents et pre-remplis', `
    var L = getEmployes(); L.push({ id: 'EXPT', matricule: 'EXP1', nom: 'DUPONT', nationalite: 'Française', expatrie: true }); DB.set('mdb_employes', L);
    openEmployeModal('EXPT');
    var h1 = document.getElementById('formModalBody').innerHTML;
    openEmployeModal();
    var h2 = document.getElementById('formModalBody').innerHTML;
    var nat = h1.indexOf('name="nationalite"') !== -1 && h1.indexOf('Française') !== -1;
    var expOui = /name="expatrie"[\\s\\S]*?<option value="oui" selected>/.test(h1);
    var aide = h1.indexOf('expat-hint-nat" style="display:block') !== -1;
    var neufNon = /name="expatrie"[\\s\\S]*?<option value="non" selected>/.test(h2) && h2.indexOf('expat-hint-nat" style="display:none') !== -1;
    var sauv = String(saveEmploye).indexOf("expatrie: f.elements['expatrie']") !== -1;
    (nat && expOui && aide && neufNon && sauv) ? 'OK : nationalite affichee, expatrie = Oui relu, aide visible pour un etranger ; nouvelle fiche = Non'
      : 'ECHEC : ' + JSON.stringify({ nat: nat, expOui: expOui, aide: aide, neufNon: neufNon, sauv: sauv })`);
  cas('Sanctions : controles du Code du travail art. 17 (mise a pied 1-8 j, 72 h, 15 j ouvrables, 3 mois, double sanction)', `
    DB.set('mdb_rh_demandes', [
      { id: 'D1', numero: 'DE-2026-0001', employee_id: 'e1', date: '2026-09-01', date_reponse: '2026-09-02', statut: 'repondue' },
      { id: 'D2', numero: 'DE-2026-0002', employee_id: 'e1', date: '2026-10-20', statut: 'attente' }
    ]);
    function c(sc, autres) { return rhControlerSanction(sc, autres || []).join(' | '); }
    var ok1 = c({ id: 'a', type: 'avertissement_ecrit', date: '2026-09-10', date_faits: '2026-08-30', demande_id: 'D1' }) === '';
    var mp9 = c({ id: 'a', type: 'mise_a_pied', duree_jours: 9, date: '2026-09-10', demande_id: 'D1' }).indexOf('1 \\u00e0 8 jours') !== -1;
    var tard = c({ id: 'a', type: 'avertissement_ecrit', date: '2026-10-01', demande_id: 'D1' }).indexOf('15 jours ouvrables') !== -1;
    var pres = c({ id: 'a', type: 'avertissement_ecrit', date: '2026-09-10', date_faits: '2026-05-01', demande_id: 'D1' }).indexOf('plus de 3 mois') !== -1;
    var h72 = c({ id: 'a', type: 'avertissement_ecrit', date: '2026-10-21', demande_id: 'D2' }).indexOf('72 h') !== -1;
    var sansDm = c({ id: 'a', type: 'licenciement', date: '2026-10-21' }).indexOf('demande d\\u2019explication') !== -1;
    var dbl = c({ id: 'b', type: 'avertissement_ecrit', date: '2026-09-10', demande_id: 'D1' }, [{ id: 'a', demande_id: 'D1', statut: 'notifie' }]).indexOf('double sanction') !== -1;
    var blame = c({ id: 'a', type: 'blame', date: '2026-09-10', demande_id: 'D1' }).indexOf('liste l\\u00e9gale') !== -1;
    var verbal = c({ id: 'a', type: 'avertissement_verbal', date: '2026-09-10' }) === '';
    var ttes = [ok1, mp9, tard, pres, h72, sansDm, dbl, blame, verbal];
    ttes.every(Boolean) ? 'OK : conforme accepte ; mise a pied 9 j, notification tardive, faits > 3 mois, delai 72 h, sans demande, double sanction, blame hors liste signales'
      : 'ECHEC : ' + ttes.join(',')`);

  cas('RH : modifier une demande ou sanction d un employe sorti le garde (ne bascule plus sur le premier actif)', `
    var L = getEmployes(); L.push({ id: 'SORTI1', matricule: 'S9', nom: 'PARTI', status: 'inactif', date_sortie: '2020-01-01' }); DB.set('mdb_employes', L);
    var h = _rhEmpOptions('SORTI1');
    var lettre = String(printDemandeLettre).indexOf('72 heures') !== -1 && String(printDemandeLettre).indexOf('rhAddDays(d.date, 3)') !== -1;
    var simple = String(supprimerSanction).indexOf('window.confirm') === -1 && String(supprimerDemande).indexOf('window.confirm') === -1;
    (h.indexOf('value="SORTI1" selected') !== -1 && h.indexOf('(sorti)') !== -1 && lettre && simple) ? 'OK : employe sorti conserve ; lettre : delai de 72 h ; une seule confirmation a la suppression'
      : 'ECHEC : ' + JSON.stringify({ opt: h.slice(0, 120), lettre: lettre, simple: simple })`);

  cas('Ordres de mission : numerotation qui suit (plus de doublon OM-AAAA-001)', `
    var y = new Date().getFullYear();
    setMissions([{ id: 'm1', numero: 'OM-' + y + '-001' }, { id: 'm2', numero: 'OM-' + y + '-007' }, { id: 'm3', numero: 'OM-2020-050' }]);
    var n = nextMissionNum();
    (n === 'OM-' + y + '-008') ? 'OK : apres 001 et 007 -> ' + n : 'ECHEC : ' + n`);

  cas('Banque : un acompte verse par la banque est bien cree (avant : erreur) et part avec l operation supprimee', `
    DB.set('mdb_banques', [{ id: 'BQ1', nom: 'SGBCI' }]);
    var L = getEmployes(); L.push({ id: 'EB1', matricule: 'B1', nom: 'KOFFI' }); DB.set('mdb_employes', L);
    function ch(id, v) { document.getElementById(id).value = v; }
    ch('bkEnrBanqueId', 'BQ1'); ch('bkEnrSens', 'sortie'); ch('bkEnrMontant', '50000'); ch('bkEnrLibelle', 'Acompte KOFFI');
    ch('bkEnrDate', '2026-10-15'); ch('bkEnrRef', 'VIR-1'); ch('bkEnrType', 'acompte'); ch('bkEnrEmploye', 'EB1'); ch('bkEnrDuree', '0'); ch('bkEnrMoisDed', '2026-10');
    saveBanqueOperation();
    var op = getBanqueOperations().filter(function (o) { return o.reference === 'VIR-1'; })[0];
    var ap = dbArr('mdb_acomptesPrets').filter(function (a) { return op && a.banqueOpId === op.id; })[0];
    var cree = !!(op && ap && ap.montant === 50000 && ap.moisDeduction === '2026-10' && ap.employeId === 'EB1');
    var _oc = openConfirm; openConfirm = function (t, cb) { cb(); };
    deleteBanqueOperation(op.id);
    openConfirm = _oc;
    var reste = dbArr('mdb_acomptesPrets').filter(function (a) { return a.banqueOpId === op.id; }).length;
    var opReste = getBanqueOperations().filter(function (o) { return o.id === op.id; }).length;
    DB.set('mdb_banqueOperations', [{ id: 'X', banqueId: 'BQ1', montant: 1, sens: 'entree', date: '2026-10-01' }]);
    deleteBanque('BQ1');
    var bqGarde = getBanques().length === 1;
    (cree && reste === 0 && opReste === 0 && bqGarde) ? 'OK : acompte 50 000 cree (mois 2026-10), supprime avec l operation ; banque avec operations non supprimable'
      : 'ECHEC : ' + JSON.stringify({ cree: cree, ap: ap, reste: reste, opReste: opReste, bqGarde: bqGarde })`);

  cas('Acomptes : plus jamais effaces automatiquement quand une piece de caisse manque un instant ; lien repare', `
    DB.set('mdb_operationsCaisse', [
      { id: 'OP1', date: '2026-10-01', sens: 'sortie', montant: 20000, apType: 'acompte', beneficiaireId: 'E1', numeroPiece: 'KK1' },
      { id: 'OP2', date: '2026-10-02', sens: 'sortie', montant: 30000, apType: 'acompte', beneficiaireId: 'E1', numeroPiece: 'KK2', acomptePretId: 'A2' }
    ]);
    DB.set('mdb_acomptesPrets', [
      { id: 'A1', type: 'acompte', employeId: 'E1', montant: 20000, caisseOpId: 'OP1', numeroPiece: 'KK1', valide: true },
      { id: 'A2', type: 'acompte', employeId: 'E1', montant: 30000, caisseOpId: 'OP2', numeroPiece: 'KK2', valide: true },
      { id: 'A3', type: 'acompte', employeId: 'E1', montant: 40000, caisseOpId: 'OP_PAS_ENCORE_LA', numeroPiece: 'KK3', valide: true }
    ]);
    _purgeOrphanAcomptes();
    var n1 = dbArr('mdb_acomptesPrets').length;
    _cleanGhostAcomptes();
    var n2 = dbArr('mdb_acomptesPrets').length;
    var op1 = getOperationsCaisse().filter(function (o) { return o.id === 'OP1'; })[0];
    var lien = op1 && op1.acomptePretId === 'A1';
    var t = getTombstones(); t.mdb_acomptesPrets = { A1: Date.now(), A3: Date.now() }; localStorage.setItem('mdb_tombstones', JSON.stringify(t));
    var vus = stripTombstoned('mdb_acomptesPrets', [{ id: 'A1', caisseOpId: 'OP1' }, { id: 'A3', caisseOpId: 'OP_PAS_ENCORE_LA' }]).map(function (x) { return x.id; }).join(',');
    (n1 === 3 && n2 === 3 && lien && vus === 'A1') ? 'OK : 3 acomptes gardes (piece manquante = plus d effacement) ; lien OP1 -> A1 repare ; acompte supprime a tort mais dont la piece existe : visible'
      : 'ECHEC : ' + JSON.stringify({ n1: n1, n2: n2, lien: lien, vus: vus })`);

}

module.exports = { run: run };
