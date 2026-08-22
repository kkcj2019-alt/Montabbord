const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');

/* 1) supprimer le zoom une-seule-page du PRINT ACTIF uniquement */
const a = t.indexOf('/* Auto-ajustement');
const marker = "printHtml += '</body></html>';";
const b = t.indexOf(marker, a);
if (a < 0 || b < 0) { console.error('marqueurs fit introuvables'); process.exit(1); }
const fitReplacement = [
  "  /* Impression naturelle multi-pages A4 : lignes espacees et lisibles */",
  "  printHtml += '<script>window.addEventListener(\"load\",function(){setTimeout(function(){window.print();},250);});<\\/script>';",
  "  "
].join('\r\n');
t = t.slice(0, a) + fitReplacement + t.slice(b);

/* 2) total de rubrique plus imposant (16.5px) */
{
  const anchor = "font-size:13.5px;color:' + (_totNegP";
  if (t.indexOf(anchor) < 0) { console.error('span total introuvable'); process.exit(1); }
  t = t.replace(anchor, "font-size:16.5px;color:' + (_totNegP");
}

/* 3) sous-libelles un peu plus lisibles dans les lignes imprimees */
{
  const oldSub = '<br><span style="font-size:9px;color:#777">';
  const newSub = '<br><span style="font-size:10px;color:#667;display:inline-block;margin-top:2px">';
  if (t.indexOf(oldSub) < 0) { console.error('sous-libelle introuvable'); process.exit(1); }
  t = t.replace(oldSub, newSub);
}

fs.writeFileSync('public/index.html', t);
console.log('impression OK');
