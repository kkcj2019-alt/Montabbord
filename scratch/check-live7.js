Promise.all([
  fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }),
  fetch('https://montabbord.web.app/paye.html').then(function(r) { return r.text(); })
]).then(function(a) {
  var i = a[0], p = a[1];
  function c(l, n, s) { console.log(l, s.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('main merge cloud        =', "_grdK = ['categories'", i);
  c('main seed boot          =', 'ensureGrillePersisteeI', i);
  c('main colonne cumulee    =', 'D\u00e9partement / Fonction</th>', i);
  c('main deptFoncCellI      =', 'function deptFoncCellI(p)', i);
  c('paye garde etendue      =', "KEYS=['categories'", p);
  c('paye colonne cumulee    =', 'D\\u00e9partement / Fonction</th>', p);
  c('paye deptFoncCell       =', 'function deptFoncCell(p)', p);
}).catch(function(e) { console.error('ERREUR:', e.message); });
