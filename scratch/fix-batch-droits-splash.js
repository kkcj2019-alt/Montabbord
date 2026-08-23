const fs = require('fs');
let nRep = 0;

/* ===================== index.html ===================== */
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
  nRep++;
}

/* --- Connexion : fond blanc simple --- */
rep('#loginOverlay{position:fixed;inset:0;background:linear-gradient(140deg,#ffffff 0%,#fbf5e4 30%,#f3e7c8 55%,#ecd9a8 78%,#dfc07c 100%)',
    '#loginOverlay{position:fixed;inset:0;background:#ffffff',
    'fond blanc');

/* --- Sidebar BEIGE FONCE --- */
rep('width:var(--sidebar-w);background:#ffffff;color:#1e293b;border-right:1px solid #e8eaee;display:flex',
    'width:var(--sidebar-w);background:#c9b18a;color:#241c09;border-right:1px solid #b39c74;display:flex',
    'sidebar fond');
rep('font-weight:700;border-bottom:1px solid #eceef2',
    'font-weight:700;border-bottom:1px solid rgba(0,0,0,.12)',
    'brand bordure');
rep('.sidebar-toggle{background:none;border:none;color:#94a3b8',
    '.sidebar-toggle{background:none;border:none;color:#6b5a35',
    'toggle');
rep('.sidebar-toggle:hover{color:#0f172a}', '.sidebar-toggle:hover{color:#241c09}', 'toggle hover');
rep('text-transform:uppercase;color:#8a93a6;letter-spacing:.06em',
    'text-transform:uppercase;color:#6f5c36;letter-spacing:.06em',
    'titre groupe');
rep('padding:10px 24px;color:#334155', 'padding:10px 24px;color:#3a2f16', 'item');
rep('.nav-item:hover{background:#f1f5f9;color:#0f172a}', '.nav-item:hover{background:#bda87e;color:#241c09}', 'item hover');
rep('.nav-item.active{background:#eff6ff;color:var(--primary-dark);border-left-color:var(--primary)}',
    '.nav-item.active{background:#b89f70;color:#241c09;border-left-color:#8a6d1f}',
    'item actif');
rep('.sidebar-footer{padding:14px 20px;border-top:1px solid #eceef2',
    '.sidebar-footer{padding:14px 20px;border-top:1px solid rgba(0,0,0,.12)',
    'footer');
rep('.sidebar-footer .user-info{font-size:12px;color:#64748b',
    '.sidebar-footer .user-info{font-size:12px;color:#5c4d2c',
    'footer user');
rep('#sidebar.collapsed .nav-item:hover{background:#e0eaff}', '#sidebar.collapsed .nav-item:hover{background:#bda87e}', 'collapsed hover');
rep('style="width:100%;background:var(--gray-800);color:#fff;border:1px solid var(--gray-600);border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer"',
    'style="width:100%;background:#b89f70;color:#241c09;border:1px solid #a08a58;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer"',
    'select module');
rep("html += '<div style=\"height:1px;background:var(--gray-700);margin:6px 24px\"></div>'; continue; }",
    "html += '<div style=\"height:1px;background:rgba(255,255,255,.28);margin:6px 24px\"></div>'; continue; }",
    'separateur');
rep('color:var(--gray-500);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:8px 14px 4px">',
    'color:#6b5a36;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:8px 14px 4px;">',
    'label epingles');

/* --- DROITS STRICTS --- */
rep('      if (dp.indexOf(page) !== -1 && dp.indexOf(basePage) !== -1) return false;',
    '      if (dp.indexOf(page) !== -1 || dp.indexOf(basePage) !== -1) return false;',
    'petit admin OU');
rep([
  'function canAccessSection(page, subKey) {',
  '  if (!currentUser) return false;',
  '  if (currentUser.isSuperAdmin) return true;',
  '  if (currentUser.isAdmin) {',
  "    if (currentUser.adminType === 'petit_admin') {",
  '      var dp = currentUser.deniedPages || [];',
  '      if (dp.indexOf(page) !== -1) return false;',
  '    }'
].join('\r\n'),
[
  'function canAccessSection(page, subKey) {',
  '  if (!currentUser) return false;',
  '  if (currentUser.isSuperAdmin) return true;',
  '  var basePageS = page.indexOf(\':\') !== -1 ? page.split(\':\')[0] : page;',
  '  if (currentUser.isAdmin) {',
  "    if (currentUser.adminType === 'petit_admin') {",
  '      var dp = currentUser.deniedPages || [];',
  '      if (dp.indexOf(page) !== -1 || dp.indexOf(basePageS) !== -1) return false;',
  '    }'
].join('\r\n'),
'canAccessSection deny');

