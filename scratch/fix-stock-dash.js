const fs = require('fs');

const F = 'public/index.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;

/* ================= 1. STOCK : edition en ligne + filtre quantite 0 ================= */

var rsStart = s.indexOf('function renderStock() {');
var rsEnd = s.indexOf('\r\nfunction openStockModal(id) {');
if (rsStart < 0 || rsEnd < 0 || rsStart >= rsEnd) { console.error('Bornes renderStock introuvables'); process.exit(1); }
if (s.split('function renderStock()').length - 1 !== 1) { console.error('renderStock multiple'); process.exit(1); }

var NEW_RS = [
"function renderStock() {",
"  var stocks = (DB.get('mdb_stocks') || []).slice();",
"  var readonly = isReadonly('stock');",
"  var filtre = document.getElementById('stockFiltreQte') ? document.getElementById('stockFiltreQte').value : 'pos';",
"  stocks.sort(function(a, b) { return ((a.quantite || 0) > 0 ? 0 : 1) - ((b.quantite || 0) > 0 ? 0 : 1); });",
"  var html = '<div class=\"toolbar\">';",
"  html += '<input type=\"text\" id=\"stockSearch\" placeholder=\"Rechercher...\" oninput=\"filterStock()\" style=\"width:220px\">';",
"  html += '<select id=\"stockFiltreQte\" onchange=\"filterStock()\" style=\"padding:8px 10px;border:1px solid var(--gray-300);border-radius:var(--radius-sm);font-size:13px;background:#fff\">';",
"  html += '<option value=\"pos\"' + (filtre === 'pos' ? ' selected' : '') + '>En stock (&gt; 0)</option>';",
"  html += '<option value=\"zero\"' + (filtre === 'zero' ? ' selected' : '') + '>Quantit\\u00e9 \\u00e0 0</option>';",
"  html += '<option value=\"all\"' + (filtre === 'all' ? ' selected' : '') + '>Tous</option>';",
"  html += '</select>';",
"  if (!readonly) html += '<button class=\"btn btn-primary\" onclick=\"openStockModal()\">+ Nouveau stock</button>';",
"  html += '</div>';",
"  html += '<div class=\"table-wrap\"><div class=\"table-responsive\"><table><thead><tr><th>Article</th><th>Code</th><th style=\"text-align:right\">Quantit\\u00e9</th><th style=\"text-align:right\">Prix unitaire</th><th style=\"text-align:right\">Montant</th>';",
"  if (!readonly) html += '<th style=\"width:120px\">Actions</th>';",
"  html += '</tr></thead><tbody id=\"stockBody\">';",
"  var total = 0;",
"  for (var i = 0; i < stocks.length; i++) {",
"    var st = stocks[i];",
"    var montant = (st.quantite || 0) * (st.prixUnitaire || 0);",
"    total += montant;",
"    var artLabel = st.articleNom || '-';",
"    var artCode = st.articleCode || '-';",
"    html += '<tr data-qte=\"' + ((st.quantite || 0) > 0 ? '1' : '0') + '\" data-search=\"' + escH((artLabel + ' ' + artCode).toLowerCase()) + '\">';",
"    if (!readonly) {",
"      html += '<td class=\"fw-600\" style=\"cursor:pointer\" title=\"Cliquer pour modifier\" onclick=\"inlineStockArticle(\\'' + st.id + '\\',\\'' + (st.articleId || '') + '\\')\">' + escH(artLabel) + '</td>';",
"    } else {",
"      html += '<td class=\"fw-600\">' + escH(artLabel) + '</td>';",
"    }",
"    html += '<td>' + escH(artCode) + '</td>';",
"    if (!readonly) {",
"      html += '<td class=\"text-right fw-600\" style=\"cursor:pointer\" title=\"Cliquer pour modifier\" onclick=\"inlineStockNum(event,\\'' + st.id + '\\',\\'quantite\\',' + (st.quantite || 0) + ')\">' + (st.quantite || 0) + '</td>';",
"      html += '<td class=\"text-right\" style=\"cursor:pointer\" title=\"Cliquer pour modifier\" onclick=\"inlineStockNum(event,\\'' + st.id + '\\',\\'prixUnitaire\\',' + (st.prixUnitaire || 0) + ')\">' + fmtMoney(st.prixUnitaire || 0) + '</td>';",
"    } else {",
"      html += '<td class=\"text-right fw-600\">' + (st.quantite || 0) + '</td>';",
"      html += '<td class=\"text-right\">' + fmtMoney(st.prixUnitaire || 0) + '</td>';",
"    }",
"    html += '<td class=\"text-right fw-600\">' + fmtMoney(montant) + '</td>';",
"    if (!readonly) {",
"      html += '<td><button class=\"btn-icon\" onclick=\"openStockModal(\\'' + st.id + '\\')\" title=\"Modifier\"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7\"/><path d=\"M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z\"/></svg></button> ';",
"      html += '<button class=\"btn-icon danger\" onclick=\"deleteStock(\\'' + st.id + '\\')\" title=\"Supprimer\"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"3 6 5 6 21 6\"/><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg></button></td>';",
"    }",
"    html += '</tr>';",
"  }",
"  if (stocks.length === 0) html += '<tr><td colspan=\"' + (readonly ? 5 : 6) + '\" class=\"text-center text-muted\">Aucun stock enregistr\\u00e9</td></tr>';",
"  html += '<tr style=\"background:var(--gray-50)\"><td class=\"fw-600\" colspan=\"4\">Total</td><td class=\"text-right fw-600\" style=\"color:var(--primary)\">' + fmtMoney(total) + '</td>' + (readonly ? '' : '<td></td>') + '</tr>';",
"  html += '</tbody></table></div></div>';",
"  document.getElementById('content').innerHTML = html;",
"}",
"",
"function _stockCommit(id, patch) {",
"  var stocks = DB.get('mdb_stocks') || [];",
"  for (var i = 0; i < stocks.length; i++) {",
"    if (stocks[i].id === id) { for (var k in patch) stocks[i][k] = patch[k]; break; }",
"  }",
"  DB.set('mdb_stocks', stocks);",
"  toast('Stock modifi\\u00e9');",
"  renderStock();",
"}",
"",
"function inlineStockNum(ev, id, field, val) {",
"  ev.stopPropagation();",
"  var td = ev.currentTarget;",
"  var cur = parseFloat(val) || 0;",
"  td.innerHTML = '<input type=\"number\" min=\"0\" value=\"' + cur + '\" style=\"width:95px;padding:4px 6px;border:1px solid var(--primary);border-radius:4px;font-size:12px;text-align:right\" id=\"stkInlineNum\">';",
"  var inp = document.getElementById('stkInlineNum');",
"  inp.focus(); inp.select();",
"  var done = false;",
"  function commit() { if (done) return; done = true; var v = parseFloat(inp.value) || 0; var p2 = {}; p2[field] = v; _stockCommit(id, p2); }",
"  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') commit(); else if (e.key === 'Escape') { done = true; renderStock(); } });",
"  inp.addEventListener('blur', commit);",
"}",
"",
"function inlineStockArticle(id, curArtId) {",
"  var td = event.currentTarget;",
"  var arts = getArticles();",
"  var h = '<select id=\"stkInlineSel\" style=\"width:100%;max-width:220px;padding:4px;border:1px solid var(--primary);border-radius:4px;font-size:12px\"><option value=\"\">--</option>';",
"  for (var i = 0; i < arts.length; i++) h += '<option value=\"' + arts[i].id + '\"' + (arts[i].id === curArtId ? ' selected' : '') + '>' + escH(arts[i].code + ' - ' + arts[i].designation) + '</option>';",
"  h += '</select>';",
"  td.innerHTML = h;",
"  var sel = document.getElementById('stkInlineSel');",
"  sel.focus();",
"  var done = false;",
"  sel.addEventListener('keydown', function(e) { if (e.key === 'Escape') { done = true; renderStock(); } });",
"  sel.addEventListener('change', function() {",
"    if (done) return; done = true;",
"    if (!sel.value) { renderStock(); return; }",
"    var art = getArticleById(sel.value);",
"    _stockCommit(id, { articleId: sel.value, articleNom: art ? art.designation : '', articleCode: art ? art.code : '' });",
"  });",
"  sel.addEventListener('blur', function() { setTimeout(function() { if (!done) renderStock(); }, 120); });",
"}"
].join("\r\n");

