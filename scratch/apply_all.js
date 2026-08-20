const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// ============================================================
// 1. CORRIGER TAX_RULES (taux CNPS corrects + panier)
// ============================================================
html = html.replace(
`var TAX_RULES = {
  cnps_sal: 0.063, cnps_pat_ret: 0.077, cnps_pat_pf: 0.0575, cnps_pat_at: 0.03,
  fdfp_app: 0.004, fdfp_form: 0.006,
  transport_max_exo: 30000,
  ricf_per_part: 11000,
  scale: [ {limit:75000,rate:0}, {limit:240000,rate:0.16}, {limit:800000,rate:0.21}, {limit:2400000,rate:0.24}, {limit:8000000,rate:0.28}, {limit:Infinity,rate:0.32} ]
};`,
`var TAX_RULES = {
  cnps_sal: 0.063,          // Part salariale retraite 6,3%
  cnps_pat_ret: 0.077,       // Part patronale retraite 7,7%
  cnps_pat_pf: 0.05,         // Part patronale prestations familiales 5% (plafond 70 000)
  cnps_pat_mat: 0.0075,      // Part patronale assurance maternité 0,75% (plafond 70 000)
  cnps_pat_at: 0.02,         // Part patronale accidents du travail 2% (plafond 70 000)
  fdfp_app: 0.004, fdfp_form: 0.006,
  transport_max_exo: 30000,
  indemnites_spec_pct: 0.10, // Exonération indemnités spéciales: 10% rémunération totale numéraire
  panier_montant: 1500,       // Montant prime de panier (FCFA)
  ricf_per_part: 11000,
  scale: [ {limit:75000,rate:0}, {limit:240000,rate:0.16}, {limit:800000,rate:0.21}, {limit:2400000,rate:0.24}, {limit:8000000,rate:0.28}, {limit:Infinity,rate:0.32} ]
};`
);

// ============================================================
// 2. CORRIGER getLimits (plafond prestations fam / AT = 70 000)
// ============================================================
html = html.replace(
`function getLimits() {
  var lim = getPayeSection('limits', {}) || {};
  return { retraite: lim.retraite || 3375000, atpf: lim.atpf || 75000 };
}`,
`function getLimits() {
  var lim = getPayeSection('limits', {}) || {};
  return { retraite: lim.retraite || 3375000, atpf: lim.atpf || 70000 };
}`
);

// ============================================================
// 3. AJOUTER helpers prime panier
// ============================================================
const helperPanier = `
/* ===== Prime de Panier ===== */
function getPanierData() { return getPayeSection('primesPanier', {}) || {}; }
function setPanierData(v) { setPayeSection('primesPanier', v); }
function getPanierJours(empId, mois) {
  var d = getPanierData();
  var key = empId + '|' + mois;
  return Array.isArray(d[key]) ? d[key] : [];
}
function setPanierJours(empId, mois, jours) {
  var d = getPanierData();
  d[empId + '|' + mois] = jours;
  setPanierData(d);
}
function getPanierTotal(empId, mois) {
  var jours = getPanierJours(empId, mois);
  return jours.length * (TAX_RULES.panier_montant || 1500);
}
/* ===== Indemnités spéciales (exonérées ITS dans limite 10%) ===== */
function getIndSpec(empId) {
  var emps = getPersonnel();
  var emp = emps.find(function(e){ return e.id === empId; });
  if (!emp) return 0;
  return (parseFloat(emp.ind_representation)||0)
    + (parseFloat(emp.ind_deplacement)||0)
    + (parseFloat(emp.ind_salissure)||0)
    + (parseFloat(emp.ind_tenue)||0)
    + (parseFloat(emp.ind_caisse)||0)
    + (parseFloat(emp.ind_responsabilite)||0)
    + (parseFloat(emp.ind_fonction)||0);
}
`;

html = html.replace(
  '/* Prime mensuelle par employé : clé "empId|YYYY-MM" */',
  helperPanier + '\n/* Prime mensuelle par employé : clé "empId|YYYY-MM" */'
);

// ============================================================
// 4. AJOUTER initialisation stockage panier dans initData()
// ============================================================
html = html.replace(
  "if (!getPayeSection('primesMois', null)) setPayeSection('primesMois', {});",
  "if (!getPayeSection('primesMois', null)) setPayeSection('primesMois', {});\n  if (!getPayeSection('primesPanier', null)) setPayeSection('primesPanier', {});"
);

