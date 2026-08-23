const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
const k = f.indexOf("escH(p.matricule) + '</td><td><strong>'");
console.log('k =', k);
if (k > 0) console.log(JSON.stringify(f.slice(k - 140, k + 340)));