s = s.slice(0, rsStart) + NEW_RS + s.slice(rsEnd);
n++;
console.log('OK renderStock reecrite + inline + filtre');

/* ================= 2. DASHBOARD ACTIF : detail des rubriques + recherche ================= */

var INS =
"  html += '<div style=\"display:flex;justify-content:flex-end;margin:14px 0 10px\"><input type=\"text\" id=\"actifDashSearch\" placeholder=\"Rechercher une rubrique ou une ligne...\" oninput=\"filterActifDash()\" style=\"width:280px;padding:7px 12px;border:1px solid var(--gray-300);border-radius:var(--radius-sm);font-size:13px;outline:none\"></div>';" + "\r\n" +
"  html += '<div id=\"actifDashRubriques\">';" + "\r\n" +
"  for (var _ari = 0; _ari < AD.rubriques.length; _ari++) {" + "\r\n" +
"    var _rubA = AD.rubriques[_ari];" + "\r\n" +
"    var _vdA = _rubA.visibleDetails || [];" + "\r\n" +
"    html += '<div class=\"ad-rub\" data-adtext=\"' + escH(String(_rubA.nom || '').toLowerCase()) + '\" style=\"margin-bottom:10px;border-left:3px solid ' + (_rubA.color || 'var(--gray-400)') + ';padding-left:10px\">';" + "\r\n" +
"    html += '<div style=\"display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;padding:3px 0;cursor:pointer\" onclick=\"navigateTo(\\'actif\\')\"><span>' + escH(_rubA.nom) + '</span><span style=\"white-space:nowrap;margin-left:12px;color:' + ((_rubA.rubTotal || 0) < 0 ? 'var(--danger)' : 'var(--success)') + '\">' + fmtMoney(_rubA.rubTotal || 0) + '</span></div>';" + "\r\n" +
"    for (var _adi = 0; _adi < _vdA.length; _adi++) {" + "\r\n" +
"      var _ddA = _vdA[_adi];" + "\r\n" +
"      html += '<div class=\"ad-row\" data-adtext=\"' + escH(String(_ddA.designation || '').toLowerCase()) + '\" style=\"display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--gray-600);padding:2px 0 2px 12px\"><span style=\"overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">' + escH(_ddA.designation || '') + '</span><span style=\"white-space:nowrap;font-weight:600;color:' + (_ddA.signe === '-' ? 'var(--danger)' : 'var(--success)') + '\">' + (_ddA.signe === '-' ? '- ' : '+ ') + fmtMoney(Math.abs(_ddA.montant || 0)) + '</span></div>';" + "\r\n" +
"    }" + "\r\n" +
"    html += '</div>';" + "\r\n" +
"  }" + "\r\n" +
"  html += '</div>';";

