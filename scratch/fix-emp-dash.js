const fs = require('fs');

const F = 'public/index.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function rep(fnd, rpl, lbl, expect) {
  const c = s.split(fnd).length - 1;
  if (c !== (expect || 1)) { console.error('ANCRE x' + c + ' (attendu ' + (expect || 1) + '):', lbl); process.exit(1); }
  s = s.split(fnd).join(rpl);
  n++;
  console.log('OK', lbl);
}

/* ======== 1. helper V manquant (crash saveEmploye) ======== */
rep(
'function saveEmploye(id) {',
'function V(id) { var _eV = document.getElementById(id); return _eV && typeof _eV.value !== "undefined" ? _eV.value : ""; }\r\n' +
'function saveEmploye(id) {',
'helper V()'
);

/* ======== 2. focus recherche employes ======== */
rep(
'oninput="window._empSearch=this.value;renderEmployesPage()"',
'oninput="window._empSearch=this.value;window._empRefocus=1;renderEmployesPage()"',
'refocus flag oninput',
1
);

rep(
'    if (!hasContent) html += \'<div style="text-align:center;padding:2rem;color:var(--gray-400)">Aucun employ\u00e9</div>\';\r\n    html += \'</div></div></div>\';\r\n  }\r\n  el.innerHTML = html;\r\n}',
'    if (!hasContent) html += \'<div style="text-align:center;padding:2rem;color:var(--gray-400)">Aucun employ\u00e9</div>\';\r\n    html += \'</div></div></div>\';\r\n  }\r\n  el.innerHTML = html;\r\n  if (window._empRefocus) { var _esi = document.getElementById(\'empSearch\'); if (_esi && document.activeElement !== _esi) { try { _esi.focus(); var _sl = _esi.value.length; _esi.setSelectionRange(_sl, _sl); } catch (e2f) {} } window._empRefocus = 0; }\r\n}',
'refocus fin renderEmployesPage'
);

/* ======== 3. edition en ligne tableau Personnel ======== */
var S0 = "      html += '<tr data-search=\"' + escH((p.matricule + ' ' + p.nom";
var iS = s.indexOf(S0);
if (iS < 0) { console.error('ligne tr introuvable'); process.exit(1); }
var ENDROW = "</td></tr>';";
var iE = s.indexOf(ENDROW, iS);
if (iE < 0) { console.error('fin tr introuvable'); process.exit(1); }
var ORIG = s.slice(iS, iE + ENDROW.length);
var idxAct = ORIG.indexOf('<td style="white-space:nowrap">');
if (idxAct < 0) { console.error('actions introuvables'); process.exit(1); }
var ACTIONS = ORIG.slice(idxAct);

var NEW_STMT = [
"      html += '<tr data-search=\"' + escH((p.matricule + ' ' + p.nom + ' ' + (p.prenoms||'') + ' ' + (p.abreviation||'') + ' ' + (p.fonction||'') + ' ' + (p.service||'')).toLowerCase()) + '\">';",
"      html += '<td class=\"fw-600\"><strong style=\"cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(p.matricule || '') + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'matricule\\')\">' + escH(p.matricule) + '</strong> - <span style=\"cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(p.nom || '') + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'nom\\')\">' + escH(p.nom) + '</span> <span style=\"cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(p.prenoms || '') + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'prenoms\\')\">' + escH(p.prenoms || '') + '</span></td>';",
"      html += '<td><span style=\"cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(p.service || '') + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'service\\')\">' + (escH(p.service) || '-') + '</span> / <span style=\"cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + escH(p.fonction || '') + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'fonction\\')\">' + (escH(p.fonction) || '-') + '</span></td>';",
"      html += '<td>' + escH(cat ? cat.libelle : (p.categorie_id || '-')) + '</td>';",
"      html += '<td><span style=\"cursor:pointer;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier la date\" onclick=\"_empInlineDate(event,\\'' + p.id + '\\')\">' + fmtDate(p.date_entree) + '</span></td>';",
"      html += '<td>' + dateFin + '</td><td>' + typeContratLabelI(p) + '</td>';",
"      if (!maskSal) html += '<td style=\"text-align:right;font-weight:700;cursor:text;border-bottom:1px dashed var(--gray-400)\" title=\"Cliquer pour modifier\" data-cur=\"' + (p.salaire_base || 0) + '\" onclick=\"_empInline(event,\\'' + p.id + '\\',\\'salaire_base\\',1)\">' + fmtFmt(p.salaire_base || 0) + '</td>';",
"      html += '<td>' + calcAncienneteI(p.date_entree) + '</td>';",
"      html += '"
].join("\r\n");

