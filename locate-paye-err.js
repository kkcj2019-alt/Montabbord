const fs = require('fs');
const acorn = require('C:\\Users\\ACSER DIRECTION\\Documents\\Default Project\\node_modules\\acorn\\dist\\acorn.js');
const html = fs.readFileSync('public/paye.html', 'utf8');
let startTag = -1, p = 0;
while (true) {
  const o = html.indexOf('<script', p);
  if (o < 0) break;
  const gt = html.indexOf('>', o);
  const tag = html.slice(o, gt + 1);
  p = gt + 1;
  if (/\bsrc\b/i.test(tag)) continue;
  startTag = o;
}
const codeStart = html.indexOf('>', startTag) + 1;
const codeEnd = html.lastIndexOf('</scr' + 'ipt>');
const code = html.slice(codeStart, codeEnd);
const baseLine = html.slice(0, codeStart).split('\n').length;
console.log('bloc: octets=' + code.length + ' commence ligne~' + baseLine);
try {
  acorn.parse(code, { ecmaVersion: 'latest' });
  console.log('SYNTAXE OK');
} catch (e) {
  console.log('ERREUR: ' + e.message + ' (pos ' + e.pos + ')');
  const lines = code.slice(0, e.pos).split('\n');
  const errLine = baseLine + lines.length - 1;
  console.log('ligne fichier ~' + errLine);
  const fl = html.split('\n');
  for (let i = Math.max(0, errLine - 6); i < Math.min(fl.length, errLine + 3); i++) {
    console.log((i + 1) + ': ' + fl[i]);
  }
}
