const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== occurrences BC actif / BC Actif ===');
var i = -1;
while ((i = f.toLowerCase().indexOf('bc actif', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 200));
}
console.log('\r\n=== montants dans printActifWithSelection ===');
i = f.indexOf('function printActifWithSelection');
var seg = f.slice(i, i + 11000);
['mtVal', '_pSign', "signe === '-'"].forEach(function(k) {
  var j = -1;
  while ((j = seg.indexOf(k, j + 1)) > 0) {
    const ls = seg.lastIndexOf('\r\n', j) + 1;
    const line = seg.slice(ls, seg.indexOf('\r\n', j)).trim();
    console.log('--', k, ':', line.slice(0, 190));
  }
});
