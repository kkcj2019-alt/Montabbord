const fs = require('fs');

/* ============ public/index.html ============ */
const F = 'public/index.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function rep(fnd, rpl, lbl, all) {
  const c = s.split(fnd).length - 1;
  if (!c) { console.error('ANCRE INTROUVABLE:', lbl); process.exit(1); }
  if (!all && c > 1) { console.error('ANCRE ' + c + 'x:', lbl); process.exit(1); }
  s = s.split(fnd).join(rpl);
  n++;
  console.log('OK', lbl, '(' + c + 'x)');
}

/* ---- 1. Recherche globale -> piece de caisse filtree dans la fenetre Caisse ---- */
rep(
  "function globalGoOpCaisse(id) { closeGlobalSearch(); navigateTo('tresorerie:caisse'); setTimeout(function(){ openCaisseModal(id); }, 300); }",
  "function globalGoOpCaisse(id) {" +
  "closeGlobalSearch();" +
  "var _term = '';" +
  "try { var _opsl = getOperationsCaisse() || []; for (var _gq = 0; _gq < _opsl.length; _gq++) { if (_opsl[_gq].id === id) { _term = _opsl[_gq].numeroPiece || _opsl[_gq].libelle || ''; break; } } } catch (_ge) {}" +
  "navigateTo('tresorerie:caisse');" +
  "setTimeout(function() { var inp = document.getElementById('csSearchTop'); if (inp && _term) { inp.value = _term; if (typeof filterCaisseOps === 'function') filterCaisseOps(); } }, 350);" +
  "}",
  'recherche -> caissance filtree'
);

/* ---- 2. Sidebar bleu nuit / ecriture doree ---- */
rep(
  '#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:#ffffff;color:#1e293b;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;z-index:100;overflow:hidden;transition:width .25s ease}',
  '#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:linear-gradient(180deg,#0b1526 0%,#101f38 100%);color:#e8dcae;border-right:1px solid #24344f;display:flex;flex-direction:column;z-index:100;overflow:hidden;transition:width .25s ease}',
  'fond bleu nuit'
);
rep(
  ".sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#111827;border-bottom:1px solid #f1f3f6;display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}",
  ".sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#ecc95f;border-bottom:1px solid rgba(236,201,95,.16);display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}",
  'brand doree'
);
rep(
  '.sidebar-brand svg{flex-shrink:0;color:#f97316}',
  '.sidebar-brand svg{flex-shrink:0;color:#ecc95f}',
  'logo dore'
);
rep(
  '.sidebar-toggle{background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;border-radius:4px;margin-left:auto;flex-shrink:0;transition:color .15s}',
  '.sidebar-toggle{background:none;border:none;color:#a89454;cursor:pointer;padding:4px;border-radius:4px;margin-left:auto;flex-shrink:0;transition:color .15s}',
  'toggle dore'
);
rep(
  '.sidebar-toggle:hover{color:#f97316}',
  '.sidebar-toggle:hover{color:#f3dc8e}',
  'toggle hover dore'
);
rep(
  '.nav-group-title{padding:12px 26px 6px;font-size:10.5px;text-transform:uppercase;color:#98a1b0;letter-spacing:.08em;font-weight:700;white-space:nowrap;overflow:hidden}',
  '.nav-group-title{padding:12px 26px 6px;font-size:10.5px;text-transform:uppercase;color:rgba(236,201,95,.55);letter-spacing:.08em;font-weight:700;white-space:nowrap;overflow:hidden}',
  'titres groupes dores'
);
rep(
  '.nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#5b6472;cursor:pointer;transition:all .15s;text-decoration:none;font-size:13.5px;white-space:nowrap;overflow:hidden}',
  '.nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#d9c88f;cursor:pointer;transition:all .15s;text-decoration:none;font-size:13.5px;white-space:nowrap;overflow:hidden}',
  'items ecriture doree'
);
rep(
  '.nav-item:hover{background:#f3f5f8;color:#1f2937}',
  '.nav-item:hover{background:rgba(236,201,95,.10);color:#f4e5b0}',
  'hover dore'
);
rep(
  '.nav-item.active,.nav-item:hover.active{background:#fff1e7;color:#ea580c;font-weight:600}',
  '.nav-item.active,.nav-item:hover.active{background:linear-gradient(90deg,rgba(236,201,95,.24),rgba(236,201,95,.07));color:#f6dd85;font-weight:600}',
  'actif dore'
);
rep(
  '.sidebar-footer{padding:14px 20px;border-top:1px solid #f1f3f6;display:flex;align-items:center;justify-content:space-between;overflow:hidden;white-space:nowrap}',
  '.sidebar-footer{padding:14px 20px;border-top:1px solid rgba(236,201,95,.16);display:flex;align-items:center;justify-content:space-between;overflow:hidden;white-space:nowrap}',
  'footer bordure doree'
);
rep(
  '.sidebar-footer .user-info{font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis}',
  '.sidebar-footer .user-info{font-size:12px;color:#c9b87e;overflow:hidden;text-overflow:ellipsis}',
  'user info dore'
);
rep(
  '#sidebar.collapsed .nav-item.active,#sidebar.collapsed .nav-item:hover.active{background:#fff1e7}',
  '#sidebar.collapsed .nav-item.active,#sidebar.collapsed .nav-item:hover.active{background:rgba(236,201,95,.20)}',
  'collapse actif dore'
);
rep(
  '#sidebar.collapsed .nav-item:hover{background:#f3f5f8}',
  '#sidebar.collapsed .nav-item:hover{background:rgba(236,201,95,.10)}',
  'collapse hover dore'
);

