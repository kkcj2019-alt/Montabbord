const fs = require('fs');
let u = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = u.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  u = u.slice(0, i) + newS + u.slice(i + oldS.length);
}

/* 1) Nom societe : construction lettre par lettre animee */
rep(
  "  var socHtml = nomSoc ? '<div style=\"margin-top:10px;font-size:clamp(15px,3.4vw,22px);font-weight:600;color:#bfdbfe;letter-spacing:1.5px;text-transform:uppercase\">' + escH(nomSoc) + '</div>' : '';",
  [
    "  var lettres = '';",
    "  for (var li = 0; li < nomSoc.length; li++) {",
    "    var chL = nomSoc.charAt(li);",
    "    lettres += '<span style=\"display:inline-block;opacity:0;animation:mdbLetIn .45s ease both ' + (0.9 + li * 0.15).toFixed(2) + 's\">' + (chL === ' ' ? '&nbsp;&nbsp;' : escH(chL)) + '</span>';",
    "  }",
    "  var socHtml = nomSoc ? '<div style=\"margin-top:14px;font-size:clamp(16px,3.8vw,26px);font-weight:700;color:#bfdbfe;letter-spacing:.45em;text-transform:uppercase;font-family:\\'Cinzel\\',Georgia,serif\">' + lettres + '</div>' : '';"
  ].join('\r\n'),
  'lettres societe'
);

/* 2) Logo arrondi (cercle avec liserat lumineux) */
rep(
  "  var logoHtml = ent.logo ? '<img src=\"' + ent.logo + '\" alt=\"\" style=\"max-height:110px;max-width:min(260px,60vw);object-fit:contain;margin-bottom:20px;filter:drop-shadow(0 6px 20px rgba(0,0,0,.45))\">' : '';",
  [
    "  var logoHtml = ent.logo ? '<div style=\"width:min(150px,38vw);height:min(150px,38vw);margin:0 auto 22px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.30);box-shadow:0 10px 40px rgba(37,99,235,.55)\"><img src=\"' + ent.logo + '\" alt=\"\" style=\"width:100%;height:100%;object-fit:cover;display:block\"></div>' : '';"
  ].join('\r\n'),
  'logo arrondi'
);

/* 3) Police elegante sur le titre */
rep(
  "    + '<div style=\"font-size:clamp(26px,7vw,52px);font-weight:800;color:#fff;letter-spacing:3px;text-transform:uppercase;animation:mdbPulseGlow 2.4s ease-in-out infinite\">Mon Tableau de Bord</div>'",
  "    + '<div style=\"font-family:\\'Cinzel\\',Georgia,serif;font-size:clamp(26px,7vw,52px);font-weight:700;color:#fff;letter-spacing:4px;text-transform:uppercase;animation:mdbPulseGlow 2.4s ease-in-out infinite\">Mon Tableau de Bord</div>'",
  'titre cinzel'
);

/* 4) Import police + keyframe des lettres */
rep(
  "  css.textContent = '@keyframes mdbBdIn{0%{opacity:0;transform:translateY(30px) scale(.96)}100%{opacity:1;transform:none}}'",
  [
    "  if (!document.getElementById('mdbFontCinzel')) {",
    "    var lk = document.createElement('link');",
    "    lk.id = 'mdbFontCinzel';",
    "    lk.rel = 'stylesheet';",
    "    lk.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap';",
    "    document.head.appendChild(lk);",
    "  }",
    "  css.textContent = '@keyframes mdbLetIn{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:none}}'",
    "    + '@keyframes mdbBdIn{0%{opacity:0;transform:translateY(30px) scale(.96)}100%{opacity:1;transform:none}}'"
  ].join('\r\n'),
  'police + keyframe'
);

fs.writeFileSync('public/index.html', u);
console.log('OK splash : lettres animees + Cinzel + logo rond');
