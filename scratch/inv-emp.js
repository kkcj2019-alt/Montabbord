const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== function V( existante ? ===');
console.log('function V( x', f.split('function V(').length - 1);
var i = f.indexOf('function saveEmploye');
console.log('\r\n=== saveEmploye extrait (usages de V) ===');
var seg = f.slice(i, i + 3000);
console.log(seg.slice(0, 1800));
console.log('\r\n=== recherche employes ===');
['empSearch', 'filterEmployes', 'renderTiersEmployes'].forEach(function(k) {
  var j = -1, c2 = 0;
  while ((j = f.indexOf(k, j + 1)) > 0 && c2 < 10) {
    const ls = f.lastIndexOf('\r\n', j) + 1;
    const le = f.indexOf('\r\n', j);
    const line = f.slice(ls, le).trim();
    console.log(k, '| L' + f.slice(0, j).split('\r\n').length + ':', line.slice(0, 140));
    c2++;
  }
});
