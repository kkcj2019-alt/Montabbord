const cp = require('child_process');
const vm = require('vm');
function bigBlock(html) {
  const blocks = [];
  let pos = 0;
  while (true) {
    const o = html.indexOf('<script', pos);
    if (o < 0) break;
    const gt = html.indexOf('>', o);
    if (gt < 0) break;
    const tag = html.slice(o, gt + 1);
    pos = gt + 1;
    if (/\bsrc\b/i.test(tag)) continue;
    const c = html.indexOf('</scr' + 'ipt>', pos);
    if (c < 0) break;
    blocks.push(html.slice(pos, c));
    pos = c + 9;
  }
  return blocks[blocks.length - 1];
}
const revs = cp.execSync('git log --format=%H -- public/paye.html', { encoding: 'utf8' }).split('\n').filter(Boolean).slice(0, 12);
for (const r of revs) {
  try {
    const html = cp.execSync('git show ' + r + ':public/paye.html', { encoding: 'utf8', maxBuffer: 60 * 1024 * 1024 });
    const code = bigBlock(html);
    const msg = cp.execSync('git log -1 --format=%s ' + r, { encoding: 'utf8' }).trim();
    try { new vm.Script(code); console.log('OK      ' + r.slice(0, 7) + ' ' + msg); }
    catch (e) { console.log('CASSE   ' + r.slice(0, 7) + ' ' + msg + '  [' + e.message + ']'); }
  } catch (e) { console.log('SKIP ' + r); }
}
