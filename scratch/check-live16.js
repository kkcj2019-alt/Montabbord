fetch('https://montabbord.web.app/').then(r=>r.text()).then(t=>{
  function c(l,n){ console.log(l, t.indexOf(n)!==-1?'OK':'ABSENT'); }
  // helpers & refocus
  c('helper V()', 'function V(');
  c('refocus flag', '_empRefocus=1');
  // personnel inline helpers
  c('_empCommitEmp', 'function _empCommitEmp');
  c('_empInline', '_empInline(event');
  c('_empInlineDate', '_empInlineDate');
  // dashboard toolbar/source
  c('setDashAllSource', 'setDashAllSource');
  c('gsrcReel', 'gsrcReel');
  c('toolbar init', '_initDashDnd()');
  c('dash order key', 'mdb_dash_order_');
  // source default
  c('dash src default', 'mdb_dash_src_');
}).catch(e=>console.error('err',e))