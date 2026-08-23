const fs = require('fs');
const idx = fs.readFileSync('public/index.html', 'utf8');
const paye = fs.readFileSync('public/paye.html', 'utf8');

console.log('=== PAYE applyCloudSnapshot garde ===');
var g = paye.indexOf('_inc.categories=_cc');
if (g < 0) g = paye.indexOf('_inc.categories');
console.log(paye.slice(Math.max(0, g - 500), g + 700));

console.log('\r\n=== MAIN printEmployes / exportEmployesCSV entetes ===');
['function printEmployes', 'function exportEmployesCSV'].forEach(function(k) {
  var j = idx.indexOf(k);
  if (j >= 0) console.log('--- ' + k + '\r\n' + idx.slice(j, j + 900));
});

console.log('\r\n=== MAIN boot/init ===');
['function initData(', 'DOMContentLoaded', 'function boot(', 'window.onload', 'function initApp'].forEach(function(k) {
  var j = idx.indexOf(k);
  console.log(k, '->', j);
});
