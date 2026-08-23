const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var r = f.indexOf('function renderEmployesPage');
var li = f.indexOf("tab === 'liste'", r);
var seg = f.slice(li, li + 4200);
console.log(seg);
