const fs = require('fs');
let html = fs.readFileSync('public/paye.html', 'utf8');

// Remplacer le bloc brut fiscal / social / CNPS
const oldBlock = `  var transportExo = Math.min(stats.transport, TAX_RULES.transport_max_exo);\r
  var brutFiscal = totalBrut - transportExo - totalNonTaxable;\r
  var brutSocial = totalBrut - transportExo - totalNonTaxable;\r
  var lim = getLimits();\r
  var baseRet = Math.min(brutSocial, lim.retraite);\r
  var baseATPF = Math.min(brutSocial, lim.atpf);\r
  var cnpsSal = Math.floor(baseRet * TAX_RULES.cnps_sal);\r
  items.push({ n: '61', label: 'CNPS, Régime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal, tauxPat: '7,70', retPat: Math.floor(baseRet * 0.077) });\r
  items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '2,00', retPat: Math.floor(baseATPF * 0.02) });\r
  items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '5,75', retPat: Math.floor(baseATPF * 0.0575) });\r`;

const newBlock = `  var transportExo = Math.min(stats.transport, TAX_RULES.transport_max_exo);\r
  /* ===== Calcul exonération 10% indemnités spéciales (Art.116 CGI) ===== */\r
  var remuNumeraire = totalBrut - totalAvantages;\r
  var totalIndSpec = primesSpecActives.reduce(function(s,p){ return s + (parseFloat(p.montant)||0); }, 0);\r
  var plafond10pct = Math.floor(remuNumeraire * (TAX_RULES.indemnites_spec_pct || 0.10));\r
  var indSpecExo = Math.min(totalIndSpec, plafond10pct);\r
  /* Brut fiscal = base ITS (hors transport exo + avantages non taxables + indemnités spéciales exonérées) */\r
  var brutFiscal = totalBrut - transportExo - totalNonTaxable - indSpecExo;\r
  /* Brut social = base CNPS (les indemnités spéciales restent incluses) */\r
  var brutSocial = totalBrut - transportExo - totalNonTaxable;\r
  var lim = getLimits();\r
  var baseRet = Math.min(brutSocial, lim.retraite);\r
  var baseATPF = Math.min(brutSocial, lim.atpf);\r
  var cnpsSal = Math.floor(baseRet * TAX_RULES.cnps_sal);\r
  items.push({ n: '61', label: 'CNPS, Régime de Retraite', base: baseRet, taux: '6,30', gain: 0, ret: cnpsSal, tauxPat: '7,70', retPat: Math.floor(baseRet * 0.077) });\r
  var atPatRate = TAX_RULES.cnps_pat_at || 0.02;\r
  var pfPatRate = TAX_RULES.cnps_pat_pf || 0.05;\r
  var matPatRate = TAX_RULES.cnps_pat_mat || 0.0075;\r
  items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (atPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * atPatRate) });\r
  items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (pfPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * pfPatRate) });\r
  items.push({ n: '64', label: 'CNPS, Ass. Maternité', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (matPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * matPatRate) });\r`;

if (html.indexOf(oldBlock) === -1) {
  // Try without \r
  const oldBlockNoR = oldBlock.replace(/\r\n/g, '\n').replace(/\r/g, '');
  const newBlockNoR = newBlock.replace(/\r\n/g, '\n').replace(/\r/g, '');
  if (html.indexOf(oldBlockNoR) === -1) {
    // Try line by line
    console.log('Block not found as-is, using line-by-line replacement...');
    html = html.replace(
      /  var transportExo = Math\.min\(stats\.transport, TAX_RULES\.transport_max_exo\);[\s\S]*?items\.push\(\{ n: '63', label: 'CNPS, Prest\. Famil\.', base: baseATPF[^\n]*\n/,
      newBlockNoR + '\n'
    );
  } else {
    html = html.replace(oldBlockNoR, newBlockNoR);
  }
} else {
  html = html.replace(oldBlock, newBlock);
}

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Done - brut fiscal 10% exemption + CNPS rates fixed');
