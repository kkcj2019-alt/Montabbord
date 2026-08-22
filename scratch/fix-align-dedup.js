const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* A) Dedoublonnage au niveau du rendu (ceinture + bretelles) */
rep(
  "    var rub = rubriqueOrder[ri];\r\n    var visibleDetails = rub.visibleDetails;",
  [
    "    var rub = rubriqueOrder[ri];",
    "    var visibleDetails = rub.visibleDetails;",
    "    /* Secours : jamais deux lignes systeme de tresorerie a l'affichage */",
    "    if (rub.key === 'tresorerie' && visibleDetails && visibleDetails.length > 1) {",
    "      var _seenRr = {}, _vdClean = [];",
    "      for (var _vi2 = 0; _vi2 < visibleDetails.length; _vi2++) {",
    "        var _dd2 = visibleDetails[_vi2];",
    "        var _k2 = String(_dd2.designation || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]/g, '');",
    "        var _b2 = null;",
    "        if (_k2.indexOf('prefinancement') === 0) _b2 = 'pre';",
    "        else if (_k2.indexOf('reserve') === 0 && _k2.indexOf('indispo') >= 0) _b2 = 'ind';",
    "        else if (_k2.indexOf('reserve') === 0 && _k2.indexOf('dispo') >= 0) _b2 = 'dis';",
    "        if (_b2) { if (_seenRr[_b2]) continue; _seenRr[_b2] = 1; }",
    "        _vdClean.push(_dd2);",
    "      }",
    "      visibleDetails = _vdClean;",
    "    }"
  ].join('\r\n'),
  'dedoublonnage rendu'
);

/* B) Badge de version visible */
rep(
  "  html += '<h2 style=\"margin:0\">Actif</h2>';",
  "  html += '<h2 style=\"margin:0\">Actif <span style=\"font-size:11px;font-weight:400;color:var(--gray-400);vertical-align:middle\">v0822d</span></h2>';",
  'badge version'
);

/* C) En-tete rubrique predefinie : nom seul + total absolument positionne sur colonne Montant */
rep(
  "    html += '<div class=\"section mb-16\" style=\"border-left:4px solid ' + rub.color + '\">';\r\n    html += '<div class=\"section-header\" data-rkey=\"' + escH(rub.key || rub.nom) + '\" style=\"cursor:pointer\" onclick=\"toggleRubrique(this)\">';\r\n    html += '<h3 style=\"display:flex;align-items:center;gap:12px\"><span>' + escH(rub.nom) + '</span>';\r\n    html += '<span style=\"font-weight:700;color:' + (rubTotal < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + fmtMoney(rubTotal) + '</span></h3>';",
  [
    "    html += '<div class=\"section mb-16\" style=\"border-left:4px solid ' + rub.color + ';position:relative\">';",
    "    html += '<div class=\"section-header\" data-rkey=\"' + escH(rub.key || rub.nom) + '\" style=\"cursor:pointer\" onclick=\"toggleRubrique(this)\">';",
    "    html += '<h3 style=\"display:flex;align-items:center\"><span>' + escH(rub.nom) + '</span></h3>';",
    "    html += '<span class=\"rub-total-align\" style=\"position:absolute;top:18px;left:0;width:120px;font-weight:700;white-space:nowrap;color:' + (rubTotal < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + fmtMoney(rubTotal) + '</span>';"
  ].join('\r\n'),
  'entete predefinie'
);

/* D) En-tete rubrique manuelle : idem */
rep(
  "    html += '<div class=\"section mb-16\">';\r\n    html += '<div class=\"section-header\" data-rkey=\"' + escH(mRub.key || mRub.id) + '\" style=\"cursor:pointer\" onclick=\"toggleRubrique(this)\">';\r\n    html += '<h3><span>' + escH(mRub.nom) + '</span> <span style=\"color:' + (mTotal < 0 ? 'var(--danger)' : 'var(--success)') + ';font-weight:700;margin-left:12px\">' + fmtMoney(mTotal) + '</span></h3>';",
  [
    "    html += '<div class=\"section mb-16\" style=\"position:relative\">';",
    "    html += '<div class=\"section-header\" data-rkey=\"' + escH(mRub.key || mRub.id) + '\" style=\"cursor:pointer\" onclick=\"toggleRubrique(this)\">';",
    "    html += '<h3><span>' + escH(mRub.nom) + '</span></h3>';",
    "    html += '<span class=\"rub-total-align\" style=\"position:absolute;top:18px;left:0;width:120px;font-weight:700;white-space:nowrap;color:' + (mTotal < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + fmtMoney(mTotal) + '</span>';"
  ].join('\r\n'),
  'entete manuelle'
);

