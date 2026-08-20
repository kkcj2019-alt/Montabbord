const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// ============================================================
// 1. Mettre à jour calcITS(base) et getRICF(parts)
// ============================================================
const oldCalcITS = `function calcITS(base) {
  var tax = 0, prev = 0;
  for (var i = 0; i < TAX_RULES.scale.length; i++) {
    var b = TAX_RULES.scale[i];
    var chunk = Math.min(b.limit - prev, Math.max(0, base - prev));
    tax += chunk * b.rate;
    if (base <= b.limit) break;
    prev = b.limit;
  }
  return Math.floor(tax);
}
function getRICF(parts) {
  if (!parts || parts <= 1) return 0;
  return (parseFloat(parts) - 1) * (TAX_RULES.ricf_per_part || 11000);
}`;

const newCalcITS = `/* Impôt sur les Traitements et Salaires (ITS 2024 - Réforme Code Général des Impôts) */
function calcITS(base) {
  if (!base || base <= 75000) return 0;
  if (base <= 240000) return Math.floor(base * 0.16 - 12000);
  if (base <= 800000) return Math.floor(base * 0.21 - 24000);
  if (base <= 2400000) return Math.floor(base * 0.24 - 48000);
  if (base <= 8000000) return Math.floor(base * 0.28 - 144000);
  return Math.floor(base * 0.32 - 464000);
}
/* Réduction d'Impôt pour Charges de Famille (RICF 2024 - Plafond 5 parts / 44 000 FCFA max) */
function getRICF(parts) {
  if (!parts || parts <= 1) return 0;
  var p = Math.min(parseFloat(parts) || 1, 5); // Plafond légal 5 parts max
  var valPerPart = TAX_RULES.ricf_per_part || 11000;
  return Math.min(44000, Math.round((p - 1) * valPerPart));
}`;

html = html.replace(oldCalcITS, newCalcITS);

// ============================================================
// 2. Ajouter le tableau de la RICF dans l'onglet tab-taxes
// ============================================================
const oldAutresAbattements = `<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Autres Abattements</h3>
<div class="grid-2">
<div class="form-group"><label>Transport exonéré max (FCFA)</label><input type="number" id="config-transport-exo" value="30000" onchange="saveTaxRates()"> FCFA</div>
<div class="form-group"><label>Abattement RICF / part (FCFA)</label><input type="number" id="config-ricf-part" value="11000" onchange="saveTaxRates()"> FCFA</div>
</div>
</div>`;

const newAutresAbattements = `<div class="card">
<h3 style="margin-bottom:1rem;font-size:.9rem">Autres Abattements &amp; Seuils</h3>
<div class="grid-2">
<div class="form-group"><label>Transport exonéré max (FCFA)</label><input type="number" id="config-transport-exo" value="30000" onchange="saveTaxRates()"> FCFA</div>
<div class="form-group"><label>Réduction RICF / demi-part supp. (FCFA)</label><input type="number" id="config-ricf-part" value="11000" onchange="saveTaxRates()"> FCFA</div>
</div>
</div>
<div class="card">
<h3 style="margin-bottom:.8rem;font-size:.9rem">Barème Officiel RICF (Réduction selon le nombre de parts - DGI 2024)</h3>
<div style="font-size:.75rem;color:var(--dim);margin-bottom:.8rem">La réduction d'impôt s'impute directement sur l'ITS brut calculé. Le nombre de parts maximum est plafonné à 5 parts.</div>
<div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:.75rem">
    <thead>
      <tr style="background:#f8fafc">
        <th style="border:1px solid var(--border);padding:5px 8px;text-align:left">Nombre de parts</th>
        <th style="border:1px solid var(--border);padding:5px 8px;text-align:left">Situation de famille type</th>
        <th style="border:1px solid var(--border);padding:5px 8px;text-align:right">Réduction mensuelle ITS</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">1 part</td><td style="border:1px solid var(--border);padding:4px 8px">Célibataire / Divorcé sans enfant</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>0 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">1,5 part</td><td style="border:1px solid var(--border);padding:4px 8px">Célibataire avec 1 demi-part spécifique</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>5 500 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">2 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié sans enfant OU Célibataire/Divorcé avec 1 enfant</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>11 000 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">2,5 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 1 enfant OU Célibataire/Divorcé avec 2 enfants</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>16 500 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">3 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 2 enfants OU Célibataire/Divorcé avec 3 enfants</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>22 000 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">3,5 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 3 enfants OU Célibataire/Divorcé avec 4 enfants</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>27 500 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">4 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 4 enfants</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>33 000 FCFA</strong></td></tr>
      <tr><td style="border:1px solid var(--border);padding:4px 8px">4,5 parts</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 5 enfants</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right"><strong>38 500 FCFA</strong></td></tr>
      <tr style="background:#f0fdf4"><td style="border:1px solid var(--border);padding:4px 8px">5 parts (Plafond max)</td><td style="border:1px solid var(--border);padding:4px 8px">Marié avec 6 enfants et plus</td><td style="border:1px solid var(--border);padding:4px 8px;text-align:right;color:#166534"><strong>44 000 FCFA (Plafond max)</strong></td></tr>
    </tbody>
  </table>
</div>
</div>`;

html = html.replace(oldAutresAbattements, newAutresAbattements);

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Updated ITS 2024 direct formula and RICF table!');