/* ---- 3. Dashboard : BL a facturer avec bascule BL actifs / BL reels ---- */
rep(
  'var facturesARecouvrer = fRet;',
  'var facturesARecouvrer = fRet;' +
  'var _blRealTotal = 0;' +
  '(function() {' +
  'var _blRInv = {}; var _blRFs = getFactures() || [];' +
  'for (var _bi1 = 0; _bi1 < _blRFs.length; _bi1++) { var _bf = _blRFs[_bi1]; if (_bf.blIds && Array.isArray(_bf.blIds)) { for (var _bj1 = 0; _bj1 < _bf.blIds.length; _bj1++) _blRInv[_bf.blIds[_bj1]] = true; } }' +
  'var _blRBls = getBLs() || [];' +
  'for (var _bi2 = 0; _bi2 < _blRBls.length; _bi2++) {' +
  'if (!_blRInv[_blRBls[_bi2].id]) { var _blLg = _blRBls[_bi2].lignes || []; for (var _bj2 = 0; _bj2 < _blLg.length; _bj2++) _blRealTotal += (_blLg[_bj2].quantite || 0) * (_blLg[_bj2].prixUnitaire || 0); }' +
  '}' +
  '})();',
  'calcul BL reels',
  true
);
rep(
  "html += '<div class=\"stat-card\"><div class=\"stat-info\"><div class=\"stat-value\" style=\"color:var(--primary)\">' + fmtMoney(blAFacturer) + '</div><div class=\"stat-label\">BL \\u00e0 facturer</div></div></div>';",
  "html += '<div class=\"stat-card\" style=\"flex-direction:column;align-items:stretch;gap:8px\"><div style=\"display:flex;justify-content:flex-end\"><div style=\"display:inline-flex;border:1px solid var(--gray-300);border-radius:var(--radius-sm);overflow:hidden\">';" +
  "html += '<button id=\"blBtnActif\" onclick=\"setDashBlSource(\\'actif\\');event.stopPropagation()\" style=\"padding:2px 8px;font-size:10px;border:none;background:var(--primary);color:#fff;cursor:pointer\">BL actifs</button>';" +
  "html += '<button id=\"blBtnReel\" onclick=\"setDashBlSource(\\'reel\\');event.stopPropagation()\" style=\"padding:2px 8px;font-size:10px;border:none;background:transparent;color:var(--gray-600);cursor:pointer\">BL r\\u00e9els</button>';" +
  "html += '</div></div>';" +
  "html += '<div class=\"stat-info\"><div class=\"stat-value\" id=\"blValActif\" style=\"color:var(--primary)\">' + fmtMoney(blAFacturer) + '</div><div class=\"stat-value\" id=\"blValReel\" style=\"color:var(--primary);display:none\">' + fmtMoney(_blRealTotal) + '</div><div class=\"stat-label\">BL \\u00e0 facturer</div></div></div>';",
  'carte BL a facturer bascule'
);
rep(
  'function setDashDebSource(mode) {',
  'function setDashBlSource(mode) {' +
  'var vA = document.getElementById(\'blValActif\'), vR = document.getElementById(\'blValReel\');' +
  'var bA = document.getElementById(\'blBtnActif\'), bR = document.getElementById(\'blBtnReel\');' +
  'if (!vA || !vR || !bA || !bR) return;' +
  'var onReel = mode === \'reel\';' +
  'vA.style.display = onReel ? \'none\' : \'\';' +
  'vR.style.display = onReel ? \'\' : \'none\';' +
  'bA.style.background = onReel ? \'transparent\' : \'var(--primary)\';' +
  'bA.style.color = onReel ? \'var(--gray-600)\' : \'#fff\';' +
  'bR.style.background = onReel ? \'var(--primary)\' : \'transparent\';' +
  'bR.style.color = onReel ? \'#fff\' : \'var(--gray-600)\';' +
  '}' +
  'function setDashDebSource(mode) {',
  'fonction setDashBlSource'
);

fs.writeFileSync(F, s);
console.log('\r\nindex.html OK (' + n + ' correctifs)');

/* ---- verifications ---- */
console.log('\r\n=== VERIFS ===');
console.log('globalGoOpCaisse numeroPiece :', s.indexOf("_opsl[_gq].numeroPiece") > 0 ? 'OK' : 'ECHEC');
console.log('csSearchTop rempli          :', s.indexOf("inp.value = _term") > 0 ? 'OK' : 'ECHEC');
console.log('gradient bleu nuit          :', s.indexOf('linear-gradient(180deg,#0b1526') > 0 ? 'OK' : 'ECHEC');
console.log('reste blanc sidebar         :', s.indexOf('#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:#ffffff') >= 0 ? 'ECHEC' : 'OK');
console.log('or rgba count               :', s.split('rgba(236,201,95').length - 1);
console.log('_blRealTotal                :', s.split('_blRealTotal').length - 1);
console.log('setDashBlSource             :', s.split('setDashBlSource').length - 1);
console.log('blValReel                   :', s.split('blValReel').length - 1);