// ============================================================
// 5. MODIFIER calculatePayroll — indemnités spéciales + panier
//    Insérer après la ligne du gratif:
//    "if (gratifT > 0) items.push({ n: '26', label: 'Gratification', ..."
// ============================================================
html = html.replace(
  `  if (gratifT > 0) items.push({ n: '26', label: 'Gratification', base: gratifT, taux: '', gain: gratifT, ret: 0 });`,
  `  if (gratifT > 0) items.push({ n: '26', label: 'Gratification', base: gratifT, taux: '', gain: gratifT, ret: 0 });
  /* ===== Indemnités spéciales (Art.116 CGI - exo ITS 10%) ===== */
  var indRep = parseFloat(emp.ind_representation)||0;
  var indDep = parseFloat(emp.ind_deplacement)||0;
  var indSal = parseFloat(emp.ind_salissure)||0;
  var indTen = parseFloat(emp.ind_tenue)||0;
  var indCai = parseFloat(emp.ind_caisse)||0;
  var indRes = parseFloat(emp.ind_responsabilite)||0;
  var indFon = parseFloat(emp.ind_fonction)||0;
  if (indRep > 0) items.push({ n: '30', label: 'Prime de représentation', base: indRep, taux: '', gain: indRep, ret: 0 });
  if (indDep > 0) items.push({ n: '31', label: 'Prime de déplacement', base: indDep, taux: '', gain: indDep, ret: 0 });
  if (indSal > 0) items.push({ n: '32', label: 'Prime de salissure', base: indSal, taux: '', gain: indSal, ret: 0 });
  if (indTen > 0) items.push({ n: '33', label: 'Prime de tenue', base: indTen, taux: '', gain: indTen, ret: 0 });
  if (indCai > 0) items.push({ n: '34', label: 'Prime de caisse', base: indCai, taux: '', gain: indCai, ret: 0 });
  if (indRes > 0) items.push({ n: '35', label: 'Prime de responsabilité', base: indRes, taux: '', gain: indRes, ret: 0 });
  if (indFon > 0) items.push({ n: '36', label: 'Prime de fonction', base: indFon, taux: '', gain: indFon, ret: 0 });
  /* Prime de panier */
  var panierT = getPanierTotal(emp.id, mois);
  if (panierT > 0) items.push({ n: '29', label: 'Prime de panier', base: panierT, taux: getPanierJours(emp.id, mois).length + 'j', gain: panierT, ret: 0 });`
);

// ============================================================
// 6. CORRIGER le calcul de brutFiscal et brutSocial
//    Remplacer le bloc transportExo / brutFiscal / brutSocial
// ============================================================
const oldBrutCalc = `  var transportExo = Math.min(stats.transport, TAX_RULES.transport_max_exo);
  var brutFiscal = totalBrut - transportExo - totalNonTaxable;
  var brutSocial = totalBrut - transportExo - totalNonTaxable;`;

const newBrutCalc = `  var transportExo = Math.min(stats.transport, TAX_RULES.transport_max_exo);
  /* Rémunération totale en numéraire (hors avantages nature) pour calcul plafond 10% */
  var remuNumeraire = totalBrut - totalAvantages;
  /* Indemnités spéciales : exonérées ITS dans la limite de 10% rémunération numéraire totale (Art.116 CGI) */
  var totalIndSpec = (parseFloat(emp.ind_representation)||0)+(parseFloat(emp.ind_deplacement)||0)
    +(parseFloat(emp.ind_salissure)||0)+(parseFloat(emp.ind_tenue)||0)
    +(parseFloat(emp.ind_caisse)||0)+(parseFloat(emp.ind_responsabilite)||0)
    +(parseFloat(emp.ind_fonction)||0);
  var plafond10pct = remuNumeraire * (TAX_RULES.indemnites_spec_pct || 0.10);
  var indSpecExo = Math.min(totalIndSpec, plafond10pct);  // Part exonérée d'ITS
  var indSpecImposable = totalIndSpec - indSpecExo;        // Part soumise à ITS
  /* Brut fiscal = base ITS (hors transport exo + hors indemnités spéciales exonérées) */
  var brutFiscal = totalBrut - transportExo - totalNonTaxable - indSpecExo;
  /* Brut social = base CNPS (indemnités spéciales restent dans la base sociale) */
  var brutSocial = totalBrut - transportExo - totalNonTaxable;`;

