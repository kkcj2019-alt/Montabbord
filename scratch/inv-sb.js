const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== zone L3430-3520 (filtre sidebar) ===');
var lines = f.split('\r\n');
for (var i = 3425; i < 3530 && i < lines.length; i++) console.log((i + 1) + ':', lines[i].slice(0, 165));
