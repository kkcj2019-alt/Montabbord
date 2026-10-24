'use strict';
/* =====================================================================
   tests/09-synchro.js
   Vague 3 (synchro) :
   - index : comparaison localStr corrigee (branche mdb_entreprise),
     garde cle sale sur mdb_entreprise au chargement, timestamp de sonde
     consomme seulement apres chargement reussi, cache de push rafraichi
     apres ecriture + echo de notre propre updated_at, push a la mise en
     arriere-plan ;
   - paye : fonctions appelees mais absentes (_ptImDateLbl, setCongePaie,
     _purgeOrphanOpsCaisse) maintenant definies et operationnelles ;
   - production : drapeaux nomenclature remis en file apres un echec
     d'ecriture, nomenclature envoyee en union avec le cloud, erreurs de
     pull tracees (plus de catch muet).
   ===================================================================== */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { storeRealiste, chargerApp } = require('./lib/sandbox.js');

function run(rapport) {
  let n = 0;

  function dynIndex(nom, code) {
    n++;
    let h;
    try { h = chargerApp('index.html', storeRealiste()); }
    catch (e) { rapport.ko(nom + ' : chargement impossible (' + e.message + ')'); return; }
    let res;
    try { res = String(vm.runInContext(code, h.ctx, { timeout: 30000 })).trim(); }
    catch (e) { rapport.ko(nom + ' : exception ' + (e && e.message ? e.message : e)); return; }
    if (res.indexOf('OK') === 0) rapport.ok(nom + '  ->  ' + res);
    else rapport.ko(nom + '  ->  ' + res + ' (attendu : OK...)');
  }

  function dynPaye(nom, code) {
    n++;
    let h;
    try { h = chargerApp('paye.html', storeRealiste()); }
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

  const srcIndex = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const srcPaye = fs.readFileSync(path.join(__dirname, '..', 'public', 'paye.html'), 'utf8');
  const srcProd = fs.readFileSync(path.join(__dirname, '..', 'public', 'production.html'), 'utf8');

  /* ---------- 1. index : comparaison de la branche mdb_entreprise ---------- */
  stat('Synchro index (statique) : la fusion mdb_entreprise compare a la valeur LOCALE (et plus a localStr volee)', function () {
    const bon = srcIndex.indexOf('if (JSON.stringify(_me) !== JSON.stringify(local))') !== -1;
    const mauvais = /JSON\.stringify\(_me\) !== localStr/.test(srcIndex);
    if (bon && !mauvais) rapport.ok('Synchro index (statique) : mdb_entreprise comparee a JSON.stringify(local)');
    else rapport.ko('Synchro index (statique) localStr bon=' + bon + ' mauvais=' + mauvais);
  });

  /* ---------- 2. index : garde cle sale au chargement cloud ---------- */
  stat('Synchro index (statique) : mdb_entreprise non ecrasee au chargement quand la cle est sale', function () {
    const garde = srcIndex.indexOf('if (!_dirtyKeys[\'mdb_entreprise\']) {') !== -1;
    if (garde) rapport.ok('Synchro index (statique) : garde _dirtyKeys mdb_entreprise presente');
    else rapport.ko('Synchro index (statique) : garde _dirtyKeys mdb_entreprise ABSENTE');
  });

  /* ---------- 3. index : timestamp de sonde consomme apres chargement ---------- */
  stat('Synchro index (statique) : le timestamp de sonde n\u2019est consomm\u00e9 qu\u2019apr\u00e8s chargement r\u00e9ussi', function () {
    const consulte = srcIndex.indexOf('if (window._mdbLastLoadOk) window._mdbVuTs = ts;') !== -1;
    const marque = srcIndex.indexOf('window._mdbLastLoadOk = true;') !== -1;
    const init = srcIndex.indexOf('window._mdbLastLoadOk = false;') !== -1;
    if (consulte && marque && init) rapport.ok('Synchro index (statique) : _mdbLastLoadOk cable (init/marque/consulte)');
    else rapport.ko('Synchro index (statique) consulte=' + consulte + ' marque=' + marque + ' init=' + init);
  });

  /* ---------- 4. index : cache de push rafraichi + echo updated_at ---------- */
  stat('Synchro index (statique) : cache de push rafra\u00eechi apr\u00e8s \u00e9criture + lecture de notre propre updated_at', function () {
    const cache = srcIndex.indexOf('window._lastCloudData[_pk] = data[_pk];') !== -1;
    const echo = srcIndex.indexOf('window._mdbVuTs = String(rowE.updated_at);') !== -1;
    const inval = srcIndex.indexOf('window._lastCloudAt = 0;') !== -1;
    if (cache && echo && inval) rapport.ok('Synchro index (statique) : cache mis a jour, echo consomme, invalidation sur changement distant');
    else rapport.ko('Synchro index (statique) cache=' + cache + ' echo=' + echo + ' invalidation=' + inval);
  });

  /* ---------- 5. index : push a la mise en arriere-plan ---------- */
  stat('Synchro index (statique) : les cles sales sont pouss\u00e9es quand la page passe en arri\u00e8re-plan', function () {
    const ok = /addEventListener\('visibilitychange'[\s\S]{0,400}document\.hidden[\s\S]{0,200}pushToCloud/.test(srcIndex);
    if (ok) rapport.ok('Synchro index (statique) : visibilitychange hidden -> pushToCloud');
    else rapport.ko('Synchro index (statique) : pas de push sur mise en arriere-plan');
  });

  /* ---------- 6. paye : _ptImDateLbl definie + format ---------- */
  dynPaye('Synchro paye : _ptImDateLbl existe et formate AAAA-MM-JJ en JJ/MM/AA',
    `
      (function () {
        if (typeof _ptImDateLbl !== 'function') return 'ECHEC : fonction absente';
        var a = _ptImDateLbl('2026-03-05');
        var b = _ptImDateLbl('');
        var c = _ptImDateLbl('texte');
        var ok = a === '05/03/26' && b === '' && c === 'texte';
        return ok ? 'OK : 2026-03-05 -> ' + a + ', vide et brut preserves'
                  : 'ECHEC a=' + a + ' b=' + b + ' c=' + c;
      })()
    `);

  /* ---------- 7. paye : setCongePaie enregistre et se relit ---------- */
  dynPaye('Synchro paye : setCongePaie ecrit dans congeRecords et getCongePaie se relit (upsert)',
    `
      (function () {
        if (typeof setCongePaie !== 'function') return 'ECHEC : fonction absente';
        setCongePaie('e1', '2026-10', 5000, '', 'note test');
        var t1 = getCongePaie('e1', '2026-10');
        var r1 = getCongeRecord('e1', '2026-10');
        setCongePaie('e1', '2026-10', 7000, '', 'maj');
        var t2 = getCongePaie('e1', '2026-10');
        var recs = getCongeRecords().filter(function (r) { return r.employee_id === 'e1'; });
        var nbPaiements = 0;
        recs.forEach(function (r) { if (r.paiements) nbPaiements += r.paiements.length; });
        var ok = t1 === 5000 && t2 === 7000 && (r1.commentaire || '').indexOf('note test') !== -1 && nbPaiements === 1;
        return ok ? 'OK : 5000 puis upsert 7000, commentaire lu, un seul paiement'
                  : 'ECHEC t1=' + t1 + ' t2=' + t2 + ' comm=' + (r1 && r1.commentaire) + ' paiements=' + nbPaiements;
      })()
    `);

  /* ---------- 8. paye : _purgeOrphanOpsCaisse retire les miroirs orphelins ---------- */
  dynPaye('Synchro paye : _purgeOrphanOpsCaisse retire les pi\u00e8ces li\u00e9es \u00e0 un acompte mort, garde le reste',
    `
      (function () {
        if (typeof _purgeOrphanOpsCaisse !== 'function') return 'ECHEC : fonction absente';
        DB.setMain('mdb_acomptesPrets', [{ id: 'ac1' }]);
        DB.setMain('mdb_operationsCaisse', [
          { id: 'op1', acomptePretId: 'ac1' },
          { id: 'op2', acomptePretId: 'acDead' },
          { id: 'op3' }
        ]);
        _purgeOrphanOpsCaisse();
        var ops = DB.getMain('mdb_operationsCaisse') || [];
        var ids = ops.map(function (o) { return o.id; }).sort().join(',');
        var ok = ops.length === 3 && ids === 'op1,op2,op3'; /* purge desactivee : ne supprime plus aucune piece de caisse */
        return ok ? 'OK : purge desactivee, les 3 pieces sont conservees (op2 a lien mort comprise)'
                  : 'ECHEC ids=' + ids;
      })()
    `);

  /* ---------- 9. production : drapeaux nomenclature remis en file sur echec ---------- */
  stat('Synchro production (statique) : les drapeaux nomenclature sont remis en file si l\u2019\u00e9criture \u00e9choue', function () {
    const restore = srcProd.indexOf('if (_nomEnAttente) { window._prodNomEnAttente = true; window._prodNomModifie = true; }') !== -1;
    const union = srcProd.indexOf('payload.mdb_nomenclature = _nomMerged;') !== -1;
    if (restore && union) rapport.ok('Synchro production (statique) : restore des drapeaux + envoi en union avec le cloud');
    else rapport.ko('Synchro production (statique) restore=' + restore + ' union=' + union);
  });

  /* ---------- 10. production : erreurs de pull tracees ---------- */
  stat('Synchro production (statique) : le pull ne avale plus les erreurs (log + statut limit\u00e9)', function () {
    const idx = srcProd.indexOf('function prodPullNow');
    const zone = idx === -1 ? '' : srcProd.substring(idx, idx + 2500);
    const log = zone.indexOf('console.warn(\'[Prod] pull error:\'') !== -1;
    const muet = /catch\(function\(err\) \{\}\)/.test(zone);
    if (idx !== -1 && log && !muet) rapport.ok('Synchro production (statique) : catch de prodPullNow trace l\u2019erreur');
    else rapport.ko('Synchro production (statique) log=' + log + ' muet=' + muet);
  });

  return n;
}

module.exports = { run };