var pinAnchor = "if (actifPin) { html += '</div>'; }";
var cPin = s.split(pinAnchor).length - 1;
if (cPin !== 1) { console.error('ancre actifPin x' + cPin); process.exit(1); }
s = s.replace(pinAnchor, INS + "\r\n  " + pinAnchor);
n++;
console.log('OK bloc rubriques dashboard insere');

/* fonction de filtrage */
var fAnchor = "function setDashDetteSource(mode) {";
if (s.split(fAnchor).length - 1 !== 1) { console.error('ancre setDashDetteSource'); process.exit(1); }
var FILTER_FN =
"function filterActifDash() {" +
"  var inp = document.getElementById('actifDashSearch');" +
"  if (!inp) return;" +
"  var q = (inp.value || '').toLowerCase().trim();" +
"  var wraps = document.querySelectorAll('#actifDashRubriques .ad-rub');" +
"  for (var i = 0; i < wraps.length; i++) {" +
"    var w = wraps[i];" +
"    var rows = w.getElementsByClassName('ad-row');" +
"    var any = false;" +
"    var rubMatch = q !== '' && (w.getAttribute('data-adtext') || '').indexOf(q) !== -1;" +
"    for (var j = 0; j < rows.length; j++) {" +
"      var show = q === '' || rubMatch || (rows[j].getAttribute('data-adtext') || '').indexOf(q) !== -1;" +
"      rows[j].style.display = show ? '' : 'none';" +
"      if (show) any = true;" +
"    }" +
"    w.style.display = (q === '' || any || rubMatch) ? '' : 'none';" +
"  }" +
"}" +
"\r\n";
s = s.replace(fAnchor, FILTER_FN + fAnchor);
n++;
console.log('OK filterActifDash ajoutee');

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

/* verifs */
console.log('\r\n=== VERIFS ===');
console.log('renderStock nouvelle   :', s.indexOf("inlineStockArticle") > 0 ? 'OK' : 'ECHEC');
console.log('filtre zero            :', s.indexOf("stockFiltreQte") > 0 ? 'OK' : 'ECHEC');
console.log('_stockCommit           :', s.indexOf("function _stockCommit") > 0 ? 'OK' : 'ECHEC');
console.log('openStockModal intact  :', s.indexOf('function openStockModal(id) {') > 0 ? 'OK' : 'ECHEC');
console.log('bloc dashboard         :', s.indexOf("id=\"actifDashSearch\"") > 0 ? 'OK' : 'ECHEC');
console.log('filterActifDash        :', s.indexOf("function filterActifDash()") > 0 ? 'OK' : 'ECHEC');
