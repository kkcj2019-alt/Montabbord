const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var lines = f.split('\r\n');
console.log('=== dashboard autour BC actifs L5150-5270 ===');
for (var i = 5149; i < 5270 && i < lines.length; i++) console.log((i + 1) + ':', lines[i].slice(0, 200));
