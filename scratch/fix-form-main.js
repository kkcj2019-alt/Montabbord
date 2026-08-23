const fs = require('fs');
let f = fs.readFileSync('public/index.html', 'utf8');
const NL = '\r\n';

function cut(oldS, newS, label) {
  const cnt = f.split(oldS).length - 1;
  if (cnt !== 1) { console.error('ANCRE ' + cnt + 'x (attendu 1): ' + label); process.exit(1); }
  f = f.replace(oldS, newS);
}

/* ---------- 1) Nouveau bloc openEmployeModal + helpers (structure identique au module Paye) ---------- */
const L = [];
const push = (s) => L.push(s);

push("function _orgOptsI(list, cur) {");
push("  var seen = {}, out = '<option value=\"\">S\\u00e9lectionner...</option>';");
push("  (list || []).forEach(function(x) { var v = typeof x === 'object' ? (x.nom || x.libelle || '') : String(x || ''); v = String(v).trim(); if (v) seen[v] = 1; });");
push("  Object.keys(seen).sort(function(a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); }).forEach(function(v) { out += '<option value=\"' + escH(v) + '\"' + (cur === v ? ' selected' : '') + '>' + escH(v) + '</option>'; });");
push("  if (cur && !seen[cur]) out += '<option value=\"' + escH(cur) + '\" selected>' + escH(cur) + '</option>';");
push("  return out;");
push("}");
push("function switchEmpTabM(tab) {");
push("  var tabs = ['infos', 'contrat', 'docs', 'paiement'];");
push("  for (var ti = 0; ti < tabs.length; ti++) {");
push("    var sec = document.getElementById('tabM-' + tabs[ti]);");
push("    if (sec) sec.style.display = tabs[ti] === tab ? '' : 'none';");
push("    var btn = document.querySelector('#empTabsM button[data-mtab=\"' + tabs[ti] + '\"]');");
push("    if (btn) {");
push("      var on = tabs[ti] === tab;");
push("      btn.style.background = on ? 'var(--primary)' : '#fff';");
push("      btn.style.color = on ? '#fff' : 'var(--gray-700)';");
push("      btn.style.borderColor = on ? 'var(--primary)' : 'var(--gray-300)';");
push("    }");
push("  }");
push("}");
push("function calcPartsM() {");
push("  var sit = document.getElementById('empSituation');");
push("  var en = document.getElementById('empEnfants');");
push("  var inf = document.getElementById('empEnfantsInfirmes');");
push("  var nb = document.getElementById('empNbParts');");
push("  if (!nb) return;");
push("  nb.value = 1 + (sit && sit.value === 'marie' ? 1 : 0) + (parseInt(en ? en.value : 0) || 0) + (parseInt(inf ? inf.value : 0) || 0);");
push("}");

/* Corps de openEmployeModal : mêmes onglets / champs / libellés / ordre que le module Paye */
push("function openEmployeModal(id) {");
push("  var e = null;");
push("  if (id) { var es = getEmployes(); for (var i = 0; i < es.length; i++) { if (es[i].id === id) { e = es[i]; break; } } }");
push("  var title = e ? 'Modifier l\\'employ\\u00e9' : 'Nouvel employ\\u00e9';");
push("  var _pb = 'border:1px solid var(--gray-300);border-radius:18px;padding:5px 13px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--gray-700)';");
push("  var html = '';");
push("  html += '<div id=\"empTabsM\" style=\"display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px\">';");
push("  html += '<button type=\"button\" data-mtab=\"infos\" style=\"' + _pb + '\" onclick=\"switchEmpTabM(\\'infos\\')\">Infos Personnelles</button>';");
push("  html += '<button type=\"button\" data-mtab=\"contrat\" style=\"' + _pb + '\" onclick=\"switchEmpTabM(\\'contrat\\')\">Contrat & Paie</button>';");
push("  html += '<button type=\"button\" data-mtab=\"docs\" style=\"' + _pb + '\" onclick=\"switchEmpTabM(\\'docs\\')\">Documents</button>';");
push("  html += '<button type=\"button\" data-mtab=\"paiement\" style=\"' + _pb + '\" onclick=\"switchEmpTabM(\\'paiement\\')\">Paiement</button>';");
push("  html += '</div>';");

