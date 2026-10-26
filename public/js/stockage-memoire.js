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

  /* ---- COMPRESSION (stockage plein) ----
     Les donnees completes depassent la place offerte par le navigateur
     (~5 millions de caracteres). Quand une ecriture echoue faute de place, on
     COMPRESSE les plus grosses rubriques (4,8 M -> ~1,1 M caracteres sur les
     donnees reelles), puis on reessaie. La lecture decompresse toute seule :
     les pages ne voient aucune difference. */
/* Compression LZ (algorithme lz-string, MIT, P. Monterrubio) — version UTF16 */
  var MdbLZ = (function () {
    var f = String.fromCharCode;
    function compressToUTF16(input) {
      if (input == null) return "";
      return _compress(input, 15, function (a) { return f(a + 32); }) + " ";
    }
    function decompressFromUTF16(c) {
      if (c == null) return "";
      if (c == "") return null;
      return _decompress(c.length, 16384, function (i) { return c.charCodeAt(i) - 32; });
    }
    function _compress(u, bits, gc) {
      if (u == null) return "";
      var i, value, dict = {}, toCreate = {}, c = "", wc = "", w = "", enlargeIn = 2, dictSize = 3, numBits = 2, data = [], val = 0, pos = 0, ii;
      function put(v, n) {
        for (var k = 0; k < n; k++) {
          val = (val << 1) | (v & 1);
          if (pos == bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++;
          v = v >> 1;
        }
      }
      function putBits(n) { for (var k = 0; k < n; k++) { val = (val << 1); if (pos == bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; } }
      function emitW() {
        if (Object.prototype.hasOwnProperty.call(toCreate, w)) {
          if (w.charCodeAt(0) < 256) { putBits(numBits); put(w.charCodeAt(0), 8); }
          else {
            value = 1;
            for (var k = 0; k < numBits; k++) { val = (val << 1) | value; if (pos == bits - 1) { pos = 0; data.push(gc(val)); val = 0; } else pos++; value = 0; }
            put(w.charCodeAt(0), 16);
          }
          enlargeIn--; if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
          delete toCreate[w];
        } else {
          put(dict[w], numBits);
        }
        enlargeIn--; if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      }
      for (ii = 0; ii < u.length; ii += 1) {
        c = u.charAt(ii);
        if (!Object.prototype.hasOwnProperty.call(dict, c)) { dict[c] = dictSize++; toCreate[c] = true; }
        wc = w + c;
        if (Object.prototype.hasOwnProperty.call(dict, wc)) w = wc;
        else { emitW(); dict[wc] = dictSize++; w = String(c); }
      }
      if (w !== "") emitW();
      put(2, numBits);
      while (true) { val = (val << 1); if (pos == bits - 1) { data.push(gc(val)); break; } else pos++; }
      return data.join("");
    }
    function _decompress(length, resetValue, getNext) {
      var dictionary = [], enlargeIn = 4, dictSize = 4, numBits = 3, entry = "", result = [], i, w, bits, resb, maxpower, power, c, data = { val: getNext(0), position: resetValue, index: 1 };
      function rd(n) {
        var b = 0, mp = Math.pow(2, n), p = 1;
        while (p != mp) {
          var rb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) { data.position = resetValue; data.val = getNext(data.index++); }
          b |= (rb > 0 ? 1 : 0) * p; p <<= 1;
        }
        return b;
      }
      for (i = 0; i < 3; i += 1) dictionary[i] = i;
      var nx = rd(2);
      switch (nx) { case 0: c = f(rd(8)); break; case 1: c = f(rd(16)); break; case 2: return ""; }
      dictionary[3] = c; w = c; result.push(c);
      while (true) {
        if (data.index > length) return "";
        c = rd(numBits);
        switch (c) {
          case 0: dictionary[dictSize++] = f(rd(8)); c = dictSize - 1; enlargeIn--; break;
          case 1: dictionary[dictSize++] = f(rd(16)); c = dictSize - 1; enlargeIn--; break;
          case 2: return result.join("");
        }
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
        if (dictionary[c]) entry = dictionary[c];
        else { if (c === dictSize) entry = w + w.charAt(0); else return null; }
        result.push(entry);
        dictionary[dictSize++] = w + entry.charAt(0);
        enlargeIn--;
        w = entry;
        if (enlargeIn == 0) { enlargeIn = Math.pow(2, numBits); numBits++; }
      }
    }
    return { compressToUTF16: compressToUTF16, decompressFromUTF16: decompressFromUTF16 };
  })();
  var MARQUE = '\u0001MDBLZ1:';
  var cacheLZ = {};
  function estCompresse(s) { return typeof s === 'string' && s.length > MARQUE.length && s.charCodeAt(0) === 1 && s.indexOf(MARQUE) === 0; }
  function lireBrut(k) {
    var raw = oGet.call(ls, k);
    if (!estCompresse(raw)) return raw;
    var c = cacheLZ[k];
    if (c && c.raw === raw) return c.val;
    var val = null;
    try { val = MdbLZ.decompressFromUTF16(raw.slice(MARQUE.length)); } catch (eD) { val = null; }
    if (val === null || val === undefined) { try { console.warn('[stockage] decompression impossible : ' + k); } catch (eW) {} return null; }
    cacheLZ[k] = { raw: raw, val: val };
    return val;
  }
  function ecrireCompresse(k, v) {
    var c = MARQUE + MdbLZ.compressToUTF16(String(v));
    oSet.call(ls, k, c);
    cacheLZ[k] = { raw: c, val: String(v) };
    etat.compresses = (etat.compresses || 0) + 1;
  }
  /* Compresse les autres grosses rubriques (les plus grosses d'abord) pour
     faire de la place. Renvoie true si au moins une a ete compressee. */
  function compresserAutres(sauf, besoin) {
    var l = [];
    try { for (var i = 0; i < ls.length; i++) { var kk = ls.key(i); if (!kk || kk === sauf) continue; var r = oGet.call(ls, kk); if (r && r.length > 150000 && !estCompresse(r)) l.push({ k: kk, n: r.length }); } } catch (e) {}
    l.sort(function (a, b) { return b.n - a.n; });
    var fait = false;
    for (var j = 0; j < l.length; j++) {
      try { ecrireCompresse(l[j].k, oGet.call(ls, l[j].k)); fait = true; } catch (eC) {}
      if (besoin && besoin()) break;
    }
    return fait;
  }
  S.setItem = function (k, v) {
    if (this !== ls) return oSet.apply(this, arguments);
    k = String(k);
    try {
      if (cacheLZ.hasOwnProperty(k)) delete cacheLZ[k];
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
        /* Compression : d'abord les AUTRES grosses rubriques, puis celle-ci */
        var self = this, ok = false;
        try {
          compresserAutres(k, function () { try { oSet.call(self, k, v); ok = true; return true; } catch (e3) { return false; } });
        } catch (eCA) {}
        if (!ok && String(v).length > 20000) { try { ecrireCompresse(k, v); ok = true; } catch (e4) {} }
        if (ok) { if (memo.hasOwnProperty(k)) delete memo[k]; etat.vuPlein = Date.now(); effacerAilleurs(k); return; }
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
      return lireBrut(k);
    }
    return oGet.apply(this, arguments);
  };
  /* aide pour les autres scripts (evenement « storage ») */
  window.mdbLireStockage = function (k) { try { return ls.getItem(k); } catch (e) { return null; } };
  window.mdbEstCompresse = estCompresse;
  S.removeItem = function (k) {
    if (this === ls && cacheLZ.hasOwnProperty(String(k))) delete cacheLZ[String(k)];
    if (this === ls && memo.hasOwnProperty(String(k))) delete memo[String(k)];
    return oRem.apply(this, arguments);
  };
  S.clear = function () {
    if (this === ls) { for (var k in memo) if (memo.hasOwnProperty(k)) delete memo[k]; }
    return oClear.apply(this, arguments);
  };
})();
