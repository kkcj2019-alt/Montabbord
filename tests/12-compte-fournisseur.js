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
}

module.exports = { run: run };
