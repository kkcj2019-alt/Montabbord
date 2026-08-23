const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('var pageLabels = {');
console.log(f.slice(i, i + 900));
console.log('\r\n=== MODULES def ===');
i = f.indexOf('MODULES = [');
if (i < 0) i = f.indexOf('var MODULES');
console.log(f.slice(i, i + 1400));
