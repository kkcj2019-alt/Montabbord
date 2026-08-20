const fs = require('fs');
let content = fs.readFileSync('public/paye.html', 'utf8');

content = content.replace(/├®/g, 'é');
content = content.replace(/├┤/g, 'ô');
content = content.replace(/├¬/g, 'ê');
content = content.replace(/├Ç/g, 'À');
content = content.replace(/N┬░/g, 'N°');
content = content.replace(/├®/g, 'é'); // in case there are others

// Also check if any of the replace logic failed in my previous script because of the garbled text:
// My previous script was:
// calcFunc.replace("items.push({ n: '61', label: 'CNPS, Régime de Retraite'...
// BUT because `Régime` was actually `R├®gime` in `orig_paye.html`, the replace FAILED!
// So lines 61, 51, 52 didn't get their tauxPat added! Let me add them here.

content = content.replace(
  "items.push({ n: '61', label: 'CNPS, Régime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal });",
  "items.push({ n: '61', label: 'CNPS, Régime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal, tauxPat: '7,70', retPat: Math.floor(baseRet * 0.077) });"
);

content = content.replace(
  "items.push({ n: '51', label: 'Impôt brut mensuel (ITS)', base: brutFiscal, taux: '', gain: 0, ret: itsBrut });",
  "items.push({ n: '60', label: 'Impôt brut', base: brutFiscal, taux: '', gain: 0, ret: itsBrut, tauxPat: '1,20', retPat: Math.floor(brutFiscal * 0.012) });"
);

content = content.replace(
  "items.push({ n: '52', label: 'Reduc. Charges Fam. (RICF)', base: getRICF(parts), taux: parts.toFixed(1) + ' P.', gain: 0, ret: -ricf });",
  "items.push({ n: '65', label: 'Reduc. Charges Fam. (RICF)', base: getRICF(parts), taux: parts.toFixed(1) + ' P.', gain: 0, ret: -ricf, tauxPat: '', retPat: 0 });"
);

content = content.replace(
  "items.push({ n: '', label: 'CMU (Part Salariale)', base: cmuCount * 1000, taux: '', gain: 0, ret: cmuCount * 500 });",
  "items.push({ n: '72', label: 'CMU', base: cmuCount * 1000, taux: '', gain: 0, ret: cmuCount * 500, tauxPat: '', retPat: cmuCount * 500 });"
);

fs.writeFileSync('public/paye.html', content, 'utf8');
console.log('Fixed encoding and logic');
