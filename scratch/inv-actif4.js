const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf("for (var di = 0; di < visibleDetails.length; di++) {\r\n      var d = visibleDetails[di];");
if (i < 0) i = f.indexOf('var montantVal = d.signe');
console.log(f.slice(i - 200, i + 4200));
