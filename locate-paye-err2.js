const fs = require('fs');
const acorn = require('C:\\Users\\ACSER DIRECTION\\Documents\\Default Project\\node_modules\\acorn\\dist\\acorn.js');
const html = fs.readFileSync('public/paye.html', 'utf8');
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
  blocks.push({ code: html.slice(pos, c), baseLine: html.slice(0, pos).split('\n').length });
  pos = c + 9;
}
console.log('blocs inline: ' + blocks.length);
const b = blocks[blocks.length - 1];
console.log('dernier bloc: commence ligne~' + b.baseLine + ', ' + b.code.length + ' car');
try {
  acorn.parse(b.code, { ecmaVersion: 'latest' });
  console.log('SYNTAXE OK');
} catch (e) {
  console.log('ERREUR: ' + e.message + ' (pos ' + e.pos + ')');
  const before = b.code.slice(0, e.pos).split('\n');
  const errLine = b.baseLine + before.length - 1;
  console.log('ligne fichier ~' + errLine);
  const fl = html.split('\n');
  for (let i = Math.max(0, errLine - 8); i < Math.min(fl.length, errLine + 4); i++) {
    console.log((i + 1) + ': ' + fl[i]);
  }
}
