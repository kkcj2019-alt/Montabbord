const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// Replace TAX_RULES block
const oldRulesBlock = `/* ==================== TAX RULES (2024) ==================== */
var TAX_RULES = {
  cnps_sal: 0.063, cnps_pat_ret: 0.077, cnps_pat_pf: 0.0575, cnps_pat_at: 0.03,
  fdfp_app: 0.004, fdfp_form: 0.006,
  transport_max_exo: 30000,
  ricf_per_part: 11000,
  scale: [ {limit:75000,rate:0}, {limit:240000,rate:0.16}, {limit:800000,rate:0.21}, {limit:2400000,rate:0.24}, {limit:8000000,rate:0.28}, {limit:Infinity,rate:0.32} ]
};
var DEFAULT_RULES = JSON.parse(JSON.stringify(TAX_RULES));
function loadTaxRules() {
  var cfg = getPayeSection('taxRules', null);
  if (cfg && typeof cfg === 'object') {
    for (var k in cfg) { TAX_RULES[k] = cfg[k]; }
  }
}`;

const newRulesBlock = `/* ==================== TAX RULES (2024 - Côte d'Ivoire) ==================== */
var TAX_RULES = {
  cnps_sal: 0.063,
  cnps_pat_ret: 0.077,
  cnps_pat_pf: 0.05,
  cnps_pat_mat: 0.0075,
  cnps_pat_at: 0.02,
  fdfp_app: 0.004,
  fdfp_form: 0.006,
  transport_max_exo: 30000,
  indemnites_spec_pct: 0.10,
  panier_montant: 1500,
  ricf_per_part: 11000,
  scale: [
    { limit: 75000, rate: 0 },
    { limit: 240000, rate: 0.16 },
    { limit: 800000, rate: 0.21 },
    { limit: 2400000, rate: 0.24 },
    { limit: 8000000, rate: 0.28 },
    { limit: Infinity, rate: 0.32 }
  ]
};
var DEFAULT_RULES = JSON.parse(JSON.stringify(TAX_RULES));

function loadTaxRules() {
  var cfg = getPayeSection('taxRules', null);
  if (cfg && typeof cfg === 'object') {
    for (var k in cfg) {
      if (cfg[k] !== undefined && cfg[k] !== null) TAX_RULES[k] = cfg[k];
    }
  }
  // Sanity check: si scale est vide ou invalide (taux à 0), restaurer le barème par défaut
  if (!TAX_RULES.scale || !Array.isArray(TAX_RULES.scale) || TAX_RULES.scale.length === 0 || (TAX_RULES.scale.length > 1 && TAX_RULES.scale[1].rate === 0)) {
    TAX_RULES.scale = JSON.parse(JSON.stringify(DEFAULT_RULES.scale));
  }
  if (!TAX_RULES.cnps_sal) TAX_RULES.cnps_sal = 0.063;
  if (!TAX_RULES.cnps_pat_ret) TAX_RULES.cnps_pat_ret = 0.077;
  if (!TAX_RULES.cnps_pat_pf) TAX_RULES.cnps_pat_pf = 0.05;
  if (!TAX_RULES.cnps_pat_mat) TAX_RULES.cnps_pat_mat = 0.0075;
  if (!TAX_RULES.cnps_pat_at) TAX_RULES.cnps_pat_at = 0.02;
  if (!TAX_RULES.fdfp_app) TAX_RULES.fdfp_app = 0.004;
  if (!TAX_RULES.fdfp_form) TAX_RULES.fdfp_form = 0.006;
}`;

if (html.includes(oldRulesBlock)) {
  html = html.replace(oldRulesBlock, newRulesBlock);
} else {
  // Regex fallback
  html = html.replace(
    /\/\* ==================== TAX RULES \(2024\) ==================== \*\/[\s\S]*?function loadTaxRules\(\) \{[\s\S]*?\n\}/,
    newRulesBlock
  );
}

// Replace loadItsScale
const oldLoadItsScaleFull = /function loadItsScale\(\) \{[\s\S]*?function addItsLine\(\)/;

const newLoadItsScaleFull = `function loadItsScale() {
  var body = document.getElementById('its-scale-body');
  if (!body) return;
  loadTaxRules(); // S'assurer que les taux par défaut sont chargés
  var scale = (TAX_RULES.scale && TAX_RULES.scale.length > 0) ? TAX_RULES.scale : DEFAULT_RULES.scale;
  var pctFields = {
    'config-cnps-ret-sal': 'cnps_sal',
    'config-cnps-ret-pat': 'cnps_pat_ret',
    'config-cnps-fam-pat': 'cnps_pat_pf',
    'config-cnps-mat-pat': 'cnps_pat_mat',
    'config-cnps-at-pat': 'cnps_pat_at',
    'config-cnps-fdfp-app': 'fdfp_app',
    'config-cnps-fdfp-form': 'fdfp_form'
  };
  for (var idName in pctFields) {
    var el = document.getElementById(idName);
    var key = pctFields[idName];
    var val = TAX_RULES[key] !== undefined ? TAX_RULES[key] : DEFAULT_RULES[key];
    if (el) el.value = ((parseFloat(val) || 0) * 100).toFixed(2).replace('.', ',');
  }
  var absFields = { 'config-transport-exo': 'transport_max_exo', 'config-ricf-part': 'ricf_per_part' };
  for (var idName2 in absFields) {
    var el2 = document.getElementById(idName2);
    var key2 = absFields[idName2];
    var val2 = TAX_RULES[key2] !== undefined ? TAX_RULES[key2] : DEFAULT_RULES[key2];
    if (el2) el2.value = val2 || '';
  }
  var lim = getLimits();
  var retEl = document.getElementById('config-cnps-retraite'); if (retEl) retEl.value = lim.retraite;
  var atpfEl = document.getElementById('config-cnps-atpf'); if (atpfEl) atpfEl.value = lim.atpf;

  body.innerHTML = '';
  scale.forEach(function(b, i) {
    var limitVal = (b.limit === Infinity || b.limit >= 999999999) ? '999999999' : String(b.limit);
    var rateVal = ((parseFloat(b.rate) || 0) * 100).toFixed(1).replace('.', ',');
    body.innerHTML += '<tr><td><input type="number" value="' + limitVal + '" style="max-width:140px" onchange="saveTaxRates()"> FCFA</td><td><input type="number" step="0.01" value="' + rateVal + '" style="max-width:90px" onchange="saveTaxRates()"> %</td><td><button class="btn btn-red" onclick="delItsLine(' + i + ')">X</button></td></tr>';
  });
}
function addItsLine()`;

html = html.replace(oldLoadItsScaleFull, newLoadItsScaleFull);

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Fixed TAX_RULES and loadItsScale defaults!');
