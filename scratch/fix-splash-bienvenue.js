const fs = require('fs');
let u = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = u.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  u = u.slice(0, i) + newS + u.slice(i + oldS.length);
}

/* 1) Construire le nom de l'utilisateur connecte en grandes lettres animees (apres la ligne socHtml) */
rep(
  "  var socHtml = nomSoc ? '<div style=\"margin-top:14px;font-size:clamp(16px,3.8vw,26px);font-weight:700;color:#bfdbfe;letter-spacing:.45em;text-transform:uppercase;font-family:\\'Cinzel\\',Georgia,serif\">' + lettres + '</div>' : '';",
  [
    "  var socHtml = nomSoc ? '<div style=\"margin-top:14px;font-size:clamp(16px,3.8vw,26px);font-weight:700;color:#bfdbfe;letter-spacing:.45em;text-transform:uppercase;font-family:\\'Cinzel\\',Georgia,serif\">' + lettres + '</div>' : '';",
    "  var uNom = '';",
    "  try { uNom = String((typeof currentUser !== 'undefined' && currentUser && currentUser.nom) || '').trim(); } catch (eU) {}",
    "  var dUser = nomSoc ? (0.9 + nomSoc.length * 0.15 + 0.35) : 1.0;",
    "  var lU = '';",
    "  for (var ui = 0; ui < uNom.length; ui++) {",
    "    var chU = uNom.charAt(ui);",
    "    lU += '<span style=\"display:inline-block;opacity:0;animation:mdbLetIn .45s ease both ' + (dUser + ui * 0.13).toFixed(2) + 's\">' + (chU === ' ' ? '&nbsp;&nbsp;' : escH(chU)) + '</span>';",
    "  }",
    "  var userHtml = uNom ? '<div style=\"margin-top:18px;font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(32px,8.5vw,60px);font-weight:700;color:#fff;letter-spacing:.3em;text-transform:uppercase;text-shadow:0 4px 30px rgba(56,189,248,.65)\">' + lU + '</div>' : '';"
  ].join('\r\n'),
  'nom utilisateur'
);

/* 2) Nouveau contenu : BONJOUR / BIENVENUE...DE / societe / NOM UTILISATEUR / barre */
rep(
  [
    "  d.innerHTML = '<div style=\"animation:mdbBdIn .75s .15s ease both;text-align:center;padding:0 24px\">'",
    "    + '<div style=\"animation:mdbLogoIn 1s .25s cubic-bezier(.34,1.56,.64,1) both\">' + logoHtml + '</div>'",
    "    + '<div style=\"font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(26px,7vw,52px);font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;animation:mdbPulseGlow 2.4s ease-in-out infinite\">Mon Tableau de Bord</div>'",
    "    + socHtml",
    "    + '<div style=\"margin:22px auto 0;height:5px;width:min(380px,80vw);background:rgba(255,255,255,.16);border-radius:99px;overflow:hidden\">'",
    "    + '<div style=\"height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill 4.6s cubic-bezier(.4,0,.2,1) both\"></div>'",
    "    + '</div></div>';"
  ].join('\r\n'),
  [
    "  d.innerHTML = '<div style=\"animation:mdbBdIn .75s .15s ease both;text-align:center;padding:0 24px\">'",
    "    + '<div style=\"animation:mdbLogoIn 1s .25s cubic-bezier(.34,1.56,.64,1) both\">' + logoHtml + '</div>'",
    "    + '<div style=\"font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(13px,2.6vw,18px);color:#93c5fd;letter-spacing:.6em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .5s\">Bonjour</div>'",
    "    + '<div style=\"font-family:\\'Cinzel\\',Georgia,serif;margin-top:10px;font-size:clamp(15px,3vw,22px);font-weight:600;color:#dbeafe;letter-spacing:.28em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .68s\">Bienvenue sur le tableau de bord' + (nomSoc ? ' de' : '') + '</div>'",
    "    + socHtml",
    "    + userHtml",
    "    + '<div style=\"margin:26px auto 0;height:5px;width:min(380px,80vw);background:rgba(255,255,255,.16);border-radius:99px;overflow:hidden\">'",
    "    + '<div style=\"height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill 4.6s cubic-bezier(.4,0,.2,1) both\"></div>'",
    "    + '</div></div>';"
  ].join('\r\n'),
  'contenu splash'
);

fs.writeFileSync('public/index.html', u);
console.log('OK splash : Bonjour / Bienvenue ... de SOCIETE / NOM utilisateur');
