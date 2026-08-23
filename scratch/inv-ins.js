const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
var i = f.indexOf("id=\"actifDashSearch\"");
var st = f.lastIndexOf('html +=', i - 400);
console.log(f.slice(i - 700, i + 2600));
