const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== renderBLAFacturer ===');
const r = f.indexOf('function renderBLAFacturer');
console.log(f.slice(r, r + 3200));
