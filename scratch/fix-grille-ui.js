const fs = require('fs');
let t = fs.readFileSync('public/paye.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* 1) Extraire les donnees de grille dans une fonction reutilisable */
rep(
  "function loadWoodSectorGrid() {\r\n  if (!confirm('Charger la grille salariale officielle du secteur du bois ?\\nBareme 2015 (arrete n°2015-855 du 30/12/2015) revalorise de +12% (SMIG 75 000 FCFA).\\nLes categories existantes seront remplacees.')) return;\r\n  var H = 173.33;",
  [
    "function woodSectorGridData() {",
    "  var H = 173.33;"
  ].join('\r\n'),
  'debut woodSectorGridData'
);

rep(
  [
    "  ];",
    "  setCategories(grid);",
    "  loadCategories();",
    "  toast('Grille secteur du bois chargee : Bareme Officiel 2015 (arrete n°2015-855) + revalorisation 12% (SMIG 75 000)', 'success');",
    "}"
  ].join('\r\n'),
  [
    "  ];",
    "  return grid;",
    "}",
    "function loadWoodSectorGrid() {",
    "  if (!confirm('Recharger la grille salariale officielle du secteur du bois ?\\nBareme 2015 (arrete n°2015-855 du 30/12/2015) revalorise de +12% (SMIG 75 000 FCFA).\\nVos modifications personnelles seront remplacees.')) return;",
    "  setCategories(woodSectorGridData());",
    "  loadCategories();",
    "  toast('Grille secteur du bois rechargee', 'success');",
    "}"
  ].join('\r\n'),
  'fin woodSectorGridData'
);

/* 2) loadCategories : grille bois par defaut si vide + bouton Modifier */
rep(
  [
    "function loadCategories() {",
    "  var cats = getCategories();",
    "  var tbody = document.getElementById('cat-tbody');"
  ].join('\r\n'),
  [
    "function loadCategories() {",
    "  var cats = getCategories();",
    "  window._catsIsDefault = false;",
    "  if (!cats || !cats.length) { cats = woodSectorGridData(); window._catsIsDefault = true; }",
    "  var tbody = document.getElementById('cat-tbody');"
  ].join('\r\n'),
  'loadCategories default'
);

rep(
  "<td style=\"text-align:right;font-weight:700\">' + fmtF(item.c.salaire_min) + '</td><td><button class=\"btn btn-red\" onclick=\"delCategorie(' + item.i + ')\">X</button></td>",
  "<td style=\"text-align:right;font-weight:700\">' + fmtF(item.c.salaire_min) + '</td><td style=\"white-space:nowrap\"><button class=\"btn-sec\" style=\"padding:2px 6px;font-size:.7rem\" onclick=\"editCategorie(' + item.i + ')\">\\u270f</button> <button class=\"btn btn-red\" style=\"padding:2px 6px;font-size:.7rem\" onclick=\"delCategorie(' + item.i + ')\">X</button></td>",
  'bouton modifier'
);
/* la meme chaine apparait 2 fois (groupes principaux + extra) */
t = t.replace("<td style=\"text-align:right;font-weight:700\">' + fmtF(item.c.salaire_min) + '</td><td><button class=\"btn btn-red\" onclick=\"delCategorie(' + item.i + ')\">X</button></td>",
              "<td style=\"text-align:right;font-weight:700\">' + fmtF(item.c.salaire_min) + '</td><td style=\"white-space:nowrap\"><button class=\"btn-sec\" style=\"padding:2px 6px;font-size:.7rem\" onclick=\"editCategorie(' + item.i + ')\">\\u270f</button> <button class=\"btn btn-red\" style=\"padding:2px 6px;font-size:.7rem\" onclick=\"delCategorie(' + item.i + ')\">X</button></td>");

/* 3) delCategorie / editCategorie gerent le cas grille par defaut non persistee */
rep(
  "function delCategorie(i) { var c = getCategories(); c.splice(i,1); setCategories(c); loadCategories(); }",
  [
    "function _ensureCatsPersisted() {",
    "  if (window._catsIsDefault) { setCategories(woodSectorGridData()); window._catsIsDefault = false; }",
    "  return getCategories();",
    "}",
    "function delCategorie(i) { var c = _ensureCatsPersisted(); c.splice(i,1); setCategories(c); loadCategories(); }",
    "function editCategorie(i) {",
    "  var c = _ensureCatsPersisted();",
    "  var it = c[i];",
    "  if (!it) return;",
    "  var nc = prompt('Code de la categorie :', it.code);",
    "  if (nc === null) return;",
    "  var nl = prompt('Libelle :', it.libelle);",
    "  if (nl === null) return;",
    "  var ns = prompt('Salaire minimum mensuel (FCFA) :', it.salaire_min);",
    "  if (ns === null) return;",
    "  ns = parseFloat(ns);",
    "  if (isNaN(ns) || ns < 0) { toast('Montant invalide', 'error'); return; }",
    "  it.code = nc.trim() || it.code;",
    "  it.libelle = nl.trim() || it.libelle;",
    "  it.salaire_min = Math.round(ns);",
    "  setCategories(c);",
    "  loadCategories();",
    "  toast('Categorie modifiee', 'success');",
    "}"
  ].join('\r\n'),
  'del/edit categorie'
);

/* 4) Bouton "Ouvrir l'appli principale" compatible iframe (volet integre) */
rep(
  "onclick=\"try{var w=window.open('index.html','_blank');if(!w||w.closed)location.href='index.html';}catch(e){location.href='index.html';}\"",
  "onclick=\"try{if(window.self!==window.top){try{window.top.location.reload();return;}catch(e){}}var w=window.open('index.html','_blank');if(!w||w.closed)location.href='index.html';}catch(e){location.href='index.html';}\"",
  'bouton appli principale iframe'
);

fs.writeFileSync('public/paye.html', t);
console.log('OK paye.html : grille par defaut + modification + iframe');
