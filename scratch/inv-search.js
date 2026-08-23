const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');

console.log('=== Page non trouvee ===');
const p1 = f.indexOf('Page non trouv');
console.log(f.slice(Math.max(0, p1 - 600), p1 + 200));

console.log('\r\n=== globalSearch occurrences (lignes) ===');
let i = -1;
while ((i = f.indexOf('globalSearch', i + 1)) > 0) {
  const ls = f.lastIndexOf('\n', i) + 1;
  const le = f.indexOf('\n', i);
  console.log('L' + f.slice(0, i).split('\n').length + ':', f.slice(ls, le).trim().slice(0, 150));
}
