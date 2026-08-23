fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('bascule bloc BL     =', 'setDashBlsSource');
  c('liste reels         =', 'blsWrapReel');
  c('mots-cles comptes   =', "'comptes tiers'");
  c('filtre 1re lettre   =', "buildSidebar();\r\n    filterMenuItems();");
}).catch(function(e) { console.error('ERREUR:', e.message); });
