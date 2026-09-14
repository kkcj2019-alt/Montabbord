const cp = require('child_process');
const vm = require('vm');
function check(label, html) {
  let pos = 0, n = 0;
  while (true) {
    const o = html.indexOf('<script', pos);
    if (o < 0) break;
    const gt = html.indexOf('>', o);
    if (gt < 0) break;
    const tag = html.slice(o, gt + 1);
    pos = gt + 1;
    if (/\bsrc\b/i.test(tag)) continue;
    const c = html.indexOf('</scr' + 'ipt>', pos);
    if (c < 0) { console.log(label + ' bloc' + n + ' SANS FERMETURE'); break; }
    const code = html.slice(pos, c);
    const line0 = html.slice(0, pos).split('\n').length;
    try { new vm.Script(code, { filename: 'b' + n + '.js' }); console.log(label + ' bloc' + n + ' ligne~' + line0 + ' OK (' + code.length + ' car)'); }
    catch (e) { console.log(label + ' bloc' + n + ' ligne~' + line0 + ' ERREUR: ' + e.message); }
    n++;
    pos = c + 9;
  }
}
const revs = process.argv.slice(2);
for (const r of revs) {
  try {
    const html = cp.execSync('git show ' + r + ':public/paye.html', { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024 });
    check(r, html);
  } catch (e) { console.log(r + ': git show impossible'); }
}
