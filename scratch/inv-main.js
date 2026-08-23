const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
['setMain(', "getMain('", "mdb_paye", "applyCloudSnapshot", "startRealtimeSync"].forEach(function(k) {
  console.log(JSON.stringify(k), 'x', f.split(k).length - 1);
});
console.log('--- appels setMain ---');
let i = -1;
while ((i = f.indexOf("setMain(", i + 1)) > 0) {
  const line = f.slice(i, i + 100).split('\n')[0];
  console.log(line.slice(0, 95));
}
console.log('--- lectures getPayeSectionI / ecritures paye cote main ---');
let j = -1;
while ((j = f.indexOf("getPayeSectionI(", j + 1)) > 0) {
  console.log(f.slice(j, j + 60).split('\r\n')[0]);
}
