const fs = require('fs');

const F = 'public/index.html';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
function rep(fnd, rpl, lbl, all) {
  const c = s.split(fnd).length - 1;
  if (!c) { console.error('ANCRE INTROUVABLE:', lbl); process.exit(1); }
  if (!all && c > 1) { console.error('ANCRE x' + c + ':', lbl); process.exit(1); }
  s = s.split(fnd).join(rpl);
  n++;
  console.log('OK', lbl, '(' + c + 'x)');
}

/* ======== 1. carte mots-cles onglets pour la recherche laterale ======== */
var TABS_MAP = [
"/* Mots-cles d onglets par menu : la recherche laterale remonte le menu parent */",
"var MENU_TABS = {",
"  dashboard: ['tableau de bord', 'statistiques', 'indicateurs'],",
"  tiers: ['clients', 'fournisseurs'],",
"  facturation: ['bc', 'bon de commande', 'bons de commande', 'bl', 'bon de livraison', 'bons de livraison', 'factures', 'facture', 'devis', 'proforma', 'journal des ventes', 'ventes'],",
"  nomenclature: ['articles', 'nomenclature'],",
"  creancesDettes: ['creances', 'dettes', 'recouvrement'],",
"  previsions: ['previsions', 'previsionnel'],",
"  stock: ['stock', 'stocks', 'inventaire', 'articles en stock'],",
"  suiviLivraisons: ['suivi', 'livraisons'],",
"  typeElementsAchats: ['types d achats'],",
"  elementsAchats: ['elements achats', 'achats'],",
"  bonsCommandeFournisseurs: ['bc fournisseur', 'commandes fournisseurs'],",
"  prefinancement: ['prefinancement', 'financement'],",
"  tresorerie: ['caisse', 'banque', 'operations diverses', 'encaissements', 'decaissements', 'solde'],",
"  employes: ['employes', 'personnel', 'salaries'],",
"  acomptesPrets: ['acomptes', 'prets'],",
"  paye: ['paie', 'salaires', 'grille salariale', 'bulletins', 'pointage'],",
"  journal: ['journal des ventes', 'ventes', 'import journal'],",
"  actif: ['actif', 'rubriques', 'patrimoine'],",
"  taches: ['taches']",
"};",
""].join("\r\n");

rep(
"function buildSidebar(",
TABS_MAP + "function buildSidebar(",
"carte MENU_TABS inseree"
);

/* enrichir les data-search des items de menu */
rep(
"data-search=\"' + escH(item.label).toLowerCase() + '\"",
"data-search=\"' + (escH(item.label) + ' ' + (MENU_TABS[baseKey] || []).join(' ')).toLowerCase() + '\"",
"data-search enrichis",
true
);

/* ======== 2. champ recherche sur la page du menu ACTIF ======== */
rep(
"html += '<label style=\"display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;color:var(--gray-600)\"><input type=\"checkbox\" id=\"hideZeroCheck\"",
"html += '<input type=\"text\" id=\"actifSearch\" placeholder=\"Rechercher une ligne...\" oninput=\"filterActifTable()\" style=\"width:240px;padding:7px 12px;border:1px solid var(--gray-300);border-radius:var(--radius-sm);font-size:13px\">';" + "\r\n" +
"  html += '<label style=\"display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;color:var(--gray-600)\"><input type=\"checkbox\" id=\"hideZeroCheck\"",
"champ recherche page actif"
);

rep(
"function setAllPrintModes(v) {",
"function filterActifTable() {" +
"  var inp = document.getElementById('actifSearch');" +
"  if (!inp) return;" +
"  var q = (inp.value || '').toLowerCase().trim();" +
"  var secs = document.querySelectorAll('#content .section');" +
"  for (var i = 0; i < secs.length; i++) {" +
"    var sec = secs[i];" +
"    var head = sec.querySelector('.section-header');" +
"    var headTxt = head ? head.innerText.toLowerCase() : '';" +
"    var body = sec.querySelector('.section-body');" +
"    if (!body) { sec.style.display = (!q || headTxt.indexOf(q) !== -1) ? '' : 'none'; continue; }" +
"    if (!q) { sec.style.display = ''; var _allTr = body.querySelectorAll('tr'); for (var _at = 0; _at < _allTr.length; _at++) _allTr[_at].style.display = ''; continue; }" +
"    var rows = body.querySelectorAll('tbody > tr');" +
"    var any = false;" +
"    var headMatch = headTxt.indexOf(q) !== -1;" +
"    for (var r2 = 0; r2 < rows.length; r2++) {" +
"      var tr = rows[r2];" +
"      if (tr.id && tr.id.indexOf('actifDetail_') === 0) continue;" +
"      var txt = (tr.innerText || '').toLowerCase();" +
"      var show = headMatch || txt.indexOf(q) !== -1;" +
"      tr.style.display = show ? '' : 'none';" +
"      var nxt = tr.nextElementSibling;" +
"      if (nxt && nxt.id && nxt.id.indexOf('actifDetail_') === 0 && !show) nxt.style.display = 'none';" +
"      if (show) any = true;" +
"    }" +
"    sec.style.display = (!any && !headMatch) ? 'none' : '';" +
"  }" +
"}" +
"\r\n" +
"function setAllPrintModes(v) {",
"fonction filtre page actif"
);

fs.writeFileSync(F, s);
console.log('\r\ncorrectifs appliques:', n);

console.log('\r\n=== VERIFS ===');
console.log('MENU_TABS          :', s.split('MENU_TABS').length - 1);
console.log('actifSearch        :', s.split('actifSearch').length - 1);
console.log('filterActifTable   :', s.split('filterActifTable').length - 1);
