const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== contexte indexation L16900 ===');
var i = f.indexOf("addRes('opcaisse'");
var st = f.lastIndexOf('for', i - 400);
console.log(f.slice(i - 900, i + 300));
console.log('\r\n=== filterCaisseOps body ===');
i = f.indexOf('function filterCaisseOps');
console.log(f.slice(i, i + 1400));
