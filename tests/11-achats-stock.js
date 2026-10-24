'use strict';
/* =====================================================================
   tests/11-achats-stock.js
   Achat -> stock : creation, MODIFICATION et SUPPRESSION doivent laisser la
   fiche de stock exactement coherente, pour toutes les categories.
   On passe par les VRAIES fonctions de l'ecran (saveAchatByCategory,
   deleteAchat) dans le bac a sable, pas par des tableaux poses a la main.
   ===================================================================== */
const vm = require('vm');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');

const PRELUDE = `
  window.confirm2 = function () { return true; };
  confirm2 = window.confirm2;
  function _champ(id, v) { document.getElementById(id).value = v; }
  function _achat(cat, ref, items, editId) {
    _champ('ach_ref', ref); _champ('ach_date', '2026-10-20'); _champ('ach_fournisseur', 'FOUR');
    _champ('ach_receiver', ''); _champ('ach_acheteur', '');
    window._editingAchatId = editId || null;
    _tempAchatItems = items.map(function (x) { return Object.assign({}, x); });
    saveAchatByCategory({ preventDefault: function () {} }, cat);
    return getAchats()[0];
  }
  function _total(arr, code) {
    var t = 0;
    (arr || []).forEach(function (l) { if (String(l.code || l.colis_number || '').toUpperCase() === code) t += parseFloat(l.quantite) || 0; });
    return t;
  }
`;

