Promise.all([
  fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }),
  fetch('https://montabbord.web.app/paye.html').then(function(r) { return r.text(); })
]).then(function(a) {
  var i = a[0], p = a[1];
  function c(l, n, s) { console.log(l, s.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('main local prioritaire =', 'if (Array.isArray(_lv5) && _lv5.length)', i);
  c('main marqueur grille   =', '_lpP.grilleWood !== true', i);
  c('main seed marque       =', 'pG.grilleWood !== true', i);
  c('paye local prioritaire =', 'if(Array.isArray(cc3)&&cc3.length)_inc[k3]=cc3;', p);
  c('paye marqueur          =', '_cur.grilleWood===true', p);
}).catch(function(e) { console.error('ERREUR:', e.message); });
