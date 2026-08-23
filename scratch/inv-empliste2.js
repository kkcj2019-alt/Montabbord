const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var r = f.indexOf('function renderEmployesPage');
var li = f.indexOf("var list = employes.slice();", r);
console.log(f.slice(li, li + 3600));
