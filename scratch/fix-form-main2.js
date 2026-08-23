const fs = require('fs');
let f = fs.readFileSync('public/index.html', 'utf8');
const NL = '\r\n';

function cut(oldS, newS, label) {
  const cnt = f.split(oldS).length - 1;
  if (cnt !== 1) { console.error('ANCRE ' + cnt + 'x (attendu 1): ' + label); process.exit(1); }
  f = f.replace(oldS, newS);
}

/* ---------- B) Nouveaux champs dans payeFields ---------- */
cut("    date_sortie: dateSortieVal," + NL +
    "    motif_sortie: motifSortieVal" + NL +
    "  };",
    "    date_sortie: dateSortieVal," + NL +
    "    motif_sortie: motifSortieVal," + NL +
    "    sexe: V('empSexe')," + NL +
    "    date_naissance: V('empNaissance')," + NL +
    "    telephone: V('empTel')," + NL +
    "    nb_parts: parseFloat(V('empNbParts')) || 1," + NL +
    "    rendement: !!(document.getElementById('empRendement') && document.getElementById('empRendement').checked)," + NL +
    "    nom_banque: V('empBanque')," + NL +
    "    numero_compte: V('empCompte')," + NL +
    "    num_wave: txWV, num_mtn_money: txMTN, num_orange_money: txOM, num_moov_money: txMV," + NL +
    "    numTransactionOM: txOM, numTransactionMTN: txMTN, numTransactionWave: txWV, numTransactionMoov: txMV" + NL +
    "  };",
    "payeFields etendus");

/* ---------- C) Branche update : retirer les lectures empTrans* ---------- */
cut("employes[i].matricule = matricule; employes[i].nom = nom; employes[i].prenoms = prenomsV; employes[i].abreviation = abreviation; employes[i].numTransactionOM = document.getElementById('empTransOM').value.trim(); employes[i].numTransactionMTN = document.getElementById('empTransMTN').value.trim(); employes[i].numTransactionWave = document.getElementById('empTransWave').value.trim(); employes[i].numTransactionMoov = document.getElementById('empTransMoov').value.trim();",
    "employes[i].matricule = matricule; employes[i].nom = nom; employes[i].prenoms = prenomsV; employes[i].abreviation = abreviation;",
    "update branch");

/* ---------- D) Branche creation : idem ---------- */
cut("var nEmp = {id:DB.genId(), matricule:matricule, nom:nom, prenoms:prenomsV, abreviation:abreviation, numTransactionOM:document.getElementById('empTransOM').value.trim(), numTransactionMTN:document.getElementById('empTransMTN').value.trim(), numTransactionWave:document.getElementById('empTransWave').value.trim(), numTransactionMoov:document.getElementById('empTransMoov').value.trim()}; for (var pk2 in payeFields)",
    "var nEmp = {id:DB.genId(), matricule:matricule, nom:nom, prenoms:prenomsV, abreviation:abreviation}; for (var pk2 in payeFields)",
    "create branch");

/* ---------- E) autoFillServiceI : assurer l'option avant value= ---------- */
cut("      var svc = typeof f === 'object' ? (f.service || '') : '';" + NL +
    "      if (svc && (!svcEl.value || svcEl.value === '')) svcEl.value = svc;",
    "      var svc = typeof f === 'object' ? (f.service || '') : '';" + NL +
    "      if (svc && (!svcEl.value || svcEl.value === '')) {" + NL +
    "        var hasOpt = false;" + NL +
    "        for (var oi = 0; oi < svcEl.options.length; oi++) { if (svcEl.options[oi].value === svc) { hasOpt = true; break; } }" + NL +
    "        if (!hasOpt) { var optS = document.createElement('option'); optS.value = svc; optS.textContent = svc; svcEl.appendChild(optS); }" + NL +
    "        svcEl.value = svc;" + NL +
    "      }",
    "autoFillServiceI select-safe");

fs.writeFileSync('public/index.html', f);
console.log('Etape 2 OK : saveEmploye + autoFillServiceI');
