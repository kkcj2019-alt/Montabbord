const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
['function setDashDebSource', 'function setDashDetteSource', 'function setDashBlSource', 'function setDashStkSource', 'function setDashBlsSource', 'function escH(', 'function deptFoncCellI', 'function fmtFmt(', 'function calcAncienneteI'].forEach(function(k) {
  var i = f.indexOf(k);
  if (i < 0) { console.log('ABSENT:', k); return; }
  console.log('\r\n--- L' + f.slice(0, i).split('\r\n').length + ': ' + k + ' ---');
  if (k.indexOf('setDash') === 0 || k === 'function escH(') {
    var le = f.indexOf('\r\n}', i);
    console.log(f.slice(i, Math.min(le + 3, i + 700)));
  } else if (k === 'function deptFoncCellI') {
    var le2 = f.indexOf('\r\n}', i);
    console.log(f.slice(i, Math.min(le2 + 3, i + 900)));
  } else {
    const ls = f.lastIndexOf('\r\n', i) + 1;
    console.log(f.slice(ls, f.indexOf('\r\n', i)).slice(0, 200));
  }
});
