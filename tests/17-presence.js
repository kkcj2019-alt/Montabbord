'use strict';
/* tests/17-presence.js — fiche de presence du jour : rapport Direction (PDF)
   et delais de synchro temps reel entre postes. */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');
function run(rapport) {
  rapport.section('17. Presence du jour et temps reel');
  let h;
  try { h = chargerApp('paye.html', storeRealiste()); } catch (e) { rapport.ko('chargement paye : ' + e.message); return; }
  let res;
  try {
    res = String(vm.runInContext(`(function(){
      var html = null;
      window.open = function(){ return { document: { open:function(){}, write: function(s){ html = (html||'') + s; }, close: function(){} }, focus: function(){}, print: function(){}, close: function(){} }; };
      var d = new Date(); var ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      var data = fpjDonneesJour(ds);
      printRapportPresenceDirection(ds);
      if (!html) return 'ECHEC : aucun document produit';
      var ok = /RAPPORT DE PR/.test(html) && /présence|Présence/.test(html) && /absence|Absence/.test(html);
      var t = data.tot; var somme = t.pres + t.abs + t.np;
      return (ok && somme === t.eff) ? 'OK : effectif ' + t.eff + ' = ' + t.pres + ' pres. + ' + t.abs + ' abs. + ' + t.np + ' non pointes' : 'ECHEC : ' + JSON.stringify({ok:ok, eff:t.eff, somme:somme});
    })()`, h.ctx, { timeout: 30000 }));
  } catch (e) { res = 'ECHEC exception ' + e.message; }
  if (res.indexOf('OK') === 0) rapport.ok('Rapport Direction : comptes coherents  ->  ' + res); else rapport.ko('Rapport Direction  ->  ' + res);

  const pub = path.join(__dirname, '..', 'public');
  const idx = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  const prod = fs.readFileSync(path.join(pub, 'production.html'), 'utf8');
  const pay = fs.readFileSync(path.join(pub, 'paye.html'), 'utf8');
  const sdk = fs.readFileSync(path.join(pub, 'supabase-sdk', 'mdb-supabase.js'), 'utf8');
  const m1 = idx.match(/_pushTimer = setTimeout\(pushToCloud, (\d+)\);\s*\}/);
  const m2 = prod.match(/_prodPushT = setTimeout\(prodPushNow, (\d+)\)/);
  const m3 = pay.match(/\}, force \? 300 : (\d+)\);/);
  const vals = [m1 && +m1[1], m2 && +m2[1], m3 && +m3[1]];
  if (vals.every(v => v && v <= 1000)) rapport.ok('Envoi vers les autres postes en moins d\'1 s (index ' + vals[0] + ' ms, production ' + vals[1] + ' ms, paye ' + vals[2] + ' ms)');
  else rapport.ko('Delais d\'envoi trop longs : ' + vals.join('/'));
  if (/ouvertJusqua/.test(sdk) && /En direct/.test(sdk) && /width = '12px'/.test(sdk)) rapport.ok('Voyant de synchro discret (petit point, detail a l\'appui, texte seulement en cas d\'alerte)');
  else rapport.ko('Voyant temps reel absent');
}
module.exports = { run };
