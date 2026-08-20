const fs = require('fs');

let html = fs.readFileSync('public/paye.html', 'utf8');

// Normalize line endings to \n temporarily for matching
let isCRLF = html.includes('\r\n');
if (isCRLF) {
  html = html.replace(/\r\n/g, '\n');
}

// 1. Injecter le tableau RICF dans tab-taxes
const ricfHTML = `
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

if (!html.includes('Barème Officiel RICF')) {
  const targetTaxes = `<div class="form-group"><label>Abattement RICF / part (FCFA)</label><input type="number" id="config-ricf-part" value="11000" onchange="saveTaxRates()"> FCFA</div>\n</div>\n</div>`;
  if (html.includes(targetTaxes)) {
    html = html.replace(targetTaxes, targetTaxes + '\n' + ricfHTML);
    console.log('RICF table inserted into tab-taxes!');
  } else {
    console.log('Warning: targetTaxes anchor not found');
  }
} else {
  console.log('RICF table already present');
}

// 2. Injecter tab-primes dans section categories
const tabPrimesHTML = `
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
</div>`;

if (!html.includes('id="tab-primes"')) {
  const targetSecEnd = `<div id="tab-montage" style="display:none">\n<div class="card">\n<h3 style="margin-bottom:1rem;font-size:.9rem">Articles de Montage (Production)</h3>`;
  const targetMontageEnd = `<div style="font-size:.72rem;color:var(--dim)">Quand la quantité totale d'articles (avec "Cpte Prime" coché) dépasse le seuil, la prime est ajoutée.</div>\n</div>\n</div>\n</section>`;
  
  if (html.includes(targetMontageEnd)) {
    html = html.replace(targetMontageEnd, `<div style="font-size:.72rem;color:var(--dim)">Quand la quantité totale d'articles (avec "Cpte Prime" coché) dépasse le seuil, la prime est ajoutée.</div>\n</div>\n</div>\n` + tabPrimesHTML + `\n</section>`);
    console.log('tab-primes inserted into section categories!');
  } else {
    // Regex fallback
    html = html.replace(/(<div id="tab-montage"[\s\S]*?<\/div>\s*<\/div>)\s*(<\/section>)/, '$1\n' + tabPrimesHTML + '\n$2');
    console.log('tab-primes inserted using regex fallback');
  }
} else {
  console.log('tab-primes already present');
}

// Convert back to CRLF if needed
if (isCRLF) {
  html = html.replace(/\n/g, '\r\n');
}

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Done inserting missing HTML elements!');
