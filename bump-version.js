const fs = require('fs');
let c = fs.readFileSync('public/index.html', 'utf8');
c = c.split("APP_VERSION='2026-10-29-320'").join("APP_VERSION='2026-10-29-321'");
fs.writeFileSync('public/index.html', c, 'utf8');
console.log('version bumped to 321');
