const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== zone boutons deb/dette source ===');
var i = f.indexOf('debBtnActif');
console.log(f.slice(i - 1800, i + 1200));
console.log('\r\n=== setDashDebSource / setDashDetteSource ===');
['function setDashDebSource', 'function setDashDetteSource'].forEach(function(k) {
  var j = f.indexOf(k);
  if (j >= 0) console.log(f.slice(j, j + 1100));
});
