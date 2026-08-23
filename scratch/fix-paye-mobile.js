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
    "  /* Clic d'ancre target=_blank dans le geste utilisateur : ouvre un VRAI nouvel onglet sur mobile */",
    "  var a = document.createElement('a');",
    "  a.href = 'paye.html';",
    "  a.target = '_blank';",
    "  a.rel = 'noopener';",
    "  a.style.display = 'none';",
    "  document.body.appendChild(a);",
    "  a.click();",
    "  setTimeout(function() { if (a.parentNode) a.parentNode.removeChild(a); }, 100);",
    "}"
  ].join('\r\n'),
  [
    "function _mdbPayeBack() { try { if (typeof navigateTo === 'function') navigateTo('dashboard'); else renderDashboard(); } catch (e) {} }",
    "function openPayeModule() {",
    "  /* PC : window.open ouvre directement un nouvel onglet. Mobile : les navigateurs bloquent",
    "     l'ouverture programmatique -> ecran relais avec un VRAI lien a taper (toujours autorise). */",
    "  var w = null;",
    "  try { w = window.open('paye.html', '_blank'); } catch (e) {}",
    "  if (w && !w.closed) return;",
    "  document.getElementById('content').innerHTML = '<div style=\"text-align:center;padding:60px 24px\">'",
    "    + '<h2>Module Traitement Salaire</h2>'",
    "    + '<p style=\"color:var(--gray-500);margin:12px auto 28px;max-width:420px\">Appuyez sur le bouton ci-dessous : le module s\\'ouvrira dans un nouvel onglet et cette application restera ouverte ici.</p>'",
    "    + '<a href=\"paye.html\" target=\"_blank\" rel=\"noopener\" style=\"display:inline-block;padding:18px 44px;font-size:17px;background:var(--primary);color:#fff;border-radius:10px;text-decoration:none;font-weight:700\">Ouvrir le module Paye \\u2197</a>'",
    "    + '<p style=\"margin-top:30px\"><a href=\"#\" onclick=\"_mdbPayeBack();return false;\" style=\"color:var(--gray-500);font-size:14px\">Retour au tableau de bord</a></p>'",
    "    + '</div>';",
    "}"
  ].join('\r\n'),
  'openPayeModule'
);

fs.writeFileSync('public/index.html', t);
console.log('OK paye relais mobile');
