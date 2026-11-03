/* Boutons « Imprimer » : icône imprimante + rouge bien visible, partout.
   S'applique aussi aux boutons créés plus tard (modales, listes, tableaux). */
(function () {
  var CSS =
    ".mdb-print-btn{background:#dc2626!important;border-color:#dc2626!important;color:#fff!important;font-weight:900!important;font-size:0!important;letter-spacing:0!important;box-shadow:0 3px 10px rgba(220,38,38,.30)!important}" +
    ".mdb-print-btn:hover{background:#b91c1c!important;border-color:#b91c1c!important;color:#fff!important}" +
    ".mdb-print-btn svg{stroke:#fff!important;color:#fff!important;width:18px!important;height:18px!important;flex:0 0 auto}" +
    ".mdb-print-btn .mdb-print-ico{width:18px;height:18px;display:inline-block;vertical-align:middle;margin:0!important}" +
    ".mdb-print-btn.mdb-print-icon-only{padding:0!important;width:38px!important;height:38px!important;min-width:38px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:8px!important}" +
    ".mdb-print-btn.mdb-print-icon-only .mdb-print-ico{margin:0!important;width:18px!important;height:18px!important}" +
    ".mdb-print-btn:disabled{opacity:.55;cursor:not-allowed}";

  var ICON =
    '<svg class="mdb-print-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="6 9 6 2 18 2 18 9"></polyline>' +
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>' +
    '<rect x="6" y="14" width="12" height="8"></rect></svg>';

  function injectCss() {
    if (document.getElementById("mdb-print-css")) return;
    var s = document.createElement("style");
    s.id = "mdb-print-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function scanEl(el) {
    if (!el || el.nodeType !== 1 || el.hasAttribute("data-mdb-print")) return;
    var tag = el.tagName;
    if (tag !== "BUTTON" && tag !== "A" && !el.classList.contains("btn")) return;
    var txt = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!/(imprim|impression|pdf)/i.test(txt)) return;
    el.setAttribute("data-mdb-print", "1");
    el.classList.add("mdb-print-btn", "mdb-print-icon-only");
    if (!el.getAttribute("title")) el.setAttribute("title", txt);
    if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", txt);
    el.innerHTML = ICON;
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 1) scanEl(root);
    var list = root.querySelectorAll ? root.querySelectorAll("button,a,.btn") : [];
    for (var i = 0; i < list.length; i++) scanEl(list[i]);
  }

  function boot() {
    injectCss();
    scan(document.body);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  var timer = null;
  try {
    var obs = new MutationObserver(function (muts) {
      clearTimeout(timer);
      timer = setTimeout(function () {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes || [];
          for (var j = 0; j < added.length; j++) scan(added[j]);
        }
      }, 120);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  } catch (e) {}
})();
