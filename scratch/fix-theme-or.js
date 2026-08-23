const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
let nRep = 0;
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
  nRep++;
}

/* ===== 1) PAGE DE CONNEXION : fond blanc beige dore ===== */
rep('#loginOverlay{position:fixed;inset:0;background:linear-gradient(135deg,var(--primary),var(--primary-dark))',
    '#loginOverlay{position:fixed;inset:0;background:linear-gradient(140deg,#ffffff 0%,#fbf5e4 30%,#f3e7c8 55%,#ecd9a8 78%,#dfc07c 100%)',
    'fond login');

const iStyle = t.indexOf('</style>');
if (iStyle < 0) { console.error('INTROUVABLE: </style>'); process.exit(1); }
t = t.slice(0, iStyle)
  + '\r\n/* Theme connexion or/beige */\r\n'
  + '#loginOverlay .login-card{border:1px solid #ead9ab;box-shadow:0 24px 70px rgba(146,110,20,.28)}\r\n'
  + '#loginOverlay h1{color:#7a5b12}\r\n'
  + '#loginOverlay .subtitle{color:#a98d3f}\r\n'
  + '#loginOverlay .login-logo svg{color:#c9a227}\r\n'
  + '#btnInitialLogin{background:linear-gradient(135deg,#f3d27a,#d4af37)!important;color:#4a3608!important;border:none!important;font-weight:700!important}\r\n'
  + '#btnInitialLogin:hover{filter:brightness(1.05)}\r\n'
  + '#tabLogin{background:transparent!important;border-bottom-color:#d4af37!important;color:#8a6d1f!important}\r\n'
  + '#linkResetPwd{color:#a07c1f!important}\r\n'
  + t.slice(iStyle);
nRep++;

/* ===== 2) SIDEBAR BLANCHE ===== */
rep('width:var(--sidebar-w);background:var(--gray-900);color:#fff;display:flex',
    'width:var(--sidebar-w);background:#ffffff;color:#1e293b;border-right:1px solid #e8eaee;display:flex',
    'sidebar fond');
rep('font-weight:700;border-bottom:1px solid var(--gray-700)',
    'font-weight:700;border-bottom:1px solid #eceef2',
    'brand bordure');
rep('.sidebar-toggle{background:none;border:none;color:var(--gray-400)',
    '.sidebar-toggle{background:none;border:none;color:#94a3b8',
    'toggle couleur');
rep('.sidebar-toggle:hover{color:#fff}', '.sidebar-toggle:hover{color:#0f172a}', 'toggle hover');
rep('text-transform:uppercase;color:var(--gray-400);letter-spacing:.06em',
    'text-transform:uppercase;color:#8a93a6;letter-spacing:.06em',
    'titre groupe');
rep('padding:10px 24px;color:var(--gray-300)', 'padding:10px 24px;color:#334155', 'item couleur');
rep('.nav-item:hover{background:rgba(255,255,255,.06);color:#fff}', '.nav-item:hover{background:#f1f5f9;color:#0f172a}', 'item hover');
rep('.nav-item.active{background:rgba(37,99,235,.2);color:#fff;border-left-color:var(--primary)}',
    '.nav-item.active{background:#eff6ff;color:var(--primary-dark);border-left-color:var(--primary)}',
    'item actif');
rep('.sidebar-footer{padding:14px 20px;border-top:1px solid var(--gray-700)',
    '.sidebar-footer{padding:14px 20px;border-top:1px solid #eceef2',
    'footer bordure');
rep('.sidebar-footer .user-info{font-size:12px;color:var(--gray-400)',
    '.sidebar-footer .user-info{font-size:12px;color:#64748b',
    'footer user');
rep('#sidebar.collapsed .nav-item:hover{background:rgba(37,99,235,.3)}', '#sidebar.collapsed .nav-item:hover{background:#e0eaff}', 'collapsed hover');