html = html.replace(oldBrutCalc, newBrutCalc);

// ============================================================
// 7. CORRIGER les cotisations CNPS patronales (plafond AT/PF = 70 000, ajouter maternité)
// ============================================================
html = html.replace(
  `  items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '2,00', retPat: Math.floor(baseATPF * 0.02) });
  items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: '5,75', retPat: Math.floor(baseATPF * 0.0575) });`,
  `  var atPatRate = TAX_RULES.cnps_pat_at || 0.02;
  var pfPatRate = TAX_RULES.cnps_pat_pf || 0.05;
  var matPatRate = TAX_RULES.cnps_pat_mat || 0.0075;
  items.push({ n: '62', label: 'CNPS, Accident Travail', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (atPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * atPatRate) });
  items.push({ n: '63', label: 'CNPS, Prest. Famil.', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (pfPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * pfPatRate) });
  items.push({ n: '64', label: 'CNPS, Ass. Maternité', base: baseATPF, taux: '', gain: 0, ret: 0, tauxPat: (matPatRate*100).toFixed(2).replace('.',','), retPat: Math.floor(baseATPF * matPatRate) });`
);

// ============================================================
// 8. AJOUTER un onglet "Prime de Panier" dans le pointage
// ============================================================
html = html.replace(
  '<button id="pt-tab-montage" onclick="switchPtTab(\'montage\')">Production (Montage)</button>',
  '<button id="pt-tab-montage" onclick="switchPtTab(\'montage\')">Production (Montage)</button>\n<button id="pt-tab-panier" onclick="switchPtTab(\'panier\')">Prime de Panier</button>'
);

// Ajouter le container pour le panier
html = html.replace(
  '<div id="pt-montage-container" style="display:none">',
  '<div id="pt-panier-container" style="display:none"><div style="text-align:center;padding:2rem;color:var(--dim)">Sélectionnez un mois</div></div>\n<div id="pt-montage-container" style="display:none">'
);

// ============================================================
// 9. MODIFIER switchPtTab pour gérer l'onglet panier
// ============================================================
html = html.replace(
  "var ptCurrentTab = 'heures';",
  "var ptCurrentTab = 'heures';\nfunction switchPtTab(tab) {\n  ptCurrentTab = tab;\n  document.getElementById('pt-tab-heures').classList.toggle('active', tab==='heures');\n  document.getElementById('pt-tab-montage').classList.toggle('active', tab==='montage');\n  document.getElementById('pt-tab-panier').classList.toggle('active', tab==='panier');\n  document.getElementById('pt-container').style.display = tab==='heures' ? '' : 'none';\n  document.getElementById('pt-montage-container').style.display = tab==='montage' ? '' : 'none';\n  document.getElementById('pt-panier-container').style.display = tab==='panier' ? '' : 'none';\n  if (tab==='panier') loadPanierUI();\n  else if (tab==='montage') loadPointageMontage();\n  else loadPointage();\n}"
);