/* Onglet 1 : Infos Personnelles */
push("  html += '<div id=\"tabM-infos\">';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Matricule *</label><input type=\"text\" id=\"empMatricule\" value=\"' + escH(e ? e.matricule : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Abr\\u00e9viation *</label><input type=\"text\" id=\"empAbrev\" value=\"' + escH(e ? e.abreviation : '') + '\" placeholder=\"Ex: JDO\"></div></div>';");
push("  var _famE = e ? (e.nom || '') : '';");
push("  var _preE = e ? (e.prenoms || '') : '';");
push("  if (_preE && _famE.length > _preE.length && _famE.slice(-_preE.length) === _preE) { _famE = _famE.slice(0, _famE.length - _preE.length).trim(); }");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Nom *</label><input type=\"text\" id=\"empNomFam\" value=\"' + escH(_famE) + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Pr\\u00e9noms *</label><input type=\"text\" id=\"empPrenoms\" value=\"' + escH(_preE) + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Sexe</label><select id=\"empSexe\"><option value=\"M\"' + (e && e.sexe === 'F' ? '' : ' selected') + '>Masculin</option><option value=\"F\"' + (e && e.sexe === 'F' ? ' selected' : '') + '>F\\u00e9minin</option></select></div>';");
push("  html += '<div class=\"form-group\"><label>Date Naissance</label><input type=\"date\" id=\"empNaissance\" value=\"' + escH(e ? e.date_naissance || '' : '') + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>T\\u00e9l\\u00e9phone</label><input type=\"text\" id=\"empTel\" value=\"' + escH(e ? e.telephone || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Situation Matrimoniale</label><select id=\"empSituation\" onchange=\"calcPartsM()\">';");
push("  var _sits = [['celibataire', 'C\\u00e9libataire'], ['marie', 'Mari\\u00e9(e)'], ['divorce', 'Divorc\\u00e9(e)'], ['veuf', 'Veuf(ve)']];");
push("  var _curSit = e ? (e.situation_matrimoniale || 'celibataire') : 'celibataire';");
push("  for (var si = 0; si < _sits.length; si++) { html += '<option value=\"' + _sits[si][0] + '\"' + (_curSit === _sits[si][0] ? ' selected' : '') + '>' + _sits[si][1] + '</option>'; }");
push("  html += '</select></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Enfants (&lt;21 ans)</label><input type=\"number\" id=\"empEnfants\" value=\"' + (e ? e.enfants || 0 : 0) + '\" onchange=\"calcPartsM()\"></div>';");
push("  html += '<div class=\"form-group\"><label>Enfants Infirmes</label><input type=\"number\" id=\"empEnfantsInfirmes\" value=\"' + (e ? e.enfants_infirmes || 0 : 0) + '\" onchange=\"calcPartsM()\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Parts Fiscales (auto)</label><input type=\"number\" id=\"empNbParts\" value=\"' + (e ? e.nb_parts || 1 : 1) + '\" step=\"0.5\" readonly style=\"background:var(--gray-100);font-weight:700\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Statut</label><select id=\"empStatus\" onchange=\"toggleEmpSortie()\"><option value=\"actif\"' + (!e || e.status !== 'inactif' ? ' selected' : '') + '>Actif</option><option value=\"inactif\"' + (e && e.status === 'inactif' ? ' selected' : '') + '>Inactif (sorti)</option></select></div></div>';");
push("  html += '<div id=\"empSortieBlock\" style=\"display:' + (e && e.status === 'inactif' ? '' : 'none') + '\">';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Date de sortie</label><input type=\"date\" id=\"empDateSortie\" value=\"' + escH(e ? e.date_sortie || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Motif de sortie</label><input type=\"text\" id=\"empMotifSortie\" value=\"' + escH(e ? e.motif_sortie || '' : '') + '\" placeholder=\"Fin contrat, d\\u00e9mission, licenciement...\"></div></div>';");
push("  html += '</div>';");
push("  html += '</div>';");

