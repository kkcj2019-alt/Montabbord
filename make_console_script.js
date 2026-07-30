var fs = require('fs');
var data = JSON.parse(fs.readFileSync('C:/Users/ACSER DIRECTION/Downloads/backup-mdb-2026-07-28 (2).json', 'utf8'));

var keys = Object.keys(data).filter(function(k) { return k.indexOf('mdb_') === 0; });
var parts = [];
for (var i = 0; i < keys.length; i++) {
  var k = keys[i];
  var v = JSON.stringify(data[k]);
  parts.push('localStorage.setItem("' + k + '",' + v + ')');
}

var msg = 'OK: ' + parts.length + ' cles restaurees. Rechargez la page (F5) et connectez-vous.';
var script = '(function(){' + parts.join(';') + ';console.log("' + msg + '")})()';
fs.writeFileSync('D:/mon-tableau-de-bord/console_restore_script.txt', script, 'utf8');
console.log('Script length: ' + script.length + ' chars, ' + parts.length + ' keys');