/* navigateTo : dashboard inaccessible -> premiere page autorisee */
rep('function navigateTo(page) {',
[
  'function navigateTo(page) {',
  "  if (page === 'dashboard' && currentUser && !currentUser.isSuperAdmin && !canAccess('dashboard', false)) {",
  "    var candD = ['tiers','facturation','creancesDettes','previsions','stock','suiviLivraisons','typeElementsAchats','elementsAchats','bonsCommandeFournisseurs','prefinancement','tresorerie','employes','acomptesPrets','comptabilite','actif','dettes','taches','licences','utilisateurs','entreprise'];",
  "    var altD = '';",
  "    for (var ciD = 0; ciD < candD.length; ciD++) { if (canAccess(candD[ciD], false)) { altD = candD[ciD]; break; } }",
  "    if (altD) { page = altD; } else { toast('Aucun acc\u00e8s configur\u00e9 pour cet utilisateur', 'error'); return; }",
  '  }'
].join('\r\n'),
'navigateTo dashboard');

/* Sidebar : entree Tableau de bord uniquement si droit */
rep('  /* Pinned menus section */',
[
  "  if (!(currentUser && currentUser.isSuperAdmin) && canAccess('dashboard', false)) {",
  "    html += '<div class=\"nav-item' + (currentPage === 'dashboard' ? ' active' : '') + '\" onclick=\"closeSidebar();navigateTo(\'dashboard\')\">';",
  "    html += '<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/></svg>';",
  "    html += '<span>Tableau de bord</span></div>';",
  "    html += '<div style=\"height:1px;background:rgba(0,0,0,.14);margin:6px 12px\"></div>';",
  '  }',
  '  /* Pinned menus section */'
].join('\r\n'),
'item dashboard conditionnel');

/* Epingles filtree par droits */
rep([
  '    for (var pi = 0; pi < pinned.length; pi++) {',
  '      var p = pinned[pi];'
].join('\r\n'),
[
  '    for (var pi = 0; pi < pinned.length; pi++) {',
  '      var p = pinned[pi];',
  "      if (!canAccess(p.key, false)) continue;"
].join('\r\n'),
'epingles filtre');

/* --- SPLASH : nom visible partout (couleurs par lettre, sans background-clip) --- */
rep([
  '  var dUser = nomSoc ? (0.9 + nomSoc.length * 0.15 + 0.35) : 1.0;',
  "  var lU = '';",
  '  for (var ui = 0; ui < uNom.length; ui++) {',
  "    var chU = uNom.charAt(ui);",
  "    lU += '<span style=\"display:inline-block;opacity:0;animation:mdbLetIn .45s ease both ' + (dUser + ui * 0.13).toFixed(2) + 's\">' + (chU === ' ' ? '&nbsp;&nbsp;' : escH(chU)) + '</span>';",
  '  }',
  "  var userHtml = uNom ? '<div id=\"mdbUserGrad\" style=\"margin-top:18px;font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(32px,8.5vw,60px);font-weight:700;letter-spacing:.3em;text-transform:uppercase;background-image:linear-gradient(100deg,#7dd3fc,#a78bfa,#f0abfc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent\">' + lU + '</div>' : '';"
].join('\r\n'),
[
  '  var dUser = nomSoc ? (0.9 + nomSoc.length * 0.15 + 0.35) : 1.0;',
  '  var _stopsU = (window._mdbLogoCols && window._mdbLogoCols.length >= 2) ? window._mdbLogoCols.slice() : [{ r: 125, g: 211, b: 252 }, { r: 167, g: 139, b: 250 }, { r: 240, g: 171, b: 252 }];',
  '  function _mdbMixU(tx) {',
  '    var seg = (_stopsU.length - 1) * tx;',
  '    var i0 = Math.min(_stopsU.length - 2, Math.floor(seg));',
  '    var f = seg - i0;',
  '    var a = _stopsU[i0], b = _stopsU[i0 + 1];',
  "    return 'rgb(' + Math.round(a.r + (b.r - a.r) * f) + ',' + Math.round(a.g + (b.g - a.g) * f) + ',' + Math.round(a.b + (b.b - a.b) * f) + ')';",
  '  }',
  '  window._mdbRenderUserLettres = function(el, t0) {',
  "    var hU = '';",
  '    for (var uj = 0; uj < uNom.length; uj++) {',
  "      var chJ = uNom.charAt(uj);",
  '      var dJ = (dUser + uj * 0.13).toFixed(2);',
  '      var shown = t0 && ((Date.now() - t0) / 1000 > parseFloat(dJ) + 0.45);',
  "      hU += '<span style=\"display:inline-block;color:' + _mdbMixU(uNom.length > 1 ? uj / (uNom.length - 1) : 0) + ';' + (shown ? 'opacity:1' : 'opacity:0;animation:mdbLetIn .45s ease both ' + dJ + 's') + '\">' + (chJ === ' ' ? '&nbsp;&nbsp;' : escH(chJ)) + '</span>';",
  '    }',
  '    el.innerHTML = hU;',
  '  };',
  "  var lU = '';",
  '  for (var ui = 0; ui < uNom.length; ui++) {',
  "    var chU = uNom.charAt(ui);",
  "    lU += '<span style=\"display:inline-block;color:' + _mdbMixU(uNom.length > 1 ? ui / (uNom.length - 1) : 0) + ';opacity:0;animation:mdbLetIn .45s ease both ' + (dUser + ui * 0.13).toFixed(2) + 's\">' + (chU === ' ' ? '&nbsp;&nbsp;' : escH(chU)) + '</span>';",
  '  }',
  "  var userHtml = uNom ? '<div id=\"mdbUserGrad\" style=\"margin-top:18px;font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(32px,8.5vw,60px);font-weight:700;letter-spacing:.3em;text-transform:uppercase;text-shadow:0 4px 26px rgba(56,189,248,.30)\">' + lU + '</div>' : '';"
].join('\r\n'),
'lettres degrade par couleur');

