const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== renderStock / table articles ===');
var i = -1;
while ((i = f.indexOf('function renderStock', i + 1)) > 0) console.log('L' + f.slice(0, i).split('\r\n').length);
['openArticleModal', 'editArticle', 'saveArticle', 'stockBody', 'renderArticles'].forEach(function(k) {
  var c2 = f.split(k).length - 1;
  if (c2) console.log(k, 'x', c2);
});
console.log('\r\n=== rubTotal assignations ===');
i = -1;
var cnt = 0;
while ((i = f.indexOf('rubTotal', i + 1)) > 0 && cnt < 20) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  const line = f.slice(ls, le).trim();
  if (/rubTotal\s*[:=]/.test(line)) { console.log('L' + f.slice(0, i).split('\r\n').length + ':', line.slice(0, 170)); cnt++; }
}
