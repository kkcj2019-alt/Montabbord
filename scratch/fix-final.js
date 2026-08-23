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

/* ======== 1. NEGATIFS EN ROUGE A L IMPRESSION / PDF ======== */
rep(
"printHtml += '<td style=\"text-align:right;font-weight:600\">' + escH(mtVal) + '</td>';",
"printHtml += '<td style=\"text-align:right;font-weight:600;' + (mtVal.indexOf('-') === 0 ? 'color:#dc2626' : 'color:#15803d') + '\">' + escH(mtVal) + '</td>';",
"impression montant principal"
);
rep(
"printHtml += '<td style=\"text-align:right;' + (isTot ? 'font-weight:700' : 'color:#555') + '\">' + escH(nmt) + '</td><td></td></tr>';",
"printHtml += '<td style=\"text-align:right;' + (isTot ? 'font-weight:700' : 'color:#555') + (nmt.indexOf('-') === 0 ? ';color:#dc2626' : '') + '\">' + escH(nmt) + '</td><td></td></tr>';",
"impression sous-details"
);

/* ======== 2. BLOC BL A FACTURER A COTE DES BC ACTIFS ======== */
rep(
"      html += '</div></div>';\r\n    }\r\n    if (activeBLs.length > 0) {",
"      html += '</div></div>';\r\n" +
"    }\r\n" +
"    {\r\n" +
"      var _adB = computeActifData();\r\n" +
"      var _blRubB = null;\r\n" +
"      for (var _brI = 0; _brI < _adB.rubriques.length; _brI++) { if (_adB.rubriques[_brI].key === 'bl_facturer') { _blRubB = _adB.rubriques[_brI]; break; } }\r\n" +
"      var _blRowsB = _blRubB ? (_blRubB.visibleDetails || []) : [];\r\n" +
"      if (_blRowsB.length > 0) {\r\n" +
"        html += '<div class=\"dash-section\" style=\"border-left:4px solid #2563eb\">';\r\n" +
"        html += '<h3 style=\"cursor:pointer\" onclick=\"navigateTo(\\'actif\\')\">\\uD83E\\uDDFE BL \\u00e0 facturer <span class=\"badge badge-primary\" style=\"font-size:11px;margin-left:4px\">' + _blRowsB.length + '</span></h3>';\r\n" +
"        html += '<div style=\"max-height:320px;overflow-y:auto\">';\r\n" +
"        for (var _bri2 = 0; _bri2 < _blRowsB.length; _bri2++) {\r\n" +
"          var _brr = _blRowsB[_bri2];\r\n" +
"          var _brv = _brr.montant < 0 ? _brr.montant : ((_brr.signe === '-') ? -1 : 1) * Math.abs(_brr.montant || 0);\r\n" +
"          html += '<div style=\"padding:8px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer\" onclick=\"navigateTo(\\'actif\\')\">';\r\n" +
"          html += '<div style=\"display:flex;align-items:center;justify-content:space-between\"><div><strong style=\"font-size:13px\">' + escH(_brr.designation || '-') + '</strong>' + (_brr.subLabel ? '<div style=\"font-size:12px;color:var(--gray-500)\">' + escH(_brr.subLabel) + '</div>' : '') + '</div>';\r\n" +
"          html += '<div style=\"text-align:right;font-size:13px;font-weight:600;color:' + (_brv < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + (_brv < 0 ? '- ' : '+ ') + fmtMoney(Math.abs(_brv)) + '</div></div>';\r\n" +
"          html += '</div>';\r\n" +
"        }\r\n" +
"        html += '</div>';\r\n" +
"        html += '<div style=\"padding:10px 12px;font-size:13px;font-weight:700;text-align:right;color:var(--primary)\">Total : ' + fmtMoney(_blRubB ? (_blRubB.rubTotal || 0) : 0) + '</div>';\r\n" +
"        html += '</div>';\r\n" +
"      }\r\n" +
"    }\r\n" +
"    if (activeBLs.length > 0) {",
"bloc bl a facturer a cote bc actifs"
);

/* ======== 3. POLICES DE LA SIDEBAR EN BLANC ======== */
rep(
'.sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#ecc95f;border-bottom:1px solid rgba(236,201,95,.16);display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}',
'.sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#ffffff;border-bottom:1px solid rgba(236,201,95,.16);display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}',
'brand blanche'
);
rep(
'.sidebar-toggle{background:none;border:none;color:#a89454;cursor:pointer;padding:4px;border-radius:4px;margin-left:auto;flex-shrink:0;transition:color .15s}',
'.sidebar-toggle{background:none;border:none;color:#cbd5e1;cursor:pointer;padding:4px;border-radius:4px;margin-left:auto;flex-shrink:0;transition:color .15s}',
'toggle clair'
);
rep(
'.sidebar-toggle:hover{color:#f3dc8e}',
'.sidebar-toggle:hover{color:#ffffff}',
'toggle hover blanc'
);
rep(
'.nav-group-title{padding:12px 26px 6px;font-size:10.5px;text-transform:uppercase;color:rgba(236,201,95,.55);letter-spacing:.08em;font-weight:700;white-space:nowrap;overflow:hidden}',
'.nav-group-title{padding:12px 26px 6px;font-size:10.5px;text-transform:uppercase;color:rgba(255,255,255,.65);letter-spacing:.08em;font-weight:700;white-space:nowrap;overflow:hidden}',
'titres groupes blancs'
);
rep(
'.nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#d9c88f;cursor:pointer;transition:all .15s;text-decoration:none;font-size:13.5px;white-space:nowrap;overflow:hidden}',
'.nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#ffffff;cursor:pointer;transition:all .15s;text-decoration:none;font-size:13.5px;white-space:nowrap;overflow:hidden}',
'items blancs'
);
rep(
'.nav-item:hover{background:rgba(236,201,95,.10);color:#f4e5b0}',
'.nav-item:hover{background:rgba(255,255,255,.08);color:#ffffff}',
'hover blanc'
);
rep(
'.nav-item.active,.nav-item:hover.active{background:linear-gradient(90deg,rgba(236,201,95,.24),rgba(236,201,95,.07));color:#f6dd85;font-weight:600}',
'.nav-item.active,.nav-item:hover.active{background:linear-gradient(90deg,rgba(236,201,95,.30),rgba(236,201,95,.08));color:#ffffff;font-weight:600}',
'actif texte blanc'
);
rep(
'.sidebar-footer .user-info{font-size:12px;color:#c9b87e;overflow:hidden;text-overflow:ellipsis}',
'.sidebar-footer .user-info{font-size:12px;color:rgba(255,255,255,.85);overflow:hidden;text-overflow:ellipsis}',
'user info blanc'
);

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
console.log('negatif impression   :', s.indexOf("(mtVal.indexOf('-') === 0") > 0 ? 'OK' : 'ECHEC');
console.log('bloc bl a facturer   :', s.indexOf('_blRubB') > 0 ? 'OK' : 'ECHEC');
console.log('sidebar blanche      :', s.indexOf('.nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#ffffff') > 0 ? 'OK' : 'ECHEC');
