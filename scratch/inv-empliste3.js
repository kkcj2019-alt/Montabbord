const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var r = f.indexOf('function renderEmployesPage');
var li = f.indexOf("var members = list.filter", r);
console.log(f.slice(li, li + 3400));
