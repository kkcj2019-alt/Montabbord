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

/* ---------- cellule Designation ---------- */
rep(
"      html += '<td style=\"white-space:normal;word-break:break-word\">' + escH(String(d.designation || '').toUpperCase()) + (d.subLabel ? '<div style=\"font-size:12px;font-weight:700;color:var(--primary);margin-top:3px\">' + escH(d.subLabel) + '</div>' : '') + (isClickable ? ' <span style=\"color:var(--gray-400);font-size:11px\">\\u25BC</span>' : '') + '</td>';",
"      var _edDes = !readonly && d.isManual && rub.key !== 'bl_facturer';" + "\r\n" +
"      var _desInner = escH(String(d.designation || '').toUpperCase()) + (d.subLabel ? '<div style=\"font-size:12px;font-weight:700;color:var(--primary);margin-top:3px\">' + escH(d.subLabel) + '</div>' : '') + (isClickable ? ' <span style=\"color:var(--gray-400);font-size:11px\">\\u25BC</span>' : '');" + "\r\n" +
"      if (_edDes) {" + "\r\n" +
"        html += '<td style=\"white-space:normal;word-break:break-word;cursor:pointer\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(String(d.designation || '')) + '\" onclick=\"event.stopPropagation();inlineActifText(event,\\'' + rub.key + '\\',\\'' + escH(rub.nom) + '\\',\\'' + d.id.replace('man_', '') + '\\',\\'designation\\')\">' + _desInner + '</td>';" + "\r\n" +
"      } else {" + "\r\n" +
"        html += '<td style=\"white-space:normal;word-break:break-word\">' + _desInner + '</td>';" + "\r\n" +
"      }",
"cellule designation editable"
);

/* ---------- cellule Qte ---------- */
rep(
"      html += '<td style=\"text-align:right\">' + (_showQtePrix && d.qte !== undefined ? d.qte : '') + '</td>';",
"      var _edQte = _showQtePrix && d.qte !== undefined && !readonly && d.isManual;" + "\r\n" +
"      html += '<td style=\"text-align:right' + (_edQte ? ';cursor:pointer' : '') + '\"' + (_edQte ? ' title=\"Cliquer pour modifier\" data-cur=\"' + (d.qte || 0) + '\" onclick=\"event.stopPropagation();inlineActifNum(event,\\'' + rub.key + '\\',\\'' + escH(rub.nom) + '\\',\\'' + d.id.replace('man_', '') + '\\',\\'qte\\')\"' : '') + '>' + (_showQtePrix && d.qte !== undefined ? d.qte : '') + '</td>';",
"cellule qte editable"
);

/* ---------- cellule Prix ---------- */
rep(
"      html += '<td style=\"text-align:right\">' + (_showQtePrix && d.prix !== undefined ? fmtMoney(d.prix) : '') + '</td>';",
"      var _edPrix = _showQtePrix && d.prix !== undefined && !readonly && d.isManual;" + "\r\n" +
"      html += '<td style=\"text-align:right' + (_edPrix ? ';cursor:pointer' : '') + '\"' + (_edPrix ? ' title=\"Cliquer pour modifier\" data-cur=\"' + (d.prix || 0) + '\" onclick=\"event.stopPropagation();inlineActifNum(event,\\'' + rub.key + '\\',\\'' + escH(rub.nom) + '\\',\\'' + d.id.replace('man_', '') + '\\',\\'prixUnitaire\\')\"' : '') + '>' + (_showQtePrix && d.prix !== undefined ? fmtMoney(d.prix) : '') + '</td>';",
"cellule prix editable"
);

/* ---------- cellule Montant ---------- */
rep(
"      html += '<td style=\"text-align:right;font-weight:600;white-space:nowrap;color:' + (montantVal < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + montantSigne + fmtMoney(Math.abs(d.montant)) + '</td>';",
"      var _edMont = !readonly && d.isManual && rub.key !== 'bl_facturer' && rub.key !== 'stock';" + "\r\n" +
"      html += '<td style=\"text-align:right;font-weight:600;white-space:nowrap;color:' + (montantVal < 0 ? 'var(--danger)' : 'var(--success)') + (_edMont ? ';cursor:pointer' : '') + '\"' + (_edMont ? ' title=\"Cliquer pour modifier (saisir un n\\u00e9gatif pour une sortie)\" data-cur=\"' + Math.abs(d.montant || 0) + '\" onclick=\"event.stopPropagation();inlineActifNum(event,\\'' + rub.key + '\\',\\'' + escH(rub.nom) + '\\',\\'' + d.id.replace('man_', '') + '\\',\\'montant\\')\"' : '') + '>' + montantSigne + fmtMoney(Math.abs(d.montant)) + '</td>';",
"cellule montant editable"
);

