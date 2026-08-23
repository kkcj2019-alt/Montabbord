const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf('var rubTotal = rub.rubTotal;');
console.log(f.slice(i - 1500, i + 3000));
