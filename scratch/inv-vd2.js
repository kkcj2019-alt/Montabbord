const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== _getActifRubriqueFlags def ===');
var i = f.indexOf('function _getActifRubriqueFlags');
console.log(f.slice(i, i + 900));
console.log('\r\n=== construction visibleDetailsD (debut) ===');
var j = f.indexOf('visibleDetailsD', f.indexOf('function computeActifData'));
console.log(f.slice(j - 1500, j + 800));
