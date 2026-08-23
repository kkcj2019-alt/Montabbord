const fs = require('fs');
const idx = fs.readFileSync('public/index.html', 'utf8');
const paye = fs.readFileSync('public/paye.html', 'utf8');
function c(src, l, n) { console.log(l, src.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
c(idx, 'merge cloud mdb_paye     =', "_grdK = ['categories', 'services'");
c(idx, 'seed permanent au boot   =', 'function ensureGrillePersisteeI()');
c(idx, 'timers seed              =', 'setTimeout(ensureGrillePersisteeI, 2500)');
c(idx, 'cellule cumulee main     =', 'function deptFoncCellI(p)');
c(idx, 'entete liste cumulee     =', '<th>Matricule & Nom</th><th>D\u00e9partement / Fonction</th>');
c(idx, 'csv cumule               =', "'Matricule & Nom','D\u00e9partement/Fonction'");
c(idx, 'plus ancien entete       =', idx.indexOf('<th>Matricule</th><th>Nom & Pr\u00e9noms</th><th>D\u00e9partement</th>') === -1 ? 'SUPPRIME OK' : 'ENCORE LA');
c(paye, 'cellule cumulee paye     =', 'function deptFoncCell(p)');
c(paye, 'entete paye cumulee      =', "<th>Matricule & Nom</th><th>D\\u00e9partement / Fonction</th>");
c(paye, 'garde cloud etendue      =', "KEYS=['categories','services','fonctions','primesSpec','pointage']");
console.log('anciennes cellules sep. paye =', paye.indexOf("escH(p.service || '-') + '</td><td>' + escH(p.fonction || '-')") === -1 ? 'SUPPRIMEES OK' : 'ENCORE LA');
