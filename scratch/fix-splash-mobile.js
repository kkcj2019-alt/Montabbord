const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* A1) Volet integre pour TOUS les telephones (navigateur, epingle, PWA) */
rep(
  "  if (isStandalone) { showPayeOverlay(); return; }",
  [
    "  var uaMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent || '');",
    "  if (uaMobile || isStandalone) { showPayeOverlay(); return; }"
  ].join('\r\n'),
  'volet tous mobiles'
);

/* A2) Drapeau connexion reussie */
rep(
  "function doFirebaseLogin() {\r\n  var _nowL = Date.now();",
  [
    "function doFirebaseLogin() {\r\n  window._justLoggedIn = true;\r\n  var _nowL = Date.now();"
  ].join('\r\n'),
  'drapeau login'
);

/* B) Splash anime MON TABLEAU DE BORD au showApp suivant une vraie connexion */
rep(
  "function showApp() {\r\n  document.getElementById('loginOverlay').style.display = 'none';\r\n  document.getElementById('app').style.display = '';",
  [
    "function _mdbBootSplash() {",
    "  var css = document.createElement('style');",
    "  css.textContent = '@keyframes mdbBdIn{0%{opacity:0;transform:translateY(30px) scale(.96)}100%{opacity:1;transform:none}}'",
    "    + '@keyframes mdbBarFill{0%{width:0}100%{width:100%}}'",
    "    + '@keyframes mdbFadeOut{to{opacity:0;visibility:hidden}}';",
    "  document.head.appendChild(css);",
    "  var d = document.createElement('div');",
    "  d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:100000;background:linear-gradient(135deg,#0f172a,#1e3a8a 60%,#2563eb);display:flex;flex-direction:column;align-items:center;justify-content:center'",
    "    + ';animation:mdbBdIn .5s ease both';",
    "  d.innerHTML = '<div style=\"animation:mdbBdIn .75s .15s ease both;text-align:center;padding:0 24px\">'",
    "    + '<div style=\"font-size:clamp(24px,6vw,46px);font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;text-shadow:0 4px 24px rgba(37,99,235,.55)\">Mon Tableau de Bord</div>'",
    "    + '<div style=\"margin:16px auto 0;height:5px;width:min(340px,72vw);background:rgba(255,255,255,.16);border-radius:99px;overflow:hidden\">'",
    "    + '<div style=\"height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill 1.9s cubic-bezier(.4,0,.2,1) both\"></div>'",
    "    + '</div></div>';",
    "  document.body.appendChild(d);",
    "  setTimeout(function() { d.style.animation = 'mdbFadeOut .5s ease both'; }, 1950);",
    "  setTimeout(function() { if (d.parentNode) d.parentNode.removeChild(d); }, 2500);",
    "}",
    "function showApp() {\r\n  document.getElementById('loginOverlay').style.display = 'none';\r\n  document.getElementById('app').style.display = '';\r\n  if (window._justLoggedIn) { window._justLoggedIn = false; _mdbBootSplash(); }"
  ].join('\r\n'),
  'splash boot'
);

fs.writeFileSync('public/index.html', t);
console.log('OK volet mobile tous modes + splash connexion');
