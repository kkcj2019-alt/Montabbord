Promise.all([
  fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }),
  fetch('https://montabbord.web.app/paye.html').then(function(r) { return r.text(); })
]).then(function(a) {
  var i = a[0], p = a[1];
  function c(l, n, s) { console.log(l, s.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('app onglets 4 tabs   =', 'data-mtab="contrat"', i);
  c('app rendement        =', 'empRendement', i);
  c('app paiement mobile  =', 'empMoovMoney', i);
  c('app selects service  =', '_orgOptsI(getServicesI()', i);
  c('app save nb_parts    =', "nb_parts: parseFloat(V(", i);
  c('app save banque      =', 'nom_banque: V(', i);
  c('paye abreviation     =', 'name="abreviation"', p);
  c('paye sortie toggle   =', 'toggleSortieP', p);
}).catch(function(e) { console.error('ERREUR:', e.message); });
