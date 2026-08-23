const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
/* chercher la structure navGroups : items et labels */
var i = f.indexOf('navGroups = [');
if (i < 0) i = f.indexOf('var navGroups');
console.log(f.slice(i, i + 3500));
