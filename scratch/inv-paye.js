const fs = require('fs');
const idx = fs.readFileSync('public/index.html', 'utf8');
const paye = fs.readFileSync('public/paye.html', 'utf8');

console.log('===== MAIN : bloc chargement cloud mdb_paye =====');
let i = idx.indexOf("if (key === 'mdb_paye')");
console.log(idx.slice(Math.max(0, i - 700), i + 500));

console.log('\r\n===== PAYE : setPayeSection / persistance =====');
['function setPayeSection', 'function getPayeSection', 'PAYE_KEY =', 'function saveCategories', 'function setCategories'].forEach(function(k) {
  const j = paye.indexOf(k);
  if (j >= 0) { console.log('--- ' + k); console.log(paye.slice(j, j + 600)); }
});

console.log('\r\n===== PAYE : entetes table personnel =====');
const h1 = paye.indexOf('<thead');
console.log(paye.slice(h1, h1 + 700));

console.log('\r\n===== PAYE : loadPersonnel lignes =====');
const lp = paye.indexOf('function loadPersonnel');
console.log(paye.slice(lp, lp + 2400));
