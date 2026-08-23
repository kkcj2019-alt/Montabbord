const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== soldeReel occurrences avec contexte ===');
var i = -1;
while ((i = f.indexOf('soldeReel', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 180));
}
console.log('\r\n=== Solde actif occurrences ===');
i = -1;
while ((i = f.indexOf('Solde actif', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 200));
}
/* contexte calcul blTotal dans actif (L11189) */
console.log('\r\n=== calcul blTotal actif ===');
var j = f.indexOf("blDetails", f.indexOf('{key:\'bl_facturer\'') - 3000);
console.log(f.slice(f.indexOf('{key:\'bl_facturer\'') - 2600, f.indexOf('{key:\'bl_facturer\'') + 400));
