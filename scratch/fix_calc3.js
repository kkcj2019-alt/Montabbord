const fs = require('fs');
let orig = fs.readFileSync('orig_paye.html', 'utf8');
let cur = fs.readFileSync('public/paye.html', 'utf8');

// Extract calculatePayroll from orig
let startStr = 'function calculatePayroll(emp, mois) {';
let endStr = '/* ==================== BULLETIN ==================== */';

let startIndex = orig.indexOf(startStr);
let endIndex = orig.indexOf(endStr);
let calcFunc = orig.substring(startIndex, endIndex);

// Correctly apply the replacements for the patronal logic
calcFunc = calcFunc.replace(
  "items.push({ n: '61', label: 'CNPS, R├®gime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal });",
  "items.push({ n: '61', label: 'CNPS, Régime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal, tauxPat: '7,70', retPat: Math.floor(baseRet * 0.077) });"
);

calcFunc = calcFunc.replace(
  "items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0 });",
  "items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '2,00', retPat: Math.floor(baseATPF * 0.02) });"
);

calcFunc = calcFunc.replace(
  "items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0 });",
  "items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '5,75', retPat: Math.floor(baseATPF * 0.0575) });"
);

calcFunc = calcFunc.replace(
  "items.push({ n: '51', label: 'Imp├┤t brut mensuel (ITS)', base: brutFiscal, taux: '', gain: 0, ret: itsBrut });",
  "items.push({ n: '60', label: 'Impôt brut', base: brutFiscal, taux: '', gain: 0, ret: itsBrut, tauxPat: '1,20', retPat: Math.floor(brutFiscal * 0.012) });"
);

calcFunc = calcFunc.replace(
  "items.push({ n: '52', label: 'Reduc. Charges Fam. (RICF)', base: getRICF(parts), taux: parts.toFixed(1) + ' P.', gain: 0, ret: -ricf });",
  "items.push({ n: '65', label: 'Reduc. Charges Fam. (RICF)', base: getRICF(parts), taux: parts.toFixed(1) + ' P.', gain: 0, ret: -ricf, tauxPat: '', retPat: 0 });"
);

calcFunc = calcFunc.replace(
  "items.push({ n: '', label: 'CMU (Part Salariale)', base: cmuCount * 1000, taux: '', gain: 0, ret: cmuCount * 500 });",
  "items.push({ n: '72', label: 'CMU', base: cmuCount * 1000, taux: '', gain: 0, ret: cmuCount * 500, tauxPat: '', retPat: cmuCount * 500 });"
);

// We also need to fix any other encoding artifacts remaining in calcFunc that we didn't replace above
calcFunc = calcFunc.replace(/├®/g, 'é');
calcFunc = calcFunc.replace(/├┤/g, 'ô');
calcFunc = calcFunc.replace(/├¬/g, 'ê');
calcFunc = calcFunc.replace(/├Ç/g, 'À');
calcFunc = calcFunc.replace(/N┬░/g, 'N°');

let curStartIndex = cur.indexOf(startStr);
let curEndIndex = cur.indexOf(endStr);
let newCur = cur.substring(0, curStartIndex) + calcFunc + cur.substring(curEndIndex);

fs.writeFileSync('public/paye.html', newCur, 'utf8');
console.log('Fixed everything');
