const fs = require('fs');

console.log('===== paye.html =====');
const p = fs.readFileSync('public/paye.html', 'utf8').split(/\r?\n/);
p.forEach((l, i) => {
  if (/loadCategories\(\)|emp-categorie|emp-nom|emp-prenom|prenom|function saveEmploye|function renderEmployes|id="emp-/.test(l)) {
    console.log((i + 1) + ': ' + l.trim().slice(0, 150));
  }
});

console.log('');
console.log('===== index.html employes =====');
const t = fs.readFileSync('public/index.html', 'utf8').split(/\r?\n/);
t.forEach((l, i) => {
  if (/openEmpModal|fENom|fEPrenom|fECategorie|Nom complet|renderEmployes|function saveEmp|employes.*modal/i.test(l)) {
    console.log((i + 1) + ': ' + l.trim().slice(0, 160));
  }
});
