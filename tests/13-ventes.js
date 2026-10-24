'use strict';
/* tests/13-ventes.js — factures / reglements : le statut suit les paiements */
const vm = require('vm');
const { storeRealiste, chargerApp, UTILISATEUR } = require('./lib/sandbox.js');
function run(rapport) {
  rapport.section('13. Ventes : factures et reglements');
  function cas(nom, code) {
    let h;
    try { h = chargerApp('index.html', storeRealiste()); } catch (e) { rapport.ko(nom + ' : chargement (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(UTILISATEUR + code, h.ctx, { timeout: 30000 })).trim(); } catch (e) { rapport.ko(nom + ' : exception ' + e.message); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res); else rapport.ko(nom + '  ->  ' + res);
  }
  cas('Facture payee dont on supprime le reglement : redevient a payer', `
    var f = { id: 'FT1', totalTTC: 1000, montantPaye: 1000, statut: 'payee' };
    updateFactureFromReglement({ factureId: 'FT1', montant: 1000 }, null);
    var fs = getFactures(); fs.push(f); DB.set('mdb_factures', fs);
    updateFactureFromReglement({ factureId: 'FT1', montant: 1000 }, null);
    var g = getFactures().filter(function (x) { return x.id === 'FT1'; })[0];
    (g.montantPaye === 0 && g.statut === 'validee') ? 'OK : payee -> validee (0 paye)' : 'ECHEC : ' + JSON.stringify(g)`);
  cas("Operation bancaire d'un reglement supprimee : la facture n'est plus payee", `
    window.confirm = function () { return true; };
    openConfirm = function (m, cb) { cb(); };
    var fs = getFactures(); fs.push({ id: 'FT2', totalTTC: 500, montantPaye: 500, statut: 'payee' }); DB.set('mdb_factures', fs);
    var rg = dbArr('mdb_reglements'); rg.push({ id: 'RG2', factureId: 'FT2', montant: 500 }); DB.set('mdb_reglements', rg);
    var bo = getBanqueOperations(); bo.push({ id: 'BO2', reglementId: 'RG2', montant: 500, banqueId: 'b1' }); DB.set('mdb_banqueOperations', bo);
    deleteBanqueOperation('BO2');
    var g = getFactures().filter(function (x) { return x.id === 'FT2'; })[0];
    var regVisible = getReglements().filter(function (r) { return r.id === 'RG2' && !r._deleted; }).length;
    (g.montantPaye === 0 && g.statut === 'validee' && regVisible === 0) ? 'OK : facture a payer, reglement retire'
      : 'ECHEC : ' + JSON.stringify(g) + ' regVisible=' + regVisible`);
  cas('BL : livrer plus que le stock puis annuler revient exactement au depart', `
    DB.set('mdb_stocks', [{ id: 'S1', articleId: 'A1', articleCode: 'X1', articleNom: 'ART X1', quantite: 5 }]);
    _adjustStockForBLLines([{ articleId: 'A1', designation: 'ART X1', quantite: 10 }], -1);
    var q1 = dbArr('mdb_stocks')[0].quantite;
    _adjustStockForBLLines([{ articleId: 'A1', designation: 'ART X1', quantite: 10 }], 1);
    var q2 = dbArr('mdb_stocks')[0].quantite;
    (q1 === -5 && q2 === 5) ? 'OK : 5 -> -5 (livraison superieure) -> 5' : 'ECHEC : ' + q1 + ' / ' + q2`);
}
module.exports = { run: run };
