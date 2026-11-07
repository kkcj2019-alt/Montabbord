/* ============================================================================
   PIN-PAD.JS — saisie des codes PIN avec un clavier à chiffres (ronds + points).
   Partout où l'on tape un code PIN / code personnel, un petit clavier s'ouvre :
   on voit combien de chiffres sont tapés (points remplis), on corrige avec ⌫,
   on valide avec ✓. Le clavier du téléphone ne cache plus le champ.
   - Champs concernés : input[inputmode=numeric] de type mot de passe, les
     champs marqués data-pinpad, et quelques champs connus (connexion employé,
     code superviseur du pointage…).
   - « ABC » : pour un code qui contient des lettres, on repasse au clavier normal.
   - Sur ordinateur, le clavier physique marche aussi (chiffres, Retour, Entrée, Échap).
   ============================================================================ */
(function () {
  'use strict';
  if (window.mdbPinPad) return;
  var IDS = ['lg-pin', 'vpPin', 'bl-pin', 'bl-newpin', 'bl-newpin2', 'rg-pin', 'pp-old', 'pp-new', 'pp-new2', 'qrpt-code1', 'qrpt-code2', 'cfgPin', 'sigPin'];
  var css = ''
    + '#mdbPinPad{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,6,23,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);font-family:Inter,"Segoe UI",system-ui,-apple-system,sans-serif;animation:mppIn .18s ease both}'
    + '@media(min-height:640px){#mdbPinPad{align-items:center}}'
    + '@keyframes mppIn{from{opacity:0}to{opacity:1}}'
    + '#mdbPinPad .mpp-box{width:100%;max-width:380px;background:linear-gradient(180deg,#1e293b,#0f172a);color:#fff;border-radius:22px 22px 0 0;padding:20px 20px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -10px 40px rgba(0,0,0,.4)}'
    + '@media(min-height:640px){#mdbPinPad .mpp-box{border-radius:22px;margin:12px}}'
    + '#mdbPinPad .mpp-t{text-align:center;font-size:16px;font-weight:800;line-height:1.3;margin:0 0 4px}'
    + '#mdbPinPad .mpp-s{text-align:center;font-size:12px;color:#94a3b8;margin:0 0 12px;min-height:15px}'
    + '#mdbPinPad .mpp-dots{display:flex;justify-content:center;gap:14px;margin:6px auto 6px;padding:12px 18px;border:1.5px solid rgba(255,255,255,.35);border-radius:14px;width:max-content;min-width:150px}'
    + '#mdbPinPad .mpp-dots i{width:13px;height:13px;border-radius:50%;border:2px solid #cbd5e1;display:block;transition:background .12s ease,transform .12s ease}'
    + '#mdbPinPad .mpp-dots i.on{background:#fff;border-color:#fff;transform:scale(1.08)}'
    + '#mdbPinPad .mpp-n{text-align:center;font-size:11.5px;color:#cbd5e1;margin-bottom:12px;min-height:14px}'
    + '#mdbPinPad .mpp-err{text-align:center;font-size:12.5px;color:#fca5a5;font-weight:700;min-height:16px;margin-bottom:6px}'
    + '#mdbPinPad .mpp-grid{display:grid;grid-template-columns:repeat(3,76px);gap:14px 22px;justify-content:center}'
    + '#mdbPinPad .mpp-k{width:76px;height:76px;border-radius:50%;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:30px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none}'
    + '#mdbPinPad .mpp-k:active{background:rgba(255,255,255,.32);transform:scale(.96)}'
    + '#mdbPinPad .mpp-k.mpp-ok{background:#16a34a;font-size:28px}'
    + '#mdbPinPad .mpp-k.mpp-ok:disabled{background:rgba(22,163,74,.35);color:rgba(255,255,255,.6)}'
    + '#mdbPinPad .mpp-k.mpp-del{background:transparent;font-size:26px}'
    + '#mdbPinPad .mpp-bas{display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:14px}'
    + '#mdbPinPad .mpp-bas button{background:none;border:none;color:#e2e8f0;font-weight:700;font-size:14px;cursor:pointer;padding:6px 4px}'
    + '#mdbPinPad .mpp-bas .mpp-annuler{color:#f87171}'
    + '#mdbPinPad .mpp-shake{animation:mppShake .35s}'
    + '@keyframes mppShake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}'
    + '@media(max-width:360px){#mdbPinPad .mpp-grid{grid-template-columns:repeat(3,66px);gap:12px 18px}#mdbPinPad .mpp-k{width:66px;height:66px;font-size:26px}}';
  function ajouterCss() {
    if (document.getElementById('mdbPinPadCss')) return;
    var st = document.createElement('style'); st.id = 'mdbPinPadCss'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  var etat = null, fermeA = 0;

  function ouvrir(o) {
    ajouterCss();
    fermer(true);
    o = o || {};
    var max = Math.max(1, Math.min(12, parseInt(o.max, 10) || 8));
    var min = Math.max(1, Math.min(max, parseInt(o.min, 10) || 4));
    etat = { code: '', max: max, min: min, o: o };
    var ov = document.createElement('div');
    ov.id = 'mdbPinPad';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    var k = function (v, cls, lab) { return '<button type="button" class="mpp-k ' + (cls || '') + '" data-k="' + v + '" aria-label="' + (lab || v) + '">' + (lab && cls !== 'mpp-del' && cls !== 'mpp-ok' ? lab : (cls === 'mpp-del' ? '⌫' : (cls === 'mpp-ok' ? '✓' : v))) + '</button>'; };
    ov.innerHTML = '<div class="mpp-box">'
      + '<div class="mpp-t"></div><div class="mpp-s"></div>'
      + '<div class="mpp-dots"></div><div class="mpp-n"></div><div class="mpp-err"></div>'
      + '<div class="mpp-grid">' + k(1) + k(2) + k(3) + k(4) + k(5) + k(6) + k(7) + k(8) + k(9) + k('del', 'mpp-del', 'Effacer') + k(0) + k('ok', 'mpp-ok', 'Valider') + '</div>'
      + '<div class="mpp-bas"><button type="button" class="mpp-abc"' + (o.lettres === false ? ' style="visibility:hidden"' : '') + '>ABC</button><button type="button" class="mpp-annuler">Annuler</button></div>'
      + '</div>';
    ov.querySelector('.mpp-t').textContent = o.titre || 'Saisissez votre code PIN';
    ov.querySelector('.mpp-s').textContent = o.sousTitre || '';
    document.body.appendChild(ov);
    etat.ov = ov;
    ov.addEventListener('click', function (ev) {
      if (ev.target === ov) { annuler(); return; }
      var b = ev.target.closest ? ev.target.closest('[data-k]') : null;
      if (b) { touche(b.getAttribute('data-k')); return; }
      if (ev.target.closest && ev.target.closest('.mpp-annuler')) { annuler(); return; }
      if (ev.target.closest && ev.target.closest('.mpp-abc')) { var f = o.onLettres; fermer(); if (f) f(); }
    });
    maj();
  }
  function maj() {
    if (!etat || !etat.ov) return;
    var n = etat.code.length, slots = Math.max(etat.min, n);
    var h = '';
    for (var i = 0; i < slots; i++) h += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    etat.ov.querySelector('.mpp-dots').innerHTML = h;
    etat.ov.querySelector('.mpp-n').textContent = n ? (n + ' chiffre' + (n > 1 ? 's' : '') + ' tapé' + (n > 1 ? 's' : '') + (etat.min === etat.max ? ' sur ' + etat.max : '')) : (etat.min === etat.max ? etat.max + ' chiffres' : etat.min + ' à ' + etat.max + ' chiffres');
    var ok = etat.ov.querySelector('.mpp-ok');
    if (ok) ok.disabled = n < etat.min;
  }
  function touche(v) {
    if (!etat) return;
    etat.ov.querySelector('.mpp-err').textContent = '';
    if (v === 'del') { etat.code = etat.code.slice(0, -1); maj(); return; }
    if (v === 'ok') { valider(); return; }
    if (!/^\d$/.test(String(v))) return;
    if (etat.code.length >= etat.max) return;
    etat.code += String(v);
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    maj();
    if (etat.o.auto && etat.code.length === etat.max) setTimeout(valider, 120);
  }
  function valider() {
    if (!etat) return;
    if (etat.code.length < etat.min) { erreur('Code trop court (' + etat.min + ' chiffres minimum).'); return; }
    var code = etat.code, f = etat.o.onValider;
    fermer();
    if (f) f(code);
  }
  function erreur(msg) {
    if (!etat || !etat.ov) return;
    etat.ov.querySelector('.mpp-err').textContent = msg || 'Code incorrect';
    var d = etat.ov.querySelector('.mpp-dots');
    d.classList.remove('mpp-shake'); void d.offsetWidth; d.classList.add('mpp-shake');
  }
  function annuler() { var f = etat && etat.o.onAnnuler; fermer(); if (f) f(); }
  function fermer(silencieux) {
    if (etat && etat.ov) { try { etat.ov.remove(); } catch (e) {} }
    if (etat) fermeA = Date.now();
    etat = null;
  }
  document.addEventListener('keydown', function (ev) {
    if (!etat) return;
    if (/^\d$/.test(ev.key)) { ev.preventDefault(); touche(ev.key); }
    else if (ev.key === 'Backspace') { ev.preventDefault(); touche('del'); }
    else if (ev.key === 'Enter') { ev.preventDefault(); valider(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); annuler(); }
  }, true);

  /* ---- Branchement automatique sur les champs de code PIN ---- */
  function estPin(el) {
    if (!el || el.tagName !== 'INPUT' || el.disabled) return false;
    if (el.getAttribute('data-pinpad') === 'non' || el.__mppLettres) return false;
    if (el.hasAttribute('data-pinpad')) return true;
    if (IDS.indexOf(el.id) !== -1) return true;
    return el.type === 'password' && String(el.getAttribute('inputmode') || '').toLowerCase() === 'numeric';
  }
  function titreDe(el) {
    if (el.getAttribute('data-pin-titre')) return el.getAttribute('data-pin-titre');
    var lab = '';
    try {
      if (el.id) { var l = document.querySelector('label[for="' + el.id + '"]'); if (l) lab = l.textContent; }
      if (!lab) { var p = el.previousElementSibling; if (p && p.tagName === 'LABEL') lab = p.textContent; }
      if (!lab && el.parentElement) { var l2 = el.parentElement.querySelector('label'); if (l2 && l2.compareDocumentPosition(el) & 4) lab = l2.textContent; }
    } catch (e) {}
    lab = String(lab || '').trim();
    if (!lab) lab = el.getAttribute('placeholder') || 'Saisissez votre code PIN';
    return lab;
  }
  function brancher(el) {
    if (el.__mpp) return;
    el.__mpp = true;
    try { el.setAttribute('readonly', 'readonly'); el.setAttribute('inputmode', 'none'); el.style.cursor = 'pointer'; el.style.caretColor = 'transparent'; } catch (e) {}
    var ouvrirPour = function () {
      if (etat || el.__mppLettres) return;
      if (Date.now() - fermeA < 500) return;
      try { el.blur(); } catch (e) {}
      var max = parseInt(el.getAttribute('maxlength'), 10);
      if (!(max > 0) || max > 12) max = 8;
      ouvrir({
        titre: titreDe(el),
        sousTitre: el.getAttribute('data-pin-sous') || '',
        min: parseInt(el.getAttribute('data-pin-min'), 10) || Math.min(4, max),
        max: max,
        onValider: function (code) {
          el.value = code;
          try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          if (el.getAttribute('data-pin-entree') !== 'non') {
            try { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true })); } catch (e2) {}
          }
        },
        onLettres: function () {
          el.__mppLettres = true;
          try { el.removeAttribute('readonly'); el.setAttribute('inputmode', 'text'); el.style.caretColor = ''; } catch (e) {}
          setTimeout(function () { try { el.focus(); } catch (e) {} }, 60);
        }
      });
    };
    el.addEventListener('focus', ouvrirPour);
    el.addEventListener('click', ouvrirPour);
    el.addEventListener('touchend', function (ev) { if (!etat) { ev.preventDefault(); ouvrirPour(); } });
  }
  function scanner(racine) {
    try {
      var list = (racine || document).querySelectorAll('input');
      for (var i = 0; i < list.length; i++) if (estPin(list[i])) brancher(list[i]);
    } catch (e) {}
  }
  function demarrer() {
    scanner(document);
    try {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var a = muts[i].addedNodes;
          for (var j = 0; j < a.length; j++) {
            var n = a[j];
            if (n.nodeType !== 1 || n.id === 'mdbPinPad') continue;
            if (n.tagName === 'INPUT') { if (estPin(n)) brancher(n); }
            else if (n.querySelector && n.querySelector('input')) scanner(n);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();

  window.mdbPinPad = { ouvrir: ouvrir, fermer: fermer, erreur: erreur, brancher: brancher };
})();
