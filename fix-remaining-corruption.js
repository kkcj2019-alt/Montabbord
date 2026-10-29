const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');
let count = 0;

function replaceAllSimple(str, search, replace) {
  // Use split/join which is safe and fast
  const parts = str.split(search);
  if (parts.length > 1) {
    count += parts.length - 1;
    console.log('FIXED (' + (parts.length-1) + 'x):', JSON.stringify(search).substring(0, 60));
  } else {
    console.log('NOT FOUND:', JSON.stringify(search).substring(0, 60));
  }
  return parts.join(replace);
}

const fixes = [
  // Statuts solde
  ["stLabel4 = 'Vers?';",            "stLabel4 = 'Vers\u00e9';"],
  ["stTitle4 = 'Solde de salaire vers?';", "stTitle4 = 'Solde de salaire vers\u00e9';"],
  // Statuts prêt remboursé
  ["stLabel4 = 'Rembours?';",        "stLabel4 = 'Rembours\u00e9';"],
  ["Toutes les ?ch?ances sont pr?lev?es", "Toutes les \u00e9ch\u00e9ances sont pr\u00e9lev\u00e9es"],
  [" mensualit?(s) d?pass?e(s) non pr?lev?e(s)", " mensualit\u00e9(s) d\u00e9pass\u00e9e(s) non pr\u00e9lev\u00e9e(s)"],
  ["stLabel4 = 'D? ce mois';",       "stLabel4 = 'D\u00fb ce mois';"],
  [" ? pr?lever sur ",               " \u00e0 pr\u00e9lever sur "],
  [" ?ch?ance(s)';",                 " \u00e9ch\u00e9ance(s)';"],
  ["'Rien ? verser ce mois'",        "'Rien \u00e0 verser ce mois'"],
  // Statuts acompte
  ["stLabel4 = 'D?duit sur salaire';",  "stLabel4 = 'D\u00e9duit sur salaire';"],
  ["stTitle4 = 'D?duit sur le bulletin';", "stTitle4 = 'D\u00e9duit sur le bulletin';"],
  ["stLabel4 = 'Valid? (? d?duire)';",  "stLabel4 = 'Valid\u00e9 (\u00e0 d\u00e9duire)';"],
  ["stTitle4 = 'Valid? : sera d?duit sur le bulletin';", "stTitle4 = 'Valid\u00e9 : sera d\u00e9duit sur le bulletin';"],
  ["stLabel4 = '? valider';",           "stLabel4 = '\u00c0 valider';"],
  // Cellule valide (colonne VALIDÉ)
  [">Vers?</span>",                  ">Vers\u00e9</span>"],
  ['b-ok\">? Valid?</span>',         'b-ok\">\u2714 Valid\u00e9</span>'],
  ['b-mute\">? valider</span>',      'b-mute\">\u00c0 valider</span>'],
  // Boutons Dévalider / Valider
  ["ne sera plus d?duit sur le bulletin\"",  "ne sera plus d\u00e9duit sur le bulletin\""],
  [">D?valider</button>",            ">D\u00e9valider</button>"],
  ["Valider : d?ductible sur le bulletin\"", "Valider : d\u00e9ductible sur le bulletin\""],
  // Revue des acomptes header
  ["Revue des acomptes &amp; pr?ts",  "Revue des acomptes &amp; pr\u00eats"],
];

for (const [search, replace] of fixes) {
  c = replaceAllSimple(c, search, replace);
}

// Fix cellule reste dû solde (le ? bizarre dans td)
const beforeSpecial = c;
c = c.split('<span class="muted">\ufffd? </span></td>').join('<span class="muted">\u2014</span></td>');
if (c !== beforeSpecial) { console.log('FIXED: ufffd special cell'); count++; }

fs.writeFileSync('public/index.html', c, 'utf8');
console.log('\nTotal replacements:', count);
