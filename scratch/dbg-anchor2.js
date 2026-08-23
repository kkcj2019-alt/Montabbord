const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('var montantSigne');
var seg = f.slice(i, i + 48);
console.log('fichier :', JSON.stringify(seg), 'len', seg.length);
var b2 = "var montantSigne = d.signe === '-' ? '- ' : '+';";
console.log('aiguille:', JSON.stringify(b2), 'len', b2.length);
for (var k = 0; k < Math.min(seg.length, b2.length); k++) {
  if (seg[k] !== b2[k]) { console.log('1er ecart pos', k, ':', seg.charCodeAt(k).toString(16), 'vs', b2.charCodeAt(k).toString(16)); break; }
}
