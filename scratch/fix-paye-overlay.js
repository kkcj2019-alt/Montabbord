const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

rep(
  [
    "function openPayeModule() {",
    "  /* PC : window.open ouvre directement un nouvel onglet. Mobile : les navigateurs bloquent",
    "     l'ouverture programmatique -> ecran relais avec un VRAI lien a taper (toujours autorise). */",
    "  var w = null;",
    "  try { w = window.open('paye.html', '_blank'); } catch (e) {}",
    "  if (w && !w.closed) return;"
  ].join('\r\n'),
  [
    "function openPayeModule() {",
    "  /* Mode application (ajoute a l'ecran d'accueil) : window.open naviguerait la fenetre courante.",
    "     -> Volet plein ecran integre avec bouton Fermer : l'appli principale reste ouverte. */",
    "  var isStandalone = false;",
    "  try { isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; } catch (e) {}",
    "  if (isStandalone) { showPayeOverlay(); return; }",
    "  /* PC : nouvel onglet. Mobile navigateur : ecran relais avec un VRAI lien a taper. */",
    "  var w = null;",
    "  try { w = window.open('paye.html', '_blank'); } catch (e) {}",
    "  if (w && !w.closed) return;"
  ].join('\r\n'),
  'openPayeModule standalone'
);

rep(
  "function _mdbPayeBack() {",
  [
    "function closePayeOverlay() { location.reload(); }",
    "function showPayeOverlay() {",
    "  document.getElementById('content').innerHTML = ''",
    "    + '<div style=\"position:fixed;left:0;right:0;top:0;bottom:0;background:#f1f5f9;z-index:99999;display:flex;flex-direction:column\">'",
    "    + '<div style=\"background:#1e293b;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center\">'",
    "    + '<strong style=\"font-size:.95rem\">Module Traitement Salaire</strong>'",
    "    + '<button onclick=\"closePayeOverlay()\" style=\"background:#ef4444;border:none;color:#fff;padding:7px 18px;border-radius:6px;font-weight:700;font-size:.85rem\">\\u2715 Fermer</button>'",
    "    + '</div>'",
    "    + '<iframe src=\"paye.html\" style=\"flex:1;border:none;width:100%;background:#fff\"></iframe>'",
    "    + '</div>';",
    "}",
    "function _mdbPayeBack()"
  ].join('\r\n'),
  'showPayeOverlay'
);

fs.writeFileSync('public/index.html', t);
console.log('OK index.html : volet paye mode application');
