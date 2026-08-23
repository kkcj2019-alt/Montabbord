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

/* ======== 1. NEGATIFS EN ROUGE PARTOUT SUR L'ACTIF ======== */
rep(
"      var montantVal = d.signe === '-' ? -Math.abs(d.montant) : Math.abs(d.montant);",
"      var montantVal = d.montant < 0 ? d.montant : ((d.signe === '-' ? -1 : 1) * Math.abs(d.montant || 0));",
"valeur effective negative"
);
rep(
"      var montantSigne = d.signe === '-' ? '- ' : '+ ';",
"      var montantSigne = montantVal < 0 ? '- ' : '+ ';",
"signe selon valeur effective"
);
rep(
"'>' + montantSigne + fmtMoney(Math.abs(d.montant)) + '</td>';",
"'>' + montantSigne + fmtMoney(Math.abs(montantVal)) + '</td>';",
"affichage montant effectif"
);

/* ======== 2. DASHBOARD : lignes avec sous-titre client/date, negatifs rouges, fallback BL ======== */
rep(
"      var _ddA = _vdA[_adi];" + "\r\n" +
"      html += '<div class=\"ad-row\" data-adtext=\"' + escH(String(_ddA.designation || '').toLowerCase()) + '\" style=\"display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--gray-600);padding:2px 0 2px 12px\"><span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + escH(_ddA.designation || '') + '</span><span style=\"white-space:nowrap;font-weight:600;color:' + (_ddA.signe === '-' ? 'var(--danger)' : 'var(--success)') + '\">' + (_ddA.signe === '-' ? '- ' : '+ ') + fmtMoney(Math.abs(_ddA.montant || 0)) + '</span></div>';",
"      var _ddA = _vdA[_adi];" + "\r\n" +
"      var _svA = _ddA.montant < 0 ? _ddA.montant : ((_ddA.signe === '-') ? -1 : 1) * Math.abs(_ddA.montant || 0);" + "\r\n" +
"      html += '<div class=\"ad-row\" data-adtext=\"' + escH(String((_ddA.designation || '') + ' ' + (_ddA.subLabel || '')).toLowerCase()) + '\" style=\"display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--gray-600);padding:2px 0 2px 12px\"><span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + escH(_ddA.designation || '') + (_ddA.subLabel ? '<span style=\"display:block;font-size:11px;color:var(--gray-400)\">' + escH(_ddA.subLabel) + '</span>' : '') + '</span><span style=\"white-space:nowrap;font-weight:600;color:' + (_svA < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + (_svA < 0 ? '- ' : '+ ') + fmtMoney(Math.abs(_svA)) + '</span></div>';",
"lignes dashboard sous-titres + negatifs"
);

/* fallback : si visibleDetails vide, reconstruire depuis les lignes manuelles de l actif */
rep(
"    var _rubA = AD.rubriques[_ari];" + "\r\n" +
"    var _vdA = _rubA.visibleDetails || [];",
"    var _rubA = AD.rubriques[_ari];" + "\r\n" +
"    var _vdA = _rubA.visibleDetails || [];" + "\r\n" +
"    if (!_vdA.length && _rubA.key !== 'tresorerie') {" + "\r\n" +
"      var _afR2 = getActif().rubriques || [];" + "\r\n" +
"      for (var _fr2 = 0; _fr2 < _afR2.length; _fr2++) {" + "\r\n" +
"        var _rR2 = _afR2[_fr2];" + "\r\n" +
"        if (!((_rR2.key && _rR2.key === _rubA.key) || ((_rR2.nom || '').toLowerCase() === (_rubA.nom || '').toLowerCase()))) continue;" + "\r\n" +
"        var _lgR2 = _rR2.lignes || [];" + "\r\n" +
"        for (var _lf2 = 0; _lf2 < _lgR2.length; _lf2++) {" + "\r\n" +
"          var _lnR2 = _lgR2[_lf2];" + "\r\n" +
"          var _sgR2 = _lnR2.signe || '+';" + "\r\n" +
"          var _svR2 = _lnR2.montant < 0 ? _lnR2.montant : ((_sgR2 === '-' ? -1 : 1) * Math.abs(_lnR2.montant || 0));" + "\r\n" +
"          var _slR2 = '';" + "\r\n" +
"          if (_lnR2.clientId && getClientById(_lnR2.clientId)) _slR2 = getClientById(_lnR2.clientId).nom + (_lnR2.date ? ' \\u2014 ' + fmtDate(_lnR2.date) : '') + (_lnR2.tvaActive !== false && _lnR2.tvaActive ? ' \\u00b7 TVA' : '');" + "\r\n" +
"          else if (_lnR2.baseDate) _slR2 = 'Solde au ' + fmtDate(_lnR2.baseDate);" + "\r\n" +
"          _vdA.push({ designation: _lnR2.designation || '', subLabel: _slR2, montant: Math.abs(_svR2), signe: _svR2 < 0 ? '-' : '+' });" + "\r\n" +
"        }" + "\r\n" +
"        break;" + "\r\n" +
"      }" + "\r\n" +
"    }",
"fallback lignes manuelles dashboard"
);

