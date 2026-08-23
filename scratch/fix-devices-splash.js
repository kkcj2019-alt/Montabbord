const fs = require('fs');
let nRep = 0;
let t = fs.readFileSync('public/index.html', 'utf8');
function rep(oldS, newS, label) {
  const i = t.indexOf(oldS);
  if (i < 0) { console.error('INTROUVABLE: ' + label); process.exit(1); }
  t = t.slice(0, i) + newS + t.slice(i + oldS.length);
  nRep++;
}

/* ================= GARDIEN APPAREILS : 1 mobile + 1 PC par entreprise ================= */
rep([
  'function startUniqueSession(enterpriseUid, userId, forceNew) {',
  '  stopUniqueSession();',
  '  if (!firebaseDb || !enterpriseUid || !userId) return;'
].join('\r\n'),
[
  '/* --- Limite appareils : un telephone ET un ordinateur simultanement max par compte --- */',
  'var _devUnsub = null;',
  'function _mdbDevType() {',
  "  var ua = navigator.userAgent || '';",
  '  if (/iPad|Tablet/i.test(ua)) return \'mobile\';',
  '  if (/Mobi|Android|iPhone|iPod|Silk|Windows Phone/i.test(ua)) return \'mobile\';',
  '  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return \'mobile\';',
  "  return 'pc';",
  '}',
  'function _mdbDevicesRef(uid) {',
  "  return firebaseDb.collection('enterprises').doc(uid).collection('sessions').doc('_devices');",
  '}',
  'function _mdbKickedLocal() {',
  '  stopUniqueSession();',
  '  stopRealtimeSync();',
  '  try { if (firebaseAuth) firebaseAuth.signOut().catch(function() {}); } catch (eK) {}',
  '  currentUser = null;',
  "  ['mdb_currentUser','mdb_enterpriseUid','mdb_devSid'].forEach(function(k) { localStorage.removeItem(k); });",
  '  showLogin();',
  "  var err = document.getElementById('loginError');",
  '  if (err) {',
  "    err.textContent = 'Ce compte vient d\\'\u00eat connect\u00e9 sur un autre ' + (_mdbDevType() === 'mobile' ? 't\u00e9l\u00e9phone' : 'ordinateur') + '.';",
  "    err.style.color = 'var(--danger)';",
  "    err.style.display = 'block';",
  '  }',
  '}',
  'function _mdbDevClaim(uid) {',
  '  if (!firebaseDb || !uid) return;',
  '  var ty = _mdbDevType();',
  "  var sid = localStorage.getItem('mdb_devSid');",
  "  if (!sid) { sid = DB.genId(); try { localStorage.setItem('mdb_devSid', sid); } catch (eS) {} }",
  '  var r = _mdbDevicesRef(uid);',
  '  var patch = {};',
  "  patch[ty] = { sid: sid, userId: (currentUser && currentUser.id) || '', at: new Date().toISOString() };",
  '  r.set(patch, { merge: true }).catch(function() {});',
  "  if (_devUnsub) { try { _devUnsub(); } catch (eU) {} _devUnsub = null; }",
  '  var settledD = false;',
  '  setTimeout(function() { settledD = true; }, 8000);',
  '  _devUnsub = r.onSnapshot(function(doc) {',
  '    if (!settledD) return;',
  '    if (!doc || !doc.exists) return;',
  '    var d = doc.data() || {};',
  '    var slot = d[ty];',
  "    if (!slot || !slot.sid) return;",
  '    if (slot.sid !== sid) { _mdbKickedLocal(); }',
  '  });',
  '}',
  'function _mdbDevValidate(uid) {',
  '  if (!firebaseDb || !uid) return;',
  '  var ty = _mdbDevType();',
  "  var sid = localStorage.getItem('mdb_devSid');",
  '  if (!sid) { _mdbDevClaim(uid); return; }',
  '  var r = _mdbDevicesRef(uid);',
  '  r.get().then(function(doc) {',
  '    var d = (doc && doc.exists) ? doc.data() : {};',
  '    var slot = d[ty];',
  '    if (!slot || !slot.sid) { _mdbDevClaim(uid); return; }',
  '    if (slot.sid === sid) { _mdbDevClaim(uid); return; }',
  '    _mdbKickedLocal();',
  '  }).catch(function() {});',
  '}',
  'function startUniqueSession(enterpriseUid, userId, forceNew) {',
  '  stopUniqueSession();',
  '  if (!firebaseDb || !enterpriseUid || !userId) return;',
  "  if (enterpriseUid !== 'SUPER-ADMIN') {",
  '    if (forceNew) { try { _mdbDevClaim(enterpriseUid); } catch (eD1) {} }',
  '    else { try { _mdbDevValidate(enterpriseUid); } catch (eD2) {} }',
  '  }'
].join('\r\n'),
'gardien appareils');

/* doLogout : liberer le slot d'appareil */
rep('function doLogout() {',
[
  'function doLogout() {',
  '  try {',
  "    if (currentUser && !currentUser.isSuperAdmin) {",
  "      var lUid = DB.get('mdb_enterpriseUid');",
  '      if (lUid && firebaseDb) {',
  '        var tyL = _mdbDevType();',
  "        var sidL = localStorage.getItem('mdb_devSid');",
  '        var pL = {};',
  "        pL[tyL] = { sid: '', userId: '', at: new Date().toISOString() };",
  '        if (sidL) { _mdbDevicesRef(lUid).set(pL, { merge: true }).catch(function() {}); }',
  '      }',
  '    }',
  "  } catch (eLO) {}"
].join('\r\n'),
'dologout libere slot');

