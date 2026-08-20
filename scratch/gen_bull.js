function generateBulletin() {
  var out = document.getElementById('paie-output');
  try {
  var empId = document.getElementById('paie-select-emp').value;
  var mois  = document.getElementById('paie-mois').value;
  if (!empId || !mois) { out.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--dim)">Sélectionnez un employé et un mois</div>'; return; }
  var emp  = getPersonnel().find(function(p){ return p.id === empId; });
  if (!emp) return;
  var calc = calculatePayroll(emp, mois);
  var soc  = getSocieteP();
  var ent  = DB.getMain('mdb_entreprise') || {};
  var mp   = mois.split('-');
  var period = new Date(mois).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();

  var B = 'border:1px solid black;';
  var P = 'padding:3px 5px;';

  function td(style, content) { return '<td style="' + B + P + (style||'') + '">' + (content||'') + '</td>'; }
  function tdC(content) { return td('text-align:center;', content); }
  function tdL(content) { return td('text-align:left;', content); }
  function tdR(content, bold) { return td('text-align:right;' + (bold ? 'font-weight:bold;' : ''), content); }
  function tdBrut(label) { return '<td colspan="2" style="' + B + P + 'font-weight:bold;text-align:center;">' + label + '</td>'; }

  // Labels qui appartiennent aux cotisations même sans numéro
  function isCot(i) {
    var n = parseInt(i.n, 10);
    if (!isNaN(n) && n >= 50) return true;
    var lbl = (i.label || '').toLowerCase().trim();
    if (lbl.indexOf('cmu') === 0) return true;   // CMU (Part Salariale)
    if (lbl === 'arrondi') return true;
    return false;
  }
  // Séparer: gains/salaires (avant 40) et cotisations (à partir de 50 + CMU/Arrondi)
  var gainItems = calc.items.filter(function(i){ return i.label && !isCot(i); });
  var cotItems  = calc.items.filter(function(i){ return i.label &&  isCot(i); });
  // Arrondi toujours en dernière position
  cotItems.sort(function(a, b) {
    var aA = (a.label || '').toLowerCase().trim() === 'arrondi' ? 1 : 0;
    var bA = (b.label || '').toLowerCase().trim() === 'arrondi' ? 1 : 0;
    return aA - bA;
  });


  function buildRow(i) {
    var isGray = ['22','23','24','25','26','31','32','81','82'].indexOf(i.n) >= 0;
    var bg = isGray ? 'background:#d1d5db;' : '';
    var baseStr = i.base > 0 ? fmt(i.base) : '';
    var gainStr = i.gain > 0 ? fmt(i.gain) : '';
    var retStr  = i.ret  > 0 ? fmt(i.ret)  : (i.ret < 0 ? fmt(-i.ret) : '');
    var tauxPatStr = i.tauxPat || '';
    var retPatStr = i.retPat > 0 ? fmt(i.retPat) : '';
    return '<tr>' +
      tdC(escH(i.n||'')) +
      tdL(escH(i.label)) +
      td('text-align:right;'+bg, baseStr) +
      tdC(escH(i.taux||'')) +
      tdR(gainStr) +
      tdR(retStr) +
      tdC(escH(tauxPatStr)) + tdR(retPatStr) +
    '</tr>';
  }

  var rows = '';
  gainItems.forEach(function(i){ rows += buildRow(i); });

  // --- Lignes 40 / 41 / 42 dans le TBODY, comme dans le PDF ---
  rows +=
    '<tr>' + tdC('40') + tdBrut('Total brut') + tdC('') + tdR(fmt(calc.totals.brut), true) + tdR('') + tdC('') + tdR('') + '</tr>' +
    '<tr>' + tdC('41') + tdBrut('Brut fiscal') + tdC('') + tdR(fmt(calc.totals.brutFiscal), true) + tdR('') + tdC('') + tdR('') + '</tr>' +
    '<tr>' + tdC('42') + tdBrut('Brut social') + tdC('') + tdR(fmt(calc.totals.brutSocial), true) + tdR('') + tdC('') + tdR('') + '</tr>';

  cotItems.forEach(function(i){ rows += buildRow(i); });

  // Totaux colonnes (dernière ligne du tableau)
  var totGain = gainItems.reduce(function(s,i){ return s+(i.gain>0?i.gain:0); }, 0) + calc.totals.brut;
  var totRet  = calc.items.reduce(function(s,i){ return s+(i.ret>0?i.ret:0); }, 0);
  var totRetPat = calc.items.reduce(function(s,i){ return s+(i.retPat>0?i.retPat:0); }, 0);

  rows +=
    '<tr>' +
      td('','') + td('','') + td('','') + td('','') +
      tdR(fmt(totGain), true) +
      tdR(fmt(totRet), true) +
      td('','') +
      tdR(fmt(totRetPat), true) +
    '</tr>';

  // --- HTML du bulletin ---
  var h = '<div class="card" style="max-width:900px;margin:0 auto">';
  h += '<div style="display:flex;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:.8rem;margin-bottom:1rem;align-items:flex-start">';
  h += '<div style="display:flex;gap:12px;align-items:center">';
  if (ent.logo) h += '<img src="' + ent.logo + '" style="max-width:70px;max-height:70px;object-fit:contain">';
  h += '<div><h3 style="font-size:1.1rem">' + escH(soc.nom || ent.nom || 'MA SOCIETE') + '</h3><div style="font-size:.72rem;color:var(--dim)">' + escH(soc.adresse || ent.adresse || '') + '</div><div style="font-size:.68rem;color:var(--dim)">NCC: ' + escH(soc.ncc || ent.nui || '-') + ' | CNPS: ' + escH(soc.cnps || ent.cnps || '-') + '</div></div></div>';
  h += '<div style="text-align:right"><h3 style="font-size:1rem;color:var(--orange)">BULLETIN DE PAIE</h3><div style="font-weight:700;font-size:.75rem;color:var(--gold)">MOIS DE : ' + period + '</div></div></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;padding:.8rem;border:1px solid var(--border);border-radius:8px;background:#f8fafc;font-size:.75rem">';
  h += '<div><strong>Matricule:</strong> ' + escH(emp.matricule) + '<br><strong>Nom:</strong> ' + escH(emp.nom) + ' ' + escH(emp.prenoms) + '<br><strong>Fonction:</strong> ' + escH(emp.fonction || '-') + '<br><strong>Catégorie:</strong> ' + escH(emp.categorie_id || '-') + '</div>';
  var catBul = empCategorie(emp);
  if (catBul === 'journalier' || catBul === 'externe') {
    var stB = calc.stats || {};
    var hsB = (stB.hs15||0) + (stB.hs50||0) + (stB.hs75||0) + (stB.hs100||0);
    h += '<div>';
    if (catBul === 'journalier') h += '<strong>Taux journalier:</strong> ' + fmt(calc.totals.tauxJ || 0) + '<br><strong>Taux horaire:</strong> ' + fmt(calc.totals.th || 0) + '<br>';
    else h += '<strong>Montant forfaitaire:</strong> ' + fmt(calc.totals.forfait || 0) + '<br>';
    h += '<strong>Heures (Jour):</strong> ' + (stB.hJour||0).toFixed(1) + 'h<br><strong>Heures (Nuit):</strong> ' + (stB.hNuit||0).toFixed(1) + 'h<br><strong>Heures supp.:</strong> ' + hsB.toFixed(1) + 'h<br><strong>Prime du mois:</strong> ' + fmt(calc.totals.prime || 0) + ' F</div></div>';
  } else {
    h += '<div><strong>N° CNPS:</strong> ' + escH(emp.num_cnps || '-') + '<br><strong>N° CMU:</strong> ' + escH(emp.num_cmu || '-') + '<br><strong>Nbre Parts:</strong> ' + (emp.nb_parts || '1').toFixed(1).replace('.', ',') + '<br><strong>Sit. Mat.:</strong> ' + escH(emp.situation_matrimoniale || '-') + '</div></div>';
  }

  // Tableau
  h += '<table style="width:100%;border-collapse:collapse;font-size:10.5px">' +
    '<thead>' +
      '<tr>' +
        '<th rowspan="2" style="' + B + 'text-align:center;padding:3px;width:28px">N°</th>' +
        '<th rowspan="2" style="' + B + 'text-align:left;padding:3px;width:200px">DESIGNATION</th>' +
        '<th rowspan="2" style="' + B + 'text-align:right;padding:3px;width:75px">BASE</th>' +
        '<th colspan="2" style="' + B + 'text-align:center;padding:3px">PART SALARIALE</th>' +
        '<th colspan="3" style="' + B + 'text-align:center;padding:3px">PART PATRONALE</th>' +
      '</tr>' +
      '<tr>' +
        '<th style="' + B + 'text-align:center;padding:3px;width:55px">Nbre/taux</th>' +
        '<th style="' + B + 'text-align:right;padding:3px;width:65px">GAINS</th>' +
        '<th style="' + B + 'text-align:right;padding:3px;width:65px">RETENUE</th>' +
        '<th style="' + B + 'text-align:center;padding:3px;width:55px">Nbre/taux</th>' +
        '<th style="' + B + 'text-align:right;padding:3px;width:65px">RETENUE</th>' +
      '</tr>' +
    '</thead>' +
    '<tbody>' + rows + '</tbody>' +
  '</table>';

  // NET A PAYER et Options d'impression
  h += '<div style="background:#0f172a;color:#fff;display:flex;justify-content:flex-end;align-items:center;padding:.8rem 1rem;margin-top:1rem;border-radius:8px;font-weight:800;font-size:1.1rem"><span style="margin-right:2rem;font-size:.75rem;color:#94a3b8">NET À PAYER :</span><span style="color:#fbbf24">' + fmt(calc.totals.net) + ' FCFA</span></div>';
  
  h += '<div contenteditable="true" style="margin-top:10px;font-size:10px;text-align:center;color:#64748b;font-style:italic;padding:5px;border:1px dashed transparent;transition:border 0.2s" onfocus="this.style.border=\'1px dashed #cbd5e1\'" onblur="this.style.border=\'1px dashed transparent\'">Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.</div>';

  h += '<div class="no-print" style="margin-top:1rem;padding:1rem;background:#f8fafc;border:1px solid var(--border);border-radius:8px">';
  h += '<div style="font-weight:700;font-size:.8rem;margin-bottom:.6rem">Options d\'impression / export</div>';
  h += '<label style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:6px;cursor:pointer"><input type="checkbox" id="opt-acomptes" checked style="width:16px;height:16px"> Détail des acomptes & prêts</label>';
  h += '<label style="display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:6px;cursor:pointer"><input type="checkbox" id="opt-pointage" checked style="width:16px;height:16px"> Détail du pointage</label>';
  h += '<div style="margin-top:.8rem;display:flex;gap:1rem"><button class="btn" style="flex:1" onclick="printBulletinComplet(\'' + empId + '\',\'' + mois + '\')">Imprimer / Exporter le bulletin</button></div>';
  h += '</div>';
  h += '</div>'; // Fermeture div.card

  out.innerHTML = h;
  } catch (err) {
    out.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--danger)">Erreur : ' + escH(err && err.message ? err.message : err) + '</div>';
  }
}