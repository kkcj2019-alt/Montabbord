const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf("var mtVal = vals[iMt]");
console.log(f.slice(i - 3000, i + 200));