/* ---------- fonctions d'edition en ligne ---------- */
var fAnchor = "function saveLigneForRubrique(key, nom, lineId) {";
if (s.split(fAnchor).length - 1 !== 1) { console.error('ancre saveLigneForRubrique'); process.exit(1); }
var FN =
"function _findActifLineCtx(rubKey, nom, lineId) {" +
"  var actif = getActif();" +
"  var ri = _findActifRubriqueByKey(rubKey, nom);" +
"  var out = { actif: actif, ri: ri, li: -1 };" +
"  var rub = actif.rubriques[ri];" +
"  if (!rub || !rub.lignes) return out;" +
"  for (var j = 0; j < rub.lignes.length; j++) { if (rub.lignes[j].id === lineId) { out.li = j; break; } }" +
"  return out;" +
"}" +
"\r\n" +
"function _actifCommitLine(rubKey, nom, lineId, patch) {" +
"  var ctx = _findActifLineCtx(rubKey, nom, lineId);" +
"  if (ctx.li < 0) { toast('Ligne introuvable', 'error'); return; }" +
"  var L = ctx.actif.rubriques[ctx.ri].lignes[ctx.li];" +
"  for (var k in patch) { if (patch.hasOwnProperty(k)) L[k] = patch[k]; }" +
"  if (rubKey === 'stock' && (patch.qte !== undefined || patch.prixUnitaire !== undefined)) L.montant = Math.round((L.qte || 0) * (L.prixUnitaire || 0) * 100) / 100;" +
"  if (rubKey === 'bl_facturer' && (patch.qte !== undefined || patch.prixUnitaire !== undefined)) L.montant = Math.round((L.qte || 0) * (L.prixUnitaire || 0) * ((L.tvaActive !== false) ? 1.18 : 1) * 100) / 100;" +
"  DB.set('mdb_actif', ctx.actif);" +
"  toast('Ligne modifi\\u00e9e');" +
"  renderActif();" +
"}" +
"\r\n" +
"function inlineActifText(ev, rubKey, nom, lineId, field) {" +
"  var td = ev.currentTarget;" +
"  var cur = td.getAttribute('data-cur') || '';" +
"  td.innerHTML = '<input type=\"text\" value=\"' + escH(cur) + '\" style=\"width:100%;min-width:130px;padding:3px 6px;border:1px solid var(--primary);border-radius:4px;font-size:12px;text-transform:uppercase\" id=\"actInlineIn\">';" +
"  var inp = document.getElementById('actInlineIn');" +
"  inp.focus(); inp.select();" +
"  var done = false;" +
"  function commit() { if (done) return; done = true; var v = inp.value.trim(); if (!v) { renderActif(); return; } var p2 = {}; p2[field] = v.toUpperCase(); _actifCommitLine(rubKey, nom, lineId, p2); }" +
"  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { done = true; renderActif(); } });" +
"  inp.addEventListener('blur', commit);" +
"}" +
"\r\n" +
"function inlineActifNum(ev, rubKey, nom, lineId, field) {" +
"  var td = ev.currentTarget;" +
"  var cur = parseFloat(td.getAttribute('data-cur')) || 0;" +
"  td.innerHTML = '<input type=\"number\" min=\"0\" step=\"any\" value=\"' + cur + '\" style=\"width:110px;padding:3px 6px;border:1px solid var(--primary);border-radius:4px;font-size:12px;text-align:right\" id=\"actInlineIn\">';" +
"  var inp = document.getElementById('actInlineIn');" +
"  inp.focus(); inp.select();" +
"  var done = false;" +
"  function commit() {" +
"    if (done) return; done = true;" +
"    var v = parseFloat(inp.value) || 0;" +
"    var p2 = {};" +
"    if (field === 'montant') { p2.montant = Math.abs(v); p2.signe = v < 0 ? '-' : '+'; }" +
"    else { p2[field] = v; }" +
"    _actifCommitLine(rubKey, nom, lineId, p2);" +
"  }" +
"  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { done = true; renderActif(); } });" +
"  inp.addEventListener('blur', commit);" +
"}" +
"\r\n";
s = s.replace(fAnchor, FN + fAnchor);
n++;
console.log('OK fonctions edition en ligne actif');

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

/* verifs */
console.log('\r\n=== VERIFS ===');
['inlineActifText', 'inlineActifNum', '_actifCommitLine', '_findActifLineCtx'].forEach(function(k) {
  console.log(k, 'x', s.split(k).length - 1);
});
console.log('data-cur x', s.split('data-cur=').length - 1);