// ============================================================
// 10. AJOUTER la fonction loadPanierUI()
// ============================================================
const panierUIFunc = `
/* ==================== PRIME DE PANIER UI ==================== */
function loadPanierUI() {
  var container = document.getElementById('pt-panier-container');
  var mois = document.getElementById('pt-mois').value;
  if (!mois) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--dim)">Sélectionnez un mois</div>'; return; }

  var year = parseInt(mois.split('-')[0]);
  var mIdx = parseInt(mois.split('-')[1]) - 1;
  var daysInMonth = new Date(year, mIdx + 1, 0).getDate();
  var personList = getPersonnelActifs().filter(function(p){ return p.en_paie !== false && empCategorie(p) !== 'externe'; });
  var panierData = getPanierData();
  var montantUn = TAX_RULES.panier_montant || 1500;

  var h = '<div style="margin-bottom:1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap">';
  h += '<span style="font-weight:700;font-size:.85rem">Prime de Panier — ' + mois + '</span>';
  h += '<label style="font-size:.78rem">Montant/jour : <input type="number" id="panier-montant-unit" value="' + montantUn + '" min="0" step="100" style="width:100px;padding:3px 6px" onchange="TAX_RULES.panier_montant=parseFloat(this.value)||1500;setPayeSection(\'taxRules\',TAX_RULES);loadPanierUI()"> FCFA</label>';
  h += '<button class="btn btn-sec" onclick="selectAllPanier()" style="font-size:.75rem;padding:4px 10px">Cocher tout</button>';
  h += '<button class="btn btn-sec" onclick="clearAllPanier()" style="font-size:.75rem;padding:4px 10px">Tout effacer</button>';
  h += '<button class="btn" onclick="savePanierUI()" style="font-size:.75rem;padding:4px 14px">Enregistrer</button>';
  h += '</div>';

  // En-tête calendrier
  h += '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:.72rem;min-width:900px">';
  h += '<thead><tr><th style="border:1px solid #d1d5db;padding:4px 8px;text-align:left;min-width:160px">Employé</th>';

  var jNoms = ['L','M','M','J','V','S','D'];
  for (var d = 1; d <= daysInMonth; d++) {
    var dow = new Date(year, mIdx, d).getDay(); // 0=dim
    var isWE = dow === 0 || dow === 6;
    h += '<th style="border:1px solid #d1d5db;padding:3px 2px;text-align:center;width:28px;' + (isWE ? 'background:#fef3c7' : '') + '">' +
      '<div>' + jNoms[(dow+6)%7] + '</div><div style="font-weight:800">' + d + '</div></th>';
  }
  h += '<th style="border:1px solid #d1d5db;padding:4px;text-align:right">Total</th></tr></thead><tbody>';

  personList.forEach(function(emp) {
    var key = emp.id + '|' + mois;
    var checked = Array.isArray(panierData[key]) ? panierData[key] : [];
    var total = checked.length * (TAX_RULES.panier_montant || 1500);
    h += '<tr>';
    h += '<td style="border:1px solid #d1d5db;padding:3px 6px;white-space:nowrap">' +
      '<label style="display:flex;align-items:center;gap:6px"><input type="checkbox" class="panier-emp-sel" data-empid="' + emp.id + '" style="width:13px;height:13px"> ' +
      escH(emp.nom) + ' ' + escH(emp.prenoms||'') + '</label></td>';
    for (var dd = 1; dd <= daysInMonth; dd++) {
      var dateStr = mois + '-' + (dd < 10 ? '0' : '') + dd;
      var dow2 = new Date(year, mIdx, dd).getDay();
      var isWE2 = dow2 === 0 || dow2 === 6;
      var isChecked = checked.indexOf(dateStr) !== -1;
      h += '<td style="border:1px solid #d1d5db;text-align:center;' + (isWE2 ? 'background:#fef9e7' : '') + '">' +
        '<input type="checkbox" class="panier-cb" data-empid="' + emp.id + '" data-date="' + dateStr + '"' +
        (isChecked ? ' checked' : '') + ' style="width:14px;height:14px"></td>';
    }
    h += '<td style="border:1px solid #d1d5db;padding:3px 6px;text-align:right;font-weight:700" id="panier-total-' + emp.id + '">' +
      (total > 0 ? fmtF(total) + ' F' : '-') + '</td>';
    h += '</tr>';
  });

  h += '</tbody></table></div>';
  container.innerHTML = h;

  // Listener pour maj total en temps réel
  container.querySelectorAll('.panier-cb').forEach(function(cb) {
    cb.addEventListener('change', function() {
      var empId = this.dataset.empid;
      var totalEl = document.getElementById('panier-total-' + empId);
      if (!totalEl) return;
      var cnt = container.querySelectorAll('.panier-cb[data-empid="' + empId + '"]:checked').length;
      var tot = cnt * (TAX_RULES.panier_montant || 1500);
      totalEl.textContent = tot > 0 ? (tot.toLocaleString('fr-FR') + ' F') : '-';
    });
  });
}

function savePanierUI() {
  var container = document.getElementById('pt-panier-container');
  var mois = document.getElementById('pt-mois').value;
  if (!mois) return;
  var d = getPanierData();
  var empIds = new Set();
  container.querySelectorAll('.panier-cb').forEach(function(cb) { empIds.add(cb.dataset.empid); });
  empIds.forEach(function(empId) {
    var checked = [];
    container.querySelectorAll('.panier-cb[data-empid="' + empId + '"]:checked').forEach(function(cb) {
      checked.push(cb.dataset.date);
    });
    d[empId + '|' + mois] = checked;
  });
  setPanierData(d);
  toast('Paniers enregistrés', 'success');
  loadPanierUI();
}

function selectAllPanier() {
  var container = document.getElementById('pt-panier-container');
  // Sélectionner uniquement les employés cochés (si aucun sélectionné, cocher tous les jours de tous)
  var empSels = Array.from(container.querySelectorAll('.panier-emp-sel:checked')).map(function(x){ return x.dataset.empid; });
  container.querySelectorAll('.panier-cb').forEach(function(cb) {
    if (empSels.length === 0 || empSels.indexOf(cb.dataset.empid) !== -1) cb.checked = true;
    cb.dispatchEvent(new Event('change'));
  });
}

function clearAllPanier() {
  var container = document.getElementById('pt-panier-container');
  var empSels = Array.from(container.querySelectorAll('.panier-emp-sel:checked')).map(function(x){ return x.dataset.empid; });
  container.querySelectorAll('.panier-cb').forEach(function(cb) {
    if (empSels.length === 0 || empSels.indexOf(cb.dataset.empid) !== -1) cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  });
}
`;

