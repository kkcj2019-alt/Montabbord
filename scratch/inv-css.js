const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('.sidebar {');
console.log(f.slice(i - 200, i + 5200));
