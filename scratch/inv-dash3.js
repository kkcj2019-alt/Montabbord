const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== stat cards dashboard autour 5496 ===');
var i5 = f.indexOf("html += '<div class=\"stat-card\"><div class=\"stat-info\"><div class=\"stat-value\" style=\"color:var(--primary)\">' + fmtMoney(blAFacturer)");
console.log(f.slice(i5 - 1500, i5 + 700));