html = html.replace(
  '/* ==================== BULLETIN ==================== */',
  panierUIFunc + '\n/* ==================== BULLETIN ==================== */'
);

// ============================================================
// 11. AJOUTER les champs indemnités spéciales dans la fiche employé
// ============================================================
const indSpecFields = `
<div style="grid-column:span 3;border-top:1px solid var(--border);margin-top:.5rem;padding-top:.5rem">
  <div style="font-weight:700;font-size:.78rem;color:var(--dim);margin-bottom:.5rem">Indemnités spéciales (Art.116 CGI — exonérées ITS dans la limite de 10% de la rémunération brute)</div>
  <div class="grid-3">
    <div class="form-group"><label>Prime de représentation (FCFA/mois)</label><input type="number" name="ind_representation" value="0" min="0"></div>
    <div class="form-group"><label>Prime de déplacement (FCFA/mois)</label><input type="number" name="ind_deplacement" value="0" min="0"></div>
    <div class="form-group"><label>Prime de salissure (FCFA/mois)</label><input type="number" name="ind_salissure" value="0" min="0"></div>
    <div class="form-group"><label>Prime de tenue (FCFA/mois)</label><input type="number" name="ind_tenue" value="0" min="0"></div>
    <div class="form-group"><label>Prime de caisse (FCFA/mois)</label><input type="number" name="ind_caisse" value="0" min="0"></div>
    <div class="form-group"><label>Prime de responsabilité (FCFA/mois)</label><input type="number" name="ind_responsabilite" value="0" min="0"></div>
    <div class="form-group"><label>Prime de fonction (FCFA/mois)</label><input type="number" name="ind_fonction" value="0" min="0"></div>
  </div>
</div>`;

html = html.replace(
  '<div class="form-group"><label>Rendement (Montage)</label>',
  indSpecFields + '\n<div class="form-group"><label>Rendement (Montage)</label>'
);

// ============================================================
// 12. AJOUTER les champs indemnités dans savePersonnel()
// ============================================================
html = html.replace(
  "assurance_mensuelle: parseFloat(f.elements['assurance_mensuelle'].value)||0, status:",
  `assurance_mensuelle: parseFloat(f.elements['assurance_mensuelle'].value)||0,
    ind_representation: parseFloat(f.elements['ind_representation'] ? f.elements['ind_representation'].value : 0)||0,
    ind_deplacement: parseFloat(f.elements['ind_deplacement'] ? f.elements['ind_deplacement'].value : 0)||0,
    ind_salissure: parseFloat(f.elements['ind_salissure'] ? f.elements['ind_salissure'].value : 0)||0,
    ind_tenue: parseFloat(f.elements['ind_tenue'] ? f.elements['ind_tenue'].value : 0)||0,
    ind_caisse: parseFloat(f.elements['ind_caisse'] ? f.elements['ind_caisse'].value : 0)||0,
    ind_responsabilite: parseFloat(f.elements['ind_responsabilite'] ? f.elements['ind_responsabilite'].value : 0)||0,
    ind_fonction: parseFloat(f.elements['ind_fonction'] ? f.elements['ind_fonction'].value : 0)||0,
    status:`
);

// ============================================================
// Fix encoding issues one more time
// ============================================================
html = html.replace(/├®/g, 'é');
html = html.replace(/├┤/g, 'ô');
html = html.replace(/├¬/g, 'ê');
html = html.replace(/├Ç/g, 'À');
html = html.replace(/N┬░/g, 'N°');
html = html.replace(/d├®duite/g, 'déduite');
html = html.replace(/├®lectricit├®/g, 'électricité');

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Done! All modifications applied.');
