const fs = require('fs');
const idx = fs.readFileSync('public/index.html', 'utf8');
const paye = fs.readFileSync('public/paye.html', 'utf8');

console.log('===== PAYE : lignes loadPersonnel (suite) =====');
const lp = paye.indexOf("'<th>Anciennet");
console.log(paye.slice(lp, lp + 2600));

console.log('\r\n===== MAIN : rendu tableau employes =====');
['function loadEmployes', 'emp-tbody', 'employes-tbody', 'Liste des employ'].forEach(function(k) {
  const j = idx.indexOf(k);
  console.log(k, '->', j);
});
