fetch('https://montabbord.web.app/').then(function(r) { return r.text(); }).then(function(t) {
  function c(l, n) { console.log(l, t.indexOf(n) !== -1 ? 'OK' : 'ABSENT'); }
  c('edition inline stock =', 'inlineStockNum');
  c('filtre qte zero      =', 'stockFiltreQte');
  c('dashboard recherche  =', 'actifDashSearch');
  c('bloc rubriques       =', 'actifDashRubriques');
}).catch(function(e) { console.error('ERREUR:', e.message); });
