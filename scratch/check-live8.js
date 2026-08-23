fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(i) {
  function c(l, n) { console.log(l, i.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('go caisse corrigee    =', "navigateTo('tresorerie:caisse'); setTimeout(function(){ openCaisseModal", i);
  c('go client corrigee    =', "navigateTo('tiers')", i);
  c('go article corrige    =', "navigateTo('stock')", i);
  c('fond ardoise          =', 'background:#eef0f4', i);
  c('pills nav actives     =', '.nav-item.active,.nav-item:hover.active{background:#fff1e7', i);
  c('champ recherche gris  =', 'background:#f2f4f8;border:1px solid transparent', i);
}).catch(function(e) { console.error('ERREUR:', e.message); });
