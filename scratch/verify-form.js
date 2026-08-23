const fs = require('fs');
let bad = 0;
for (const file of ['public/index.html', 'public/paye.html']) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html)) !== null) {
    if (/src\s*=/i.test(m[1]) || !m[2].trim()) continue;
    n++;
    try { new Function(m[2]); } catch (e) {
      bad++;
      console.error('ERREUR ' + file + ' bloc#' + n + ' : ' + e.message);
    }
  }
  console.log(file + ' : ' + n + ' blocs verifies');
}
const idx = fs.readFileSync('public/index.html', 'utf8');
['empTransOM','empTransMTN','empTransWave','empTransMoov'].forEach(function(id) {
  const c = idx.split(id).length - 1;
  if (c > 0) console.log('ATTENTION ' + id + ' encore present x' + c);
});
const paye = fs.readFileSync('public/paye.html', 'utf8');
['name="abreviation"','toggleSortieP','date_sortie'].forEach(function(id) {
  const c = paye.split(id).length - 1;
  console.log('paye ' + id + ' x' + c);
});
process.exit(bad ? 1 : 0);
