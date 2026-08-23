const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function saveStock');
console.log(f.slice(i, i + 900));
console.log('\r\n=== filterTable def ===');
i = f.indexOf('function filterTable');
console.log(f.slice(i, i + 600));
