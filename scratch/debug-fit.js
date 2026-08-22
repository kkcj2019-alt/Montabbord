const fs = require('fs');
const t = fs.readFileSync('public/index.html', 'utf8');
console.log('Auto-ajustement idx:', t.indexOf('Auto-ajustement'));
const marker = "printHtml += '</body></html>';";
console.log('/body/html idx:', t.indexOf(marker));
const i = t.indexOf('Auto');
if (i >= 0) console.log(JSON.stringify(t.substring(i - 60, i + 100)));
