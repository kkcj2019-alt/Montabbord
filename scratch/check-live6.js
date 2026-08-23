fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(i) {
  function c(l, n) { console.log(l, i.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('fond blanc           =', '#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:#ffffff', i);
  c('actif orange paye    =', '.nav-item.active{background:linear-gradient(to right,rgba(249,115,22,.1),transparent);color:#f97316;border-left-color:#f97316', i);
  c('hover teinte orange  =', '.nav-item:hover{background:rgba(249,115,22,.05)', i);
  c('brand orange         =', '.sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#f97316', i);
  console.log('ancien creme         =', i.indexOf('#f6f1e7') === -1 ? 'SUPPRIME OK' : 'ENCORE LA');
}).catch(function(e) { console.error('ERREUR:', e.message); });
