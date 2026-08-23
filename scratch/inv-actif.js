const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = -1;
console.log('=== bl_facturer occurrences ===');
while ((i = f.indexOf("bl_facturer", i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 175));
}
console.log('\r\n=== recherche mode reel/actif dans actif ===');
["'REEL'", '"REEL"', "'ACTIF'", '_modeReel', 'modeAffaire', 'affaireMode', 'soldeReel', 'Solde r\u00e9el', 'Solde actif', 'BL r\u00e9els', 'BL actifs'].forEach(function(k) {
  var c2 = f.split(k).length - 1;
  if (c2) console.log(JSON.stringify(k), 'x', c2);
});
