const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// 1. Corriger les attributs value static dans HTML pour input type="number"
html = html.replace('id="config-cnps-ret-sal" step="0.01" value="6,30"', 'id="config-cnps-ret-sal" step="0.01" value="6.3"');
html = html.replace('id="config-cnps-ret-pat" step="0.01" value="7,70"', 'id="config-cnps-ret-pat" step="0.01" value="7.7"');
html = html.replace('id="config-cnps-fam-pat" step="0.01" value="5,00"', 'id="config-cnps-fam-pat" step="0.01" value="5.0"');
html = html.replace('id="config-cnps-mat-pat" step="0.01" value="0,75"', 'id="config-cnps-mat-pat" step="0.01" value="0.75"');
html = html.replace('id="config-cnps-at-pat" step="0.01" value="2,00"', 'id="config-cnps-at-pat" step="0.01" value="2.0"');
html = html.replace('id="config-cnps-fdfp-app" step="0.01" value="0,40"', 'id="config-cnps-fdfp-app" step="0.01" value="0.4"');
html = html.replace('id="config-cnps-fdfp-form" step="0.01" value="0,60"', 'id="config-cnps-fdfp-form" step="0.01" value="0.6"');

// 2. Corriger loadItsScale() pour qu'il assigne un nombre valide (avec point) dans input type="number"
const oldLoadJS = `    if (el) el.value = ((parseFloat(val) || 0) * 100).toFixed(2).replace('.', ',');`;
const newLoadJS = `    if (el) el.value = ((parseFloat(val) || 0) * 100).toFixed(2);`;

const oldRateValJS = `    var rateVal = ((parseFloat(b.rate) || 0) * 100).toFixed(1).replace('.', ',');`;
const newRateValJS = `    var rateVal = ((parseFloat(b.rate) || 0) * 100).toFixed(1);`;

html = html.replace(oldLoadJS, newLoadJS);
html = html.replace(oldRateValJS, newRateValJS);

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Fixed input type="number" values format!');
