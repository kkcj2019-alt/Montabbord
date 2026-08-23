const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = -1;
console.log('=== affectations visibleDetails ===');
while ((i = f.indexOf('visibleDetails', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  const line = f.slice(ls, le);
  if (/visibleDetails\s*[:=]/.test(line)) console.log('L' + f.slice(0, i).split('\r\n').length + ':', line.trim().slice(0, 150));
}
console.log('\r\n=== fin computeActifData ===');
var c = f.indexOf('function computeActifData');
var e = f.indexOf('\r\nfunction ', c + 100);
var seg = f.slice(c, e);
console.log(seg.slice(Math.max(0, seg.length - 2200)));
