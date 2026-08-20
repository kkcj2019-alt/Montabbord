const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// =================================================================
// ÉTAPE 1: Ajouter l'onglet "Primes Spéciales" dans Données de Salaire
// =================================================================
html = html.replace(
  '<button onclick="switchCatTab(\'montage\')">Articles Montage</button>',
  '<button onclick="switchCatTab(\'montage\')">Articles Montage</button>\n<button id="cat-tab-primes" onclick="switchCatTab(\'primes\')">Primes Spéciales</button>'
);

// =================================================================
// ÉTAPE 2: Ajouter le panneau HTML de gestion des primes spéciales
//          avant la fermeture de la section categories
// =================================================================
const primesPanelHTML = `
<div id="tab-primes" style="display:none">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem">
      <div>
        <h3 style="margin-bottom:.3rem;font-size:.9rem">Gestion des Primes &amp; Indemnités Spéciales</h3>
        <div style="font-size:.72rem;color:var(--dim)">Art. 116 CGI — Exonérées d'ITS dans la limite de 10% de la rémunération brute. Ces primes restent soumises aux cotisations CNPS.</div>
      </div>
      <button class="btn" onclick="openPrimeModal()">+ Nouvelle Prime</button>
    </div>
    <div id="primes-list-container">
      <div style="text-align:center;padding:2rem;color:var(--dim)">Aucune prime configurée.</div>
    </div>
  </div>
  <!-- Détail attribution d'une prime -->
  <div id="prime-detail-card" class="card" style="display:none;margin-top:1rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 id="prime-detail-title" style="font-size:.9rem">Attribution</h3>
      <button class="btn-sec" onclick="document.getElementById('prime-detail-card').style.display='none'">Fermer</button>
    </div>
    <!-- Filtre par département -->
    <div style="margin-bottom:.8rem;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
      <label style="font-size:.78rem;font-weight:700">Filtrer par département :</label>
      <select id="prime-dept-filter" onchange="filterPrimeEmployees()" style="max-width:200px;padding:4px 8px;border:1px solid var(--border);border-radius:6px">
        <option value="">Tous les départements</option>
      </select>
      <button class="btn btn-sec" onclick="toggleAllPrimeEmps(true)" style="font-size:.72rem;padding:3px 10px">Cocher tous</button>
      <button class="btn btn-sec" onclick="toggleAllPrimeEmps(false)" style="font-size:.72rem;padding:3px 10px">Décocher tous</button>
      <button class="btn" onclick="savePrimeAttribution()" style="font-size:.75rem;padding:4px 14px">Enregistrer</button>
    </div>
    <div id="prime-emp-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem;max-height:400px;overflow-y:auto"></div>
  </div>
</div>

<!-- Modal Nouvelle Prime -->
<div id="modal-prime" class="modal-overlay" style="display:none">
  <div class="modal-content" style="max-width:480px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 id="prime-modal-title" style="font-size:1rem">Nouvelle Prime</h3>
      <button class="btn-sec" onclick="closePrimeModal()">✕</button>
    </div>
    <form id="form-prime" onsubmit="savePrimeConfig(event)">
      <input type="hidden" id="prime-edit-id">
      <div class="form-group">
        <label>Type de prime</label>
        <select id="prime-type" required onchange="onPrimeTypeChange()">
          <option value="">— Choisir —</option>
          <option value="ind_representation">Prime de représentation</option>
          <option value="ind_deplacement">Prime de déplacement</option>
          <option value="ind_salissure">Prime de salissure</option>
          <option value="ind_tenue">Prime de tenue</option>
          <option value="ind_caisse">Prime de caisse</option>
          <option value="ind_responsabilite">Prime de responsabilité</option>
          <option value="ind_fonction">Prime de fonction</option>
          <option value="custom">Autre (personnalisée)</option>
        </select>
      </div>
      <div class="form-group" id="prime-label-group" style="display:none">
        <label>Libellé personnalisé</label>
        <input type="text" id="prime-label" placeholder="Ex: Prime de nuit">
      </div>
      <div class="form-group">
        <label>Numéro de ligne bulletin</label>
        <input type="text" id="prime-num" placeholder="Ex: 37" style="max-width:100px">
      </div>
      <div class="form-group">
        <label>Montant mensuel (FCFA)</label>
        <input type="number" id="prime-montant" min="0" required placeholder="Ex: 25000">
      </div>
      <div class="form-group">
        <label>Applicable à (département par défaut)</label>
        <select id="prime-dept-default">
          <option value="">Tous les employés (titulaires)</option>
        </select>
      </div>
      <button type="submit" class="btn" style="width:100%;margin-top:.5rem">Enregistrer la prime</button>
    </form>
  </div>
</div>
`;