/* ================= SPLASH EN BLANC ================= */
rep("background:linear-gradient(135deg,#0f172a,#1e3a8a 60%,#2563eb);display:flex;flex-direction:column;align-items:center;justify-content:center'",
    "background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center'",
    'splash fond blanc');
rep('border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.30);box-shadow:0 10px 40px rgba(37,99,235,.55)',
    'border-radius:50%;overflow:hidden;border:3px solid #e7d9b3;box-shadow:0 10px 34px rgba(15,23,42,.16)',
    'logo cadre or');
rep('letter-spacing:.6em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .5s">Bonjour</div>',
    'letter-spacing:.6em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .5s;color:#94a3b8">Bonjour</div>',
    'bonjour gris');
rep("letter-spacing:.28em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .68s\">Bienvenue sur le tableau de bord' + (nomSoc ? ' de' : '') + '</div>'",
    "letter-spacing:.28em;text-transform:uppercase;opacity:0;animation:mdbLetIn .5s ease both .68s;color:#475569\">Bienvenue sur le tableau de bord' + (nomSoc ? ' de' : '') + '</div>'",
    'bienvenue slate');
rep("letter-spacing:.45em;text-transform:uppercase;font-family:\\'Cinzel\\',Georgia,serif\">' + lettres + '</div>",
    "letter-spacing:.45em;text-transform:uppercase;font-family:\\'Cinzel\\',Georgia,serif;color:#1e293b\">' + lettres + '</div>",
    'societe foncee');
rep('_stopsU = (window._mdbLogoCols && window._mdbLogoCols.length >= 2) ? window._mdbLogoCols.slice() : [{ r: 125, g: 211, b: 252 }, { r: 167, g: 139, b: 250 }, { r: 240, g: 171, b: 252 }];',
    '_stopsU = (window._mdbLogoCols && window._mdbLogoCols.length >= 2) ? window._mdbLogoCols.slice() : [{ r: 37, g: 99, b: 235 }, { r: 124, g: 58, b: 237 }, { r: 219, g: 39, b: 119 }];',
    'degrade plus soutenu');
rep('margin:26px auto 0;height:5px;width:min(380px,80vw);background:rgba(255,255,255,.16)',
    'margin:26px auto 0;height:5px;width:min(380px,80vw);background:rgba(15,23,42,.10)',
    'piste barre');
rep('text-shadow:0 4px 26px rgba(56,189,248,.30)',
    'text-shadow:0 4px 22px rgba(15,23,42,.16)',
    'halo nom');

/* ================= SIDEBAR CREME ELEGANTE ================= */
rep('width:var(--sidebar-w);background:#c9b18a;color:#241c09;border-right:1px solid #b39c74;display:flex',
    'width:var(--sidebar-w);background:#f6f1e7;color:#3f3625;border-right:1px solid #e6dcc4;display:flex',
    'sidebar creme');
rep('font-weight:700;border-bottom:1px solid rgba(0,0,0,.12)',
    'font-weight:700;border-bottom:1px solid rgba(0,0,0,.08)',
    'brand bordure');
rep('.sidebar-toggle{background:none;border:none;color:#6b5a35',
    '.sidebar-toggle{background:none;border:none;color:#a3926b',
    'toggle');
rep('.sidebar-toggle:hover{color:#241c09}', '.sidebar-toggle:hover{color:#2c2413}', 'toggle hover');
rep('text-transform:uppercase;color:#6f5c36;letter-spacing:.06em',
    'text-transform:uppercase;color:#a3926b;letter-spacing:.06em',
    'titre groupe');
rep('padding:10px 24px;color:#3a2f16', 'padding:10px 24px;color:#4a4030', 'item');
rep('.nav-item:hover{background:#bda87e;color:#241c09}', '.nav-item:hover{background:#ece3cd;color:#2c2413}', 'item hover');
rep('.nav-item.active{background:#b89f70;color:#241c09;border-left-color:#8a6d1f}',
    '.nav-item.active{background:#efe6cf;color:#2c2413;border-left-color:#b8860b}',
    'item actif');
rep('.sidebar-footer{padding:14px 20px;border-top:1px solid rgba(0,0,0,.12)',
    '.sidebar-footer{padding:14px 20px;border-top:1px solid rgba(0,0,0,.08)',
    'footer bordure');
rep('.sidebar-footer .user-info{font-size:12px;color:#5c4d2c',
    '.sidebar-footer .user-info{font-size:12px;color:#8a7a55',
    'footer user');
rep('#sidebar.collapsed .nav-item:hover{background:#bda87e}', '#sidebar.collapsed .nav-item:hover{background:#ece3cd}', 'collapsed hover');
rep('style="width:100%;background:#b89f70;color:#241c09;border:1px solid #a08a58;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer"',
    'style="width:100%;background:#fffdf7;color:#4a4030;border:1px solid #ddd2b4;border-radius:6px;padding:6px 8px;font-size:12px;outline:none;cursor:pointer"',
    'select module');
rep("html += '<div style=\"height:1px;background:rgba(255,255,255,.28);margin:6px 24px\"></div>'; continue; }",
    "html += '<div style=\"height:1px;background:rgba(0,0,0,.10);margin:6px 24px\"></div>'; continue; }",
    'separateur');
rep('color:#6b5a36;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:8px 14px 4px;">',
    'color:#a3926b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin:8px 14px 4px;">',
    'label epingles');

/* Carte connexion : ombre plus douce sur fond blanc */
rep('#loginOverlay .login-card{border:1px solid #ead9ab;box-shadow:0 24px 70px rgba(146,110,20,.28)}',
    '#loginOverlay .login-card{border:1px solid #eee3c8;box-shadow:0 18px 50px rgba(120,100,40,.13)}',
    'carte douce');

fs.writeFileSync('public/index.html', t);
console.log('OK - ' + nRep + ' remplacements');