/* ======== 3. STOCK REEL / STOCK ACTIF SUR LE DASHBOARD ======== */
rep(
"  html += '<div class=\"stats-grid\" style=\"grid-template-columns:repeat(3,1fr);margin-bottom:0\">';\r\n  html += '<div class=\"stat-card\"><div class=\"stat-info\"><div class=\"stat-value\" style=\"color:var(--success)\">' + fmtMoney(soldeTresorerie)",
"  var _stkRealTotal = 0;" + "\r\n" +
"  (function() { var _skS = DB.get('mdb_stocks') || []; for (var _si3 = 0; _si3 < _skS.length; _si3++) _stkRealTotal += (_skS[_si3].quantite || 0) * (_skS[_si3].prixUnitaire || 0); })();" + "\r\n" +
"  html += '<div class=\"stats-grid\" style=\"grid-template-columns:repeat(3,1fr);margin-bottom:0\">';\r\n  html += '<div class=\"stat-card\"><div class=\"stat-info\"><div class=\"stat-value\" style=\"color:var(--success)\">' + fmtMoney(soldeTresorerie)",
"calcul stock reel"
);

rep(
"html += '<div class=\"stat-card\"><div class=\"stat-info\"><div class=\"stat-value\">' + fmtMoney(stockMontant) + '</div><div class=\"stat-label\">Stock</div></div></div>';",
"html += '<div class=\"stat-card\" style=\"flex-direction:column;align-items:stretch;gap:8px\"><div style=\"display:flex;justify-content:flex-end\"><div style=\"display:inline-flex;border:1px solid var(--gray-300);border-radius:var(--radius-sm);overflow:hidden\">';" + "\r\n" +
"  html += '<button id=\"stkBtnActif\" onclick=\"setDashStkSource(\\'actif\\');event.stopPropagation()\" style=\"padding:2px 8px;font-size:10px;border:none;background:var(--primary);color:#fff;cursor:pointer\">Stock actif</button>';" + "\r\n" +
"  html += '<button id=\"stkBtnReel\" onclick=\"setDashStkSource(\\'reel\\');event.stopPropagation()\" style=\"padding:2px 8px;font-size:10px;border:none;background:transparent;color:var(--gray-600);cursor:pointer\">Stock r\\u00e9el</button>';" + "\r\n" +
"  html += '</div></div>';" + "\r\n" +
"  html += '<div class=\"stat-info\"><div class=\"stat-value\" id=\"stkValActif\">' + fmtMoney(stockMontant) + '</div><div class=\"stat-value\" id=\"stkValReel\" style=\"display:none\">' + fmtMoney(_stkRealTotal) + '</div><div class=\"stat-label\">Stock</div></div></div>';",
"carte stock bascule"
);

rep(
"function setDashBlSource(mode) {",
"function setDashStkSource(mode) {" +
"var vA = document.getElementById('stkValActif'), vR = document.getElementById('stkValReel');" +
"var bA = document.getElementById('stkBtnActif'), bR = document.getElementById('stkBtnReel');" +
"if (!vA || !vR || !bA || !bR) return;" +
"var onReel = mode === 'reel';" +
"vA.style.display = onReel ? 'none' : '';" +
"vR.style.display = onReel ? '' : 'none';" +
"bA.style.background = onReel ? 'transparent' : 'var(--primary)';" +
"bA.style.color = onReel ? 'var(--gray-600)' : '#fff';" +
"bR.style.background = onReel ? 'var(--primary)' : 'transparent';" +
"bR.style.color = onReel ? '#fff' : 'var(--gray-600)';" +
"}" +
"\r\n" +
"function setDashBlSource(mode) {",
"fonction setDashStkSource"
);

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
['montantVal', '_stkRealTotal', 'setDashStkSource', 'stkValReel'].forEach(function(k) {
  console.log(k, 'x', s.split(k).length - 1);
});
