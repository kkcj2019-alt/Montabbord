const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* A) Piege a erreurs global des le tout premier script : toute erreur de demarrage devient visible */
rep(
  "<script>\r\n/* Base de donn\u00e9es : Supabase (PostgreSQL) via l'adaptateur compatible Firestore */",
  [
    "<script>\r\n/* Toute erreur JS est affichee a l'ecran (cadre de connexion) au lieu de rester silencieuse */\r\nwindow.onerror = function(msg, src, line) {\r\n  try {\r\n    var ov = document.getElementById('loginOverlay');\r\n    if (ov && ov.style.display !== 'none') {\r\n      var el = document.getElementById('loginError');\r\n      if (el) { el.textContent = 'Erreur: ' + String(msg).slice(0, 160) + ' (ligne ' + line + ')'; el.style.display = 'block'; }\r\n    }\r\n  } catch (e) {}\r\n  return false;\r\n};\r\n",
    "/* Base de donn\u00e9es : Supabase (PostgreSQL) via l'adaptateur compatible Firestore */"
  ].join('\r\n'),
  'piege erreurs'
);

/* B) Garde anti double declenchement (clic inline + addEventListener) */
rep(
  "function doFirebaseLogin() {\r\n  var entIdRaw = document.getElementById('loginEntId').value.trim();",
  [
    "function doFirebaseLogin() {\r\n  var _nowL = Date.now();\r\n  if (window._lastLoginTry && _nowL - window._lastLoginTry < 1200) return;\r\n  window._lastLoginTry = _nowL;\r\n  var entIdRaw = document.getElementById('loginEntId').value.trim();"
  ].join('\r\n'),
  'garde double clic'
);

/* C) Entree clavier en inline sur les 3 champs (fonctionne meme si l'init JS a echoue) */
rep(
  "<input type=\"text\" id=\"loginEntId\" placeholder=\"Ex: SARLDupont\">",
  "<input type=\"text\" id=\"loginEntId\" placeholder=\"Ex: SARLDupont\" onkeydown=\"if(event.key==='Enter'&&typeof doFirebaseLogin==='function')doFirebaseLogin()\">",
  'entree champ entreprise'
);
rep(
  "<input type=\"text\" id=\"loginEmail\" placeholder=\"Identifiant entreprise ou email\">",
  "<input type=\"text\" id=\"loginEmail\" placeholder=\"Identifiant entreprise ou email\" onkeydown=\"if(event.key==='Enter'&&typeof doFirebaseLogin==='function')doFirebaseLogin()\">",
  'entree champ utilisateur'
);
{
  const oldP = '<div class="form-group"><label>Mot de passe</label><input type="password" id="loginPass" placeholder="Votre mot de passe"></div>\r\n<p id="loginError"';
  const newP = '<div class="form-group"><label>Mot de passe</label><input type="password" id="loginPass" placeholder="Votre mot de passe" onkeydown="if(event.key===\'Enter\'&&typeof doFirebaseLogin===\'function\')doFirebaseLogin()"></div>\r\n<p id="loginError"';
  rep(oldP, newP, 'entree champ mot de passe');
}

fs.writeFileSync('public/index.html', t);
console.log('OK connexion robustifiee');
