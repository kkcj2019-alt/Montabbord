'use strict';
/* =====================================================================
   tests/08-securite.js
   Vague 2 (securite) : les mots de passe ne circulent plus en clair.
   - SHA-256 avec sel (vecteurs de reference) ;
   - verification unique mdbPassCheck (empreinte d'abord, ancien champ
     en clair encore accepte en lecture => migration douce sans lockout) ;
   - migration one-shot sans boucle de synchro ;
   - plus de bypass « admin123 » permanent (uniquement bootstrap) ;
   - affichage Super Admin masque, derniere connexion sans clair.
   ===================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');

function run(rapport) {
  let n = 0;

  function dyn(nom, store, code) {
    n++;
    let h;
    try { h = chargerApp('index.html', store()); }
    catch (e) { rapport.ko(nom + ' : chargement impossible (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(code, h.ctx, { timeout: 30000 })).trim(); }
    catch (e) { rapport.ko(nom + ' : exception ' + (e && e.message ? e.message : e)); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res);
    else rapport.ko(nom + '  ->  ' + res + ' (attendu : OK...)');
  }

  function stat(nom, f) {
    n++;
    try { f(); }
    catch (e) { rapport.ko(nom + ' : lecture impossible (' + e.message + ')'); return; }
  }

  /* ---------- 1. SHA-256 : vecteurs de reference + sel unique ---------- */
  dyn('Securite : SHA-256 conforme aux vecteurs de reference (sel unique)',
    storeRealiste,
    `
      var h0 = mdbSha256Hex('');
      var h1 = mdbSha256Hex('abc');
      var h2 = mdbSha256Hex('admin123');
      var s1 = mdbNewPassSalt(), s2 = mdbNewPassSalt();
      var ok = h0 === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        && h1 === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        && h2 === '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
        && !!s1 && !!s2 && s1 !== s2;
      ok ? 'OK : h0+h1+h2 identiques a la reference, sels distincts'
         : 'ECHEC h0=' + h0 + ' h1=' + h1 + ' h2=' + h2 + ' selEgaux=' + (s1 === s2)
    `);

  /* ---------- 2. mdbPassCheck : empreinte + ancien clair ---------- */
  dyn('Securite : mdbPassCheck valide l\u2019empreinte, refuse le faux code, accepte l\u2019ancien clair',
    storeRealiste,
    `
      var h = mdbMakePassHash('monsecret123');
      var rec = { passwordHash: h };
      var legacy = { password: 'clair123' };
      var vide = {};
      var ok = h.indexOf('sha256:') === 0
        && mdbPassCheck(rec, 'monsecret123') === true
        && mdbPassCheck(rec, 'mauvais') === false
        && mdbPassCheck(legacy, 'clair123') === true
        && mdbPassCheck(legacy, 'autre') === false
        && mdbPassCheck(vide, 'x') === false
        && mdbPassCheck(rec, '') === false
        && mdbPassCheck(null, 'x') === false;
      ok ? 'OK : empreinte validee, faux code refuse, ancien champ en clair encore accepte en lecture'
         : 'ECHEC h=' + h
    `);

  /* ---------- 3. Upgrade au vol : clair -> empreinte, sans double appel ---------- */
  dyn('Securite : un ancien mot de passe en clair est remplace par son empreinte (une fois)',
    storeRealiste,
    `
      var rec = { id: 'u', password: 'ancien' };
      var b1 = mdbUpgradeRecToHash(rec, 'ancien');
      var b2 = mdbUpgradeRecToHash(rec, 'ancien');
      var ok = b1 === true && b2 === false && rec.password === ''
        && rec.passwordHash.indexOf('sha256:') === 0
        && mdbPassCheck(rec, 'ancien') === true
        && mdbPassCheck(rec, 'mauvais') === false;
      ok ? 'OK : clair remplace par l\u2019empreinte, re-verif apres migration OK, 2e appel sans effet'
         : 'ECHEC b1=' + b1 + ' b2=' + b2 + ' pass=' + rec.password + ' hash=' + rec.passwordHash
    `);

  /* ---------- 4. Seed initDB : admin par defaut deja hache ---------- */
  dyn('Securite : le compte admin cree au premier demarrage porte une empreinte, jamais le clair',
    function () { const s = storeRealiste(); delete s.mdb_users; return s; },
    `
      try { initDB(); } catch (e0) {}
      var u = DB.get('mdb_users');
      var ok = Array.isArray(u) && u.length === 1
        && !!u[0].passwordHash && u[0].passwordHash.indexOf('sha256:') === 0
        && !u[0].password
        && mdbPassCheck(u[0], 'admin123') === true
        && mdbPassCheck(u[0], 'autre') === false;
      ok ? 'OK : seed en passwordHash sha256:... (admin123 verifiable, aucun clair stocke)'
         : 'ECHEC ' + JSON.stringify(u && u[0] ? { p: u[0].password, h: String(u[0].passwordHash).slice(0, 30) } : u)
    `);

  /* ---------- 5. Migration one-shot : pas de boucle ---------- */
  dyn('Securite : migration des comptes en clair -> empreinte, sans boucle de synchro',
    storeRealiste,
    `
      DB.set('mdb_users', [
        { id: 'x1', login: 'a', nom: 'A', password: 'ancien1', isAdmin: true, sections: {} },
        { id: 'x2', login: 'b', nom: 'B', passwordHash: mdbMakePassHash('deja'), password: 'deja', isAdmin: false, sections: {} }
      ]);
      var ch = mdbMigrateUserHashes();
      var l = DB.get('mdb_users');
      var ok = ch === true
        && l[0].password === '' && l[0].passwordHash.indexOf('sha256:') === 0
        && mdbPassCheck(l[0], 'ancien1') === true
        && mdbPassCheck(l[0], 'faux') === false
        && l[1].password === '' && mdbPassCheck(l[1], 'deja') === true
        && mdbMigrateUserHashes() === false;
      ok ? 'OK : 2 comptes haches, connexions conservees, 2e passe = aucun changement (pas de boucle)'
         : 'ECHEC ch=' + ch + ' u0=' + JSON.stringify(l[0]).slice(0, 120)
    `);

  /* ---------- 6. Deverrouillage module Exploitation avec empreinte ---------- */
  dyn('Securite : le deverrouillage Exploitation accepte l\u2019empreinte et refuse le faux code',
    storeRealiste,
    `
      DB.set('mdb_users', [{ id: 'u9', login: 'moi', nom: 'Moi', passwordHash: mdbMakePassHash('lepass'), isAdmin: true, sections: {} }]);
      currentUser = { id: 'x', login: 'moi', subUserId: 'u9', nom: 'Moi', isAdmin: true, sections: {} };
      document.getElementById('prodAuthErr').style.display = 'none';
      document.getElementById('prodAuthOverlay').style.display = '';
      document.getElementById('prodAuthCode').value = getProdAccesCode();
      document.getElementById('prodAuthPass').value = 'faux';
      try { confirmProdAuth(); } catch (e1) {}
      var bloque = document.getElementById('prodAuthErr').style.display === 'block'
        && document.getElementById('prodAuthOverlay').style.display !== 'none';
      document.getElementById('prodAuthErr').style.display = 'none';
      document.getElementById('prodAuthPass').value = 'lepass';
      try { confirmProdAuth(); } catch (e2) {}
      var ouvert = document.getElementById('prodAuthOverlay').style.display === 'none';
      (bloque && ouvert)
        ? 'OK : faux code bloque (erreur affichee), bon code via empreinte -> module ouvert'
        : 'ECHEC bloque=' + bloque + ' ouvert=' + ouvert
    `);

  /* ---------- 7. Code de connexion des transferts (empreinte + clair) ---------- */
  dyn('Securite : code de connexion transfert = mot de passe du compte (empreinte ou ancien clair)',
    storeRealiste,
    `
      DB.set('mdb_users', [
        { id: 'u1', login: 'admin', nom: 'A', passwordHash: mdbMakePassHash('moncode'), isAdmin: true, sections: {} },
        { id: 'u2', login: 'l2', nom: 'B', password: 'legacy', isAdmin: false, sections: {} }
      ]);
      currentUser = { id: 'x1', subUserId: 'u1', login: 'admin', isAdmin: true, sections: {} };
      var a = codeConnexionOK('moncode') === true;
      var b = codeConnexionOK('faux') === false;
      currentUser = { id: 'x2', subUserId: 'u2', login: 'l2', sections: {} };
      var c = codeConnexionOK('legacy') === true;
      currentUser = { id: 'solo', sections: {} };
      var d = codeConnexionOK(String(getEntreprise().validationCode)) === true;
      var e = codeConnexionOK('9999') === false;
      (a && b && c && d && e)
        ? 'OK : empreinte validee, faux code refuse, ancien clair accepte en lecture, code entreprise sans compte'
        : 'ECHEC a=' + a + ' b=' + b + ' c=' + c + ' d=' + d + ' e=' + e
    `);

  /* ---------- 8. Connexion Super Admin : pas de bypass permanent ---------- */
  dyn('Securite : connexion Super Admin hors-ligne — code faux refuse, code par defaut octroye une fois',
    storeRealiste,
    `
      try { localStorage.removeItem('mdb_saPassHash'); } catch (e0) {}
      currentUser = null;
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('saQuickPass').value = 'mauvais';
      try { doSaQuickLogin(); } catch (e1) {}
      var rejete = document.getElementById('loginError').style.display === 'block'
        && !(currentUser && currentUser.isSuperAdmin);
      document.getElementById('saQuickPass').value = 'admin123';
      try { doSaQuickLogin(); } catch (e2) {}
      var accorde = !!(currentUser && currentUser.isSuperAdmin === true)
        && document.getElementById('loginError').style.display === 'none';
      (rejete && accorde)
        ? 'OK : faux code refuse sans session, code par defaut accepte hors-ligne (bootstrap)'
        : 'ECHEC rejete=' + rejete + ' accorde=' + accorde
    `);

  /* ---------- 9-13. Controles statiques du source ---------- */
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  stat('Securite (statique) : plus aucun ancien controle de mot de passe en clair', function () {
    const ancien1 = (src.match(/pass !== config\.password/g) || []).length;
    const ancien2 = (src.match(/doc\.data\(\)\.password === pass/g) || []).length;
    const ancien3 = (src.match(/users\[i\]\.password === pass/g) || []).length;
    const nouveau1 = src.indexOf('mdbPassCheck(cfg, pass)') !== -1;
    const nouveau2 = src.indexOf('mdbPassCheck(config, pass)') !== -1;
    if (ancien1 === 0 && ancien2 === 0 && ancien3 === 0 && nouveau1 && nouveau2) {
      rapport.ok('Securite (statique) : comparaisons en clair supprimees, mdbPassCheck en place (SA quick + SA login)');
    } else {
      rapport.ko('Securite (statique) anciens=' + [ancien1, ancien2, ancien3].join(',') + ' nouveaux=' + nouveau1 + '/' + nouveau2);
    }
  });

  stat('Securite (statique) : « admin123 » uniquement en bootstrap (4 occurrences toutes conditionnees)', function () {
    const total = (src.match(/pass === 'admin123'/g) || []).length;
    const porte = src.indexOf('!_anyCache && pass === \'admin123\'') !== -1;
    const seedClair = (src.match(/password: 'admin123'/g) || []).length;
    if (total === 4 && porte && seedClair === 0) {
      rapport.ok('Securite (statique) : 4 acceptations bootstrap conditionn\u00e9es (hors-ligne sans cache ou config absente), 0 seed en clair');
    } else {
      rapport.ko('Securite (statique) admin123 total=' + total + ' porteHorsLigne=' + porte + ' seedClair=' + seedClair);
    }
  });

  stat('Securite (statique) : ecritures de mots de passe exclusivement hachees', function () {
    const hashLits = (src.match(/passwordHash\s*:\s*mdbMakePassHash\(/g) || []).length;
    const mdpPass = (src.match(/password: pass/g) || []).length;
    const lastLoginClair = (src.match(/pass:pass/g) || []).length;
    if (hashLits >= 5 && mdpPass === 0 && lastLoginClair === 0) {
      rapport.ok('Securite (statique) : ' + hashLits + ' creations/versions en passwordHash, 0 ecriture « password: pass », lastLogin sans clair');
    } else {
      rapport.ko('Securite (statique) hashLits=' + hashLits + ' passwordPass=' + mdpPass + ' lastLogin=' + lastLoginClair);
    }
  });

  stat('Securite (statique) : le tableau utilisateurs Super Admin n\u2019affiche plus les mots de passe', function () {
    const masque = (src.match(/\\u2022/g) || []).length;
    const clairVue = src.indexOf('escH(u.password)') !== -1;
    if (masque >= 8 && !clairVue) {
      rapport.ok('Securite (statique) : colonne mot de passe masquee (puces), aucun affichage de mot de passe en clair');
    } else {
      rapport.ko('Securite (statique) puces=' + masque + ' clairVue=' + clairVue);
    }
  });

  stat('Securite (statique) : la migration des mots de passe est cablee sur tous les entr\u00e9es cloud', function () {
    const appels = (src.match(/mdbMigrateUserHashes\(\)/g) || []).length;
    const hooks = src.indexOf('try { mdbMigrateUserHashes(); } catch (eMH1) {}') !== -1
      && src.indexOf('try { mdbMigrateUserHashes(); } catch (eMH2) {}') !== -1
      && src.indexOf('try { mdbMigrateUserHashes(); } catch (eMH3) {}') !== -1;
    if (appels >= 4 && hooks) {
      rapport.ok('Securite (statique) : migration cablee au demarrage + reception login + loadCloudData + applySnapshot');
    } else {
      rapport.ko('Securite (statique) appels=' + appels + ' hooks=' + hooks);
    }
  });

  return n;
}

module.exports = { run };
