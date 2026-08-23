const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
const nIdx = f.indexOf('function navigateTo');
console.log(f.slice(nIdx + 900, nIdx + 3400));
