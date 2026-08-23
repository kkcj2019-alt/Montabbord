const fs = require('fs');
const t = fs.readFileSync('public/index.html', 'utf8');
try {
  [...t.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].forEach(x => new Function(x[1]));
  console.log('SYNTAXE OK');
} catch (e) { console.log('ERREUR: ' + e.message); }
console.log('_bc2=' + t.indexOf('_bc2') + ' _bc3=' + t.indexOf('_bc3') + ' _bc4=' + t.indexOf('_bc4'));
console.log('toggleActifDetail intact: ' + (t.indexOf('function toggleActifDetail(id)') >= 0));
console.log('par-section: ' + (t.indexOf('sec._mtCol') >= 0));
