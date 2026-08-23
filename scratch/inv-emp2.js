const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('function saveEmploye');
var seg = f.slice(i, i + 9000);
/* occurrences de V( dans saveEmploye */
var j = -1;
console.log('=== V( dans saveEmploye ===');
while ((j = seg.indexOf('V(', j + 1)) > 0) {
  console.log('...' + seg.slice(Math.max(0, j - 70), j + 30).replace(/\r?\n/g, '\\n'));
}
/* fin de fonction : prochaine "function " */
var k = seg.indexOf('\r\nfunction ', 100);
console.log('\r\n=== fin saveEmploye (derniers 600c) ===');
console.log(seg.slice(k - 600, k));
console.log('\r\n=== renderEmployesPage structure ===');
var r = f.indexOf('function renderEmployesPage');
var rs = f.slice(r, r + 2600);
console.log(rs);
