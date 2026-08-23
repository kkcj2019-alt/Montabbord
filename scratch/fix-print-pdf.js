const fs = require('fs');

const F = 'public/index.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function rep(fnd, rpl, lbl) {
  const c = s.split(fnd).length - 1;
  if (c !== 1) { console.error('ANCRE x' + c + ':', lbl); process.exit(1); }
  s = s.replace(fnd, rpl);
  n++;
  console.log('OK', lbl);
}

/* ---------- 1. deux boutons dans la barre d outils actif ---------- */
rep(
"html += '<button class=\"btn btn-sm btn-outline\" onclick=\"openPrintActifModal()\" style=\"margin-right:4px\">Imprimer / PDF</button>';",
"html += '<button class=\"btn btn-sm btn-outline\" onclick=\"openPrintActifModal(\\'print\\')\" style=\"margin-right:4px\">Imprimer</button>';" + "\r\n" +
"  html += '<button class=\"btn btn-sm btn-outline\" onclick=\"openPrintActifModal(\\'pdf\\')\" style=\"margin-right:4px\">PDF</button>';",
"boutons Imprimer et PDF separes"
);

/* ---------- 2. modal memorise le mode ---------- */
rep(
"function openPrintActifModal() {",
"function openPrintActifModal(mode) {\r\n  window._actifOutMode = (mode === 'pdf') ? 'pdf' : 'print';",
"signature modal avec mode"
);

rep(
"inner += '<h3 style=\"margin:0 0 16px;color:var(--primary)\">Imprimer l\\'Actif</h3>';",
"inner += '<h3 style=\"margin:0 0 16px;color:var(--primary)\">' + (window._actifOutMode === 'pdf' ? 'Exporter l\\'Actif en PDF' : 'Imprimer l\\'Actif') + '</h3>';",
"titre modal dynamique"
);

rep(
"inner += '<button class=\"btn btn-primary\" onclick=\"doPrintActif()\">Imprimer</button>';",
"inner += '<button class=\"btn btn-primary\" onclick=\"doPrintActif()\">" + "' + (window._actifOutMode === 'pdf' ? 'Continuer vers le PDF' : 'Imprimer') + '" + "</button>';",
"bouton modal dynamique"
);

/* ---------- 3. sortie differenciee ---------- */
var OLD_TAIL = [
"    /* Impression naturelle multi-pages A4 : lignes espacees et lisibles */",
"  printHtml += '<script>window.addEventListener(\"load\",function(){setTimeout(function(){window.print();},250);});<\\/script>';",
"  printHtml += '</body></html>';",
"  var w = window.open('', '_blank', 'width=850,height=900');",
"  w.document.write(printHtml);",
"  w.document.close();"
].join("\r\n");

var NEW_TAIL = [
"  var _outIsPdf = window._actifOutMode === 'pdf';",
"  if (_outIsPdf) {",
"    var _pd = new Date();",
"    var _pds = _pd.getFullYear() + '-' + String(_pd.getMonth() + 1).padStart(2, '0') + '-' + String(_pd.getDate()).padStart(2, '0');",
"    var _bar = '<div style=\"position:sticky;top:0;z-index:99;background:#0b1526;color:#f6dd85;padding:10px 16px;display:flex;align-items:center;gap:12px;font-family:Arial,sans-serif\">'" ,
"      + '<strong style=\"font-size:13px\">Export PDF</strong>'",
"      + '<span style=\"font-size:12px;color:#c9b87e\">Cliquez puis choisissez \\u00ab Enregistrer au format PDF \\u00bb comme destination.</span>'",
"      + '<button onclick=\"window.print()\" style=\"margin-left:auto;background:#f6dd85;color:#0b1526;border:none;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:13px\">Enregistrer en PDF</button>'",
"      + '</div>';",
"    printHtml += '<script>document.title=\"Actif_Bilan_' + _pds + '\";<\\/script>';",
"    printHtml += _bar;",
"  } else {",
"    /* Impression naturelle multi-pages A4 : lignes espacees et lisibles */",
"    printHtml += '<script>window.addEventListener(\"load\",function(){setTimeout(function(){window.print();},250);});<\\/script>';",
"  }",
"  printHtml += '</body></html>';",
"  var w = window.open('', '_blank', 'width=850,height=900');",
"  w.document.write(printHtml);",
"  w.document.close();"
].join("\r\n");

rep(OLD_TAIL, NEW_TAIL, "sortie imprimer vs pdf");

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
console.log('_actifOutMode x', s.split('_actifOutMode').length - 1);
console.log("openPrintActifModal('pdf') :", s.indexOf("openPrintActifModal(\\'pdf\\')") >= 0 ? 'OK' : 'ECHEC');
console.log('Enregistrer en PDF         :', s.indexOf('Enregistrer en PDF') > 0 ? 'OK' : 'ECHEC');