/* Callback logo : recolorer les lettres */
rep([
  '  document.body.appendChild(d);',
  '  if (ent.logo && uNom) {',
  '    _mdbCouleursLogo(ent.logo, function(cols) {',
  '      if (!cols || !cols.length) return;',
  "      var el = document.getElementById('mdbUserGrad');",
  '      if (!el) return;',
  "      el.style.backgroundImage = 'linear-gradient(100deg,' + cols.map(function(c) { return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')'; }).join(',') + ')';",
  '    });',
  '  }'
].join('\r\n'),
[
  '  document.body.appendChild(d);',
  '  var _splashT0 = Date.now();',
  '  if (ent.logo && uNom) {',
  '    _mdbCouleursLogo(ent.logo, function(cols) {',
  '      if (!cols || !cols.length) return;',
  '      window._mdbLogoCols = cols;',
  "      var el = document.getElementById('mdbUserGrad');",
  '      if (el && window._mdbRenderUserLettres) window._mdbRenderUserLettres(el, _splashT0);',
  '    });',
  '  }'
].join('\r\n'),
'recoloriage logo');

/* Voix masculine francaise prioritaire */
rep([
  '    var vs = window.speechSynthesis.getVoices() || [];',
  '    var frV = null;',
  "    for (var i = 0; i < vs.length; i++) { if (/^fr/i.test(vs[i].lang || '')) { frV = vs[i]; break; } }",
  '    if (frV) ut.voice = frV;'
].join('\r\n'),
[
  '    var vs = window.speechSynthesis.getVoices() || [];',
  '    var frV = null, frM = null;',
  '    for (var i = 0; i < vs.length; i++) {',
  "      if (!/^fr/i.test(vs[i].lang || '')) continue;",
  '      if (!frV) frV = vs[i];',
  "      if (!frM && /paul|thomas|nicolas|mathieu|henri|jerome|claude|homme|male/i.test(vs[i].name || '')) frM = vs[i];",
  '    }',
  '    if (frM) ut.voice = frM; else if (frV) ut.voice = frV;'
].join('\r\n'),
'voix homme');

/* Deblocage audio mobile au clic de connexion */
rep('function doFirebaseLogin() {',
[
  'function _mdbUnlockVoix() {',
  '  try {',
  '    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;',
  "    var u0 = new SpeechSynthesisUtterance(' ');",
  '    u0.volume = 0;',
  '    window.speechSynthesis.cancel();',
  '    window.speechSynthesis.speak(u0);',
  '  } catch (e) {}',
  '}',
  'function doFirebaseLogin() {',
  '  try { _mdbUnlockVoix(); } catch (e0) {}'
].join('\r\n'),
'unlock voix');

fs.writeFileSync('public/index.html', t);

/* ===================== paye.html : bandes de groupe lisibles (texte gris sur le TD) ===================== */
let p = fs.readFileSync('public/paye.html', 'utf8');
const oldBand = '<tr style="background:#1e293b;color:#f8fafc"><td colspan="4" style="font-weight:700;font-size:.78rem;padding:6px 10px;letter-spacing:.5px;text-transform:uppercase">';
const newBand = '<tr><td colspan="4" style="background:#334155;color:#cbd5e1;font-weight:700;font-size:.78rem;padding:6px 10px;letter-spacing:.5px;text-transform:uppercase">';
let cntB = 0;
while (p.indexOf(oldBand) !== -1) { p = p.replace(oldBand, newBand); cntB++; }
if (cntB === 0) { console.error('INTROUVABLE: bande groupe paye'); process.exit(1); }
fs.writeFileSync('public/paye.html', p);

console.log('OK - ' + nRep + ' remplacements index.html + ' + cntB + ' bandes paye.html');
