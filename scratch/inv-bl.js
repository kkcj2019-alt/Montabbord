const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function _saveBlFactLigne');
console.log(f.slice(i, i + 2400));
