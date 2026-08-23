const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = -1;
console.log('=== definitions de sous-onglets ===');
while ((i = f.indexOf('subTabs', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  const line = f.slice(ls, le).trim();
  if (/=\s*\[/.test(line)) console.log('L' + f.slice(0, i).split('\r\n').length + ':', line.slice(0, 240));
}