/* Onglet 2 : Contrat & Paie */
push("  html += '<div id=\"tabM-contrat\" style=\"display:none\">';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Date d\\'Entr\\u00e9e *</label><input type=\"date\" id=\"empDateEntree\" value=\"' + escH(e ? e.date_entree || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Type Contrat</label><select id=\"empTypeContrat\" onchange=\"toggleContratDuree()\">';");
push("  var _tcs = [['CDI', 'CDI'], ['CDD', 'CDD'], ['Stage', 'Stage'], ['Journalier', 'Journalier'], ['Externe', 'Prestataire externe']];");
push("  var _curTc = e ? (e.type_contrat || 'CDI') : 'CDI';");
push("  for (var tci = 0; tci < _tcs.length; tci++) { html += '<option value=\"' + _tcs[tci][0] + '\"' + (_curTc === _tcs[tci][0] ? ' selected' : '') + '>' + _tcs[tci][1] + '</option>'; }");
push("  html += '</select></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\" id=\"empDureeGroup\" style=\"display:' + (_curTc !== 'CDI' && _curTc !== 'Externe' ? '' : 'none') + '\"><label>Dur\\u00e9e (Mois)</label><input type=\"number\" id=\"empDureeContrat\" value=\"' + (e ? e.duree_contrat || 0 : 0) + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Service</label><select id=\"empService\">' + _orgOptsI(getServicesI(), e ? e.service || '' : '') + '</select></div>';");
push("  html += '<div class=\"form-group\"><label>Fonction</label><select id=\"empFonction\" onchange=\"autoFillServiceI()\">' + _orgOptsI(getFonctionsI(), e ? e.fonction || '' : '') + '</select></div></div>';");
push("  var cats = getCategoriesI();");
push("  if (cats.length > 0) {");
push("    html += '<div class=\"form-row\"><div class=\"form-group\"><label>Cat\\u00e9gorie</label><select id=\"empCategorie\" onchange=\"autoSalaireI()\"><option value=\"\">S\\u00e9lectionner...</option>';");
push("    for (var ci = 0; ci < cats.length; ci++) {");
push("      var selCat = (e && e.categorie_id === cats[ci].code) ? ' selected' : '';");
push("      html += '<option value=\"' + escH(cats[ci].code) + '\" data-sal=\"' + (cats[ci].salaire_min || 0) + '\"' + selCat + '>' + escH(cats[ci].code) + ' - ' + escH(cats[ci].libelle) + ' (' + fmtMoney(parseInt(cats[ci].salaire_min) || 0) + ')</option>';");
push("    }");
push("    html += '</select></div>';");
push("    html += '<div class=\"form-group\"><label>Taux indicatif</label><div id=\"empTauxHint\" style=\"font-size:11px;color:var(--gray-500);padding-top:8px\">S\\u00e9lectionnez une cat\\u00e9gorie</div></div></div>';");
push("  }");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Salaire de Base (FCFA) *</label><input type=\"number\" id=\"empSalaire\" value=\"' + (e ? e.salaire_base || '' : '') + '\" required><div id=\"empSalHintB\" style=\"font-size:.66rem;color:var(--gray-500);margin-top:2px\"></div></div>';");
push("  html += '<div class=\"form-group\"><label>Changement \\u00e0 partir de (mois)</label><input type=\"month\" id=\"empSalaireEffet\"></div></div>';");
push("  if (e && e.salaire_history && e.salaire_history.length > 0) {");
push("    html += '<div class=\"form-group\"><label style=\"font-size:11px;color:var(--gray-500)\">Historique des salaires</label><div style=\"font-size:12px;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:6px;padding:6px 10px;max-height:80px;overflow-y:auto\">';");
push("    var histSorted = e.salaire_history.slice().sort(function(a,b){ return (a.dateEffet||'').localeCompare(b.dateEffet||''); });");
push("    for (var hsi = 0; hsi < histSorted.length; hsi++) {");
push("      html += '<div style=\"padding:2px 0;border-bottom:1px dashed var(--gray-200)\"><strong>' + fmtMoney(histSorted[hsi].montant) + '</strong> depuis ' + escH(histSorted[hsi].dateEffet) + '</div>';");
push("    }");
push("    html += '</div></div>';");
push("  }");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Dans le livre de paie ?</label><select id=\"empEnPaie\"><option value=\"oui\"' + (e && e.en_paie === false ? '' : ' selected') + '>Oui</option><option value=\"non\"' + (e && e.en_paie === false ? ' selected' : '') + '>Non</option></select></div>';");
push("  html += '<div class=\"form-group\"><label>Mode de pointage</label><select id=\"empModePointage\"><option value=\"journalier\"' + (e && e.mode_pointage === 'forfait' ? '' : ' selected') + '>Journalier (heures r\\u00e9elles)</option><option value=\"forfait\"' + (e && e.mode_pointage === 'forfait' ? ' selected' : '') + '>Forfait (173,33h/mois)</option></select></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Rendement (Montage)</label><label style=\"display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400\"><input type=\"checkbox\" id=\"empRendement\"' + (e && e.rendement ? ' checked' : '') + ' style=\"width:16px;height:16px\"> Travaille au rendement</label></div></div>';");
push("  html += '</div>';");

