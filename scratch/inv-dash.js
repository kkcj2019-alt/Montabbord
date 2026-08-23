const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== Dashboard autour L5465 ===');
console.log(f.slice(f.indexOf('var blAFacturer = _rubByKey') - 2200, f.indexOf('var blAFacturer = _rubByKey') + 900));
