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

/* ======== 1. mots-cles Comptes Tiers : clients / fournisseurs ======== */
rep(
"creancesDettes: ['creances', 'dettes', 'recouvrement'],",
"creancesDettes: ['creances', 'dettes', 'recouvrement', 'clients', 'fournisseurs', 'comptes tiers', 'soldes'],",
"mots-cles comptes tiers"
);

/* ======== 2. appliquer le filtre des la premiere lettre tapee ======== */
rep(
"    window._menuSearchPos = pos;\r\n    buildSidebar();\r\n    return;",
"    window._menuSearchPos = pos;\r\n    buildSidebar();\r\n    filterMenuItems();\r\n    return;",
"filtre immediat premiere lettre"
);

/* ======== 3. bloc BL a facturer avec bascule Actifs / Reels ======== */
var START = "    {\r\n      var _adB = computeActifData();";
var END = "\r\n    if (activeBLs.length > 0) {";
var iS = s.indexOf(START), iE = s.indexOf(END);
if (iS < 0 || iE < 0 || iE <= iS) { console.error('bornes introuvables'); process.exit(1); }

var NEW_BLOCK = [
"    {",
"      var _adB = computeActifData();",
"      var _blRubB = null;",
"      for (var _brI = 0; _brI < _adB.rubriques.length; _brI++) { if (_adB.rubriques[_brI].key === 'bl_facturer') { _blRubB = _adB.rubriques[_brI]; break; } }",
"      var _blRowsB = _blRubB ? (_blRubB.visibleDetails || []) : [];",
"      html += '<div class=\"dash-section\" style=\"border-left:4px solid #2563eb\">';",
"      html += '<div style=\"display:flex;justify-content:space-between;align-items:center;gap:8px\"><h3 style=\"cursor:pointer;margin:0\" onclick=\"navigateTo(\\'actif\\')\">\\uD83E\\uDDFE BL \\u00e0 facturer</h3>';",
"      html += '<div style=\"display:inline-flex;border:1px solid var(--gray-300);border-radius:6px;overflow:hidden\">';",
"      html += '<button id=\"blsBtnActif\" onclick=\"setDashBlsSource(\\'actif\\')\" style=\"padding:3px 10px;font-size:11px;border:none;background:var(--primary);color:#fff;cursor:pointer\">Actifs</button>';",
"      html += '<button id=\"blsBtnReel\" onclick=\"setDashBlsSource(\\'reel\\')\" style=\"padding:3px 10px;font-size:11px;border:none;background:transparent;color:var(--gray-600);cursor:pointer\">R\\u00e9els</button>';",
"      html += '</div></div>';",
"      html += '<div id=\"blsWrapActif\" style=\"max-height:320px;overflow-y:auto\">';",
"      if (_blRowsB.length === 0) html += '<div style=\"padding:12px;color:var(--gray-400);font-size:13px;text-align:center\">Aucune ligne BL \\u00e0 facturer dans l\\'actif</div>';",
"      for (var _bri2 = 0; _bri2 < _blRowsB.length; _bri2++) {",
"        var _brr = _blRowsB[_bri2];",
"        var _brv = _brr.montant < 0 ? _brr.montant : ((_brr.signe === '-') ? -1 : 1) * Math.abs(_brr.montant || 0);",
"        html += '<div style=\"padding:8px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer\" onclick=\"navigateTo(\\'actif\\')\">';",
"        html += '<div style=\"display:flex;align-items:center;justify-content:space-between\"><div><strong style=\"font-size:13px\">' + escH(_brr.designation || '-') + '</strong>' + (_brr.subLabel ? '<div style=\"font-size:12px;color:var(--gray-500)\">' + escH(_brr.subLabel) + '</div>' : '') + '</div>';",
"        html += '<div style=\"text-align:right;font-size:13px;font-weight:600;color:' + (_brv < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + (_brv < 0 ? '- ' : '+ ') + fmtMoney(Math.abs(_brv)) + '</div></div>';",
"        html += '</div>';",
"      }",
"      if (_blRubB && _blRowsB.length > 0) html += '<div style=\"padding:10px 12px;font-size:13px;font-weight:700;text-align:right;color:var(--primary)\">Total : ' + fmtMoney(_blRubB.rubTotal || 0) + '</div>';",
"      html += '</div>';",
"      html += '<div id=\"blsWrapReel\" style=\"max-height:320px;overflow-y:auto;display:none\">';",
"      if (activeBLs.length === 0) html += '<div style=\"padding:12px;color:var(--gray-400);font-size:13px;text-align:center\">Aucun BL r\\u00e9el en attente de facturation</div>';",
"      var _blrSum = 0;",
"      for (var _blrI = 0; _blrI < activeBLs.length; _blrI++) {",
"        var _blrB = activeBLs[_blrI];",
"        var _blrCl = getClientById(_blrB.clientId);",
"        var _blrTot = 0;",
"        if (_blrB.lignes) { for (var _blj2 = 0; _blj2 < _blrB.lignes.length; _blj2++) _blrTot += (_blrB.lignes[_blj2].quantite || 0) * (_blrB.lignes[_blj2].prixUnitaire || 0); }",
"        _blrSum += _blrTot;",
"        html += '<div style=\"padding:8px 12px;border-bottom:1px solid var(--gray-100);cursor:pointer\" onclick=\"navigateToFacturation(\\'bl\\')\">';",
"        html += '<div style=\"display:flex;align-items:center;justify-content:space-between\"><div><strong style=\"font-size:13px\">' + escH(_blrB.numero || '-') + '</strong><div style=\"font-size:12px;color:var(--gray-500)\">' + escH(_blrCl ? _blrCl.nom : 'Client inconnu') + '</div></div><div style=\"text-align:right;font-size:13px;font-weight:600;color:var(--warning)\">' + fmtMoney(_blrTot) + '</div></div>';",
"        html += '</div>';",
"      }",
"      if (activeBLs.length > 0) html += '<div style=\"padding:10px 12px;font-size:13px;font-weight:700;text-align:right;color:var(--warning)\">Total : ' + fmtMoney(_blrSum) + '</div>';",
"      html += '</div>';",
"      html += '</div>';",
"    }"
].join("\r\n");