html = html.replace(
  '</div>\n</section>\n\n<!-- ============ PERSONNEL ============ -->',
  primesPanelHTML + '\n</div>\n</section>\n\n<!-- ============ PERSONNEL ============ -->'
);

// =================================================================
// ÉTAPE 3: Ajouter les fonctions JS de gestion des primes spéciales
// =================================================================
const primesJS = `
/* ==================== PRIMES SPECIALES CENTRALISÉES ==================== */
/* Structure: getPayeSection('primesSpec') = [
     { id, type, label, num, montant, dept, employes: ['emp1', 'emp2', ...] }
   ]
   employes = liste des emp.id qui bénéficient de la prime
*/
function getPrimesSpec() { return getPayeSection('primesSpec', []); }
function setPrimesSpec(v) { setPayeSection('primesSpec', v); }

/* Retourne le montant total des primes spéciales pour un employé et un type donné */
function getIndSpecForEmp(empId, type) {
  var primes = getPrimesSpec();
  var total = 0;
  primes.forEach(function(p) {
    if ((type ? p.type === type : true) && p.employes && p.employes.indexOf(empId) !== -1) {
      total += parseFloat(p.montant) || 0;
    }
  });
  return total;
}

/* Retourne toutes les primes actives pour un employé (pour le bulletin) */
function getPrimesSpecEmp(empId) {
  var primes = getPrimesSpec();
  return primes.filter(function(p) { return p.employes && p.employes.indexOf(empId) !== -1; });
}

var _currentPrimeId = null; // ID de la prime en cours d'attribution

function loadPrimesSpec() {
  var container = document.getElementById('primes-list-container');
  if (!container) return;
  var primes = getPrimesSpec();
  if (!primes.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--dim)">Aucune prime configurée. Cliquez sur "+ Nouvelle Prime" pour commencer.</div>';
    return;
  }
  var LABELS = {
    ind_representation: 'Prime de représentation',
    ind_deplacement: 'Prime de déplacement',
    ind_salissure: 'Prime de salissure',
    ind_tenue: 'Prime de tenue',
    ind_caisse: 'Prime de caisse',
    ind_responsabilite: 'Prime de responsabilité',
    ind_fonction: 'Prime de fonction',
    custom: 'Prime personnalisée'
  };
  var colors = {
    ind_representation: '#3b82f6',
    ind_deplacement: '#8b5cf6',
    ind_salissure: '#f59e0b',
    ind_tenue: '#10b981',
    ind_caisse: '#ef4444',
    ind_responsabilite: '#0ea5e9',
    ind_fonction: '#6366f1',
    custom: '#64748b'
  };
  var h = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.8rem">';
  primes.forEach(function(p) {
    var color = colors[p.type] || '#64748b';
    var label = p.type === 'custom' ? (p.label || 'Prime personnalisée') : (LABELS[p.type] || p.type);
    var empCount = (p.employes || []).length;
    h += '<div style="border:1px solid var(--border);border-radius:10px;padding:.9rem;border-left:4px solid ' + color + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.4rem">';
    h += '<div style="font-weight:700;font-size:.85rem">' + escH(label) + '</div>';
    h += '<div style="display:flex;gap:4px">';
    h += '<button class="btn-sec" onclick="editPrimeConfig(\'' + p.id + '\')" style="font-size:.65rem;padding:2px 6px">✏️</button>';
    h += '<button class="btn btn-red" onclick="deletePrimeConfig(\'' + p.id + '\')" style="font-size:.65rem;padding:2px 6px">✕</button>';
    h += '</div></div>';
    h += '<div style="font-size:.78rem;color:var(--dim)">N° ' + escH(p.num||'—') + ' · <strong>' + fmtF(p.montant) + ' FCFA/mois</strong></div>';
    if (p.dept) h += '<div style="font-size:.72rem;color:#64748b;margin-top:2px">Dept: ' + escH(p.dept) + '</div>';
    h += '<div style="margin-top:.6rem;display:flex;justify-content:space-between;align-items:center">';
    h += '<span style="font-size:.72rem;background:' + color + '22;color:' + color + ';padding:2px 8px;border-radius:20px">' + empCount + ' employé' + (empCount!==1?'s':'') + '</span>';
    h += '<button class="btn" onclick="openPrimeAttrib(\'' + p.id + '\')" style="font-size:.72rem;padding:3px 10px">Attribuer / Modifier</button>';
    h += '</div></div>';
  });
  h += '</div>';
  container.innerHTML = h;
}

function openPrimeModal(id) {
  document.getElementById('prime-edit-id').value = id || '';
  document.getElementById('prime-modal-title').textContent = id ? 'Modifier la prime' : 'Nouvelle prime';
  document.getElementById('prime-type').value = '';
  document.getElementById('prime-label').value = '';
  document.getElementById('prime-num').value = '';
  document.getElementById('prime-montant').value = '';
  document.getElementById('prime-label-group').style.display = 'none';
  // Charger les départements dans le select
  var deptSel = document.getElementById('prime-dept-default');
  deptSel.innerHTML = '<option value="">Tous les employés (titulaires)</option>';
  getServices().forEach(function(s) {
    deptSel.innerHTML += '<option value="' + escH(s) + '">' + escH(s) + '</option>';
  });
  if (id) {
    var p = getPrimesSpec().find(function(x){ return x.id === id; });
    if (p) {
      document.getElementById('prime-type').value = p.type;
      document.getElementById('prime-label').value = p.label || '';
      document.getElementById('prime-num').value = p.num || '';
      document.getElementById('prime-montant').value = p.montant || '';
      document.getElementById('prime-dept-default').value = p.dept || '';
      document.getElementById('prime-label-group').style.display = p.type === 'custom' ? '' : 'none';
    }
  }
  document.getElementById('modal-prime').style.display = 'flex';
}

function closePrimeModal() { document.getElementById('modal-prime').style.display = 'none'; }

function onPrimeTypeChange() {
  var t = document.getElementById('prime-type').value;
  document.getElementById('prime-label-group').style.display = (t === 'custom') ? '' : 'none';
  // Auto-numérotation
  var NUMS = { ind_representation:'30',ind_deplacement:'31',ind_salissure:'32',ind_tenue:'33',ind_caisse:'34',ind_responsabilite:'35',ind_fonction:'36' };
  if (NUMS[t]) document.getElementById('prime-num').value = NUMS[t];
}

function savePrimeConfig(e) {
  e.preventDefault();
  var id = document.getElementById('prime-edit-id').value || DB.id();
  var type = document.getElementById('prime-type').value;
  var LABELS = { ind_representation:'Prime de représentation', ind_deplacement:'Prime de déplacement', ind_salissure:'Prime de salissure', ind_tenue:'Prime de tenue', ind_caisse:'Prime de caisse', ind_responsabilite:'Prime de responsabilité', ind_fonction:'Prime de fonction' };
  var label = type === 'custom' ? (document.getElementById('prime-label').value || 'Prime') : (LABELS[type] || type);
  var primes = getPrimesSpec();
  var existing = primes.find(function(x){ return x.id === id; });
  var dept = document.getElementById('prime-dept-default').value;

  if (existing) {
    existing.type = type; existing.label = label;
    existing.num = document.getElementById('prime-num').value;
    existing.montant = parseFloat(document.getElementById('prime-montant').value)||0;
    existing.dept = dept;
  } else {
    // Auto-attribuer les employés du département par défaut
    var empList = getPersonnelActifs().filter(function(p){ return empCategorie(p) !== 'externe'; });
    var assigned = empList
      .filter(function(p){ return !dept || p.service === dept; })
      .map(function(p){ return p.id; });
    primes.push({ id: id, type: type, label: label, num: document.getElementById('prime-num').value, montant: parseFloat(document.getElementById('prime-montant').value)||0, dept: dept, employes: assigned });
  }
  setPrimesSpec(primes);
  closePrimeModal();
  loadPrimesSpec();
  toast('Prime enregistrée', 'success');
}

function editPrimeConfig(id) { openPrimeModal(id); }

function deletePrimeConfig(id) {
  if (!confirm('Supprimer cette prime ?')) return;
  setPrimesSpec(getPrimesSpec().filter(function(x){ return x.id !== id; }));
  loadPrimesSpec();
  document.getElementById('prime-detail-card').style.display = 'none';
  toast('Prime supprimée', 'success');
}

function openPrimeAttrib(id) {
  var p = getPrimesSpec().find(function(x){ return x.id === id; });
  if (!p) return;
  _currentPrimeId = id;
  var LABELS = { ind_representation:'Prime de représentation', ind_deplacement:'Prime de déplacement', ind_salissure:'Prime de salissure', ind_tenue:'Prime de tenue', ind_caisse:'Prime de caisse', ind_responsabilite:'Prime de responsabilité', ind_fonction:'Prime de fonction', custom:'Prime personnalisée' };
  var label = p.type === 'custom' ? (p.label||'Prime') : (LABELS[p.type]||p.type);
  document.getElementById('prime-detail-title').textContent = label + ' — ' + fmtF(p.montant) + ' FCFA/mois';
  // Charger départements dans le filtre
  var deptSel = document.getElementById('prime-dept-filter');
  deptSel.innerHTML = '<option value="">Tous les départements</option>';
  getServices().forEach(function(s) { deptSel.innerHTML += '<option value="' + escH(s) + '">' + escH(s) + '</option>'; });
  document.getElementById('prime-detail-card').style.display = '';
  renderPrimeEmpGrid(p);
  document.getElementById('prime-detail-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPrimeEmpGrid(p) {
  var deptFilter = (document.getElementById('prime-dept-filter')||{}).value || '';
  var empList = getPersonnelActifs().filter(function(emp){ return empCategorie(emp) !== 'externe'; });
  if (deptFilter) empList = empList.filter(function(emp){ return emp.service === deptFilter; });
  var assigned = p.employes || [];
  var grid = document.getElementById('prime-emp-grid');
  if (!grid) return;
  var h = '';
  // Grouper par service
  var groups = {};
  empList.forEach(function(emp) {
    var svc = emp.service || 'Sans département';
    if (!groups[svc]) groups[svc] = [];
    groups[svc].push(emp);
  });
  Object.keys(groups).sort().forEach(function(svc) {
    h += '<div style="grid-column:1/-1;font-size:.72rem;font-weight:700;color:var(--dim);border-bottom:1px solid var(--border);padding-bottom:3px;margin-top:.4rem">' + escH(svc) + '</div>';
    groups[svc].forEach(function(emp) {
      var isChecked = assigned.indexOf(emp.id) !== -1;
      h += '<label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:.78rem;' + (isChecked ? 'background:#f0fdf4;border-color:#86efac' : '') + '">';
      h += '<input type="checkbox" class="prime-emp-cb" data-empid="' + emp.id + '"' + (isChecked ? ' checked' : '') + ' style="width:15px;height:15px" onchange="onPrimeEmpChange(this)">';
      h += '<span><strong>' + escH(emp.nom) + '</strong> ' + escH(emp.prenoms||'') + '</span>';
      h += '</label>';
    });
  });
  if (!h) h = '<div style="color:var(--dim);font-size:.8rem">Aucun employé dans ce département.</div>';
  grid.innerHTML = h;
}

function onPrimeEmpChange(cb) {
  var lbl = cb.closest('label');
  if (cb.checked) lbl.style.background = '#f0fdf4', lbl.style.borderColor = '#86efac';
  else lbl.style.background = '', lbl.style.borderColor = '';
}

function filterPrimeEmployees() {
  if (!_currentPrimeId) return;
  var p = getPrimesSpec().find(function(x){ return x.id === _currentPrimeId; });
  if (p) renderPrimeEmpGrid(p);
}

function toggleAllPrimeEmps(state) {
  document.querySelectorAll('.prime-emp-cb').forEach(function(cb) {
    cb.checked = state;
    onPrimeEmpChange(cb);
  });
}

function savePrimeAttribution() {
  if (!_currentPrimeId) return;
  var primes = getPrimesSpec();
  var p = primes.find(function(x){ return x.id === _currentPrimeId; });
  if (!p) return;
  var checked = [];
  document.querySelectorAll('.prime-emp-cb:checked').forEach(function(cb) { checked.push(cb.dataset.empid); });
  // Fusionner avec les employés d'autres départements non affichés
  var deptFilter = (document.getElementById('prime-dept-filter')||{}).value || '';
  if (deptFilter) {
    // Garder les assignés hors du filtre
    var empIds = getPersonnelActifs().filter(function(e){ return e.service === deptFilter; }).map(function(e){ return e.id; });
    var keep = (p.employes||[]).filter(function(id){ return empIds.indexOf(id) === -1; });
    p.employes = keep.concat(checked);
  } else {
    p.employes = checked;
  }
  setPrimesSpec(primes);
  loadPrimesSpec();
  // Mettre à jour la carte
  var count = p.employes.length;
  toast(count + ' employé' + (count!==1?'s':'') + ' assigné' + (count!==1?'s':''), 'success');
  // Rerender
  var pp = getPrimesSpec().find(function(x){ return x.id === _currentPrimeId; });
  if (pp) renderPrimeEmpGrid(pp);
}
`;

