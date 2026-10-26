/* =====================================================================
   js/stockage-memoire.js — charge EN PREMIER dans les trois pages.

   Probleme : sur telephone, le navigateur limite le stockage local (~5 Mo).
   Quand il est plein, l'ecriture d'une rubrique (ex. mdb_acomptesPrets,
   mdb_paye) echoue : la page relisait alors l'ANCIENNE copie restee dans le
   stockage et affichait des soldes et des totaux faux (solde caisse, total
   acomptes...), et pouvait travailler sur cette copie perimee.

   Solution : quand une ecriture echoue faute de place, la valeur est gardee
   EN MEMOIRE et toute relecture renvoie cette valeur a jour. L'erreur est
   toujours remontee, pour que les pages fassent leur menage habituel
   (purge des vieilles sauvegardes locales) et reessaient.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__mdbStockageMemoire) return;
  var S;
  try { S = window.Storage && window.Storage.prototype; } catch (e) { return; }
  if (!S || !S.setItem) return;
  var ls = null;
  try { ls = window.localStorage; } catch (e0) { return; }
  var oSet = S.setItem, oGet = S.getItem, oRem = S.removeItem, oClear = S.clear;
  var memo = {};          /* cle -> derniere valeur voulue (non enregistree faute de place) */
  var etat = window.__mdbStockageMemoire = { cles: memo, plein: 0, purges: 0 };

  function estQuota(e) {
    return !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
  }
  /* Copies locales de securite : le serveur garde ses propres copies ; sur un
     appareil plein, elles prennent la place des vraies donnees. */
  function purgerCopiesLocales() {
    var n = 0;
    try {
      var cles = [];
      for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k) cles.push(k); }
      cles.forEach(function (k) {
        if (k.indexOf('mdb_backup_') === 0 || k === 'mdb_autosave' || k === 'mdb_diag_trace' || k.indexOf('mdb_snapshot_') === 0) {
          try { oRem.call(ls, k); n++; } catch (eR) {}
        }
      });
    } catch (e) {}
    etat.purges += n;
    return n;
  }

  S.setItem = function (k, v) {
    if (this !== ls) return oSet.apply(this, arguments);
    k = String(k);
    try {
      var r = oSet.call(this, k, v);
      if (memo.hasOwnProperty(k)) delete memo[k];
      /* ecriture reussie : les autres fenetres oublient leur valeur en memoire */
      if (memoAilleurs(k) !== null || (Date.now() - (etat.vuPlein || 0)) < 3600000) effacerAilleurs(k);
      return r;
    } catch (e) {
      if (!estQuota(e)) throw e;
      /* Une donnee metier ne doit jamais ceder la place a une copie de securite */
      var estCopie = k.indexOf('mdb_backup_') === 0 || k === 'mdb_autosave' || k === 'mdb_diag_trace';
      if (!estCopie && purgerCopiesLocales() > 0) {
        try { var r2 = oSet.call(this, k, v); if (memo.hasOwnProperty(k)) delete memo[k]; return r2; } catch (e2) { if (!estQuota(e2)) throw e2; }
      }
      if (!estCopie) {
        memo[k] = String(v);
        etat.plein = Date.now(); etat.vuPlein = etat.plein;
        /* IMPORTANT : on NE supprime PAS l'ancienne copie. Les autres fenetres
           (module Paye dans son cadre, onglet Exploitation) et le prochain
           rechargement la reliraient sinon VIDE, et repartiraient d'une Paie
           vierge (pointage disparu). Une copie un peu ancienne est fusionnee
           avec le cloud ; une copie absente est prise pour « rien ». */
        partager(k, memo[k]);
      }
      throw e;
    }
  };
  /* Les fenetres de la meme appli (page principale, module Paye dans son
     cadre, onglets) partagent la valeur a jour gardee en memoire. */
  function memoAilleurs(k) {
    var w = [];
    try { if (window.parent && window.parent !== window) w.push(window.parent); } catch (e1) {}
    try { if (window.top && window.top !== window && w.indexOf(window.top) === -1) w.push(window.top); } catch (e2) {}
    try { if (window.opener) w.push(window.opener); } catch (e3) {}
    for (var i = 0; i < w.length; i++) {
      try { var m = w[i].__mdbStockageMemoire; if (m && m.cles && m.cles.hasOwnProperty(k)) return m.cles[k]; } catch (e4) {}
    }
    return null;
  }
  var canal = null;
  try { if (window.BroadcastChannel) canal = new BroadcastChannel('mdb_stockage_memoire'); } catch (eC) {}
  function partager(k, v) { try { if (canal) canal.postMessage({ k: k, v: v }); } catch (e) {} }
  function effacerAilleurs(k) {
    var w = [];
    try { if (window.parent && window.parent !== window) w.push(window.parent); } catch (e1) {}
    try { if (window.top && window.top !== window) w.push(window.top); } catch (e2) {}
    try { if (window.opener) w.push(window.opener); } catch (e3) {}
    for (var i = 0; i < w.length; i++) { try { var m = w[i].__mdbStockageMemoire; if (m && m.cles && m.cles.hasOwnProperty(k)) delete m.cles[k]; } catch (e4) {} }
    partager(k, null);
  }
  if (canal) canal.onmessage = function (ev) {
    try {
      var d = ev && ev.data; if (!d || !d.k) return;
      if (d.v === null) { if (memo.hasOwnProperty(d.k)) delete memo[d.k]; return; }
      memo[d.k] = String(d.v);
      etat.vuPlein = Date.now();
    } catch (e) {}
  };
  S.getItem = function (k) {
    if (this === ls) {
      k = String(k);
      if (memo.hasOwnProperty(k)) return memo[k];
      var a = memoAilleurs(k);
      if (a !== null) return a;
    }
    return oGet.apply(this, arguments);
  };
  S.removeItem = function (k) {
    if (this === ls && memo.hasOwnProperty(String(k))) delete memo[String(k)];
    return oRem.apply(this, arguments);
  };
  S.clear = function () {
    if (this === ls) { for (var k in memo) if (memo.hasOwnProperty(k)) delete memo[k]; }
    return oClear.apply(this, arguments);
  };
})();
