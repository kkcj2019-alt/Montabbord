const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== recherche caisse ===');
['caisse-search', 'caisseSearch', 'rechercheCaisse', 'filterCaisse'].forEach(function(k) {
  console.log(JSON.stringify(k), 'x', f.split(k).length - 1);
});
var i = f.indexOf('caisse-search');
if (i < 0) i = f.indexOf('caisseSearch');
if (i > 0) console.log(f.slice(Math.max(0, i - 300), i + 500));

console.log('\r\n=== BL a facturer ===');
['\u00e0 facturer', 'aFacturer', 'AFacturer', 'blAFacturer', '\u00e0 facturer'].forEach(function(k) {
  var c2 = f.split(k).length - 1;
  if (c2) console.log(JSON.stringify(k), 'x', c2);
});
