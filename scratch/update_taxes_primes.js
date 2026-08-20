const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// ============================================================
// 1. Mettre à jour l'HTML de la section tab-taxes
// ============================================================
const oldTaxesHTML = `<div id="tab-taxes" style="display:none">
<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Plafonds CNPS</h3>
<div class="grid-2">
<div class="form-group"><label>Plafond Retraite (FCFA)</label><input type="number" id="config-cnps-retraite" value="3375000" onchange="saveLimits()"></div>
<div class="form-group"><label>Plafond AT/PF (FCFA)</label><input type="number" id="config-cnps-atpf" value="75000" onchange="saveLimits()"></div>
</div>
</div>
<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Taux de Cotisation CNPS</h3>
<div class="grid-2">
<div class="form-group"><label>Retraite (% salarial)</label><input type="number" id="config-cnps-ret-sal" step="0.01" value="6.3" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Retraite (% patronal)</label><input type="number" id="config-cnps-ret-pat" step="0.01" value="7.7" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Prest. Fam. (% patronal)</label><input type="number" id="config-cnps-fam-pat" step="0.01" value="5.75" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Accident (% patronal)</label><input type="number" id="config-cnps-at-pat" step="0.01" value="3" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>FDFP Apprentissage (% patronal)</label><input type="number" id="config-cnps-fdfp-app" step="0.01" value="0.4" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>FDFP Formation (% patronal)</label><input type="number" id="config-cnps-fdfp-form" step="0.01" value="0.6" onchange="saveTaxRates()">%</div>
</div>
<div style="margin-top:.5rem;font-size:.72rem;color:var(--dim)">Sauvegardé automatiquement dans la configuration.</div>
</div>`;

const newTaxesHTML = `<div id="tab-taxes" style="display:none">
<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Plafonds CNPS</h3>
<div class="grid-2">
<div class="form-group"><label>Plafond Retraite (FCFA)</label><input type="number" id="config-cnps-retraite" value="3375000" onchange="saveLimits()"></div>
<div class="form-group"><label>Plafond Prestations Fam. / Accident / Maternité (FCFA)</label><input type="number" id="config-cnps-atpf" value="70000" onchange="saveLimits()"></div>
</div>
</div>
<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Taux de Cotisation CNPS</h3>
<div class="grid-2">
<div class="form-group"><label>Retraite (% salarial)</label><input type="number" id="config-cnps-ret-sal" step="0.01" value="6,30" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Retraite (% patronal)</label><input type="number" id="config-cnps-ret-pat" step="0.01" value="7,70" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Prest. Fam. (% patronal)</label><input type="number" id="config-cnps-fam-pat" step="0.01" value="5,00" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Assurance Maternité (% patronal)</label><input type="number" id="config-cnps-mat-pat" step="0.01" value="0,75" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>Accident du Travail (% patronal)</label><input type="number" id="config-cnps-at-pat" step="0.01" value="2,00" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>FDFP Apprentissage (% patronal)</label><input type="number" id="config-cnps-fdfp-app" step="0.01" value="0,40" onchange="saveTaxRates()">%</div>
<div class="form-group"><label>FDFP Formation (% patronal)</label><input type="number" id="config-cnps-fdfp-form" step="0.01" value="0,60" onchange="saveTaxRates()">%</div>
</div>
<div style="margin-top:.5rem;font-size:.72rem;color:var(--dim)">Sauvegardé automatiquement dans la configuration.</div>
</div>`;

html = html.replace(oldTaxesHTML, newTaxesHTML);

// ============================================================
// 2. Mettre à jour saveTaxRates() et loadItsScale()
// ============================================================
html = html.replace(
  `var pctFields = { 'config-cnps-ret-sal':'cnps_sal', 'config-cnps-ret-pat':'cnps_pat_ret', 'config-cnps-fam-pat':'cnps_pat_pf', 'config-cnps-at-pat':'cnps_pat_at', 'config-cnps-fdfp-app':'fdfp_app', 'config-cnps-fdfp-form':'fdfp_form' };`,
  `var pctFields = { 'config-cnps-ret-sal':'cnps_sal', 'config-cnps-ret-pat':'cnps_pat_ret', 'config-cnps-fam-pat':'cnps_pat_pf', 'config-cnps-mat-pat':'cnps_pat_mat', 'config-cnps-at-pat':'cnps_pat_at', 'config-cnps-fdfp-app':'fdfp_app', 'config-cnps-fdfp-form':'fdfp_form' };`
);

// Dans loadItsScale(), remplir aussi les plafonds retraite et atpf
const oldLoadItsScale = `function loadItsScale() {
  var body = document.getElementById('its-scale-body');
  if (!body) return;
  var scale = TAX_RULES.scale || DEFAULT_RULES.scale;
  var pctFields = { 'config-cnps-ret-sal':'cnps_sal', 'config-cnps-ret-pat':'cnps_pat_ret', 'config-cnps-fam-pat':'cnps_pat_pf', 'config-cnps-at-pat':'cnps_pat_at', 'config-cnps-fdfp-app':'fdfp_app', 'config-cnps-fdfp-form':'fdfp_form' };`;

const newLoadItsScale = `function loadItsScale() {
  var body = document.getElementById('its-scale-body');
  if (!body) return;
  var scale = TAX_RULES.scale || DEFAULT_RULES.scale;
  var pctFields = { 'config-cnps-ret-sal':'cnps_sal', 'config-cnps-ret-pat':'cnps_pat_ret', 'config-cnps-fam-pat':'cnps_pat_pf', 'config-cnps-mat-pat':'cnps_pat_mat', 'config-cnps-at-pat':'cnps_pat_at', 'config-cnps-fdfp-app':'fdfp_app', 'config-cnps-fdfp-form':'fdfp_form' };
  var lim = getLimits();
  var retEl = document.getElementById('config-cnps-retraite'); if (retEl) retEl.value = lim.retraite;
  var atpfEl = document.getElementById('config-cnps-atpf'); if (atpfEl) atpfEl.value = lim.atpf;`;

html = html.replace(oldLoadItsScale, newLoadItsScale);

// ============================================================
// 3. Initialiser les Primes Spéciales par défaut dans initData()
// ============================================================
const initPrimesDefaultCode = `
  if (!getPayeSection('primesSpec', null) || getPayeSection('primesSpec', []).length === 0) {
    var allEmps = getPersonnel().map(function(e){ return e.id; });
    setPayeSection('primesSpec', [
      { id: 'prime_salissure_def', type: 'ind_salissure', label: 'Prime de salissure', num: '32', montant: 15000, dept: '', employes: allEmps },
      { id: 'prime_tenue_def', type: 'ind_tenue', label: 'Prime de tenue', num: '33', montant: 15000, dept: '', employes: allEmps },
      { id: 'prime_panier_def', type: 'custom', label: 'Prime de panier (mensuelle)', num: '29', montant: 25000, dept: '', employes: allEmps }
    ]);
  }`;

html = html.replace(
  "if (!getPayeSection('primesPanier', null)) setPayeSection('primesPanier', {});",
  "if (!getPayeSection('primesPanier', null)) setPayeSection('primesPanier', {});" + initPrimesDefaultCode
);

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Updated taxes, scale, and default primes!');
