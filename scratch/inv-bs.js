const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function buildSidebar');
console.log(f.slice(i, i + 5200));
