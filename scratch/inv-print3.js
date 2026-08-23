const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function printActifWithSelection');
var seg = f.slice(i, i + 9000);
var k = seg.indexOf("window.print");
console.log(seg.slice(Math.max(0, k - 1200), k + 300));
