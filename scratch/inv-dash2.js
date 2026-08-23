const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== occurrences reel/actif/affaire ===');
['r\u00e9el', 'r\u00e9elle', 'Solde Client', 'soldeClient', 'affaire', 'Affaire'].forEach(function(k) {
  var i = -1, c2 = 0;
  while ((i = f.indexOf(k, i + 1)) > 0 && c2 < 14) {
    const ls = f.lastIndexOf('\r\n', i) + 1;
    const le = f.indexOf('\r\n', i);
    const line = f.slice(ls, le).trim();
    if (/dashboard|render|stat|rubrique|actif|bl/i.test(line)) { console.log('L' + f.slice(0, i).split('\r\n').length + ':', line.slice(0, 165)); c2++; }
  }
});
