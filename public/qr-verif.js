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
    size = size || 110;
    var px = Math.max(240, Math.round(size * 3));
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + px + 'x' + px + '&data=' + enc(url);
  };

  /* Affiche un grand QR (scannable depuis un téléphone) + le lien cliquable. */
  window.mdbQrAfficher = function (url, title) {
    try {
      var old = document.getElementById('mdbQrOverlay');
      if (old) old.remove();
      var safe = esc(url);
      var ov = document.createElement('div');
      ov.id = 'mdbQrOverlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.62);z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px';
      ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
      ov.innerHTML = '<div style="background:#fff;border-radius:16px;padding:18px;max-width:380px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)">'
        + '<div style="font-weight:900;color:#0b3a6f;margin-bottom:8px;font-size:15px">' + esc(title || 'QR de vérification') + '</div>'
        + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' + enc(url) + '" alt="QR" style="width:290px;height:290px;max-width:100%;display:block;margin:0 auto;border:1px solid #e2e8f0;border-radius:10px;background:#fff">'
        + '<div style="font-size:10.5px;color:#475569;word-break:break-all;margin-top:8px;line-height:1.4">' + safe + '</div>'
        + '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap">'
        + '<a href="' + safe + '" target="_blank" rel="noopener" style="background:#0b3a6f;color:#fff;border-radius:8px;padding:9px 14px;text-decoration:none;font-weight:800;font-size:12px">Ouvrir le lien</a>'
        + '<button type="button" onclick="document.getElementById(\'mdbQrOverlay\').remove()" style="border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:9px 14px;font-weight:800;font-size:12px;cursor:pointer">Fermer</button>'
        + '</div></div>';
      document.body.appendChild(ov);
    } catch (e) {}
  };

  /* Bloc HTML prêt à insérer dans un document imprimé. */
  window.qrVerifBloc = function (type, ref, data, opts) {
    opts = opts || {};
    var r = window.qrVerifCreer(type, ref, data);
    if (!r.url) return '';
    var size = opts.size || 110;
    var label = opts.label || 'Vérification';
    var texte = opts.texte || 'Scannez pour contrôler l\u2019authenticité de ce document.';
    var align = opts.align || 'left';
    var bg = opts.bg || '#ffffff';
    var border = opts.border || '#dbe3ef';
    var safeUrl = esc(r.url);
    var img = '<img src="' + window.qrVerifImage(r.url, size) + '" width="' + size + '" height="' + size + '" alt="QR de vérification" title="Cliquer pour agrandir / vérifier" data-mdb-qr-url="' + safeUrl + '" onclick="try{mdbQrAfficher(this.getAttribute(\'data-mdb-qr-url\'),\'Vérification du document\')}catch(e){window.open(this.getAttribute(\'data-mdb-qr-url\'),\'_blank\')}" onerror="this.style.display=\'none\';var f=this.parentNode.querySelector(\'.mdb-qr-fallback\');if(f)f.style.display=\'inline-flex\'" style="display:block;width:' + size + 'px;height:' + size + 'px;cursor:pointer;border-radius:4px">';
    var fallback = '<a class="mdb-qr-fallback" href="' + safeUrl + '" target="_blank" title="Ouvrir la vérification" style="display:none;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;border:1px dashed #93c5fd;border-radius:6px;color:#0b3a6f;font-size:8px;font-weight:800;text-align:center;text-decoration:none;line-height:1.2">Vérifier<br>le document</a>';
    return '<div class="mdb-qr-verif" style="display:flex;align-items:center;gap:' + (opts.gap || 7) + 'px;'
      + 'justify-content:' + (align === 'right' ? 'flex-end' : 'flex-start') + ';'
      + 'margin-top:' + (opts.marginTop != null ? opts.marginTop : 7) + 'px;'
      + 'padding:5px 8px;border:1px solid ' + border + ';border-radius:6px;background:' + bg + ';'
      + 'page-break-inside:avoid;break-inside:avoid">'
      + img + fallback
      + '<div style="font-size:7px;line-height:1.3;color:#475569">'
      + '<div style="font-size:8px;font-weight:800;color:#0b3a6f;letter-spacing:.04em;text-transform:uppercase">' + esc(label) + '</div>'
      + '<div>' + esc(texte) + '</div>'
      + '<div style="font-family:monospace;font-size:6.5px;color:#64748b;margin-top:2px">' + esc(r.token) + '</div>'
      + '<div style="margin-top:2px"><a href="' + safeUrl + '" target="_blank" rel="noopener" style="font-size:7px;color:#0b3a6f;font-weight:800;text-decoration:underline">Ouvrir le lien</a></div>'
      + '</div></div>';
  };
})();
