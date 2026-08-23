const fs = require('fs');
console.log('===== index.html : page Employes =====');
const L = fs.readFileSync('public/index.html', 'utf8').split(/\r?\n/);
L.forEach((l, i) => {
  if (/function renderEmployesPage|Nouvel employ|openEEmp|saveEEmp|fEE|modal.*employ|employForm/i.test(l)) {
    console.log((i + 1) + ': ' + l.trim().slice(0, 160));
  }
});
console.log('');
console.log('===== paye.html : boot / init / merge =====');
const P = fs.readFileSync('public/paye.html', 'utf8').split(/\r?\n/);
P.forEach((l, i) => {
  if (/DOMContentLoaded|function boot|function init\(|window.addEventListener\('load'|hasPaye|PAYE_KEY\] && typeof/.test(l)) {
    console.log((i + 1) + ': ' + l.trim().slice(0, 170));
  }
});
