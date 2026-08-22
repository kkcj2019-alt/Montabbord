const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');

const START = "    var visibleDetailsD = [];\r\n";
const END_ANCHOR = "    if (rubD.key === 'tresorerie') {\r\n      /* Tri par montant";
const sI = t.indexOf(START);
if (sI < 0) { console.error('start introuvable'); process.exit(1); }
const eI = t.indexOf(END_ANCHOR, sI);
if (eI < 0) { console.error('fin introuvable'); process.exit(1); }

const NEW = [
"    var visibleDetailsD = [];",
"    if (rubD.key === 'tresorerie') {",
"      /* D\u00e9doublonnage des libell\u00e9s syst\u00e8me + filtres classiques */",
"      var _seenSysT = {};",
"      for (var vdS = 0; vdS < allDetailsD.length; vdS++) {",
"        var dS = allDetailsD[vdS];",
"        if (dS.isHidden) continue;",
"        if (!dS.isManual && _sysNamesD[(dS.designation || '').trim().toLowerCase()]) {",
"          var kS = dS.designation.trim().toLowerCase() + '|' + dS.signe + '|' + Math.abs(dS.montant || 0);",
"          if (_seenSysT[kS]) continue;",
"          _seenSysT[kS] = 1;",
"        }",
"        if (hideZero && dS.montant === 0 && !dS.fournisseurId && !dS.isManual) continue;",
"        visibleDetailsD.push(dS);",
"      }",
"    } else {",
"      for (var vdD = 0; vdD < allDetailsD.length; vdD++) {",
"        if (allDetailsD[vdD].isHidden) continue;",
"        if (hideZero && allDetailsD[vdD].montant === 0 && !allDetailsD[vdD].fournisseurId) continue;",
"        visibleDetailsD.push(allDetailsD[vdD]);",
"      }",
"    }",
"    /* Total de rubrique : hors lignes masqu\u00e9es et hors doublons syst\u00e8me */",
"    var _countableD = [];",
"    var _seenTotD = {};",
"    for (var ctD = 0; ctD < allDetailsD.length; ctD++) {",
"      var dCt = allDetailsD[ctD];",
"      if (dCt.isHidden) continue;",
"      if (!dCt.isManual && rubD.key === 'tresorerie' && _sysNamesD[(dCt.designation || '').trim().toLowerCase()]) {",
"        var kCt = dCt.designation.trim().toLowerCase() + '|' + dCt.signe + '|' + Math.abs(dCt.montant || 0);",
"        if (_seenTotD[kCt]) continue;",
"        _seenTotD[kCt] = 1;",
"      }",
"      _countableD.push(dCt);",
"    }",
""
].join('\r\n');

t = t.substring(0, sI) + NEW + t.substring(eI);

/* le total utilise la liste dédoublonnée */
const OLD_TOT = [
"    var rubTotalD = 0;",
"    for (var dtD = 0; dtD < allDetailsD.length; dtD++) {",
"      if (allDetailsD[dtD].isHidden) continue;",
"      if (allDetailsD[dtD].signe === '-') rubTotalD -= Math.abs(allDetailsD[dtD].montant);",
"      else rubTotalD += Math.abs(allDetailsD[dtD].montant);",
"    }"
].join('\r\n');
const NEW_TOT = [
"    var rubTotalD = 0;",
"    for (var dtD = 0; dtD < _countableD.length; dtD++) {",
"      if (_countableD[dtD].signe === '-') rubTotalD -= Math.abs(_countableD[dtD].montant);",
"      else rubTotalD += Math.abs(_countableD[dtD].montant);",
"    }"
].join('\r\n');
if (t.indexOf(OLD_TOT) < 0) { console.error('bloc total introuvable'); process.exit(1); }
t = t.replace(OLD_TOT, NEW_TOT);

fs.writeFileSync('public/index.html', t);
console.log('nettoyage OK');