/* E) TOTAL BALANCE : montant sur la meme colonne */
rep(
  "  html += '<div class=\"grand-total\" style=\"font-size:18px;padding:16px 24px;background:var(--primary-light);border-radius:var(--radius-md);margin-top:20px\"><strong>TOTAL BALANCE : </strong><span style=\"color:var(--primary);font-weight:800\">' + fmtMoney(grandTotal) + '</span></div>';",
  "  html += '<div class=\"grand-total\" style=\"position:relative;font-size:18px;padding:16px 24px;background:var(--primary-light);border-radius:var(--radius-md);margin-top:20px\"><strong>TOTAL BALANCE : </strong><span class=\"grand-total-amt\" style=\"position:absolute;top:16px;left:0;width:120px;font-weight:800;white-space:nowrap;color:var(--primary)\">' + fmtMoney(grandTotal) + '</span></div>';",
  'grand total'
);

/* F) Fonction d'alignement + hooks apres injection HTML */
rep(
  "  document.getElementById('content').innerHTML = html;\r\n}\r\nfunction toggleActifDetail(id)",
  [
    "  document.getElementById('content').innerHTML = html;",
    "  _alignActifTotals();",
    "  setTimeout(_alignActifTotals, 60);",
    "  if (!window._actifResizeHooked) { window._actifResizeHooked = true; window.addEventListener('resize', _alignActifTotals); }",
    "}",
    "function _alignActifTotals() {",
    "  var root = document.getElementById('content');",
    "  if (!root || !root.querySelector('.rub-total-align')) return;",
    "  var col = window._actifMontantCol;",
    "  var tbl = root.querySelector('.table-responsive table');",
    "  if (tbl && tbl.offsetParent !== null) {",
    "    var ths = tbl.querySelectorAll('thead th');",
    "    if (ths.length >= 4) {",
    "      var trr = ths[3].getBoundingClientRect();",
    "      var rrr = root.getBoundingClientRect();",
    "      col = window._actifMontantCol = { l: trr.left - rrr.left + root.scrollLeft, w: trr.width };",
    "    }",
    "  }",
    "  if (!col) return;",
    "  var tots = root.querySelectorAll('.rub-total-align');",
    "  for (var iat = 0; iat < tots.length; iat++) {",
    "    var tvv = tots[iat];",
    "    tvv.style.left = col.l + 'px';",
    "    tvv.style.width = col.w + 'px';",
    "    tvv.style.textAlign = 'right';",
    "    var hd = tvv.parentNode.querySelector('.section-header');",
    "    if (hd) tvv.style.top = Math.max(6, hd.offsetTop + (hd.offsetHeight - tvv.offsetHeight) / 2) + 'px';",
    "  }",
    "  var gta = root.querySelector('.grand-total-amt');",
    "  if (gta) {",
    "    gta.style.left = col.l + 'px';",
    "    gta.style.width = col.w + 'px';",
    "    gta.style.textAlign = 'right';",
    "    if (gta.offsetParent) gta.style.top = Math.max(10, gta.parentNode.clientHeight / 2 - gta.offsetHeight / 2 + 4) + 'px';",
    "  }",
    "}"
  ].join('\r\n'),
  'fonction alignement'
);

/* G) toggleRubrique : realigner apres repli/depli */
rep(
  "  window._actifCollapsed = window._actifCollapsed || {};\r\n  if (rk) { if (willHide) window._actifCollapsed[rk] = true; else delete window._actifCollapsed[rk]; }\r\n}",
  [
    "  window._actifCollapsed = window._actifCollapsed || {};",
    "  if (rk) { if (willHide) window._actifCollapsed[rk] = true; else delete window._actifCollapsed[rk]; }",
    "  setTimeout(function() { if (typeof _alignActifTotals === 'function') _alignActifTotals(); }, 30);",
    "}"
  ].join('\r\n'),
  'hook toggleRubrique'
);

/* H) Impression : lire le total depuis .rub-total-align (il n'est plus dans le h3) */
rep(
  "    var _spansT = h3.querySelectorAll('span');\r\n    var _rubNameP = _spansT.length > 0 ? _spansT[0].textContent.trim() : sectionTitle;\r\n    var _rubTotTxtP = '';\r\n    for (var st2 = 1; st2 < _spansT.length; st2++) { if (_spansT[st2].textContent.trim()) _rubTotTxtP = _spansT[st2].textContent.trim(); }",
  [
    "    var _spansT = h3.querySelectorAll('span');",
    "    var _rubNameP = _spansT.length > 0 ? _spansT[0].textContent.trim() : sectionTitle;",
    "    var _totElT = sections[i].querySelector('.rub-total-align');",
    "    var _rubTotTxtP = _totElT ? _totElT.textContent.trim() : '';"
  ].join('\r\n'),
  'impression lecture total'
);

fs.writeFileSync('public/index.html', t);
console.log('OK toutes modifications appliquees');
