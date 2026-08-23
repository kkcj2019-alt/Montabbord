const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function openPrintActifModal');
console.log(f.slice(i + 3000, i + 6200));
