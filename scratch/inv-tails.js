const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
function tail(fnName, label) {
  var i = f.indexOf('function ' + fnName);
  if (i < 0) { console.log(label, ': INTROUVABLE'); return; }
  var k = f.indexOf('\r\nfunction ', i + 20);
  var seg = f.slice(i, k);
  console.log('=== ' + label + ' | fin (' + seg.length + 'c) derniers 500 ===');
  console.log(seg.slice(-500));
}
tail('renderEmployesPage', 'renderEmployesPage');
tail('renderDashboard', 'renderDashboard');
/* liste tab : filtre employes dans la page ? */
var li = f.indexOf("tab === 'liste'", f.indexOf('function renderEmployesPage'));
console.log('\r\n=== onglet liste (extrait 900) ===');
console.log(f.slice(li, li + 900));
