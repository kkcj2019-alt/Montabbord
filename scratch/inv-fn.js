const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('renderDashboard defs :', f.split('function renderDashboard').length - 1);
var i = f.indexOf('id="actifDashSearch"');
var seg = f.slice(0, i);
var lastFn = 0, names = [];
var re = /function\s+([A-Za-z0-9_]+)\s*\(/g, m;
while ((m = re.exec(seg)) !== null) { lastFn = m.index; var nm = m[1]; }
/* trouver la fonction englobante la plus proche avant le bloc */
var before = seg.slice(Math.max(0, i - 60000));
var last = null;
var re2 = /\r\n  function ([A-Za-z0-9_]+)|\r\nfunction ([A-Za-z0-9_]+)/g, m2;
while ((m2 = re2.exec(before)) !== null) last = m2[1] || m2[2];
console.log('fonction englobante probable :', last);
/* toutes les definitions de fonctions contenant data-sub dashboard */
var j = -1;
while ((j = f.indexOf('dashboard.actif', j + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', j) + 1;
  console.log('dashboard.actif a L' + f.slice(0, j).split('\r\n').length);
}
