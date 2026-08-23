const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== renderStock (L20201) ===');
var i = f.indexOf('function renderStock');
console.log(f.slice(i, i + 4200));
