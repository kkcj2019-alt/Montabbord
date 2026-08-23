fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('montant effectif    =', 'var montantSigne = montantVal < 0');
  c('fallback lignes     =', '_svR2');
  c('sous-titres dash    =', '_ddA.subLabel');
  c('bascule stock       =', 'setDashStkSource');
  c('stock reel calc     =', "_skS[_si3].prixUnitaire");
}).catch(function(e) { console.error('ERREUR:', e.message); });