function run(rapport) {
  rapport.section('11. Achats -> stock : creation, modification, suppression');

  function cas(nom, code) {
    let h;
    try { h = chargerApp('production.html', storeRealiste()); }
    catch (e) { rapport.ko(nom + ' : chargement impossible (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(PRELUDE + code, h.ctx, { timeout: 30000 })).trim(); }
    catch (e) { rapport.ko(nom + ' : exception ' + (e && e.message ? e.message : e)); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res);
    else rapport.ko(nom + '  ->  ' + res);
  }

  ['semi', 'finished', 'merchandises'].forEach(function (cat) {
    const get = cat === 'semi' ? 'getStockSemi' : (cat === 'finished' ? 'getStockFinished' : 'getStockMerch');
    cas('Achat ' + cat + ' : modifier la quantite met a jour le stock, supprimer le remet comme avant', `
      var avant = _total(${get}(), 'ZX1');
      var a = _achat('${cat}', 'BL-T1', [{ code: 'ZX1', designation: 'ART ZX1', quantity: 10, unit_price: 100, total_price: 1000 }]);
      var apresCreation = _total(${get}(), 'ZX1');
      _achat('${cat}', 'BL-T1', [{ code: 'ZX1', designation: 'ART ZX1', quantity: 4, unit_price: 100, total_price: 400 }], a.id);
      var apresModif = _total(${get}(), 'ZX1');
      _achat('${cat}', 'BL-T1', [{ code: 'ZX1', designation: 'ART ZX1', quantity: 15, unit_price: 100, total_price: 1500 }], a.id);
      var apresModif2 = _total(${get}(), 'ZX1');
      deleteAchat(a.id);
      var apresSuppr = _total(${get}(), 'ZX1');
      (apresCreation === avant + 10 && apresModif === avant + 4 && apresModif2 === avant + 15 && apresSuppr === avant)
        ? 'OK : ' + avant + ' -> +10 -> 4 -> 15 -> supprime = ' + apresSuppr
        : 'ECHEC : avant=' + avant + ' creation=' + apresCreation + ' modif=' + apresModif + ' modif2=' + apresModif2 + ' suppr=' + apresSuppr`);
  });

  cas('Achat EPI : modification puis suppression remettent le stock EPI', `
    var a = _achat('epi', 'BL-EPI', [{ code: 'GANT9', designation: 'GANTS T9', quantity: 10, unit_price: 500, total_price: 5000 }]);
    function st() { var e = getEpiCatalogue().find(function (x) { return x.code === 'GANT9'; }); return e ? parseFloat(e.stock) || 0 : 0; }
    var c = st();
    _achat('epi', 'BL-EPI', [{ code: 'GANT9', designation: 'GANTS T9', quantity: 4, unit_price: 500, total_price: 2000 }], a.id);
    var m = st();
    var lignesAchat = (getEpiPurchases().find(function (p) { return String(p.achat_id) === String(a.id); }) || {}).lignes || [];
    deleteAchat(a.id);
    var s = st();
    var resteAchat = getEpiPurchases().filter(function (p) { return String(p.achat_id) === String(a.id); }).length;
    (c === 10 && m === 4 && s === 0 && resteAchat === 0 && lignesAchat.length === 1 && lignesAchat[0].quantite === 4)
      ? 'OK : 10 -> 4 -> 0, historique EPI mis a jour puis retire'
      : 'ECHEC : creation=' + c + ' modif=' + m + ' suppr=' + s + ' achatsRestants=' + resteAchat + ' lignes=' + JSON.stringify(lignesAchat)`);

  cas('Ancien stock sans etiquette : la suppression retire la quantite sur plusieurs lignes du meme code', `
    setStockSemi([
      { id: 's1', code: 'OLD1', designation: 'X', quantite: 30 },
      { id: 's2', code: 'OLD1', designation: 'X', quantite: 80 },
      { id: 's3', code: 'AUTRE', designation: 'Y', quantite: 5 }
    ]);
    var achats = getAchats();
    achats.unshift({ id: 777, category: 'semi', reference: 'BL-OLD', date: '2026-09-01', fournisseur: 'F', items: [{ code: 'OLD1', designation: 'X', quantity: 100 }], montant_total: 0 });
    setAchats(achats);
    deleteAchat(777);
    var t = _total(getStockSemi(), 'OLD1'), autre = _total(getStockSemi(), 'AUTRE');
    (t === 10 && autre === 5) ? 'OK : 110 - 100 = 10 (reparti sur 2 lignes), autre code intact'
      : 'ECHEC : OLD1=' + t + ' (attendu 10, avant la correction 30 restait) AUTRE=' + autre`);

  cas("Deux achats SANS reference : supprimer l'un ne touche pas aux mouvements de l'autre", `
    var a1 = _achat('finished', '', [{ code: 'PF77', designation: 'PF 77', quantity: 5, unit_price: 1, total_price: 5 }]);
    var a2 = _achat('finished', '', [{ code: 'PF88', designation: 'PF 88', quantity: 7, unit_price: 1, total_price: 7 }]);
    var mAvant = getMovements().filter(function (m) { return String(m.achat_id) === String(a2.id); }).length;
    deleteAchat(a1.id);
    var mApres = getMovements().filter(function (m) { return String(m.achat_id) === String(a2.id); }).length;
    var reste1 = getMovements().filter(function (m) { return String(m.achat_id) === String(a1.id); }).length;
    (mAvant === 1 && mApres === 1 && reste1 === 0 && _total(getStockFinished(), 'PF88') >= 7)
      ? 'OK : mouvements de l\\'achat 2 conserves, ceux de l\\'achat 1 retires'
      : 'ECHEC : avant=' + mAvant + ' apres=' + mApres + ' reste1=' + reste1`);

  cas('Consommables : deux achats du meme code sans fournisseur, supprimer le premier garde le second', `
    var base = _total(getStockConsum(), 'CLOU9');
    document.getElementById('ach_fournisseur').value = '';
    _champ('ach_ref', 'BL-C1'); _champ('ach_date', '2026-10-20'); _champ('ach_fournisseur', '');
    window._editingAchatId = null;
    _tempAchatItems = [{ code: 'CLOU9', designation: 'CLOU 9', quantity: 100, paquets: 100, cond: 1, ctype: 'DIVERS', unit_price: 1, total_price: 100 }];
    saveAchatByCategory({ preventDefault: function () {} }, 'consumables');
    var a1 = getAchats()[0];
    _champ('ach_ref', 'BL-C2');
    _tempAchatItems = [{ code: 'CLOU9', designation: 'CLOU 9', quantity: 50, paquets: 50, cond: 1, ctype: 'DIVERS', unit_price: 1, total_price: 50 }];
    saveAchatByCategory({ preventDefault: function () {} }, 'consumables');
    var apres2 = _total(getStockConsum(), 'CLOU9');
    deleteAchat(a1.id);
    var fin = _total(getStockConsum(), 'CLOU9');
    (apres2 === base + 150 && fin === base + 50)
      ? 'OK : ' + base + ' +100 +50 = ' + apres2 + ', suppression du 1er -> ' + fin
      : 'ECHEC : base=' + base + ' apres2=' + apres2 + ' fin=' + fin`);
}

module.exports = { run: run };
