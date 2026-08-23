Promise.all([
  fetch('https://montabbord.web.app/').then(r => r.text()),
  fetch('https://montabdord.web.app/').catch(() => ''),
  fetch('https://montabbor.web.app/paye.html').catch(() => fetch('https://montabbord.web.app/paye.html').then(r => r.text()))
]).then(function(a) {
  var i = a[0];
  var p = a[2] && a[2].length ? a[2] : '';
  function chk(l, n, src) { console.log(l, src.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  chk('boot grille paye        =', 'try { loadCategories(); } catch (eLC) {}', p);
  chk('protection categories   =', '_inc.categories=_cc;', p);
  chk('garde tbody             =', 'if (!tbody) return;', p);
  chk('grille fallback index   =', 'woodSectorGridDataI()', i);
  chk('champs Nom/Prenoms      =', 'empNomFam', i);
  chk('save prenoms            =', 'employes[i].prenoms = prenomsV;', i);
  chk('splash bonjour or       =', 'color:#b8860b">Bonjour', i);
  chk('splash societe or       =', 'color:#7a5f14', i);
}).catch(function(e) { console.error('ERREUR:', e.message); });
