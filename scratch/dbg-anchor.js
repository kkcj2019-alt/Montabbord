const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var tests = {
  A: "      var montantVal = d.signe === '-' ? -Math.abs(d.montant) : Math.abs(d.montant);",
  B: "      var montantSigne = d.signe === '-' ? '- ' : '+';"
};
Object.keys(tests).forEach(function(k) { console.log(k, 'x', f.split(tests[k]).length - 1); });
/* variante sans espaces de tete */
console.log('B2 x', f.split("var montantSigne = d.signe === '-' ? '- ' : '+';").length - 1);
