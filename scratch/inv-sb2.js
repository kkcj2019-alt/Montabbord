const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== data-search dans buildSidebar ===');
var i = f.indexOf('function buildSidebar');
var seg = f.slice(i, i + 6000);
var k = seg.indexOf('data-search');
console.log(seg.slice(Math.max(0, k - 500), k + 300));
console.log('\r\n=== menuSearch input ===');
i = f.indexOf("id=\"menuSearch\"");
var ls = f.lastIndexOf('\r\n', i) + 1;
console.log(f.slice(ls, f.indexOf('\r\n', i)).trim());
console.log('\r\n=== onglets : occurrences Journal ===');
['Journal des ventes', 'journalVentes', 'data-tab', 'switchTab', 'onglet'].forEach(function(kk) {
  var j = -1, c2 = 0;
  while ((j = f.indexOf(kk, j + 1)) > 0 && c2 < 8) {
    const ls2 = f.lastIndexOf('\r\n', j) + 1;
    const line = f.slice(ls2, f.indexOf('\r\n', j)).trim();
    if (/render|html|tab|onglet/i.test(line)) { console.log('L' + f.slice(0, j).split('\r\n').length + ':', line.slice(0, 150)); c2++; }
  }
});
