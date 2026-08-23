const fs = require('fs');
let nRep = 0;

/* ===================== A) PAYE : ajouter Abréviation + Sortie ===================== */
let p = fs.readFileSync('public/paye.html', 'utf8');
function repP(oldS, newS, label) {
  const i = p.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE (paye): ' + label); process.exit(1); }
  p = p.slice(0, i) + newS + p.slice(i + oldS.length);
  nRep++;
}

repP('<div class="form-group"><label>Nom</label><input type="text" name="nom" required></div>',
     '<div class="form-group"><label>Nom</label><input type="text" name="nom" required></div>\r\n<div class="form-group"><label>Abr\u00e9viation</label><input type="text" name="abreviation" placeholder="Ex: JDO"></div>',
     'abreviation');

repP('<div class="form-group"><label>Statut</label><select name="status"><option value="actif">Actif</option><option value="inactif">Inactif</option></select></div>\r\n</div>',
     '<div class="form-group"><label>Statut</label><select name="status" onchange="toggleSortieP()"><option value="actif">Actif</option><option value="inactif">Inactif (sorti)</option></select></div>\r\n<div class="form-group" id="sortie-date-g" style="display:none"><label>Date de sortie</label><input type="date" name="date_sortie"></div>\r\n<div class="form-group" id="sortie-motif-g" style="display:none"><label>Motif de sortie</label><input type="text" name="motif_sortie" placeholder="Fin contrat, d\u00e9mission, licenciement..."></div>\r\n</div>',
     'sortie fields');

repP("function closeEmpModal() { document.getElementById('form-personnel').reset(); document.getElementById('modal-emp').classList.remove('open'); }",
     [
      "function closeEmpModal() { document.getElementById('form-personnel').reset(); toggleSortieP(); document.getElementById('modal-emp').classList.remove('open'); }",
      'function toggleSortieP() {',
      "  var st = document.querySelector('#form-personnel select[name=\"status\"]');",
      "  var show = st && st.value === 'inactif';",
      "  var g1 = document.getElementById('sortie-date-g');",
      "  var g2 = document.getElementById('sortie-motif-g');",
      "  if (g1) g1.style.display = show ? '' : 'none';",
      "  if (g2) g2.style.display = show ? '' : 'none';",
      '}'
     ].join('\r\n'),
     'toggleSortieP');

repP("  updateEmpTypeFields();\r\n  autoFillService();",
     "  updateEmpTypeFields();\r\n  toggleSortieP();\r\n  autoFillService();",
     'edit montre sortie');

repP("ind_fonction: parseFloat(f.elements['ind_fonction'] ? f.elements['ind_fonction'].value : 0)||0,",
     "ind_fonction: parseFloat(f.elements['ind_fonction'] ? f.elements['ind_fonction'].value : 0)||0,\r\n    abreviation: f.elements['abreviation'] ? f.elements['abreviation'].value : '', date_sortie: f.elements['date_sortie'] ? f.elements['date_sortie'].value : '', motif_sortie: f.elements['motif_sortie'] ? f.elements['motif_sortie'].value : '',",
     'save nouveaux champs');

fs.writeFileSync('public/paye.html', p);
console.log('Partie paye OK');
