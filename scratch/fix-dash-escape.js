const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
const brk = '+ \'" onclick="closeSidebar();navigateTo(\'dashboard\')">\';';
const okS = '+ \'" onclick="closeSidebar();navigateTo(\\\'dashboard\\\')">\';';
const i = t.indexOf(brk);
if (i < 0) { console.error('INTROUVABLE: ligne cassee'); process.exit(1); }
t = t.slice(0, i) + okS + t.slice(i + brk.length);
fs.writeFileSync('public/index.html', t);
console.log('OK - echappement corrige');
