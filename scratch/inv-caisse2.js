const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
console.log('=== filterCaisse occurrences ===');
var i = -1;
while ((i = f.indexOf('filterCaisse', i + 1)) > 0) {
  const ls = f.lastIndexOf('\r\n', i) + 1;
  const le = f.indexOf('\r\n', i);
  console.log('L' + f.slice(0, i).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 170));
}
console.log('\r\n=== blAFacturer / AFacturer occurrences ===');
['blAFacturer', 'AFacturer'].forEach(function(k) {
  var j = -1;
  while ((j = f.indexOf(k, j + 1)) > 0) {
    const ls = f.lastIndexOf('\r\n', j) + 1;
    const le = f.indexOf('\r\n', j);
    console.log('L' + f.slice(0, j).split('\r\n').length + ':', f.slice(ls, le).trim().slice(0, 170));
  }
});
