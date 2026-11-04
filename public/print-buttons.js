/* Boutons d'impression / export : icône seule, discrète, partout.
   - « Imprimer » → icône imprimante bleue.
   - « PDF » → petit logo PDF rouge, visible et simple.
   - Ne doit jamais rester le mot « Imprimer », « Impression » ou « PDF ». */
(function () {
  var VERSION = '6';
  var CSS =
    ".mdb-print-btn{background:#eef4fb!important;border:1px solid #cbd5e1!important;color:#0b3a6f!important;font-weight:900!important;font-size:0!important;line-height:0!important;letter-spacing:0!important;box-shadow:0 1px 3px rgba(15,23,42,.08)!important;overflow:hidden!important}" +
    ".mdb-print-btn:hover{background:#e0ecf8!important;border-color:#93c5fd!important;color:#0b3a6f!important}" +
    ".mdb-print-btn::before,.mdb-print-btn::after{content:none!important;display:none!important}" +
    ".mdb-print-btn *{font-size:0!important;line-height:0!important;letter-spacing:0!important}" +
    ".mdb-print-btn svg{stroke:#0b3a6f!important;color:#0b3a6f!important;width:18px!important;height:18px!important;flex:0 0 auto;font-size:initial!important;line-height:normal!important}" +
    ".mdb-print-btn .mdb-print-ico{width:18px;height:18px;display:inline-block;vertical-align:middle;margin:0!important;font-size:initial!important;line-height:normal!important}" +
    ".mdb-print-btn .mdb-pdf-ico{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:#dc2626!important;color:#fff!important;font-family:Arial,Helvetica,sans-serif!important;font-size:9px!important;line-height:1!important;font-weight:900!important;letter-spacing:.03em!important;border-radius:5px!important;padding:4px 4px!important;min-width:24px!important;height:22px!important}" +
    ".mdb-print-btn.mdb-print-icon-only{padding:0!important;width:38px!important;height:38px!important;min-width:38px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:8px!important}" +
    ".mdb-print-btn.mdb-print-icon-only .mdb-print-ico{margin:0!important;width:18px!important;height:18px!important}" +
    ".mdb-print-btn:disabled{opacity:.55;cursor:not-allowed}";

  var ICON =
    '<svg class="mdb-print-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
    '<rect x="6" y="14" width="12" height="8"></rect></svg>';
  var PDF_ICON = '<span class="mdb-pdf-ico" aria-hidden="true">PDF</span>';

  function injectCss() {
    if (document.getElementById('mdb-print-css')) return;
    var s = document.createElement('style');
    s.id = 'mdb-print-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function texteDe(el) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!t) {
      t = String(el.getAttribute('title') || el.getAttribute('aria-label') || el.value || '').trim();
    }
    return t;
  }

  function estBoutonImpression(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-mdb-print-skip') === '1') return false;
    var tag = el.tagName;
    if (tag === 'INPUT') {
      var type = String(el.getAttribute('type') || '').toLowerCase();
      if (type !== 'button' && type !== 'submit') return false;
    } else if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'SUMMARY' && !el.classList.contains('btn')) {
      return false;
    }
    var txt = texteDe(el);
    if (!/(imprim|impression|pdf)/i.test(txt)) return false;
    /* Un bouton déjà parfaitement icône seule n'a pas besoin d'être retouché. */
    if (el.getAttribute('data-mdb-print-v') === VERSION && el.querySelector('svg.mdb-print-ico') && !(el.textContent || '').trim()) return false;
    return true;
  }

  function scanEl(el) {
    if (!estBoutonImpression(el)) return;
    var txt = texteDe(el);
    el.classList.add('mdb-print-btn', 'mdb-print-icon-only');
    el.setAttribute('data-mdb-print', '1');
    el.setAttribute('data-mdb-print-v', VERSION);
    if (!el.getAttribute('title')) el.setAttribute('title', txt || 'Imprimer');
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', txt || 'Imprimer');
    /* Remplacement TOTAL : icône imprimante, ou logo PDF si le bouton parle de PDF. */
    el.innerHTML = /\bpdf\b/i.test(txt) ? PDF_ICON : ICON;
  }

  function scan(root) {
    try {
      if (!root) return;
      if (root.nodeType === 1) scanEl(root);
      var list = root.querySelectorAll ? root.querySelectorAll('button,a,.btn,input[type="button"],input[type="submit"],summary') : [];
      for (var i = 0; i < list.length; i++) scanEl(list[i]);
    } catch (e) {}
  }

  function scanAll() { scan(document.body); }
  window.mdbPrintButtonsScan = scanAll;

  function boot() {
    injectCss();
    scanAll();
    setTimeout(scanAll, 250);
    setTimeout(scanAll, 1200);
    setTimeout(scanAll, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  try { window.addEventListener('load', boot); } catch (e) {}
  try { window.addEventListener('pageshow', boot); } catch (e2) {}

  var timer = null;
  try {
    var obs = new MutationObserver(function (muts) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) scan(added[j]);
        }
      }, 100);
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
  } catch (e) {}

  /* Filet de sécurité : les barres d'outils recréées après un rendu différé
     (caisse, listes, modales) sont rebalayées régulièrement. */
  try { setInterval(scanAll, 1500); } catch (e3) {}
  try {
    document.addEventListener('click', function () { setTimeout(scanAll, 60); }, true);
    document.addEventListener('focusin', function () { setTimeout(scanAll, 60); }, true);
  } catch (e4) {}
})();
