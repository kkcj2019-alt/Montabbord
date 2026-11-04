/* ============================================================================
   VÉRIFICATION QR — registre générique Montabbord
   Chaque document imprimé (pièce de caisse, BL, BC, pro-forma, production…)
   reçoit un jeton stable et une URL de contrôle vers /verif.html.
   Le registre local est la clé « mdb_qr_verifs » (synchronisée au cloud).
   Le QR seul n'est PAS une authentification forte : il prouve seulement
   qu'un document portant ce jeton a bien été enregistré par l'entreprise.
   ============================================================================ */
(function () {
  'use strict';
  var KEY = 'mdb_qr_verifs';
  var MAX = 800;

  function uid() {
    try {
      var u = (typeof currentUser !== 'undefined' && currentUser && currentUser.id) ? currentUser.id : '';
      if (!u) u = localStorage.getItem('mdb_enterpriseUid') || '';
      if (!u) {
        var raw = localStorage.getItem('mdb_currentUser') || '';
        if (raw) {
          try {
            var p = JSON.parse(raw);
            u = (typeof p === 'string') ? p : ((p && p.id) || '');
          } catch (e) { u = raw; }
        }
      }
      return String(u || '').replace(/^["']+|["']+$/g, '').trim();
    } catch (e) { return ''; }
  }

  function lecture() {
    try {
      var raw = localStorage.getItem(KEY);
      var a = raw ? JSON.parse(raw) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }

  function ecriture(arr) {
    if (arr.length > MAX) arr = arr.slice(arr.length - MAX);
    try {
      if (typeof DB !== 'undefined' && DB && typeof DB.set === 'function') {
        DB.set(KEY, arr);
        return;
      }
    } catch (e1) {}
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e2) {}
    try { if (typeof prodPartageModifie === 'function') prodPartageModifie(KEY); } catch (e3) {}
  }

  function hash(s) {
    var h = 0x811c9dc5;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h >>> 0) * 16777619 >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8).toUpperCase();
  }

  function enc(s) { return encodeURIComponent(String(s == null ? '' : s)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tokenPour(type, ref) {
    var t = String(type || 'doc').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'DOC';
    return (t + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).toUpperCase();
  }

  /* Crée (ou met à jour) la fiche de vérification et renvoie { token, url }.
     type  : caisse | bl | bc | proforma | facture | production | of | qualite
     ref   : numéro du document
     data  : { date, tiers, montant, libelle, meta } */
  window.qrVerifCreer = function (type, ref, data) {
    try {
      type = String(type || 'doc').toLowerCase();
      ref = String(ref || '');
      data = data || {};
      var u = uid();
      var key = type + '|' + ref;
      var arr = lecture();
      var idx = -1;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] && arr[i].key === key) { idx = i; break; }
      }
      var token = (idx >= 0 && arr[idx].token) ? arr[idx].token : tokenPour(type, ref);
      var base = [u, type, ref, data.montant != null ? data.montant : '', data.date || '', token].join('|');
      var h = hash(base);
      if (idx >= 0 && arr[idx].hash === h && arr[idx].token === token) {
        return { token: token, url: arr[idx].url || '' };
      }
      var url = location.origin + '/verif.html?uid=' + enc(u) + '&token=' + enc(token);
      var rec = {
        id: key, key: key, token: token, uid: u, type: type, ref: ref,
        date: data.date || '', tiers: data.tiers || '',
        montant: data.montant != null ? data.montant : 0,
        libelle: data.libelle || '', meta: data.meta || null,
        hash: h, url: url,
        dateCreation: (idx >= 0 && arr[idx].dateCreation) ? arr[idx].dateCreation : new Date().toISOString(),
        dateMaj: new Date().toISOString()
      };
      if (idx >= 0) arr[idx] = rec; else arr.push(rec);
      ecriture(arr);
      return { token: token, url: url };
    } catch (e) { return { token: '', url: '' }; }
  };

  window.qrVerifImage = function (url, size) {
    size = size || 60;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + enc(url);
  };

  /* Bloc HTML prêt à insérer dans un document imprimé. */
  window.qrVerifBloc = function (type, ref, data, opts) {
    opts = opts || {};
    var r = window.qrVerifCreer(type, ref, data);
    if (!r.url) return '';
    var size = opts.size || 56;
    var label = opts.label || 'Vérification';
    var texte = opts.texte || 'Scannez pour contrôler l\u2019authenticité de ce document.';
    var align = opts.align || 'left';
    var bg = opts.bg || '#ffffff';
    var border = opts.border || '#dbe3ef';
    return '<div class="mdb-qr-verif" style="display:flex;align-items:center;gap:' + (opts.gap || 7) + 'px;'
      + 'justify-content:' + (align === 'right' ? 'flex-end' : 'flex-start') + ';'
      + 'margin-top:' + (opts.marginTop != null ? opts.marginTop : 7) + 'px;'
      + 'padding:5px 8px;border:1px solid ' + border + ';border-radius:6px;background:' + bg + ';'
      + 'page-break-inside:avoid;break-inside:avoid">'
      + '<img src="' + window.qrVerifImage(r.url, size) + '" width="' + size + '" height="' + size + '" alt="QR vérification" style="display:block;width:' + size + 'px;height:' + size + 'px">'
      + '<div style="font-size:7px;line-height:1.3;color:#475569">'
      + '<div style="font-size:8px;font-weight:800;color:#0b3a6f;letter-spacing:.04em;text-transform:uppercase">' + esc(label) + '</div>'
      + '<div>' + esc(texte) + '</div>'
      + '<div style="font-family:monospace;font-size:6.5px;color:#64748b;margin-top:2px">' + esc(r.token) + '</div>'
      + '</div></div>';
  };
})();
