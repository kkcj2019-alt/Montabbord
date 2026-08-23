const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function openLigneModalForRubrique');
console.log(f.slice(i, i + 3800));
console.log('\r\n=== save associe ===');
['function saveLigneForRubrique', 'function saveActifLigne', 'function quickAddActifLigne'].forEach(function(k) {
  var j = f.indexOf(k);
  if (j >= 0) console.log(f.slice(j, j + 1600));
});