/* Onglet 3 : Documents */
push("  html += '<div id=\"tabM-docs\" style=\"display:none\">';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>N\\u00b0 CNI</label><input type=\"text\" id=\"empCNI\" value=\"' + escH(e ? e.num_cni || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>N\\u00b0 Extrait</label><input type=\"text\" id=\"empExtrait\" value=\"' + escH(e ? e.num_extrait || '' : '') + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>N\\u00b0 CNPS</label><input type=\"text\" id=\"empCNPS\" value=\"' + escH(e ? e.num_cnps || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>N\\u00b0 CMU</label><input type=\"text\" id=\"empCMU\" value=\"' + escH(e ? e.num_cmu || '' : '') + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>N\\u00b0 Assurance</label><input type=\"text\" id=\"empAssurance\" value=\"' + escH(e ? e.num_assurance || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>Assurance Mensuelle</label><input type=\"number\" id=\"empAssuranceMensuelle\" value=\"' + (e ? e.assurance_mensuelle || 0 : 0) + '\"></div></div>';");
push("  html += '</div>';");

/* Onglet 4 : Paiement */
push("  html += '<div id=\"tabM-paiement\" style=\"display:none\">';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>Nom de la Banque</label><input type=\"text\" id=\"empBanque\" value=\"' + escH(e ? e.nom_banque || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>N\\u00b0 de Compte</label><input type=\"text\" id=\"empCompte\" value=\"' + escH(e ? e.numero_compte || '' : '') + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>N\\u00b0 Wave</label><input type=\"text\" id=\"empWave\" value=\"' + escH(e ? e.num_wave || e.numTransactionWave || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>N\\u00b0 Moov Money</label><input type=\"text\" id=\"empMoovMoney\" value=\"' + escH(e ? e.num_moov_money || e.numTransactionMoov || '' : '') + '\"></div></div>';");
push("  html += '<div class=\"form-row\"><div class=\"form-group\"><label>N\\u00b0 Orange Money</label><input type=\"text\" id=\"empOrangeMoney\" value=\"' + escH(e ? e.num_orange_money || e.numTransactionOM || '' : '') + '\"></div>';");
push("  html += '<div class=\"form-group\"><label>N\\u00b0 MTN Mobile Money</label><input type=\"text\" id=\"empMtnMoney\" value=\"' + escH(e ? e.num_mtn_money || e.numTransactionMTN || '' : '') + '\"></div></div>';");
push("  html += '</div>';");
push("  var footer = '<button class=\"btn btn-outline\" onclick=\"closeModal()\">Annuler</button>';");
push("  footer += '<button class=\"btn btn-primary\" onclick=\"saveEmploye(\\'' + (id || '') + '\\')\">Enregistrer</button>';");
push("  openFormModal(title, html, footer);");
push("  switchEmpTabM('infos');");
push("  calcPartsM();");
push("}");

const newBlock = L.join(NL);

cut("function openEmployeModal(id) {" + NL +
    "  var e = null;" ,
    newBlock + NL +
    "function __OLD_openEmployeMarker__() { var e = null;",
    "bloc openEmployeModal complet");

/* Supprimer l'ancien corps resté entre le marqueur et la fin de fonction */
const mStart = f.indexOf("function __OLD_openEmployeMarker__() { var e = null;");
const mEndAnchor = "  openFormModal(title, html, footer);" + NL + "}";
const mEnd = f.indexOf(mEndAnchor, mStart);
if (mStart < 0 || mEnd < 0) { console.error('Ancien corps introuvable'); process.exit(1); }
f = f.slice(0, mStart) + f.slice(mEnd + mEndAnchor.length + 1); /* +1 pour le \r restant */

fs.writeFileSync('public/index.html', f);
console.log('Etape 1 OK : nouveau formulaire 4 onglets');
