fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(i) {
  function c(l, n) { console.log(l, i.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('fond nuit degrade     =', 'linear-gradient(165deg,#0d1017', i);
  c('halo or radial        =', 'rgba(212,175,55,.13)', i);
  c('logo SANS bordure     =', 'border-radius:50%;overflow:hidden;box-shadow:0 22px 70px', i);
  c('ancienne bordure      =', 'border:3px solid #e7d9b3');
  console.log('ancienne bordure      =', i.indexOf('border:3px solid #e7d9b3') === -1 ? 'SUPPRIMEE OK' : 'ENCORE LA');
  c('rampe or unique       =', '_mixGold', i);
  c('diviseur fin or       =', 'linear-gradient(90deg,transparent,#caa64b,transparent)', i);
}).catch(function(e) { console.error('ERREUR:', e.message); });
