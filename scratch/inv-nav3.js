const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
const rStart = f.indexOf('var renderers = {');
const rEnd = f.indexOf('};', rStart);
const map = f.slice(rStart, rEnd);
["tiers", "clients", "articles", "stock", "facturation", "fournisseurs", "employes", "caisse"].forEach(function(k) {
  const re = new RegExp('\\b' + k + '\\s*:');
  console.log(k.padEnd(14), re.test(map) ? 'renderer OK' : 'ABSENT du map');
});
/* openCaisseModal existe ? */
console.log('openCaisseModal ->', f.indexOf('function openCaisseModal') > -1 ? 'OK' : 'ABSENT');
