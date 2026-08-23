const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* 1) Module Paye : nouvel onglet fiable sur mobile via clic d'ancre target=_blank */
rep(
  [
    "function openPayeModule() {",
    "  var w = window.open('paye.html', '_blank');",
    "  if (!w || w.closed || typeof w.closed === 'undefined') {",
    "    var a = document.createElement('a');",
    "    a.href = 'paye.html';",
    "    a.target = '_blank';",
    "    a.rel = 'noopener';",
    "    a.textContent = 'Ouvrir Module Paye';",
    "    a.style.cssText = 'display:block;margin:40px auto;padding:20px 40px;font-size:18px;background:var(--primary);color:#fff;border-radius:8px;text-align:center;text-decoration:none;width:fit-content';",
    "    document.getElementById('content').innerHTML = '<div style=\"text-align:center;padding:40px\"><h2>Module Traitement Salaire</h2><p style=\"color:var(--dim);margin:16px 0\">Sur mobile, appuyez longuement ci-dessous et choisissez \"Ouvrir dans un nouvel onglet\"</p><a href=\"paye.html\" target=\"_blank\" rel=\"noopener\" style=\"display:inline-block;padding:16px 32px;font-size:16px;background:var(--primary);color:#fff;border-radius:8px;text-decoration:none;font-weight:700\">Ouvrir Module Paye</a></div>';",
    "  }",
    "}"
  ].join('\r\n'),
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
  'openPayeModule'
);

/* 2) Dettes fournisseurs : tri par montant signe croissant (dus les plus eleves en premier) */
rep(
  "      visibleDetailsD = _flatD;\r\n    }\r\n    var rubTotalD = 0;",
  [
    "      visibleDetailsD = _flatD;",
    "    }",
    "    if (rubD.key === 'dette_fournisseur') {",
    "      /* En premier les fournisseurs a qui l'on doit le plus : du negatif le plus eleve vers le positif */",
    "      visibleDetailsD.sort(function(aX, bX) {",
    "        var va = (aX.signe === '-' ? -Math.abs(aX.montant || 0) : Math.abs(aX.montant || 0));",
    "        var vb = (bX.signe === '-' ? -Math.abs(bX.montant || 0) : Math.abs(bX.montant || 0));",
    "        return va - vb;",
    "      });",
    "    }",
    "    var rubTotalD = 0;"
  ].join('\r\n'),
  'tri dettes fournisseurs'
);

fs.writeFileSync('public/index.html', t);
console.log('OK paye onglet + tri dettes');