s = s.slice(0, iS) + NEW_STMT + ACTIONS + s.slice(iE + ENDROW.length);
n++;
console.log('OK ligne personnal editable');

/* helpers inline */
rep(
'\r\nfunction filterEmployes() {',
'\r\nfunction _empCommitEmp(empId, patch, label) {' +
'  var employes = getEmployes();' +
'  for (var i = 0; i < employes.length; i++) {' +
'    if (employes[i].id !== empId) continue;' +
'    for (var k in patch) employes[i][k] = patch[k];' +
'    if ("salaire_base" in patch) {' +
'      var d = new Date(); var ym = d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1);' +
'      if (!employes[i].salaire_history || !employes[i].salaire_history.length) employes[i].salaire_history = [{ montant: patch.salaire_base, dateEffet: ym }];' +
'      else employes[i].salaire_history[employes[i].salaire_history.length - 1].montant = patch.salaire_base;' +
'    }' +
'    break;' +
'  }' +
'  DB.set("mdb_employes", employes);' +
'  window._empRefocus = 1;' +
'  if (currentPage === "employes") renderEmployesPage();' +
'  toast(label || "Modifi\u00e9");' +
'}' +
'\r\n' +
'function _empInline(ev, empId, field, isNum) {' +
'  ev.stopPropagation();' +
'  var td = ev.currentTarget;' +
'  if (!td || td.dataset.editing === "1") return;' +
'  var cur = td.getAttribute("data-cur") || "";' +
'  td.dataset.editing = "1";' +
'  var old = td.innerHTML;' +
'  td.innerHTML = "";' +
'  var inp = document.createElement("input");' +
'  inp.type = "text"; inp.value = cur;' +
'  inp.style.cssText = "width:" + Math.max(80, Math.min(240, cur.length * 9 + 34)) + "px;padding:2px 6px;border:1px solid var(--primary);border-radius:6px;font-size:12px;outline:none";' +
'  if (isNum) inp.style.textAlign = "right";' +
'  td.appendChild(inp); inp.focus(); inp.select();' +
'  function done(save) {' +
'    if (td.dataset.editing !== "1") return;' +
'    td.dataset.editing = "0";' +
'    var v = inp.value.trim();' +
'    if (!save || v === cur) { td.innerHTML = old; return; }' +
'    if (isNum) {' +
'      var nn = parseFloat(v.replace(/\\s/g, "").replace(",", "."));' +
'      if (isNaN(nn)) { td.innerHTML = old; toast("Montant invalide", "error"); return; }' +
'      _empCommitEmp(empId, { salaire_base: nn }, "Salaire modifi\u00e9");' +
'      return;' +
'    }' +
'    var patch = {}; patch[field] = v;' +
'    _empCommitEmp(empId, patch);' +
'  }' +
'  inp.onblur = function () { done(true); };' +
'  inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); inp.onblur = null; done(true); } else if (e.key === "Escape") { e.preventDefault(); inp.onblur = null; done(false); } };' +
'}' +
'\r\n' +
'function _empInlineDate(ev, empId) {' +
'  ev.stopPropagation();' +
'  var td = ev.currentTarget;' +
'  if (!td || td.dataset.editing === "1") return;' +
'  var employes = getEmployes(); var e0 = null;' +
'  for (var i = 0; i < employes.length; i++) { if (employes[i].id === empId) { e0 = employes[i]; break; } }' +
'  if (!e0) return;' +
'  var cur = e0.date_entree || "";' +
'  td.dataset.editing = "1";' +
'  var old = td.innerHTML;' +
'  td.innerHTML = "";' +
'  var inp = document.createElement("input");' +
'  inp.type = "date"; inp.value = cur;' +
'  inp.style.cssText = "padding:2px 4px;border:1px solid var(--primary);border-radius:6px;font-size:12px;outline:none";' +
'  td.appendChild(inp); inp.focus();' +
'  function doneD(save) {' +
'    if (td.dataset.editing !== "1") return;' +
'    td.dataset.editing = "0";' +
'    var v = inp.value;' +
'    if (!save || v === cur) { td.innerHTML = old; return; }' +
'    _empCommitEmp(empId, { date_entree: v }, "Date modifi\u00e9e");' +
'  }' +
'  inp.onblur = function () { doneD(true); };' +
'  inp.onchange = function () { inp.onblur = null; doneD(true); };' +
'}' +
'\r\n' +
'function filterEmployes() {',
'helpers inline employes'
);

