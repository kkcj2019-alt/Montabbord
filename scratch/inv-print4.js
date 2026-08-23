const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function printActifWithSelection');
var end = f.indexOf('\r\nfunction ', i + 100);
var seg = f.slice(i, end);
console.log('LONGUEUR:', seg.length);
/* dernier quart */
console.log(seg.slice(seg.length - 1800));
