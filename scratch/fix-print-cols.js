const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* 1) CSS impression plus compact */
rep(
  "  printHtml += '<style>@page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;font-size:13px;color:#222;margin:0;padding:0}';\r\n  printHtml += '#fitWrap{width:100%}';\r\n  printHtml += 'table{width:100%;border-collapse:collapse;margin:8px 0 14px;table-layout:fixed}';\r\n  printHtml += 'th,td{padding:7px 10px;border:1px solid #999;text-align:left;font-size:13px;overflow:hidden;text-overflow:ellipsis;line-height:1.5}';\r\n  printHtml += 'th{background:#f2f2f2;font-weight:700;font-size:13px}';",
  [
    "  printHtml += '<style>@page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;font-size:12.5px;color:#222;margin:0;padding:0}';",
    "  printHtml += '#fitWrap{width:100%}';",
    "  printHtml += 'table{width:100%;border-collapse:collapse;margin:6px 0 10px;table-layout:fixed}';",
    "  printHtml += 'th,td{padding:4px 8px;border:1px solid #999;text-align:left;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;line-height:1.35}';",
    "  printHtml += 'th{background:#f2f2f2;font-weight:700;font-size:12.5px}';"
  ].join('\r\n'),
  'css compact'
);
rep(
  "  printHtml += '.section-title{font-size:19px;font-weight:800;margin:18px 0 9px;padding:10px 14px;display:block;position:relative;border-radius:4px;page-break-after:avoid}';",
  "  printHtml += '.section-title{font-size:18px;font-weight:800;margin:12px 0 6px;padding:7px 12px;display:block;position:relative;border-radius:4px;page-break-after:avoid}';",
  'titre compact'
);

/* 2) Colonnes Qte/Prix unit. seulement si la rubrique en utilise */
rep(
  "      printHtml += '<table>';\r\n      printHtml += '<thead><tr><th style=\"text-align:left;width:auto\">D\\u00e9signation</th><th style=\"text-align:right;width:38px\">' + _qHdrP + '</th><th style=\"text-align:right;width:75px\">' + _pHdrP + '</th><th style=\"text-align:right;width:125px\">Montant</th><th style=\"width:110px\">Observation</th></tr></thead><tbody>';",
  [
    "      var _hasQP = (_qHdrP !== '' || _pHdrP !== '');",
    "      printHtml += '<table>';",
    "      if (_hasQP) {",
    "        printHtml += '<thead><tr><th style=\"text-align:left;width:auto\">D\\u00e9signation</th><th style=\"text-align:right;width:38px\">' + _qHdrP + '</th><th style=\"text-align:right;width:75px\">' + _pHdrP + '</th><th style=\"text-align:right;width:125px\">Montant</th><th style=\"width:110px\">Observation</th></tr></thead><tbody>';",
    "      } else {",
    "        printHtml += '<thead><tr><th style=\"text-align:left;width:auto\">D\\u00e9signation</th><th style=\"text-align:right;width:125px\">Montant</th><th style=\"width:110px\">Observation</th></tr></thead><tbody>';",
    "      }"
  ].join('\r\n'),
  'entete conditionnelle'
);

/* 3) Sous-details : memes colonnes que le tableau parent */
rep(
  "                    printHtml += '<tr><td style=\"padding-left:16px;' + (isTot ? 'font-weight:700' : 'font-style:italic;color:#555') + '\">' + escH(nlbl) + '</td><td></td><td></td><td style=\"text-align:right;' + (isTot ? 'font-weight:700' : 'color:#555') + '\">' + escH(nmt) + '</td><td></td></tr>';",
  [
    "                    printHtml += '<tr><td style=\"padding-left:16px;' + (isTot ? 'font-weight:700' : 'font-style:italic;color:#555') + '\">' + escH(nlbl) + '</td>';",
    "                    if (_hasQP) printHtml += '<td></td><td></td>';",
    "                    printHtml += '<td style=\"text-align:right;' + (isTot ? 'font-weight:700' : 'color:#555') + '\">' + escH(nmt) + '</td><td></td></tr>';"
  ].join('\r\n'),
  'sous-details colonnes'
);

/* 4) Lignes principales : supprimer les cellules Qte/Prix vides quand inutiles */
rep(
  "          printHtml += '<tr>';\r\n          printHtml += '<td>' + escH(vals[iDesig] || '') + (subLbl ? '<br><span style=\"font-size:10px;color:#667;display:inline-block;margin-top:2px\">' + escH(subLbl) + '</span>' : '') + '</td>';\r\n          printHtml += '<td style=\"text-align:right\">' + escH(vals[iQte] || '') + '</td>';\r\n          printHtml += '<td style=\"text-align:right\">' + escH(vals[iPrix] || '') + '</td>';\r\n          printHtml += '<td style=\"text-align:right;font-weight:600\">' + escH(mtVal) + '</td>';",
  [
    "          printHtml += '<tr>';",
    "          printHtml += '<td>' + escH(vals[iDesig] || '') + (subLbl ? '<br><span style=\"font-size:10px;color:#667;display:inline-block;margin-top:2px\">' + escH(subLbl) + '</span>' : '') + '</td>';",
    "          if (_hasQP) {",
    "            printHtml += '<td style=\"text-align:right\">' + escH(vals[iQte] || '') + '</td>';",
    "            printHtml += '<td style=\"text-align:right\">' + escH(vals[iPrix] || '') + '</td>';",
    "          }",
    "          printHtml += '<td style=\"text-align:right;font-weight:600\">' + escH(mtVal) + '</td>';"
  ].join('\r\n'),
  'lignes conditionnelles'
);

/* 5) TOTAL BALANCE aligne sur la colonne Montant */
rep(
  "  var gt = document.querySelector('.grand-total');\r\n  if (gt) printHtml += '<div class=\"grand-total\">' + gt.textContent + '</div>';",
  [
    "  var gt = document.querySelector('.grand-total');",
    "  if (gt) {",
    "    var gtAmtEl = gt.querySelector('.grand-total-amt');",
    "    var gtLblEl = gt.querySelector('strong');",
    "    var gtLbl = gtLblEl ? gtLblEl.textContent.replace(/:\\s*$/, ':') : 'TOTAL BALANCE :';",
    "    var gtAmt = gtAmtEl ? gtAmtEl.textContent.trim() : '';",
    "    printHtml += '<div class=\"grand-total\" style=\"position:relative\"><span style=\"font-weight:800\">' + escH(gtLbl) + '</span>';",
    "    if (gtAmt) printHtml += '<span style=\"position:absolute;right:110px;top:50%;transform:translateY(-50%);font-weight:800;color:' + (gtAmt.replace(/\\s/g, '').indexOf('-') === 0 ? '#dc2626' : '#15803d') + '\">' + escH(gtAmt) + '</span>';",
    "    printHtml += '</div>';",
    "  }"
  ].join('\r\n'),
  'total balance aligne'
);

fs.writeFileSync('public/index.html', t);
console.log('OK impression compacte + alignee');