/* ======== 4. toolbar dashboard : Actifs/Reels general + Reorganiser ======== */
rep(
"  document.getElementById('content').innerHTML = '<div id=\"dashboardView\">' + html + '</div>';\r\n}",
"  document.getElementById('content').innerHTML = '<div id=\"dashboardView\">' + html + '</div>';\r\n  _initDashDnd();\r\n}",
'appel init dashboard'
);

rep(
'\r\nfunction globalSearchInput(q) {',

/* bloc complet insere avant globalSearchInput */
'\r\nvar _dashEdit = false, _dashDragEl = null;\r\n' +
'function _dashKeys(skipToolbar) {' +
'  var dv = document.getElementById("dashboardView");' +
'  if (!dv) return [];' +
'  var out = [];' +
'  for (var i = 0; i < dv.children.length; i++) {' +
'    var c = dv.children[i];' +
'    if (skipToolbar && c.id === "dashToolbar") continue;' +
'    var k = c.getAttribute("data-dashkey");' +
'    if (!k) {' +
'      k = c.getAttribute("data-sub") || "";' +
'      if (!k) { var h3 = c.querySelector ? c.querySelector("h3") : null; k = h3 ? ("h3:" + h3.textContent.trim().toLowerCase().slice(0, 30)) : ((c.className || "blk").split(" ")[0]); }' +
'      var base = k, n2 = 2;' +
'      while (out.indexOf(k) !== -1) { k = base + "#" + (n2++); }' +
'      c.setAttribute("data-dashkey", k);' +
'    }' +
'    out.push(k);' +
'  }' +
'  return out;' +
'}' +
'\r\n' +
'function _applyDashOrder() {' +
'  var dv = document.getElementById("dashboardView");' +
'  if (!dv) return;' +
'  _dashKeys(true);' +
'  var saved = DB.get("mdb_dash_order_" + (currentUser ? currentUser.id : "anon"));' +
'  if (saved && saved.length) {' +
'    var map = {}, i;' +
'    for (i = 0; i < dv.children.length; i++) map[dv.children[i].getAttribute("data-dashkey")] = dv.children[i];' +
'    var frag = document.createDocumentFragment();' +
'    for (i = 0; i < saved.length; i++) { if (map[saved[i]]) { frag.appendChild(map[saved[i]]); delete map[saved[i]]; } }' +
'    for (var kk in map) frag.appendChild(map[kk]);' +
'    dv.appendChild(frag);' +
'  }' +
'  _dashSetEdit(false);' +
'}' +
'\r\n' +
'function _dashSaveOrder() { DB.set("mdb_dash_order_" + (currentUser ? currentUser.id : "anon"), _dashKeys(true)); }' +
'function toggleDashEdit() { _dashSetEdit(!_dashEdit); }' +
'function _dashSetEdit(on) {' +
'  _dashEdit = !!on;' +
'  var dv = document.getElementById("dashboardView");' +
'  if (!dv) return;' +
'  var btn = document.getElementById("dashEditBtn");' +
'  if (btn) btn.innerHTML = _dashEdit ? "\\u2713 Terminer" : "\\u21C5 R\\u00e9organiser";' +
'  for (var i = 0; i < dv.children.length; i++) {' +
'    var c = dv.children[i];' +
'    if (c.id === "dashToolbar") continue;' +
'    c.setAttribute("draggable", _dashEdit ? "true" : "false");' +
'    c.style.outline = _dashEdit ? "2px dashed rgba(37,99,235,.55)" : "";' +
'    c.style.outlineOffset = _dashEdit ? "4px" : "";' +
'    c.style.cursor = _dashEdit ? "grab" : "";' +
'  }' +
'}' +
'function _dndStart(ev) { if (!_dashEdit) { ev.preventDefault(); return; } _dashDragEl = ev.currentTarget; try { ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", "d"); } catch (e) {} }' +
'function _dndOver(ev) { if (!_dashEdit) return; ev.preventDefault(); var t = ev.currentTarget; if (t === _dashDragEl || t.id === "dashToolbar") return; var r = t.getBoundingClientRect(); t.style.borderTopColor = (ev.clientY < r.top + r.height / 2) ? "#2563eb" : ""; t.style.borderBottomColor = (ev.clientY >= r.top + r.height / 2) ? "#2563eb" : ""; }' +
'function _dndLeave(ev) { var t = ev.currentTarget; if (t.style) { t.style.borderTopColor = ""; t.style.borderBottomColor = ""; } }' +
'function _dndDrop(ev) {' +
'  if (!_dashEdit) return;' +
'  ev.preventDefault();' +
'  var t = ev.currentTarget;' +
'  _dndLeave(ev);' +
'  if (!_dashDragEl || t === _dashDragEl || t.id === "dashToolbar") { _dashDragEl = null; return; }' +
'  var r = t.getBoundingClientRect();' +
'  var parent = t.parentNode;' +
'  if (ev.clientY < r.top + r.height / 2) parent.insertBefore(_dashDragEl, t); else parent.insertBefore(_dashDragEl, t.nextSibling);' +
'  _dashDragEl.style.opacity = "";' +
'  _dashSaveOrder();' +
'  _dashDragEl = null;' +
'}' +
'\r\n' +
'function setDashAllSource(mode) {' +
'  window._dashSrc = mode === "reel" ? "reel" : "actif";' +
'  DB.set("mdb_dash_src_" + (currentUser ? currentUser.id : "anon"), window._dashSrc);' +
'  _applyDashGlobals();' +
'  toast(window._dashSrc === "reel" ? "Vue R\\u00c9ELS appliqu\\u00e9e \\u00e0 toutes les cartes" : "Vue ACTIFS appliqu\\u00e9e \\u00e0 toutes les cartes");' +
'}' +
'function _applyDashGlobals() {' +
'  var mode = window._dashSrc || "actif";' +
'  var bA = document.getElementById("gsrcActif"), bR = document.getElementById("gsrcReel");' +
'  if (bA && bR) {' +
'    bA.style.background = mode === "reel" ? "transparent" : "var(--primary)"; bA.style.color = mode === "reel" ? "var(--gray-600)" : "#fff";' +
'    bR.style.background = mode === "reel" ? "var(--primary)" : "transparent"; bR.style.color = mode === "reel" ? "#fff" : "var(--gray-600)";' +
'  }' +
'  ["setDashDebSource", "setDashDetteSource", "setDashBlSource", "setDashStkSource", "setDashBlsSource"].forEach(function (fn) { try { if (typeof window[fn] === "function") window[fn](mode); } catch (e2g) {} });' +
'}' +
'\r\n' +
'function _initDashDnd() {' +
'  var dv = document.getElementById("dashboardView");' +
'  if (!dv) return;' +
'  if (!document.getElementById("dashToolbar")) {' +
'    var tb = document.createElement("div");' +
'    tb.id = "dashToolbar";' +
'    tb.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px";' +
'    tb.innerHTML = "<div style=\\"display:inline-flex;border:1px solid var(--gray-300);border-radius:8px;overflow:hidden;background:#fff\\">"' +
'      + "<button id=\\"gsrcActif\\" onclick=\\"setDashAllSource(\'actif\')\\" style=\\"padding:5px 14px;font-size:12px;border:none;background:var(--primary);color:#fff;cursor:pointer;font-weight:600\\">Actifs</button>"' +
'      + "<button id=\\"gsrcReel\\" onclick=\\"setDashAllSource(\'reel\')\\" style=\\"padding:5px 14px;font-size:12px;border:none;background:transparent;color:var(--gray-600);cursor:pointer;font-weight:600\\">R\\u00e9els</button>"' +
'      + "</div>"' +
'      + "<button id=\\"dashEditBtn\\" class=\\"btn btn-outline btn-sm\\" onclick=\\"toggleDashEdit()\\" title=\\"Glisser-d\\u00e9poser les cartes pour les r\\u00e9ordonner\\">\\u21C5 R\\u00e9organiser</button>";' +
'    dv.insertBefore(tb, dv.firstChild);' +
'    for (var i = 1; i < dv.children.length; i++) {' +
'      var c = dv.children[i];' +
'      c.setAttribute("ondragstart", "_dndStart(event)");' +
'      c.setAttribute("ondragover", "_dndOver(event)");' +
'      c.setAttribute("ondragleave", "_dndLeave(event)");' +
'      c.setAttribute("ondrop", "_dndDrop(event)");' +
'      c.setAttribute("ondragend", "_dndLeave(event)");' +
'    }' +
'  }' +
'  _applyDashOrder();' +
'  window._dashSrc = DB.get("mdb_dash_src_" + (currentUser ? currentUser.id : "anon")) || "actif";' +
'  _applyDashGlobals();' +
'}' +
'\r\n' +
'function globalSearchInput(q) {',
'bloc reorganisation + source globale'
);

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
['function V(', '_empRefocus', '_empInline(event', 'function _empCommitEmp', '_initDashDnd()', 'gsrcReel', 'mdb_dash_src_', 'mdb_dash_order_', 'function setDashAllSource', 'function _dndDrop'].forEach(function(k) {
  console.log(k.padEnd(26), s.split(k).length - 1);
});
