const fs = require('fs');
let nRep = 0;
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
  nRep++;
}
/* Splash : ecritures dorees foncees sur fond blanc */
rep('color:#94a3b8">Bonjour</div>', 'color:#b8860b">Bonjour</div>', 'bonjour or');
rep('color:#475569">Bienvenue sur le tableau de bord', 'color:#8a6d1f">Bienvenue sur le tableau de bord', 'bienvenue or');
rep("font-family:\\'Cinzel\\',Georgia,serif;color:#1e293b\">' + lettres + '</div>",
    "font-family:\\'Cinzel\\',Georgia,serif;color:#7a5f14\">' + lettres + '</div>",
    'societe or');
rep('_stopsU = (window._mdbLogoCols && window._mdbLogoCols.length >= 2) ? window._mdbLogoCols.slice() : [{ r: 37, g: 99, b: 235 }, { r: 124, g: 58, b: 237 }, { r: 219, g: 39, b: 119 }];',
    '_stopsU = (window._mdbLogoCols && window._mdbLogoCols.length >= 2) ? window._mdbLogoCols.slice() : [{ r: 212, g: 175, b: 55 }, { r: 138, g: 103, b: 20 }, { r: 90, g: 68, b: 10 }];',
    'degrade or par defaut');
rep('height:5px;width:min(380px,80vw);background:rgba(15,23,42,.10)',
    'height:5px;width:min(380px,80vw);background:rgba(180,150,40,.18)',
    'piste barre or');
rep('<div style="height:100%;background:linear-gradient(90deg,#38bdf8,#a78bfa,#f472b6);border-radius:99px;animation:mdbBarFill',
    '<div style="height:100%;background:linear-gradient(90deg,#d4af37,#b8860b,#8a6d1f);border-radius:99px;animation:mdbBarFill',
    'remplissage or');
rep('text-shadow:0 4px 22px rgba(15,23,42,.16)', 'text-shadow:0 4px 22px rgba(138,103,20,.28)', 'halo or');
fs.writeFileSync('public/index.html', t);
console.log('OK splash or - ' + nRep + ' remplacements');
