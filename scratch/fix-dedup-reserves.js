const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');

function cut(fromMarker, toMarker, replacement) {
  const a = t.indexOf(fromMarker);
  const b = t.indexOf(toMarker, a < 0 ? 0 : a);
  if (a < 0 || b < 0 || b < a) { console.error('marqueurs introuvables: ' + fromMarker.slice(0, 40)); process.exit(1); }
  t = t.slice(0, a) + replacement + t.slice(b);
}

/* 1) helpers normalises, inseres a la place de la declaration _sysNamesD */
const declAnchor = 'var allDetailsD = rubD.details.slice();';
const afterDecl = 'for (var mlD = 0';
cut(
  declAnchor,
  afterDecl,
  [
    'var allDetailsD = rubD.details.slice();',
    "    /* _sysBucketD : reconnait les libelles systeme quel que soit l'orthographe (accents/pluriel/espaces/casse) */",
    '    function _sysBucketD(nmX) {',
    "      var k = String(nmX || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]/g, '');",
    "      if (k.indexOf('prefinancement') === 0) return 'pre';",
    "      if (k.indexOf('reserve') === 0 && k.indexOf('indispo') >= 0) return 'ind';",
    "      if (k.indexOf('reserve') === 0 && k.indexOf('dispo') >= 0) return 'dis';",
    '      return null;',
    '    }',
    '    '
  ].join('\r\n')
);

/* 2) saut des lignes manuelles a libelle systeme */
{
  const a = t.indexOf('if (rubD.key');
  let start = -1;
  if (a >= 0) {
    const probe = t.indexOf('_sysNamesD[', a);
    if (probe >= 0 && probe - a < 120 && t.slice(a, probe).indexOf("'tresorerie'") >= 0) start = a;
  }
  if (start < 0) { console.error('ligne skip introuvable'); process.exit(1); }
  let end = t.indexOf('\n', t.indexOf('continue;', start));
  if (end < 0) { console.error('fin skip introuvable'); process.exit(1); }
  end += 1;
  t = t.slice(0, start) + "      if (rubD.key === 'tresorerie' && _sysBucketD(manualLignesD[mlD].designation)) continue;\r\n" + t.slice(end);
}

/* 3) bloc visibleDetailsD : dedup par bucket systeme, garde la 1ere occurrence */
cut(
  'var _seenSysT = {};',
  'if (hideZero && dS.montant === 0',
  [
    'var _seenSysT = {};',
    '      for (var vdS = 0; vdS < allDetailsD.length; vdS++) {',
    '        var dS = allDetailsD[vdS];',
    '        if (dS.isHidden) continue;',
    '        var bS = _sysBucketD(dS.designation);',
    '        if (bS) {',
    '          if (_seenSysT[bS]) continue;',
    '          _seenSysT[bS] = 1;',
    '        }',
    '        '
  ].join('\r\n')
);

/* 4) bloc _countableD idem */
cut(
  'var _seenTotD = {};',
  '_countableD.push(dCt);',
  [
    'var _seenTotD = {};',
    '    for (var ctD = 0; ctD < allDetailsD.length; ctD++) {',
    '      var dCt = allDetailsD[ctD];',
    '      if (dCt.isHidden) continue;',
    "      if (rubD.key === 'tresorerie') {",
    '        var bCt = _sysBucketD(dCt.designation);',
    '        if (bCt) {',
    '          if (_seenTotD[bCt]) continue;',
    '          _seenTotD[bCt] = 1;',
    '        }',
    '      }',
    '      '
  ].join('\r\n')
);

fs.writeFileSync('public/index.html', t);
console.log('normalisation OK');
