const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i0 = f.indexOf("data-sub=\"dashboard.actif\"");
console.log(f.slice(i0, i0 + 5200));