s = s.slice(0, iS) + NEW_BLOCK + s.slice(iE);
n++;
console.log('OK bloc bascule actifs/reels');

rep(
"function setDashStkSource(mode) {",
"function setDashBlsSource(mode) {" +
"var wA = document.getElementById('blsWrapActif'), wR = document.getElementById('blsWrapReel');" +
"var bA = document.getElementById('blsBtnActif'), bR = document.getElementById('blsBtnReel');" +
"if (!wA || !wR || !bA || !bR) return;" +
"var onReel = mode === 'reel';" +
"wA.style.display = onReel ? 'none' : '';" +
"wR.style.display = onReel ? '' : 'none';" +
"bA.style.background = onReel ? 'transparent' : 'var(--primary)';" +
"bA.style.color = onReel ? 'var(--gray-600)' : '#fff';" +
"bR.style.background = onReel ? 'var(--primary)' : 'transparent';" +
"bR.style.color = onReel ? '#fff' : 'var(--gray-600)';" +
"}" +
"\r\n" +
"function setDashStkSource(mode) {",
"fonction setDashBlsSource"
);

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
console.log('blsWrapReel       :', s.split('blsWrapReel').length - 1);
console.log('setDashBlsSource  :', s.split('setDashBlsSource').length - 1);
console.log('filtre immediat   :', s.indexOf("buildSidebar();\r\n    filterMenuItems();") > 0 ? 'OK' : 'ECHEC');
console.log('mots-cles clients :', s.indexOf("'comptes tiers'") > 0 ? 'OK' : 'ECHEC');
