const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
const rStart = f.indexOf('if (renderers[page])');
const mapStart = f.lastIndexOf('var renderers', rStart);
console.log('--- renderers map (extrait tresorerie) ---');
console.log(f.slice(mapStart, mapStart + 1400));
/* comment navigateTo resout les sous-pages */
const nIdx = f.indexOf('function navigateTo');
console.log('\r\n--- navigateTo ---');
console.log(f.slice(nIdx, nIdx + 900));
