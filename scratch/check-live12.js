fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('bouton Imprimer =', "openPrintActifModal(\\'print\\')");
  c('bouton PDF      =', "openPrintActifModal(\\'pdf\\')");
  c('barre export    =', 'Enregistrer en PDF');
  c('mode memo       =', '_actifOutMode');
}).catch(function(e) { console.error('ERREUR:', e.message); });