html = html.replace(
  '/* ===== Prime de Panier ===== */',
  primesJS + '\n\n/* ===== Prime de Panier ===== */'
);

// =================================================================
// ÉTAPE 4: Modifier switchCatTab pour gérer l'onglet primes
// =================================================================
html = html.replace(
  "function switchCatTab(tab) {",
  `function switchCatTab(tab) {
  var primeTabBtn = document.getElementById('cat-tab-primes');
  if (primeTabBtn) primeTabBtn.classList.toggle('active', tab === 'primes');
  var primeTabDiv = document.getElementById('tab-primes');
  if (primeTabDiv) { primeTabDiv.style.display = tab === 'primes' ? '' : 'none'; if (tab === 'primes') loadPrimesSpec(); }
  if (tab === 'primes') {
    document.querySelectorAll('#categories .tab-pills button').forEach(function(b){ if (!b.id || b.id !== 'cat-tab-primes') b.classList.remove('active'); });
    return;
  }
  _switchCatTab_orig(tab);
}
function _switchCatTab_orig(tab) {`
);

// Trouver la fin de la fonction switchCatTab originale et la fermer
// On doit aussi fermer la nouvelle fonction _switchCatTab_orig
// Chercher le pattern de fin de l'ancienne fonction
html = html.replace(
  /function _switchCatTab_orig\(tab\) \{([\s\S]*?)function loadCategories/,
  function(match, body) {
    return 'function _switchCatTab_orig(tab) {' + body + '}\nfunction loadCategories';
  }
);

// =================================================================
// ÉTAPE 5: Modifier calculatePayroll pour utiliser getPrimesSpecEmp
//          au lieu des champs individuels emp.ind_xxx
// =================================================================
const oldIndSpecBlock = `  /* ===== Indemnités spéciales (Art.116 CGI - exo ITS 10%) ===== */
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
  if (indFon > 0) items.push({ n: '36', label: 'Prime de fonction', base: indFon, taux: '', gain: indFon, ret: 0 });`;

const newIndSpecBlock = `  /* ===== Indemnités spéciales (Art.116 CGI - exo ITS 10%) ===== */
  /* Lues depuis la config centralisée dans Données de Salaire > Primes Spéciales */
  var primesSpecActives = getPrimesSpecEmp(emp.id);
  primesSpecActives.forEach(function(p) {
    var LABELS = { ind_representation:'Prime de représentation', ind_deplacement:'Prime de déplacement', ind_salissure:'Prime de salissure', ind_tenue:'Prime de tenue', ind_caisse:'Prime de caisse', ind_responsabilite:'Prime de responsabilité', ind_fonction:'Prime de fonction' };
    var label = p.type === 'custom' ? (p.label||'Indemnité') : (LABELS[p.type]||p.label||p.type);
    var num = p.num || '30';
    var montant = parseFloat(p.montant)||0;
    if (montant > 0) items.push({ n: num, label: label, base: montant, taux: '', gain: montant, ret: 0 });
  });`;

html = html.replace(oldIndSpecBlock, newIndSpecBlock);

// =================================================================
// ÉTAPE 6: Adapter le calcul du totalIndSpec pour la base fiscale
// =================================================================
const oldBrutFiscalBlock = `  /* Indemnités spéciales : exonérées ITS dans la limite de 10% rémunération numéraire totale (Art.116 CGI) */
  var totalIndSpec = (parseFloat(emp.ind_representation)||0)+(parseFloat(emp.ind_deplacement)||0)
    +(parseFloat(emp.ind_salissure)||0)+(parseFloat(emp.ind_tenue)||0)
    +(parseFloat(emp.ind_caisse)||0)+(parseFloat(emp.ind_responsabilite)||0)
    +(parseFloat(emp.ind_fonction)||0);`;

const newBrutFiscalBlock = `  /* Indemnités spéciales : exonérées ITS dans la limite de 10% rémunération numéraire totale (Art.116 CGI) */
  var totalIndSpec = primesSpecActives.reduce(function(s,p){ return s + (parseFloat(p.montant)||0); }, 0);`;

html = html.replace(oldBrutFiscalBlock, newBrutFiscalBlock);

// =================================================================
// ÉTAPE 7: Supprimer les champs ind_xxx de la fiche employé (plus utiles)
//          Remplacer par une note explicative
// =================================================================
const oldIndSpecEmpForm = `
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

const newIndSpecNote = `
<div style="grid-column:span 3;border-top:1px solid var(--border);margin-top:.5rem;padding-top:.5rem">
  <div style="font-size:.78rem;color:#0369a1;background:#e0f2fe;border:1px solid #7dd3fc;border-radius:6px;padding:.6rem .9rem">
    ℹ️ <strong>Primes &amp; Indemnités spéciales</strong> (Art.116 CGI) — Gérées de manière centralisée dans <strong>Données de Salaire → Primes Spéciales</strong>. Vous pouvez y configurer chaque prime et l'attribuer par département ou par employé.
    <button type="button" class="btn btn-sec" onclick="closeEmpModal();showSection('categories');setTimeout(function(){switchCatTab('primes');},200)" style="font-size:.7rem;padding:2px 8px;margin-left:.5rem">Gérer les primes →</button>
  </div>
</div>`;

html = html.replace(oldIndSpecEmpForm, newIndSpecNote);

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Done — Primes Spéciales centralisées!');
