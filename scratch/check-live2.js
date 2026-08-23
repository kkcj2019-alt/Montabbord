Promise.all([
  fetch('https://montabbord.web.app/').then(r => r.text()),
  fetch('https://montabbord.web.app/paye.html').then(r => r.text())
]).then(function(a) {
  var i = a[0], p = a[1];
  function chk(label, needle, src) { console.log(label, src.indexOf(needle) !== -1 ? 'OK' : 'ABSENT'); }
  chk('connexion fond blanc  =', 'inset:0;background:#ffffff', i);
  chk('sidebar beige         =', '#c9b18a', i);
  chk('dashboard conditionnel=', "canAccess('dashboard', false)) {", i);
  chk('epingles filtrees     =', 'if (!canAccess(p.key, false)) continue;', i);
  chk('fix petit admin OU    =', 'dp.indexOf(basePage) !== -1) return false;', i);
  chk('lettres colorees mix  =', '_mdbMixU', i);
  chk('voix homme            =', 'paul|thomas|nicolas', i);
  chk('unlock audio mobile   =', '_mdbUnlockVoix', i);
  chk('paye bandes grises    =', 'background:#334155;color:#cbd5e1', p);
}).catch(function(e) { console.error('ERREUR:', e.message); });
