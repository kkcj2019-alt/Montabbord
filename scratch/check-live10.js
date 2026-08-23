fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('caisse filtree      =', '_opsl[_gq].numeroPiece');
  c('sidebar bleu nuit   =', 'linear-gradient(180deg,#0b1526');
  c('nav doree           =', 'rgba(236,201,95,.24)');
  c('bascule BL reels    =', "setDashBlSource('reel')");
  c('calcul BL reel      =', '_blRealTotal');
}).catch(function(e) { console.error('ERREUR:', e.message); });
