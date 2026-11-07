/* ============================================================================
   MDB-AUTH.JS — badge de connexion vérifié par le serveur.
   - garde le jeton remis par /api/auth à la connexion ;
   - l'ajoute automatiquement à toutes les demandes vers /api/sync, /api/backup,
     /api/session, /api/enterprise, /api/portail (côté administration) ;
     GET : paramètre « _tk » (pas de requête préalable du navigateur, donc pas
     de charge en plus) ; autres méthodes : en-tête Authorization ;
   - si le serveur répond « session », l'application redemande la connexion.
   À charger AVANT tout autre script qui parle au serveur.
   ============================================================================ */
(function () {
  'use strict';
  if (window.MDB_AUTH) return;
  var CLE = 'mdb_authJeton';
  var RX_API = /\/api\/(sync|backup|session|enterprise|portail|auth|recep)(\?|$|\/)/;

  function lire() {
    try { var o = JSON.parse(localStorage.getItem(CLE) || 'null'); if (o && o.token && (!o.expiresAt || o.expiresAt > Date.now())) return o; } catch (e) {}
    return null;
  }
  /* Le badge est demandé au serveur principal (montabbord.pages.dev, toujours à
     jour) ; les deux serveurs partagent la même base, le badge vaut pour les deux. */
  function racine() {
    if (/\.pages\.dev$/i.test(location.hostname) || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return location.origin;
    var r = (typeof window.__MDB_API_ROOT === 'string') ? window.__MDB_API_ROOT : '';
    return r || '';
  }

  var MDB_AUTH = {
    jeton: function () { var o = lire(); return o ? o.token : ''; },
    info: function () { return lire(); },
    enregistrer: function (uid, rep) {
      try { localStorage.setItem(CLE, JSON.stringify({ uid: uid, token: rep.token, expiresAt: rep.expiresAt || 0, user: rep.user || null, at: Date.now() })); } catch (e) {}
    },
    effacer: function () { try { localStorage.removeItem(CLE); } catch (e) {} },
    /* Connexion au serveur. Renvoie la réponse ({ok, code…}) sans jamais lever d'erreur. */
    login: function (uid, login, pass) {
      return _fetchOrig(racine() + '/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', uid: uid, login: login, pass: pass })
      }).then(function (r) { return r.json().catch(function () { return { ok: false, code: 'http' + r.status }; }); })
        .then(function (j) { if (j && j.ok && j.token) MDB_AUTH.enregistrer(uid, j); return j || { ok: false }; })
        .catch(function () { return { ok: false, code: 'reseau' }; });
    },
    /* Appel direct au service de connexion (configuration du Super Admin…). */
    appel: function (body) {
      return _fetchOrig(racine() + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
        .then(function (r) { return r.json().catch(function () { return { ok: false, code: 'http' + r.status }; }); })
        .catch(function () { return { ok: false, code: 'reseau' }; });
    },
    logout: function () {
      var t = MDB_AUTH.jeton();
      MDB_AUTH.effacer();
      if (!t) return Promise.resolve();
      return _fetchOrig(racine() + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout', token: t }) }).catch(function () {});
    },
    verifier: function () {
      var t = MDB_AUTH.jeton();
      if (!t) return Promise.resolve({ ok: false, code: 'aucun' });
      return _fetchOrig(racine() + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'check', token: t }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j && j.code === 'session') MDB_AUTH.effacer(); else if (j && j.ok && j.expiresAt) { var o = lire(); if (o) { o.expiresAt = j.expiresAt; try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {} } } return j; })
        .catch(function () { return { ok: false, code: 'reseau' }; });
    },
    /* Appelé quand le serveur refuse faute de badge valide (étape 2). */
    surRefus: function () {
      if (MDB_AUTH._refusEnCours) return;
      MDB_AUTH._refusEnCours = true;
      MDB_AUTH.effacer();
      try { if (typeof window.mdbAuthRefus === 'function') { window.mdbAuthRefus(); return; } } catch (e) {}
    }
  };
  window.MDB_AUTH = MDB_AUTH;

  /* ---- Ajout automatique du badge ---- */
  var _fetchOrig = window.fetch ? window.fetch.bind(window) : null;
  if (_fetchOrig) {
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        if (url && RX_API.test(url) && url.indexOf('/api/auth') === -1) {
          var t = MDB_AUTH.jeton();
          if (t) {
            var meth = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            if (meth === 'GET' || meth === 'HEAD') {
              if (typeof input === 'string') input = input + (input.indexOf('?') === -1 ? '?' : '&') + '_tk=' + encodeURIComponent(t);
            } else {
              init = init ? Object.assign({}, init) : {};
              var h = init.headers;
              if (h && typeof Headers !== 'undefined' && h instanceof Headers) { h = new Headers(h); h.set('Authorization', 'Bearer ' + t); }
              else { h = Object.assign({}, h || {}); h['Authorization'] = 'Bearer ' + t; }
              init.headers = h;
            }
          }
          return _fetchOrig(input, init).then(function (res) {
            try {
              if (res && res.status === 401 && url.indexOf('/api/portail') === -1) {
                res.clone().json().then(function (j) { if (j && j.code === 'auth') MDB_AUTH.surRefus(); }).catch(function () {});
              }
            } catch (eR) {}
            return res;
          });
        }
      } catch (e) {}
      return _fetchOrig(input, init);
    };
  }
  /* Utilisateur déjà connecté AVANT cette mise à jour : il n'a pas encore de
     badge. On lui demande une fois son mot de passe (petit bandeau). */
  function bandeau() {
    try {
      if (MDB_AUTH.jeton()) return;
      try { if (window.top !== window) return; } catch (eTop) { return; }
      if (document.getElementById('mdbAuthBandeau')) return;
      var cu = ''; try { cu = JSON.parse(localStorage.getItem('mdb_currentUser') || '""'); } catch (e0) { cu = localStorage.getItem('mdb_currentUser') || ''; }
      if (!cu || cu === 'SUPER-ADMIN') return;
      var ll = null; try { ll = JSON.parse(localStorage.getItem('mdb_lastLogin') || 'null'); } catch (e1) {}
      var uid = localStorage.getItem('mdb_lastLoginUid') || '';
      try { var eu = JSON.parse(localStorage.getItem('mdb_enterpriseUid') || '""'); if (eu) uid = eu; } catch (e2) {}
      if (!ll || !ll.login || !uid) return;
      var appEl = document.getElementById('app');
      if (appEl && getComputedStyle(appEl).display === 'none') return;
      var d = document.createElement('div');
      d.id = 'mdbAuthBandeau';
      d.setAttribute('role', 'dialog');
      d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;background:#0f2a44;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:min(560px,94vw);font:14px/1.4 system-ui,Segoe UI,Arial,sans-serif;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
      d.innerHTML = '<div style="flex:1 1 220px"><b>🔒 Sécurité renforcée</b><br><span style="opacity:.85;font-size:12.5px">Confirmez votre mot de passe (' + String(ll.login).replace(/[<>&"]/g, '') + ') : bientôt indispensable pour synchroniser.</span></div>'
        + '<input id="mdbAuthPw" type="password" autocomplete="current-password" placeholder="Mot de passe" style="flex:1 1 140px;padding:9px 10px;border-radius:9px;border:0;font-size:14px">'
        + '<button id="mdbAuthOk" type="button" style="padding:9px 14px;border-radius:9px;border:0;background:#f5b301;color:#1b1b1b;font-weight:800;cursor:pointer">Confirmer</button>'
        + '<button id="mdbAuthPlusTard" type="button" style="padding:9px 10px;border-radius:9px;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;cursor:pointer">Plus tard</button>'
        + '<div id="mdbAuthMsg" style="flex-basis:100%;font-size:12.5px;color:#fecaca;min-height:0"></div>';
      document.body.appendChild(d);
      var go = function () {
        var pw = document.getElementById('mdbAuthPw').value;
        if (!pw) return;
        var m = document.getElementById('mdbAuthMsg'); m.style.color = '#cbd5e1'; m.textContent = 'Vérification…';
        MDB_AUTH.login(uid, ll.login, pw).then(function (j) {
          if (j && j.ok) { d.remove(); MDB_AUTH._oblige = false; MDB_AUTH._refusEnCours = false; try { if (typeof window.mdbAuthRetabli === 'function') window.mdbAuthRetabli(); } catch (eR) {} return; }
          m.style.color = '#fecaca';
          m.textContent = (j && j.code === 'bloque') ? 'Trop d’essais : réessayez dans 15 minutes.' : (j && j.code === 'mdp') ? 'Mot de passe incorrect.' : 'Serveur injoignable, réessayez plus tard.';
        });
      };
      document.getElementById('mdbAuthOk').onclick = go;
      document.getElementById('mdbAuthPw').onkeydown = function (ev) { if (ev.key === 'Enter') go(); };
      if (MDB_AUTH._oblige) { var pt = document.getElementById('mdbAuthPlusTard'); if (pt) pt.style.display = 'none'; var tx = d.querySelector('span'); if (tx) tx.textContent = 'Votre connexion a expiré : retapez votre mot de passe pour continuer à synchroniser. Vos saisies sont gardées sur cet appareil.'; }
      document.getElementById('mdbAuthPlusTard').onclick = function () { d.remove(); MDB_AUTH._plusTard = Date.now(); };
    } catch (e) {}
  }
  MDB_AUTH.bandeau = bandeau;
  setInterval(function () { if (!MDB_AUTH._plusTard || Date.now() - MDB_AUTH._plusTard > 30 * 60 * 1000) bandeau(); }, 20000);
  setTimeout(bandeau, 6000);

  try {
    if (navigator.sendBeacon) {
      var _sb = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        try { if (RX_API.test(String(url))) { var t = MDB_AUTH.jeton(); if (t) url = String(url) + (String(url).indexOf('?') === -1 ? '?' : '&') + '_tk=' + encodeURIComponent(t); } } catch (e) {}
        return _sb(url, data);
      };
    }
  } catch (eB) {}
})();
