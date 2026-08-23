const fs = require('fs');

/* ===== paye.html ===== */
let t = fs.readFileSync('public/paye.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* Grille bois PERSISTEE automatiquement au premier chargement */
rep(
  [
    "  window._catsIsDefault = false;",
    "  if (!cats || !cats.length) { cats = woodSectorGridData(); window._catsIsDefault = true; }",
    "  var tbody = document.getElementById('cat-tbody');"
  ].join('\r\n'),
  [
    "  window._catsIsDefault = false;",
    "  if (!cats || !cats.length) {",
    "    /* Grille officielle secteur du bois : persistee automatiquement la premiere fois */",
    "    cats = woodSectorGridData();",
    "    setCategories(cats);",
    "    toast('Grille salariale secteur du bois chargee automatiquement (Bareme 2015 +12%)', 'success');",
    "  }",
    "  var tbody = document.getElementById('cat-tbody');"
  ].join('\r\n'),
  'persist grille defaut'
);

/* En-tete de groupe toujours visible, meme pour un type inconnu unique */
rep(
  "  var extra = [];",
  [
    "  if (!Object.keys(groups).length) { groups['Autre'] = []; }",
    "  var extra = [];"
  ].join('\r\n'),
  'bande secours'
);

fs.writeFileSync('public/paye.html', t);
console.log('OK paye.html : grille persistee auto + bande secours');

/* ===== index.html : splash 5s avec logo + nom societe ===== */
let u = fs.readFileSync('public/index.html', 'utf8');
function rep2(oldS, newS, label) {
  const i = u.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  u = u.slice(0, i) + newS + u.slice(i + oldS.length);
}

const ancienSplash =
"function _mdbBootSplash() {\r\n"
+ "  var css = document.createElement('style');\r\n"
+ "  css.textContent = '@keyframes mdbBdIn{0%{opacity:0;transform:translateY(30px) scale(.96)}100%{opacity:1;transform:none}}'\r\n"
+ "    + '@keyframes mdbBarFill{0%{width:0}100%{width:100%}}'\r\n"
+ "    + '@keyframes mdbFadeOut{to{opacity:0;visibility:hidden}}';\r\n"
+ "  document.head.appendChild(css);\r\n"
+ "  var d = document.createElement('div');\r\n"
+ "  d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;background:linear-gradient(135deg,#0f172a,#1e3a8a 60%,#2563eb);display:flex;flex-direction:column;align-items:center;justify-content:center'\r\n"
+ "    + ';animation:mdbBdIn .5s ease both';\r\n"
+ "  d.innerHTML = '<div style=\"animation:mdbBdIn .75s .15s ease both;text-align:center;padding:0 24px\">'\r\n"
+ "    + '<div style=\"font-size:clamp(24px,6vw,46px);font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;text-shadow:0 4px 24px rgba(37,99,235,.55)\">Mon Tableau de Bord</div>'\r\n"
+ "    + '<div style=\"margin:16px auto 0;height:5px;width:min(340px,72vw);background:rgba(255,255,255,.16);border-radius:99px;overflow:hidden\">'\r\n"
+ "    + '<div style=\"height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill 1.9s cubic-bezier(.4,0,.2,1) both\"></div>'\r\n"
+ "    + '</div></div>';\r\n"
+ "  document.body.appendChild(d);\r\n"
+ "  setTimeout(function() { d.style.animation = 'mdbFadeOut .5s ease both'; }, 1950);\r\n"
+ "  setTimeout(function() { if (d.parentNode) d.parentNode.removeChild(d); }, 2500);\r\n"
+ "}";

if (u.indexOf(ancienSplash) < 0) { console.error('INTROUVABLE: splash exact'); process.exit(1); }

const nouveauSplash = [
"function _mdbBootSplash() {",
"  var ent = {};",
"  try { ent = (typeof getEntreprise === 'function' && getEntreprise()) || {}; } catch (e) {}",
"  var nomSoc = String(ent.nom || '').trim();",
"  var logoHtml = ent.logo ? '<img src=\"' + ent.logo + '\" alt=\"\" style=\"max-height:110px;max-width:min(260px,60vw);object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 6px 20px rgba(0,0,0,.45))\">' : '';",
"  var socHtml = nomSoc ? '<div style=\"margin-top:10px;font-size:clamp(15px,3.4vw,22px);font-weight:600;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase\">' + escH(nomSoc) + '</div>' : '';",
"  var css = document.createElement('style');",
"  css.textContent = '@keyframes mdbBdIn{0%{opacity:0;transform:translateY(30px) scale(.96)}100%{opacity:1;transform:none}}'",
"    + '@keyframes mdbLogoIn{0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:none}}'",
"    + '@keyframes mdbBarFill{0%{width:0}100%{width:100%}}'",
"    + '@keyframes mdbPulseGlow{0%,100%{text-shadow:0 4px 24px rgba(37,99,235,.55)}50%{text-shadow:0 4px 42px rgba(56,189,248,.85)}}'",
"    + '@keyframes mdbFadeOut{to{opacity:0;visibility:hidden}}';",
"  document.head.appendChild(css);",
"  var d = document.createElement('div');",
"  d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;background:linear-gradient(135deg,#0f172a,#1e3a8a 60%,#2563eb);display:flex;flex-direction:column;align-items:center;justify-content:center'",
"    + ';animation:mdbBdIn .5s ease both';",
"  d.innerHTML = '<div style=\"animation:mdbBdIn .75s .15s ease both;text-align:center;padding:0 24px\">'",
"    + '<div style=\"animation:mdbLogoIn 1s .25s cubic-bezier(.34,1.56,.64,1) both\">' + logoHtml + '</div>'",
"    + '<div style=\"font-size:clamp(26px,7vw,52px);font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;animation:mdbPulseGlow 2.4s ease-in-out infinite\">Mon Tableau de Bord</div>'",
"    + socHtml",
"    + '<div style=\"margin:22px auto 0;height:5px;width:min(380px,80vw);background:rgba(255,255,255,.16);border-radius:99px;overflow:hidden\">'",
"    + '<div style=\"height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill 4.6s cubic-bezier(.4,0,.2,1) both\"></div>'",
"    + '</div></div>';",
"  document.body.appendChild(d);",
"  setTimeout(function() { d.style.animation = 'mdbFadeOut .6s ease both'; }, 4850);",
"  setTimeout(function() { if (d.parentNode) d.parentNode.removeChild(d); }, 5500);",
"}"
].join('\r\n');

rep2(ancienSplash, nouveauSplash, 'splash remplace');

/* Cache-bust de l'iframe paye */
rep2("'<iframe src=\\\"paye.html\\\" style=\\\"flex:1;border:none;width:100%;background:#fff\\\"></iframe>'",
     "'<iframe src=\\\"paye.html?v=0823\\\" style=\\\"flex:1;border:none;width:100%;background:#fff\\\"></iframe>'",
     'iframe cache-bust');

fs.writeFileSync('public/index.html', u);
console.log('OK index.html : splash 5s logo+societe + iframe cache-bust');
