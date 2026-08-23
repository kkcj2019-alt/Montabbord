const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function openPrintActifModal');
console.log(f.slice(i, i + 3000));
console.log('\r\n=== appels ===');
var j = -1;
while ((j = f.indexOf('openPrintActifModal', j + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', j) + 1;
  const le = f.indexOf('\r\n', j);
  console.log('L' + f.slice(0, j).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 160));
}