/* ===== 3) EXTRACTION COULEURS LOGO + SYNTHESE VOCALE ===== */
rep('function _mdbBootSplash() {',
[
  'function _mdbCouleursLogo(dataUrl, cb) {',
  '  try {',
  '    var im = new Image();',
  '    im.onload = function() {',
  '      try {',
  '        var cw = 48;',
  '        var chh = Math.max(1, Math.round(im.height / Math.max(1, im.width) * cw));',
  '        var cv = document.createElement(\'canvas\');',
  '        cv.width = cw; cv.height = chh;',
  '        var cx = cv.getContext(\'2d\');',
  '        cx.drawImage(im, 0, 0, cw, chh);',
  '        var dt;',
  '        try { dt = cx.getImageData(0, 0, cw, chh).data; } catch (eD) { cb(null); return; }',
  '        var bk = {};',
  '        for (var i = 0; i < dt.length; i += 4) {',
  '          var r = dt[i], g = dt[i + 1], b = dt[i + 2], a = dt[i + 3];',
  '          if (a < 120) continue;',
  '          var mx = Math.max(r, g, b), mn = Math.min(r, g, b);',
  '          if (mn > 225 || mx < 45) continue;',
  '          var k = (r >> 5) + \'-\' + (g >> 5) + \'-\' + (b >> 5);',
  '          var o = bk[k];',
  '          if (!o) { o = bk[k] = { n: 0, r: 0, g: 0, b: 0, s: 0 }; }',
  '          o.n++; o.r += r; o.g += g; o.b += b; o.s += (mx - mn);',
  '        }',
  '        var arr = Object.keys(bk).map(function(k2) { var o = bk[k2]; return { r: Math.round(o.r / o.n), g: Math.round(o.g / o.n), b: Math.round(o.b / o.n), w: o.n * ((o.s / o.n) + 40) }; });',
  '        arr.sort(function(a, b) { return b.w - a.w; });',
  '        cb(arr.slice(0, 3).map(function(c) { return { r: c.r, g: c.g, b: c.b }; }));',
  '      } catch (eC) { cb(null); }',
  '    };',
  '    im.onerror = function() { cb(null); };',
  '    im.src = dataUrl;',
  '  } catch (e) { cb(null); }',
  '}',
  'function _mdbParle(txt) {',
  '  try {',
  '    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;',
  '    window.speechSynthesis.cancel();',
  '    var ut = new SpeechSynthesisUtterance(txt);',
  '    ut.lang = \'fr-FR\';',
  '    ut.rate = 0.95;',
  '    ut.pitch = 1.05;',
  '    ut.volume = 1;',
  '    var vs = window.speechSynthesis.getVoices() || [];',
  '    var frV = null;',
  '    for (var i = 0; i < vs.length; i++) { if (/^fr/i.test(vs[i].lang || \'\')) { frV = vs[i]; break; } }',
  '    if (frV) ut.voice = frV;',
  '    setTimeout(function() { try { window.speechSynthesis.speak(ut); } catch (eS) {} }, 450);',
  '  } catch (eT) {}',
  '}',
  'function _mdbBootSplash() {'
].join('\r\n'),
'fonctions couleurs + voix');

/* Nom utilisateur : degrade (mis a jour avec les couleurs du logo) */
rep("  var userHtml = uNom ? '<div style=\"margin-top:18px;font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(32px,8.5vw,60px);font-weight:700;color:#fff;letter-spacing:.3em;text-transform:uppercase;text-shadow:0 4px 30px rgba(56,189,248,.65)\">' + lU + '</div>' : '';",
    "  var userHtml = uNom ? '<div id=\"mdbUserGrad\" style=\"margin-top:18px;font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(32px,8.5vw,60px);font-weight:700;letter-spacing:.3em;text-transform:uppercase;background-image:linear-gradient(100deg,#7dd3fc,#a78bfa,#f0abfc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent\">' + lU + '</div>' : '';",
    'userHtml degrade');

/* Apres affichage : appliquer les couleurs du logo au degradé + voix de bienvenue */
rep([
  '  document.body.appendChild(d);',
  "  setTimeout(function() { d.style.animation = 'mdbFadeOut .6s ease both'; }, 4850);"
].join('\r\n'),
[
  '  document.body.appendChild(d);',
  '  if (ent.logo && uNom) {',
  '    _mdbCouleursLogo(ent.logo, function(cols) {',
  '      if (!cols || !cols.length) return;',
  '      var el = document.getElementById(\'mdbUserGrad\');',
  '      if (!el) return;',
  '      el.style.backgroundImage = \'linear-gradient(100deg,\' + cols.map(function(c) { return \'rgb(\' + c.r + \',\' + c.g + \',\' + c.b + \')\'; }).join(\',\') + \')\';',
  '    });',
  '  }',
  "  try { _mdbParle('Bonjour ! Bienvenue sur le tableau de bord' + (nomSoc ? ' de ' + nomSoc : '') + (uNom ? ', ' + uNom : '')); } catch (eP) {}",
  "  setTimeout(function() { d.style.animation = 'mdbFadeOut .6s ease both'; }, 4850);"
].join('\r\n'),
'degrande logo + voix');

fs.writeFileSync('public/index.html', t);
console.log('OK - ' + nRep + ' remplacements appliques');
