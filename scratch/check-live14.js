fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('negatifs impression =', "mtVal.indexOf('-') === 0");
  c('bloc bl facturer    =', '_blRowsB');
  c('sidebar blanche     =', 'border-radius:9px;color:#ffffff');
}).catch(function(e) { console.error('ERREUR:', e.message); });
