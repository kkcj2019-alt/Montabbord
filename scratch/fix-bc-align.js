const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
}

/* 1) Numero de BC dans les sous-details Prefinancement / Reserve dispo / Reserve indispo */
rep(
  "sd2.push({designation:getClientById(pfActifs[pi3].clientId)?getClientById(pfActifs[pi3].clientId).nom:'Client',montant:r,signe:'-'})",
  [
    "var _cN2=getClientById(pfActifs[pi3].clientId)?getClientById(pfActifs[pi3].clientId).nom:'Client';",
    "var _bc2=pfActifs[pi3].bcId?getBCById(pfActifs[pi3].bcId):null;",
    "sd2.push({designation:(_bc2&&_bc2.numero?'BC '+_bc2.numero+' \\u2014 ':'')+_cN2,montant:r,signe:'-'})"
  ].join(''),
  'sd2 BC'
);
rep(
  "(getClientById(pfActifs[pi4].clientId)?getClientById(pfActifs[pi4].clientId).nom:'Client')+' ('+rd+' FCFA)'",
  [
    "(function(){var _cN3=getClientById(pfActifs[pi4].clientId)?getClientById(pfActifs[pi4].clientId).nom:'Client';",
    "var _bc3=pfActifs[pi4].bcId?getBCById(pfActifs[pi4].bcId):null;",
    "return (_bc3&&_bc3.numero?'BC '+_bc3.numero+' \\u2014 ':'')+_cN3;})()+' ('+rd+' FCFA)'"
  ].join(''),
  'sd3 BC'
);
rep(
  "(getClientById(pfActifs[pi5].clientId)?getClientById(pfActifs[pi5].clientId).nom:'Client')+' ('+ri+' FCFA)'",
  [
    "(function(){var _cN4=getClientById(pfActifs[pi5].clientId)?getClientById(pfActifs[pi5].clientId).nom:'Client';",
    "var _bc4=pfActifs[pi5].bcId?getBCById(pfActifs[pi5].bcId):null;",
    "return (_bc4&&_bc4.numero?'BC '+_bc4.numero+' \\u2014 ':'')+_cN4;})()+' ('+ri+' FCFA)'"
  ].join(''),
  'sd4 BC'
);

/* 2) Remplacer entierement _alignActifTotals par une version par-section */
{
  const a = t.indexOf('function _alignActifTotals() {');
  const b = t.indexOf('function toggleActifDetail(id)');
  if (a < 0 || b < 0 || b < a) { console.error('bornes _alignActifTotals introuvables'); process.exit(1); }
  const fn = [
    "function _alignActifTotals() {",
    "  var root = document.getElementById('content');",
    "  if (!root || !root.querySelector('.rub-total-align')) return;",
    "  var secs = root.querySelectorAll('.section');",
    "  var _lastRect = null;",
    "  for (var iat = 0; iat < secs.length; iat++) {",
    "    var sec = secs[iat];",
    "    var tvv = sec.querySelector('.rub-total-align');",
    "    if (!tvv) continue;",
    "    var mL = null, mW = null, mRect = null;",
    "    var tbl = sec.querySelector('.table-responsive table');",
    "    if (tbl && tbl.offsetParent !== null) {",
    "      var ths = tbl.querySelectorAll('thead th');",
    "      if (ths.length >= 4) {",
    "        mRect = ths[3].getBoundingClientRect();",
    "        var secR = sec.getBoundingClientRect();",
    "        var blW = 0;",
    "        try { blW = parseFloat(getComputedStyle(sec).borderLeftWidth) || 0; } catch (e) {}",
    "        mL = mRect.left - secR.left - blW;",
    "        mW = mRect.width;",
    "        _lastRect = { left: mRect.left, width: mRect.width };",
    "      }",
    "    }",
    "    if (mL === null && sec._mtCol) { mL = sec._mtCol.l; mW = sec._mtCol.w; }",
    "    else if (mL !== null) { sec._mtCol = { l: mL, w: mW }; }",
    "    if (mL === null && window._actifMtColLast) { mL = window._actifMtColLast.l; mW = window._actifMtColLast.w; }",
    "    if (mL === null) continue;",
    "    window._actifMtColLast = { l: mL, w: mW };",
    "    tvv.style.left = mL + 'px';",
    "    tvv.style.width = mW + 'px';",
    "    tvv.style.textAlign = 'right';",
    "    var hd = sec.querySelector('.section-header');",
    "    if (hd) tvv.style.top = Math.max(6, hd.offsetTop + (hd.offsetHeight - tvv.offsetHeight) / 2) + 'px';",
    "  }",
    "  var gta = root.querySelector('.grand-total-amt');",
    "  if (gta) {",
    "    if (_lastRect) window._actifGtRef = _lastRect;",
    "    var ref = window._actifGtRef;",
    "    if (ref) {",
    "      var gtR = gta.parentNode.getBoundingClientRect();",
    "      gta.style.left = (ref.left - gtR.left) + 'px';",
    "      gta.style.width = ref.width + 'px';",
    "      gta.style.textAlign = 'right';",
    "      gta.style.top = Math.max(10, gta.parentNode.clientHeight / 2 - gta.offsetHeight / 2 + 4) + 'px';",
    "    }",
    "  }",
    "}"
  ].join('\r\n');
  t = t.slice(0, a) + fn + '\r\n' + t.slice(b);
}

fs.writeFileSync('public/index.html', t);
console.log('OK BC + alignement par-section');
