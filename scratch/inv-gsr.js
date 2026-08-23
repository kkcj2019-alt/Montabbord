const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== globalGoOpCaisse def ===');
var i = f.indexOf('function globalGoOpCaisse');
console.log(i >= 0 ? f.slice(i, i + 700) : '(absent)');
console.log('\r\n=== indexation ops caisse dans recherche globale ===');
i = -1;
while ((i = f.indexOf('globalGoOpCaisse', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 220));
}
