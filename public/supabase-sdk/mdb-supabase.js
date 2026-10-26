/* ============================================================================
   MDB-SUPABASE.JS — Adaptateur Firestore -> Supabase pour MONTABBORD
   Expose une API compatible avec le sous-ensemble Firestore utilisé par l'app,
   adossé à PostgreSQL/Supabase. La logique métier reste inchangée.
   DECOUPAGE (anti timeouts 57014) : le document enterprises n'est plus UN
   gros jsonb — chaque rubrique est une petite ligne de enterprise_data
   (mdb_paye / mdb_production decoupes par section). Interface inchangee.
   ============================================================================ */
(function() {
  'use strict';

  var SUPABASE_URL = 'https://pywacfwhwsvidkhqsjqv.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5d2FjZndod3N2aWRraHFzanF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDMyMTksImV4cCI6MjEwMjg3OTIxOX0.wmt5vKo189wxQ9loIYprj8PE-Xd3y0Xs_-n61UJjbls';

  var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.SB_CLIENT = sb;

  /* ---------- Utilitaires ---------- */

  var FV_DELETE = { __mdbFieldValueDelete: true };

  function deepClean(obj) {
    /* Retire les sentinelles FieldValue.delete() avant envoi */
    if (Array.isArray(obj)) {
      var arr = [];
      for (var i = 0; i < obj.length; i++) {
        if (obj[i] === FV_DELETE || (obj[i] && obj[i].__mdbFieldValueDelete)) continue;
        arr.push(deepClean(obj[i]));
      }
      return arr;
    }
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      var out = {};
      for (var k in obj) {
        if (!obj.hasOwnProperty(k)) continue;
        var v = obj[k];
        if (v === FV_DELETE || (v && v.__mdbFieldValueDelete)) continue;
        out[k] = deepClean(v);
      }
      return out;
    }
    return obj;
  }

  function genUid(prefix) {
    try {
      if (window.crypto && crypto.randomUUID) return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    } catch (e) {}
    return 'ent_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function isoNow() { return new Date().toISOString(); }

  /* ========================================================================
     DECOUPAGE ANTI-TIMEOUT (1 ligne par rubrique dans enterprise_data)
     Le dossier entier (2,5 Mo) dans enterprises.data faisait timeouter
     Postgres (57014/500) a 4 postes. Desormais chaque rubrique est une
     petite ligne : ecritures/lectures en millisecondes, temps reel leger.
     - mdb_paye / mdb_production (les geants) sont decoupes par SECTION
       ('mdb_paye.pointage'...), transparent pour l'app (re-assembles).
     - Compatibilite totale : si la table n'existe pas encore (migration SQL
       passee APRES le deploiement), repli automatique sur l'ancien chemin.
     - Migration sans perte : a la premiere lecture, l'ancien document est
       recopie ligne par ligne (uniquement les cles manquantes), l'ancienne
       colonne reste intacte en secours. Rien n'est jamais efface.
     ======================================================================== */
  var SPLIT_TABLE = 'enterprise_data';
  var SPLIT_MIGRATION_CLE = '__split_migration_ok';
  var SPLIT_SECTION_KEYS = { mdb_paye: true, mdb_production: true };
  var _splitOK = null; /* null = inconnu, true = table prete, false = repli legacy */

  function splitEstTableManquante(err) {
    try {
      if (!err) return false;
      var code = String(err.code || '');
      var msg = String(err.message || '');
      var det = String(err.details || '') + ' ' + String(err.hint || '');
      if (code === '42P01' || code === 'PGRST205') return true;
      if (/could not find the table/i.test(msg + ' ' + det) && /enterprise_data/i.test(msg + ' ' + det)) return true;
      if (/enterprise_data/i.test(msg + ' ' + det) &&
          (/does not exist|not exist|not found|42P01/i.test(msg + ' ' + det))) return true;
      if ((err.status === 404 || err.statusCode === 404) && /enterprise_data/i.test(msg)) return true;
    } catch (e) {}
    return false;
  }

  function splitEstObjetSimple(v) {
    return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
  }

  /* Document {cle: valeur} -> lignes. Les cles null/undefined sont ignorees
     (pousse-a-vide : on ne propage jamais du vide). */
  function splitDocEnLignes(uid, data) {
    var lignes = [];
    for (var k in data) {
      if (!data.hasOwnProperty(k)) continue;
      var v = data[k];
      if (v === undefined || v === null) continue;
      if (SPLIT_SECTION_KEYS[k] && splitEstObjetSimple(v)) {
        for (var s in v) {
          if (!v.hasOwnProperty(s)) continue;
          if (v[s] === undefined || v[s] === null) continue;
          lignes.push({ enterprise_id: uid, cle: k + '.' + s, data: v[s], updated_at: isoNow() });
        }
      } else {
        lignes.push({ enterprise_id: uid, cle: k, data: v, updated_at: isoNow() });
      }
    }
    return lignes;
  }

  /* Lignes -> document identique a l'ancien. Les sections priment sur une
     eventuelle ligne entiere (elles sont toujours les plus recentes). */
  function splitAssemble(lignes) {
    var doc = {};
    var i, r, pos, base;
    for (i = 0; i < (lignes || []).length; i++) {
      r = lignes[i];
      if (!r || typeof r.cle !== 'string' || r.cle === SPLIT_MIGRATION_CLE) continue;
      pos = r.cle.indexOf('.');
      if (pos > 0 && SPLIT_SECTION_KEYS[r.cle.slice(0, pos)]) continue; /* passe 2 */
      doc[r.cle] = (r.data === undefined ? null : r.data);
    }
    for (i = 0; i < (lignes || []).length; i++) {
      r = lignes[i];
      if (!r || typeof r.cle !== 'string') continue;
      pos = r.cle.indexOf('.');
      if (!(pos > 0)) continue;
      base = r.cle.slice(0, pos);
      if (!SPLIT_SECTION_KEYS[base]) continue;
      if (!splitEstObjetSimple(doc[base])) doc[base] = {};
      doc[base][r.cle.slice(pos + 1)] = (r.data === undefined ? null : r.data);
    }
    return doc;
  }

  function splitIdentite(data) {
    var id = {};
    if (data) {
      if (typeof data.identifiant === 'string' && data.identifiant) id.identifiant = data.identifiant;
      if (typeof data.email === 'string' && data.email) id.email = data.email;
      if (typeof data.nom === 'string' && data.nom) id.nom = data.nom;
    }
    return id;
  }

  function splitParPaquets(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  /* Ecriture decoupee : le PUSH est lui-meme decoupe en lots.
     Decouper les LIGNES ne suffisait pas : toutes etaient envoyees en un
     seul POST (~2,3 Mo), que PostgREST ne finissait pas de traiter -> 504
     Gateway Timeout et « synchro en attente » a chaque poste. On regroupe
     donc les lignes par taille de JSON pour qu'aucune requete nApproche
     la limite. Le bump updated_at vient apres, puis la sentinelle. */
  var SPLIT_LOT_CIBLES = 320 * 1024; /* ~320 Ko par requete */

  function splitLignesParLots(lignes) {
    var lots = [], courant = [], poids = 0;
    for (var i = 0; i < (lignes || []).length; i++) {
      var l = lignes[i];
      var p;
      try { p = JSON.stringify(l).length + 1; } catch (e) { p = 2048; }
      /* Une ligne plus grosse que la cible part seule (rien a faire). */
      if (courant.length && poids + p > SPLIT_LOT_CIBLES) { lots.push(courant); courant = []; poids = 0; }
      courant.push(l); poids += p;
    }
    if (courant.length) lots.push(courant);
    return lots;
  }

  /* Lot par lot séquentiel avec retry : évite les conflits de verrous Postgres (timeouts 57014) sur Supabase Nano */
  function upsertLots(lots) {
    var idx = 0;
    function doOneLot() {
      if (idx >= lots.length) return Promise.resolve();
      var lot = lots[idx++];
      function send(retries) {
        return sb.from(SPLIT_TABLE).upsert(lot, { onConflict: 'enterprise_id,cle' })
          .then(function (r) {
            if (r.error) {
              var is57014 = r.error.code === '57014' || /57014|timeout/i.test(r.error.message || '');
              if (is57014 && retries > 0) {
                return new Promise(function(resolve) { setTimeout(resolve, 800); }).then(function() { return send(retries - 1); });
              }
              throw r.error;
            }
          });
      }
      return send(2).then(doOneLot);
    }
    return doOneLot();
  }

  /* ========================================================================
     SYNCHRO BLINDEE (ecriture a controle de version + fusion a 3 points)
     Probleme corrige : chaque rubrique est UNE ligne ecrasee en entier ; deux
     postes qui enregistrent presque en meme temps s'ecrasaient (le dernier
     arrive gagnait, la saisie de l'autre disparaissait du serveur).
     Maintenant, pour chaque rubrique :
       1. on n'ecrit QUE ce qui a change depuis notre derniere ecriture ;
       2. l'ecriture est conditionnelle : elle n'a lieu que si la ligne n'a pas
          ete modifiee entre-temps par un autre poste (compare-and-set sur
          updated_at) ;
       3. si quelqu'un a ecrit entre-temps, on relit la ligne fraiche et on
          FUSIONNE ligne a ligne avec 3 points (ce que j'avais, ce que je
          veux, ce que le serveur a maintenant) : mes ajouts/modifs sont
          gardes, ceux des autres aussi ;
       4. un garde-fou refuse qu'une ecriture retire d'un coup une grosse
          part d'une liste sans suppression volontaire (tombstones).
     ======================================================================== */
  var _rowBase = {};   /* uid|cle -> { ts, json } : ce que CE poste a ecrit en dernier */
  var _rowsCache = {}; /* uid -> { cle: json } : copie des lignes serveur (lecture ciblee) */

  var _rowsTs = {};    /* uid -> { cle: updated_at } : version serveur de chaque ligne en cache */

  var DELTA_FULL_MS = 30 * 60 * 1000; /* relecture integrale de controle : 1 fois / 30 min */
  var _watchers = {};  /* uid -> [fonction] : rafraichir les pages apres une fusion */
  var SYNC = window.MDB_SYNC = { lastWriteOk: 0, lastWriteErr: 0, lastFetchOk: 0, errStreak: 0,
    lastError: '', conflits: 0, fusions: 0, garde: 0, enCours: 0 };

  function bkey(uid, cle) { return uid + '|' + cle; }
  function sjson(x) { try { return JSON.stringify(x); } catch (e) { return ''; } }
  function isPlain(o) { return !!o && typeof o === 'object' && !Array.isArray(o) && !(o instanceof Date); }
  function idOf(x) { return (x && typeof x === 'object' && x.id !== undefined && x.id !== null && String(x.id) !== '') ? String(x.id) : null; }
  function allIdArr(a) { if (!Array.isArray(a)) return false; for (var i = 0; i < a.length; i++) if (idOf(a[i]) === null) return false; return true; }
  function countOf(x) { return Array.isArray(x) ? x.length : (isPlain(x) ? Object.keys(x).length : 1); }
  /* Egalite EXACTE d'horodatage (Postgres = microsecondes) : 'Z' == '+00:00', zeros de fin ignores */
  function normTs(t) { return String(t || '').replace('Z', '+00:00').replace(/\.(\d*?)0+(?=[+-])/, '.$1').replace(/\.(?=[+-])/, ''); }
  function sameTs(a, b) { if (!a || !b) return false; return normTs(a) === normTs(b); }
  function cacheSet(uid, cle, data, ts) {

    (_rowsCache[uid] = _rowsCache[uid] || {})[cle] = sjson(data);

    if (ts) (_rowsTs[uid] = _rowsTs[uid] || {})[cle] = ts;

  }

  /* ---- Journal local des 200 dernieres ecritures (pour retrouver qui a efface quoi) ---- */
  var _jr = null, _jT = null;
  function journal(e) {
    try {
      e.t = isoNow();
      if (!_jr) { try { _jr = JSON.parse(localStorage.getItem('mdb_sync_journal') || '[]'); } catch (x) { _jr = []; } if (!Array.isArray(_jr)) _jr = []; }
      _jr.push(e);
      if (_jr.length > 200) _jr.splice(0, _jr.length - 200);
      if (!_jT) _jT = setTimeout(function () { _jT = null; try { localStorage.setItem('mdb_sync_journal', JSON.stringify(_jr)); } catch (x2) {} }, 1500);
    } catch (e2) {}
  }
  window.mdbSyncJournalAjout = function (e) { journal(e || {}); };
  window.mdbSyncJournal = function () { try { if (!_jr) _jr = JSON.parse(localStorage.getItem('mdb_sync_journal') || '[]'); } catch (e) { _jr = []; } return (_jr || []).slice(); };

  /* ---- Suppressions volontaires connues (tombstones) pour une rubrique ---- */
  function tombSet(uid, cle, lignes) {
    var out = {};
    try {
      var t = JSON.parse(localStorage.getItem('mdb_tombstones') || '{}');
      var m = t && t[cle];
      if (isPlain(m)) for (var k in m) if (k !== '__resetAt') out[k] = true;
    } catch (e) {}
    try {
      var mm = /^mdb_paye\.(pointage|pointageMontage)$/.exec(cle);
      if (mm) {
        var tk = cle + '_tombstones', arrs = [];
        (lignes || []).forEach(function (l) { if (l && l.cle === tk && Array.isArray(l.data)) arrs.push(l.data); });
        var cached = _rowsCache[uid] && _rowsCache[uid][tk];
        if (cached) { try { var ca = JSON.parse(cached); if (Array.isArray(ca)) arrs.push(ca); } catch (e3) {} }
        arrs.forEach(function (a) { a.forEach(function (x) { out[String(x)] = true; }); });
      }
    } catch (e2) {}
    /* Acomptes/prets : une suppression memorisee ne vaut pas tant que la piece
       de caisse correspondante existe (meme regle que les pages). Sans ca, une
       ecriture de l'app principale retirait du serveur les acomptes que la Paie
       venait de recreer depuis la caisse : le total montait puis retombait. */
    if (cle === 'mdb_acomptesPrets') {
      try {
        var ops = JSON.parse(localStorage.getItem('mdb_operationsCaisse') || '[]'), vivOps = {};
        var natAP = function (o) {
          var t = String(o.apType || '');
          if (t === 'acompte' || t === 'pret' || t === 'solde') return true;
          var c = String(o.code || '').toUpperCase();
          return /^(ACOMPTE|PRET|SOLDE)(_|-|$)/.test(c) || /_(ACOMPTE|PRET)(_|$)/.test(c);
        };
        if (Array.isArray(ops)) ops.forEach(function (o) {
          if (!o || o.reversed || !natAP(o)) return;
          if (o.id) vivOps[o.id] = true;
          if (o.acomptePretId && out[o.acomptePretId]) delete out[o.acomptePretId];
        });
        Object.defineProperty(out, '__liveOps', { value: vivOps, enumerable: false });
      } catch (e4) {}
    }
    return out;
  }
  function recentReset() {
    try {
      var t = JSON.parse(localStorage.getItem('mdb_tombstones') || '{}');
      var r = t && t.__resetAt;
      if (typeof r === 'number' && Date.now() - r < 10 * 60 * 1000) return true;
      var a = parseInt(localStorage.getItem('mdb_sync_allow_mass') || '0', 10);
      if (a && Date.now() - a < 10 * 60 * 1000) return true;
    } catch (e) {}
    return false;
  }

  /* ---- Garde-fou : une ecriture ne retire pas d'un coup >= 40 % d'une liste (>= 8 lignes) sans tombstones ---- */
  function guardMass(cle, inc, baseJson, tomb) {
    try {
      if (!baseJson || !Array.isArray(inc)) return inc;
      var base = JSON.parse(baseJson);
      if (!Array.isArray(base) || base.length < 8 || !allIdArr(base) || !allIdArr(inc)) return inc;
      if (recentReset()) return inc;
      var have = {}; inc.forEach(function (x) { have[idOf(x)] = 1; });
      var miss = base.filter(function (x) { var i = idOf(x); return !have[i] && !tomb[i]; });
      if (miss.length >= 8 && miss.length >= 0.4 * base.length) {
        SYNC.garde++;
        journal({ op: 'GARDE-FOU', cle: cle, retire: miss.length, sur: base.length });
        try { console.warn('[mdb] GARDE-FOU : ' + miss.length + '/' + base.length + ' lignes de ' + cle + ' disparaissaient sans suppression volontaire : conservees.'); } catch (e) {}
        return inc.concat(miss);
      }
    } catch (e2) {}
    return inc;
  }

  /* ---- Fusion a 3 points ---- */
  function unionTomb(a, b, reset) {
    if (Array.isArray(a) || Array.isArray(b)) {
      var seen = {}, out = [];
      [].concat(Array.isArray(b) ? b : [], Array.isArray(a) ? a : []).forEach(function (x) { var k = sjson(x); if (!seen[k]) { seen[k] = 1; out.push(x); } });
      return out;
    }
    if (isPlain(a) && isPlain(b)) {
      var o = {}, k;
      for (k in b) { if (k === '__resetAt') continue; var v = b[k]; if (typeof v === 'number' && reset && v <= reset) continue; o[k] = v; }
      for (k in a) { if (k === '__resetAt') continue; o[k] = (k in o && isPlain(a[k]) && isPlain(o[k])) ? unionTomb(a[k], o[k], reset) : a[k]; }
      return o;
    }
    return a;
  }
  function mergeTomb(inc, fresh) {
    if (Array.isArray(inc) || Array.isArray(fresh)) return unionTomb(inc, fresh, 0);
    if (!isPlain(inc) || !isPlain(fresh)) return inc;
    var ri = typeof inc.__resetAt === 'number' ? inc.__resetAt : 0, rf = typeof fresh.__resetAt === 'number' ? fresh.__resetAt : 0;
    if (ri > rf) return inc;
    var o = unionTomb(inc, fresh, ri);
    var mx = Math.max(ri, rf);
    if (mx > 0) o.__resetAt = mx;
    return o;
  }
  /* Listes de l'appli principale dont chaque VRAIE suppression laisse une
     pierre tombale (DB.set) : une ligne absente de MA copie mais sans pierre
     tombale n'est PAS une suppression — c'est une copie perimee (autre onglet,
     autre fenetre). Avant, la ligne etait retiree du serveur : un fournisseur
     cree disparaissait tout seul. */
  var LISTES_A_SUPPRESSION_EXPLICITE = { mdb_fournisseurs: 1, mdb_clients: 1 };
  function merge3Array(inc, base, fresh, tomb, cle) {
    var bM = {}, fM = {}, iM = {}, out = [], i, x, id, b, f;
    base.forEach(function (r) { bM[idOf(r)] = r; });
    fresh.forEach(function (r) { fM[idOf(r)] = r; });
    inc.forEach(function (r) { iM[idOf(r)] = 1; });
    for (i = 0; i < inc.length; i++) {
      x = inc[i]; id = idOf(x); b = bM[id]; f = fM[id];
      if (f !== undefined && b !== undefined) {
        if (sjson(x) !== sjson(b)) out.push(x);               /* j'ai modifie : ma version */
        else out.push(f);                                       /* je n'y ai pas touche : version du serveur */
      } else if (f !== undefined) out.push(x);                  /* ajoute des deux cotes : la mienne */
      else if (b !== undefined) { if (sjson(x) !== sjson(b)) out.push(x); /* un autre l'a supprimee ; je l'ai modifiee : je la garde */ }
      else out.push(x);                                         /* mon ajout */
    }
    for (i = 0; i < fresh.length; i++) {
      x = fresh[i]; id = idOf(x);
      if (iM[id]) continue;
      b = bM[id];
      if (b === undefined) { if (!tomb[id] || (x && x.caisseOpId && tomb.__liveOps && tomb.__liveOps[x.caisseOpId])) out.push(x); }      /* ajoute par un autre poste */
      else if (sjson(x) !== sjson(b)) out.push(x);              /* je l'ai supprimee mais un autre l'a modifiee : on garde */
      else if (LISTES_A_SUPPRESSION_EXPLICITE[cle] && !tomb[id]) out.push(x); /* absente sans suppression volontaire : on garde */
      /* sinon : je l'ai supprimee, personne d'autre n'y a touche -> supprimee */
    }
    return out;
  }
  function merge3(inc, base, fresh, tomb, name, depth) {
    if (/tombstone/i.test(name || '')) return mergeTomb(inc, fresh);
    if (Array.isArray(inc) && Array.isArray(fresh)) {
      var b = Array.isArray(base) ? base : [];
      if (allIdArr(inc) && allIdArr(fresh) && allIdArr(b) && (inc.length || fresh.length || b.length)) return merge3Array(inc, b, fresh, tomb, name);
      return inc;
    }
    if (isPlain(inc) && isPlain(fresh) && (depth || 0) < 4) {
      var bo = isPlain(base) ? base : null, out = {}, k;
      for (k in inc) {
        var iv = inc[k], fv = fresh[k], bv = bo ? bo[k] : undefined;
        if (fv === undefined) out[k] = iv;
        else if (bo && bv !== undefined && sjson(iv) === sjson(bv)) out[k] = fv;
        else out[k] = merge3(iv, bv, fv, tomb, k, (depth || 0) + 1);
      }
      for (k in fresh) {
        if (k in inc) continue;
        var bv2 = bo ? bo[k] : undefined;
        if (bo && bv2 !== undefined && sjson(fresh[k]) === sjson(bv2)) continue; /* je l'avais retiree, personne d'autre n'y a touche */
        out[k] = fresh[k];
      }
      return out;
    }
    return inc;
  }

  /* ---- Requetes avec reessai sur incident passager ---- */
  function passager(err) {
    var m = String((err && err.message) || ''), c = String((err && err.code) || '');
    return c === '57014' || /57014|timeout|timed out|fetch|network|502|503|504|500/i.test(m);
  }
  function avecReessai(fn, n) {
    return fn().catch(function (e) {
      if (n > 0 && passager(e)) return new Promise(function (r) { setTimeout(r, 700 + Math.floor(Math.random() * 500)); }).then(function () { return avecReessai(fn, n - 1); });
      throw e;
    });
  }
  function lireLigne(uid, cle) {
    return avecReessai(function () {
      return sb.from(SPLIT_TABLE).select('cle,data,updated_at').eq('enterprise_id', uid).eq('cle', cle).limit(1)
        .then(function (r) { if (r.error) throw r.error; return (r.data && r.data[0]) || null; });
    }, 2);
  }
  function majConditionnelle(uid, cle, data, attendu) {
    var ts = isoNow();
    return avecReessai(function () {
      return sb.from(SPLIT_TABLE).update({ data: data, updated_at: ts }).eq('enterprise_id', uid).eq('cle', cle).eq('updated_at', attendu).select('cle,updated_at')
        .then(function (r) { if (r.error) throw r.error; return (r.data && r.data.length) ? { ok: true, ts: r.data[0].updated_at || ts } : { ok: false }; });
    }, 2);
  }
  function inserer(uid, cle, data) {
    var ts = isoNow();
    return avecReessai(function () {
      return sb.from(SPLIT_TABLE).insert([{ enterprise_id: uid, cle: cle, data: data, updated_at: ts }]).select('cle,updated_at')
        .then(function (r) {
          if (r.error) {
            if (String(r.error.code) === '23505' || /duplicate|already exists/i.test(r.error.message || '')) return { ok: false };
            throw r.error;
          }
          return { ok: true, ts: (r.data && r.data[0] && r.data[0].updated_at) || ts };
        });
    }, 2);
  }
  function notifierFusion(uid) {
    var l = _watchers[uid] || [];
    for (var i = 0; i < l.length; i++) { try { l[i](); } catch (e) {} }
  }

  /* Ecrit UNE ligne sans jamais ecraser le travail d'un autre poste. */
  function ecrireLigneSure(uid, ligne, lignes, pre) {
    var cle = ligne.cle, bk = bkey(uid, cle), tomb = tombSet(uid, cle, lignes);
    var baseAvant = _rowBase[bk];
    var inc = baseAvant ? guardMass(cle, ligne.data, baseAvant.json, tomb) : ligne.data;
    /* Listes a suppression explicite : une ligne que j'avais deja envoyee et
       qui manque maintenant SANS pierre tombale vient d'une copie perimee
       (autre onglet) -> on la renvoie au lieu de l'effacer du serveur. */
    if (baseAvant && LISTES_A_SUPPRESSION_EXPLICITE[cle] && Array.isArray(inc)) {
      try {
        var bA = JSON.parse(baseAvant.json);
        if (Array.isArray(bA) && allIdArr(bA) && allIdArr(inc)) {
          var vu = {}; inc.forEach(function (x) { vu[idOf(x)] = 1; });
          var manq = bA.filter(function (x) { var i = idOf(x); return !vu[i] && !tomb[i]; });
          if (manq.length) { inc = inc.concat(manq); journal({ op: 'GARDE-LISTE', cle: cle, remis: manq.length }); }
        }
      } catch (eGL) {}
    }
    function reussi(r, envoye, fusionne) {
      /* json = ce que CE poste voulait (base de la prochaine fusion) ;
         srv = ce que le serveur contient reellement apres l'ecriture. */
      var srvJ = sjson(fusionne), envJ = sjson(envoye);
      _rowBase[bk] = { ts: r.ts, json: envJ, srv: srvJ === envJ ? null : srvJ };
      cacheSet(uid, cle, fusionne, r.ts);
      journal({ op: srvJ === envJ ? 'ecrit' : 'FUSION', cle: cle, avant: baseAvant ? countOf(JSON.parse(baseAvant.json)) : null, apres: countOf(fusionne) });
      if (srvJ !== envJ) { SYNC.fusions++; notifierFusion(uid); }
    }
    function conflit(n) {
      if (n > 5) return Promise.reject(new Error('Conflit de synchro persistant sur ' + cle + ' (reessai automatique)'));
      if (n > 0 || baseAvant) SYNC.conflits++;
      var lecture = (n === 0 && pre && pre.hasOwnProperty(cle)) ? Promise.resolve(pre[cle]) : lireLigne(uid, cle);
      return lecture.then(function (fr) {
        if (!fr) {
          return inserer(uid, cle, inc).then(function (r) { if (r.ok) return reussi(r, inc, inc); return conflit(n + 1); });
        }
        var base = baseAvant ? JSON.parse(baseAvant.json) : null;
        var merged = merge3(inc, base, fr.data, tomb, cle, 0);
        /* Rien a changer sur le serveur (cas courant a l'ouverture) : on note la base, sans ecrire */
        if (sjson(merged) === sjson(fr.data)) { reussi({ ts: fr.updated_at }, inc, merged); return; }
        return majConditionnelle(uid, cle, merged, fr.updated_at).then(function (r) {
          if (r.ok) return reussi(r, inc, merged);
          return new Promise(function (res) { setTimeout(res, 150 + Math.floor(Math.random() * 250)); }).then(function () { return conflit(n + 1); });
        });
      });
    }
    if (baseAvant) {
      /* Si notre derniere ecriture etait une fusion, le serveur contient aussi les
         lignes des autres postes : on refusionne localement pour ne pas les retirer. */
      var aEnvoyer = inc;
      if (baseAvant.srv) {
        try { aEnvoyer = merge3(inc, JSON.parse(baseAvant.json), JSON.parse(baseAvant.srv), tomb, cle, 0); } catch (eM) { return conflit(0); }
      }
      return majConditionnelle(uid, cle, aEnvoyer, baseAvant.ts).then(function (r) {
        if (r.ok) return reussi(r, inc, aEnvoyer);
        return conflit(0);
      });
    }
    return conflit(0);
  }

  var _sentinelleOk = {};
  function writeEnterpriseSplit(uid, data) {
    var lignes = splitDocEnLignes(uid, data);
    var ident = splitIdentite(data);
    var upsertIdent = { id: uid, updated_at: isoNow() };
    for (var k in ident) { if (ident.hasOwnProperty(k)) upsertIdent[k] = ident[k]; }
    /* Ne reecrire que ce qui a change depuis NOTRE derniere ecriture */
    var aEcrire = lignes.filter(function (l) {
      var b = _rowBase[bkey(uid, l.cle)];
      return !(b && b.json === sjson(l.data));
    });
    try { console.log('[mdb] push cible : ' + aEcrire.length + ' rubrique(s) modifiee(s) sur ' + lignes.length); } catch (eL) {}
    SYNC.enCours++;
    var idx = 0, pre = {}, ecrites = 0;
    /* Rubriques jamais ecrites par ce poste : une seule lecture groupee */
    var sansBase = aEcrire.filter(function (l) { return !_rowBase[bkey(uid, l.cle)]; }).map(function (l) { return l.cle; });
    function prelire() {
      if (!sansBase.length) return Promise.resolve();
      return avecReessai(function () {
        return sb.from(SPLIT_TABLE).select('cle,data,updated_at').eq('enterprise_id', uid).in('cle', sansBase)
          .then(function (r) {
            if (r.error) throw r.error;
            sansBase.forEach(function (c) { pre[c] = null; });
            (r.data || []).forEach(function (row) { pre[row.cle] = row; });
          });
      }, 2).catch(function () { pre = {}; });
    }
    function suivante() {
      if (idx >= aEcrire.length) return Promise.resolve();
      var l = aEcrire[idx++];
      var avant = _rowBase[bkey(uid, l.cle)];
      return ecrireLigneSure(uid, l, lignes, pre).catch(function (e) {
        /* Filet de securite : refus inattendu de l'ecriture conditionnelle (droits,
           colonne, version du serveur) -> ancien envoi simple plutot que blocage. */
        if (passager(e) || /Conflit de synchro/.test(String((e && e.message) || ''))) throw e;
        journal({ op: 'SECOURS', cle: l.cle, message: String((e && e.message) || e) });
        try { console.warn('[mdb] ecriture protegee refusee, envoi simple pour ' + l.cle + ' :', (e && e.message) || e); } catch (eW) {}
        delete _rowBase[bkey(uid, l.cle)];
        return avecReessai(function () {
          return sb.from(SPLIT_TABLE).upsert([{ enterprise_id: uid, cle: l.cle, data: l.data, updated_at: isoNow() }], { onConflict: 'enterprise_id,cle' })
            .then(function (r) { if (r.error) throw r.error; });
        }, 2);
      }).then(function () {
        var apres = _rowBase[bkey(uid, l.cle)];
        if (!avant || !apres || apres.ts !== avant.ts) ecrites++;
      }).then(suivante);
    }
    return prelire().then(suivante).then(function () {
      if (!ecrites) return;
      return sb.from('enterprises').upsert(upsertIdent, { onConflict: 'id' })
        .then(function (r2) { if (r2.error) throw r2.error; });
    }).then(function () {
      if (!ecrites || _sentinelleOk[uid]) return;
      return sb.from(SPLIT_TABLE).upsert(
        [{ enterprise_id: uid, cle: SPLIT_MIGRATION_CLE, data: { v: 1 }, updated_at: isoNow() }],
        { onConflict: 'enterprise_id,cle' })
        .then(function (r3) { if (r3.error) throw r3.error; _sentinelleOk[uid] = true; });
    }).then(function () {
      SYNC.enCours = Math.max(0, SYNC.enCours - 1);
      SYNC.lastWriteOk = Date.now(); SYNC.errStreak = 0; SYNC.lastError = '';
    }, function (e) {
      SYNC.enCours = Math.max(0, SYNC.enCours - 1);
      SYNC.lastWriteErr = Date.now(); SYNC.errStreak++; SYNC.lastError = String((e && e.message) || e);
      journal({ op: 'ERREUR', message: SYNC.lastError });
      throw e;
    });
  }

  /* Ancien chemin (table enterprise_data absente) : conserve tel quel. */
  function writeEnterpriseLegacy(uid, data) {
    var conv = docToRow('enterprises', uid, data);
    var row = conv.row;
    return sb.rpc('mdb_upsert_enterprise', {
      p_id: row.id, p_data: row.data,
      p_identifiant: row.identifiant || '', p_email: row.email || '', p_nom: row.nom || ''
    }).then(function(res) { if (res.error) throw res.error; });
  }

  /* Migration legacy -> decoupe : ne remplit que les cles ABSENTES (jamais
     d'ecrasement d'une ecriture fraiche), puis pose la sentinelle. Idempotent,
     rejouable, erreurs avalees (reessai a la prochaine lecture). */
  function migrerLegacyVersSplit(uid, legacyData, lignesExistantes) {
    try {
      if (!legacyData || typeof legacyData !== 'object') return Promise.resolve();
      var presents = {};
      for (var i = 0; i < (lignesExistantes || []).length; i++) {
        var r = lignesExistantes[i];
        if (r && r.cle) presents[r.cle] = true;
      }
      var toutes = [];
      var cand = splitDocEnLignes(uid, legacyData);
      for (var j = 0; j < cand.length; j++) {
        if (!presents[cand[j].cle]) toutes.push(cand[j]);
      }
      var chain = Promise.resolve();
      var paquets = splitParPaquets(toutes, 15);
      paquets.forEach(function(pq) {
        chain = chain.then(function() {
          return sb.from(SPLIT_TABLE).upsert(pq, { onConflict: 'enterprise_id,cle' })
            .then(function(r) { if (r.error) throw r.error; });
        });
      });
      return chain.then(function() {
        return sb.from(SPLIT_TABLE).upsert(
          [{ enterprise_id: uid, cle: SPLIT_MIGRATION_CLE, data: { v: 1 }, updated_at: isoNow() }],
          { onConflict: 'enterprise_id,cle' })
          .then(function(r) { if (r.error) throw r.error; });
      }).catch(function() {});
    } catch (e) { return Promise.resolve(); }
  }

  function fetchEnterpriseLegacy(uid) {
    return sb.from('enterprises').select('*').eq('id', uid).limit(1).then(function(res) {
      if (res.error) throw res.error;
      var snap = (res.data && res.data.length > 0)
        ? docFromRow('enterprises', res.data[0])
        : new DocSnapshot(uid, false, null);
      snap._split = false;
      return snap;
    });
  }

  /* Lecture DIFFERENTIELLE du dossier : on lit d'abord la liste (cle, version)
     — quelques Ko — puis on ne telecharge QUE les rubriques modifiees depuis la
     derniere lecture. Avant, chaque changement d'un autre poste faisait
     retelecharger tout le dossier (plusieurs Mo) par chaque page ouverte :
     c'est ce qui epuisait le quota de bande passante Supabase. */
  function fetchEnterpriseDelta(uid) {
    var c = _rowsCache[uid], tsC = _rowsTs[uid];
    return sb.from(SPLIT_TABLE).select('cle,updated_at').eq('enterprise_id', uid).then(function(res) {
      if (res.error) throw res.error;
      var liste = res.data || [], vu = {}, aLire = [], aSentinelle = false;
      for (var i = 0; i < liste.length; i++) {
        var l = liste[i]; if (!l || typeof l.cle !== 'string') continue;
        vu[l.cle] = true;
        if (l.cle === SPLIT_MIGRATION_CLE) { aSentinelle = true; tsC[l.cle] = l.updated_at; if (!(l.cle in c)) c[l.cle] = sjson({ v: 1 }); continue; }
        if (!(l.cle in c) || !tsC[l.cle] || normTs(tsC[l.cle]) !== normTs(l.updated_at)) aLire.push(l.cle);
      }
      if (!aSentinelle) return null; /* cas non standard : lecture complete */
      for (var k in c) { if (c.hasOwnProperty(k) && !vu[k]) { delete c[k]; delete tsC[k]; } }
      SYNC.deltaLus = (SYNC.deltaLus || 0) + aLire.length;
      if (!aLire.length) { SYNC.lastFetchOk = Date.now(); return snapshotFromCache(uid); }
      var lots = [];
      for (var j = 0; j < aLire.length; j += 40) lots.push(aLire.slice(j, j + 40));
      return Promise.all(lots.map(function (lot) {
        return sb.from(SPLIT_TABLE).select('cle,data,updated_at').eq('enterprise_id', uid).in('cle', lot).then(function (r) {
          if (r.error) throw r.error;
          (r.data || []).forEach(function (row) { c[row.cle] = sjson(row.data); tsC[row.cle] = row.updated_at; });
        });
      })).then(function () { SYNC.lastFetchOk = Date.now(); return snapshotFromCache(uid); });
    });
  }

  function fetchEnterpriseSplit(uid) {
    if (_rowsCache[uid] && _rowsTs[uid] && (Date.now() - (SYNC.lastFull || 0)) < DELTA_FULL_MS) {
      return fetchEnterpriseDelta(uid).then(function (sn) { return sn || fetchEnterpriseSplitComplet(uid); }, function (e) {
        if (splitEstTableManquante(e)) throw e;
        return fetchEnterpriseSplitComplet(uid);
      });
    }
    return fetchEnterpriseSplitComplet(uid);
  }

  function fetchEnterpriseSplitComplet(uid) {
    return sb.from(SPLIT_TABLE).select('cle,data,updated_at').eq('enterprise_id', uid).then(function(res) {
      if (res.error) {
        if (splitEstTableManquante(res.error)) {
          _splitOK = false;
          return fetchEnterpriseLegacy(uid);
        }
        throw res.error;
      }
      _splitOK = true;
      var lignes = res.data || [];
      try {
        var _nc = {}, _nt = {};
        for (var ci = 0; ci < lignes.length; ci++) { if (lignes[ci] && typeof lignes[ci].cle === 'string') { _nc[lignes[ci].cle] = sjson(lignes[ci].data); _nt[lignes[ci].cle] = lignes[ci].updated_at; } }
        _rowsCache[uid] = _nc; _rowsTs[uid] = _nt;
        SYNC.lastFetchOk = Date.now(); SYNC.lastFull = Date.now();
      } catch (eCache) {}
      var aSentinelle = false;
      for (var i = 0; i < lignes.length; i++) {
        if (lignes[i] && lignes[i].cle === SPLIT_MIGRATION_CLE) { aSentinelle = true; break; }
      }
      if (aSentinelle) {
        var snap = new DocSnapshot(uid, true, splitAssemble(lignes));
        snap._split = true;
        return snap;
      }
      /* Pas de sentinelle : le legacy fait foi + migration en arriere-plan */
      return sb.from('enterprises').select('id').eq('id', uid).limit(1).then(function(rId) {
        if (rId.error) throw rId.error;
        var identExiste = !!(rId.data && rId.data.length > 0);
        if (!lignes.length && !identExiste) {
          var vide = new DocSnapshot(uid, false, null);
          vide._split = true;
          return vide;
        }
        return fetchEnterpriseLegacy(uid).then(function(snapLegacy) {
          try {
            migrerLegacyVersSplit(uid, snapLegacy.exists ? snapLegacy.data() : null, lignes);
          } catch (eM) {}
          return snapLegacy;
        });
      });
    });
  }

  /* ---------- Conversion ligne <-> document ---------- */

  /* Si la colonne data a ete ecrite comme tableau [{...}], on la deballe automatiquement */
  function unwrapData(v) {
    if (Array.isArray(v)) return (v.length === 1 && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0])) ? v[0] : {};
    return (v && typeof v === 'object') ? v : {};
  }

  function rowToDocData(table, row) {
    switch (table) {
      case 'enterprises':
        return unwrapData(row.data);
      case 'enterprise_index':
        return row.data && Object.keys(row.data).length > 0 ? row.data : { uid: row.uid || '', email: row.email || '', nom: row.nom || '' };
      case 'license_keys':
        return row.data || {};
      case 'reset_codes':
        return row.data || {};
      case 'super_admin_config':
        return row.data || {};
      case 'backups':
        return row.data || {};
      case 'sessions': {
        /* Plusieurs appareils peuvent être connectés en même temps : la colonne
           token contient les jetons séparés par '|'. Le dernier = login le plus récent. */
        var rawTok = row.token || '';
        var parts = String(rawTok).split('|').filter(Boolean);
        return { token: parts.length > 0 ? parts[parts.length - 1] : '',
                 tokens: parts,
                 userId: row.user_id || '',
                 updatedAt: row.updated_at ? new Date(row.updated_at) : null };
      }
      default:
        return row.data || {};
    }
  }

  function docToRow(table, docId, data) {
    var clean = deepClean(data || {});
    if (table === 'enterprises') {
      /* Garde-fou : jamais de tableau comme document entreprise */
      if (Array.isArray(clean)) clean = (clean.length === 1 && clean[0] && typeof clean[0] === 'object' && !Array.isArray(clean[0])) ? clean[0] : {};
    }
    switch (table) {
      case 'enterprises':
        return { row: { id: docId,
                        identifiant: clean.identifiant || null,
                        email: clean.email || null,
                        nom: clean.nom || null,
                        data: clean }, mergeRpc: true };
      case 'enterprise_index':
        return { row: { identifiant: docId,
                        uid: clean.uid || '',
                        email: clean.email || '',
                        nom: clean.nom || '',
                        data: clean } };
      case 'license_keys':
        return { row: { code: docId, data: clean } };
      case 'reset_codes':
        return { row: { email_key: docId, data: clean } };
      case 'super_admin_config':
        return { row: { id: 1, data: clean }, saMerge: true };
      case 'backups':
        return { row: { ts: parseInt(docId, 10) || 0, data: clean }, needsParent: true };
      case 'sessions':
        return { row: { token: clean.token || '', updated_at: isoNow(), user_id: docId }, needsParent: true };
      default:
        return { row: { data: clean } };
    }
  }

  /* ---------- Snapshots ---------- */

  function DocSnapshot(id, exists, data) {
    this.id = id;
    this.exists = !!exists;
    this._data = data || null;
  }
  DocSnapshot.prototype.data = function() { return this._data; };

  function QuerySnapshot(docs) {
    this.docs = docs || [];
    this.empty = this.docs.length === 0;
    var self = this;
    this.size = this.docs.length;
    this.forEach = function(cb) { for (var i = 0; i < self.docs.length; i++) cb(self.docs[i]); };
    this.forEachDoc = this.forEach;
  }
  QuerySnapshot.prototype.forEach = null;

  function docFromRow(table, row) {
    if (!row) return new DocSnapshot('', false, null);
    var idKey = { enterprises: 'id', enterprise_index: 'identifiant', license_keys: 'code',
                  reset_codes: 'email_key', super_admin_config: 'id', backups: 'ts', sessions: 'user_id' }[table] || 'id';
    var rawId = row[idKey];
    var id = (table === 'super_admin_config') ? 'config'
           : (table === 'backups') ? String(rawId)
           : String(rawId == null ? '' : rawId);
    return new DocSnapshot(id, true, rowToDocData(table, row));
  }

  /* ---------- Écritures ---------- */

  function writeDoc(parentTable, parentId, table, docId, data, opts) {
    data = deepClean(data || {});

    /* Document entreprise : ecriture decoupee (petites lignes), repli legacy
       UNIQUEMENT si la table enterprise_data n'existe vraiment pas.
       Avant, TOUTE erreur (504, delai depasse, reseau) faisait basculer en
       legacy : le RPC de 2,3 Mo repartait en timeoute, puis l'erreur
       recommençait, et « synchro en attente » devenait permanente. Sur une
       erreur passagere on la remonte : les cles sales restent en file et
       repartent au prochain essai. */
    if (table === 'enterprises' && !parentTable) {
      if (_splitOK === false) return writeEnterpriseLegacy(docId, data);
      return writeEnterpriseSplit(docId, data).catch(function(e) {
        if (splitEstTableManquante(e)) {
          _splitOK = false;
          try { console.warn('[mdb] table enterprise_data absente : repli legacy'); } catch (eC) {}
          return writeEnterpriseLegacy(docId, data);
        }
        /* 504 / delai / reseau : a reessayer, PAS de repli legacy. */
        try { console.warn('[mdb] push echoue (repli desactive) :', (e && e.message) || e); } catch (eC2) {}
        throw e;
      });
    }
    var conv = docToRow(table, docId, data);
    var row = conv.row;
    if (conv.saMerge) {
      return sb.rpc('mdb_upsert_sa_config', { p_data: row.data })
        .then(function(res) { if (res.error) throw res.error; });
    }

    if (conv.needsParent) {
      if (table === 'sessions') {
        /* Sessions simultanées : fusionner la liste de jetons au lieu d'écraser.
           - Login (appareil) : union, l'appareil passe en fin de liste (max 5).
           - Déconnexion/révocation : l'app envoie _replaceTokens + liste restante. */
        row.enterprise_id = parentId;
        var replaceAll = !!data._replaceTokens;
        var incoming = (Array.isArray(data.tokens) && data.tokens.length > 0) ? data.tokens.slice()
                     : (data.token ? [data.token] : []);
        return sb.from('sessions').select('*').eq('enterprise_id', parentId).eq('user_id', docId).limit(1)
          .then(function(res) {
            var erow = res.data && res.data[0];
            var cur = (erow && erow.token) ? String(erow.token).split('|').filter(Boolean) : [];
            var merged;
            if (replaceAll) {
              merged = incoming.slice();
            } else {
              merged = cur.slice();
              for (var mi = 0; mi < incoming.length; mi++) {
                var at = merged.indexOf(incoming[mi]);
                if (at !== -1) merged.splice(at, 1);
                merged.push(incoming[mi]);
              }
              while (merged.length > 5) merged.shift();
            }
            row.token = merged.join('|');
            return sb.from('sessions').upsert(row, { onConflict: 'enterprise_id,user_id' })
              .then(function(r2) { if (r2.error) throw r2.error; });
          });
      }
      if (table === 'backups') {
        row.enterprise_id = parentId;
        return sb.from('backups').upsert(row, { onConflict: 'enterprise_id,ts' })
          .then(function(res) { if (res.error) throw res.error; });
      }
    }

    /* update() = lecture-modification-écriture sur petites tables */
    if (opts && opts.__isUpdate) {
      return sb.from(table).select('*').eq(pkOf(table), docId).limit(1)
        .then(function(res) {
          if (res.error) throw res.error;
          var existing = res.data && res.data[0];
          var base = existing ? (existing.data || {}) : {};
          var merged = Object.assign({}, base, data);
          var conv2 = docToRow(table, docId, merged);
          conv2.row[pkOf(table)] = (table === 'super_admin_config') ? 1 : docId;
          return sb.from(table).upsert(conv2.row, { onConflict: pkOf(table) })
            .then(function(r2) { if (r2.error) throw r2.error; });
        });
    }

    return sb.from(table).upsert(row, { onConflict: pkOf(table) })
      .then(function(res) { if (res.error) throw res.error; });
  }

  function pkOf(table) {
    return { enterprises: 'id', enterprise_index: 'identifiant', license_keys: 'code',
             reset_codes: 'email_key', super_admin_config: 'id', backups: 'ts', sessions: 'user_id' }[table] || 'id';
  }

  /* ---------- Lectures ---------- */

  function _tmo(p, ms) {
    ms = ms || 12000;
    return new Promise(function(res, rej) {
      var done = false;
      var t = setTimeout(function() {
        if (done) return; done = true;
        rej(new Error('D\u00e9lai r\u00e9seau d\u00e9pass\u00e9 (' + ms + 'ms) \u2014 v\u00e9rifiez Internet ou d\u00e9sactivez l\'adblocker'));
      }, ms);
      Promise.resolve(p).then(function(v) {
        if (done) return; done = true; clearTimeout(t); res(v);
      }, function(e) {
        if (done) return; done = true; clearTimeout(t); rej(e);
      });
    });
  }

  function fetchDoc(parentTable, parentId, table, docId) {
    var q;
    /* Document entreprise : lecture decoupee (petites lignes + migration
       auto), repli legacy si la table n'existe pas encore. */
    if (table === 'enterprises' && !parentTable) {
      if (_splitOK === false) return _tmo(fetchEnterpriseLegacy(docId));
      /* Lecture complete du dossier (~2,3 Mo repartis) : 12 s est trop court
         sur une connexion lente et provoquait « Delai reseau depasse », donc
         envoi avec le cache. Seul le dossier entreprise a ce delai. */
      return _tmo(fetchEnterpriseSplit(docId).catch(function(e) {
        if (splitEstTableManquante(e)) { _splitOK = false; return fetchEnterpriseLegacy(docId); }
        throw e;
      }), 45000);
    }
    switch (table) {
      case 'enterprises':
        q = sb.from('enterprises').select('*').eq('id', docId).limit(1); break;
      case 'enterprise_index':
        q = sb.from('enterprise_index').select('*').eq('identifiant', docId).limit(1); break;
      case 'license_keys':
        q = sb.from('license_keys').select('*').eq('code', docId).limit(1); break;
      case 'reset_codes':
        q = sb.from('reset_codes').select('*').eq('email_key', docId).limit(1); break;
      case 'super_admin_config':
        q = sb.from('super_admin_config').select('*').eq('id', 1).limit(1); break;
      case 'sessions':
        q = sb.from('sessions').select('*')
              .eq('enterprise_id', parentId).eq('user_id', docId).limit(1); break;
      case 'backups':
        q = sb.from('backups').select('*')
              .eq('enterprise_id', parentId).eq('ts', parseInt(docId, 10) || 0).limit(1); break;
      default:
        return Promise.resolve(new DocSnapshot(docId, false, null));
    }
    return _tmo(q.then(function(res) {
      if (res.error) throw res.error;
      return res.data && res.data.length > 0 ? docFromRow(table, res.data[0]) : new DocSnapshot(docId, false, null);
    }));
  }

  function fetchQuery(table, modifiers) {
    var sel = sb.from(table).select('*');
    for (var i = 0; i < modifiers.length; i++) {
      var m = modifiers[i];
      if (m.type === 'where') sel = sel.eq(m.field, m.value);
      else if (m.type === 'order') sel = sel.order(m.field, { ascending: m.dir !== 'desc' });
      else if (m.type === 'limit') sel = sel.limit(m.n);
    }
    return _tmo(sel.then(function(res) {
      if (res.error) throw res.error;
      var docs = [];
      for (var j = 0; j < (res.data || []).length; j++) docs.push(docFromRow(table, res.data[j]));
      return new QuerySnapshot(docs);
    }));
  }

  /* ---------- Temps réel ---------- */

  function watchDoc(parentTable, parentId, table, docId, onData, onError) {
    var stopped = false;
    var channel = null;
    var emitRef = null;

    fetchDoc(parentTable, parentId, table, docId).then(function(snap) {
      if (stopped) return;
      try { onData(snap); } catch (e) { console.warn('[SB] snapshot cb error:', e); }
      /* Document decoupe : on s'abonne aux petites lignes (evenements legers),
         puis on re-assemble (requetes rapides). Debounce anti-rafale. */
      var useSplit = (table === 'enterprises' && snap && snap._split === true);
      var cfg = useSplit
        ? { event: '*', schema: 'public', table: SPLIT_TABLE, filter: 'enterprise_id=eq.' + docId }
        : { event: '*', schema: 'public', table: table };
      if (table === 'enterprises' && !useSplit) cfg.filter = 'id=eq.' + docId;
      else if (table === 'sessions') cfg.filter = 'enterprise_id=eq.' + parentId;
      else if (table === 'backups') cfg.filter = 'enterprise_id=eq.' + parentId;
      else if (table === 'license_keys') cfg.filter = 'code=eq.' + docId;
      var chName = 'mdb-' + (useSplit ? SPLIT_TABLE : table) + '-' + parentId + '-' + docId;
      var debT = null, pend = {}, pendFull = false;
      function pleinRelecture() {
        fetchDoc(parentTable, parentId, table, docId).then(function(s2) {
          if (stopped) return;
          try { onData(s2); } catch (e2) { console.warn('[SB] snapshot cb error:', e2); }
        }).catch(function() {});
      }
      function emettreDepuisCache() {
        if (stopped) return;
        var sn = snapshotFromCache(docId);
        if (!sn) return pleinRelecture();
        try { onData(sn); } catch (e3) { console.warn('[SB] snapshot cb error:', e3); }
      }
      function flush() {
        debT = null;
        if (stopped) return;
        var full = pendFull, p = pend; pendFull = false; pend = {};
        var cles = [], dels = [];
        for (var c in p) {
          if (!p.hasOwnProperty(c) || c === SPLIT_MIGRATION_CLE) continue;
          if (p[c].del) { dels.push(c); continue; }
          var bb = _rowBase[bkey(docId, c)];
          if (bb && p[c].ts && sameTs(bb.ts, p[c].ts)) continue; /* echo de notre propre ecriture */
          cles.push(c);
        }
        if (!full && !cles.length && !dels.length) return;
        /* Filet de securite : au moins une relecture complete toutes les 3 minutes */
        if (full || !_rowsCache[docId] || (Date.now() - (SYNC.lastFull || 0)) > 180000) return pleinRelecture();
        fetchRowsInto(docId, cles, dels).then(emettreDepuisCache).catch(pleinRelecture);
      }
      if (useSplit) {
        emitRef = emettreDepuisCache;
        (_watchers[docId] = _watchers[docId] || []).push(emettreDepuisCache);
      }
      channel = sb.channel(chName).on(
        'postgres_changes', cfg,
        function(payload) {
          if (stopped) return;
          try {
            if (useSplit) {
              /* Un evenement par ligne modifiee : on note QUELLE rubrique a change,
                 on ignore l'echo de nos propres ecritures, puis on ne relit que
                 les rubriques modifiees (et non plus tout le dossier, 2,5 Mo). */
              var evRow = payload && ((payload.new && payload.new.cle) ? payload.new : ((payload.old && payload.old.cle) ? payload.old : null));
              var evDel = payload && (payload.eventType === 'DELETE' || payload.event === 'DELETE');
              if (!evRow || !_rowsCache[docId]) pendFull = true;
              else if (evDel) pend[evRow.cle] = { del: true };
              else pend[evRow.cle] = { ts: evRow.updated_at };
              if (debT) clearTimeout(debT);
              debT = setTimeout(flush, 400);
              return;
            }
            if (payload.eventType === 'DELETE' || payload.event === 'DELETE') {
              onData(new DocSnapshot(docId, false, null));
            } else {
              var newRow = payload.new;
              if (table === 'sessions' && newRow && newRow.user_id !== docId) return; // autre session du même parent
              onData(docFromRow(table, newRow));
            }
          } catch (e) { console.warn('[SB] realtime cb error:', e); }
        }
      );
      channel.subscribe(function(status) {
        /* Le temps réel est-il réellement CONNECTÉ ? L'appli s'en sert pour
           savoir si elle doit frequent le cloud : sinon elle ne verrait les
           saisies des autres postes qu'au prochain rechargement manuel. */
        if (status === 'SUBSCRIBED') window.__MDB_RT__ = true;
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_CLOSED') window.__MDB_RT__ = false;
        try { majVoyantDirect(); } catch (eV) {}
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (onError) onError(new Error('Realtime: ' + status));
        }
      });
    }).catch(function(e) { if (onError) onError(e); });

    return function() {
      stopped = true;
      try { var wl = _watchers[docId] || []; _watchers[docId] = wl.filter(function(f) { return f !== emitRef; }); } catch (eW) {}
      if (channel) { try { sb.removeChannel(channel); } catch (e) {} }
    };
  }

  /* Voyant visible dans l'en-tete des 3 applis :

     vert « En direct » = les saisies des autres postes arrivent tout de suite ;

     orange « Relais » = temps reel coupe, verification automatique toutes les quelques secondes. */

  /* L'etat temps reel est montre par le petit voyant de synchro (en bas a gauche) */
  function majVoyantDirect() {
    try { var v = document.getElementById('mdbVoyantDirect'); if (v && v.parentNode) v.parentNode.removeChild(v); } catch (e) {}
  }



  /* Relecture ciblee : seules les rubriques modifiees sont retelechargees */
  function fetchRowsInto(uid, cles, dels) {
    var c = _rowsCache[uid] || (_rowsCache[uid] = {});
    var t = _rowsTs[uid] || (_rowsTs[uid] = {});
    for (var i = 0; i < dels.length; i++) { delete c[dels[i]]; delete t[dels[i]]; }
    if (!cles.length) return Promise.resolve();
    return _tmo(sb.from(SPLIT_TABLE).select('cle,data,updated_at').eq('enterprise_id', uid).in('cle', cles), 30000).then(function(res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      for (var j = 0; j < rows.length; j++) { c[rows[j].cle] = sjson(rows[j].data); t[rows[j].cle] = rows[j].updated_at; }
      SYNC.lastFetchOk = Date.now();
    });
  }
  function snapshotFromCache(uid) {
    var c = _rowsCache[uid];
    if (!c) return null;
    var l = [];
    for (var k in c) { if (!c.hasOwnProperty(k)) continue; try { l.push({ cle: k, data: JSON.parse(c[k]) }); } catch (e) {} }
    var sn = new DocSnapshot(uid, true, splitAssemble(l));
    sn._split = true;
    return sn;
  }

  /* ---------- Références type Firestore ---------- */

  function DocRef(parentTable, parentId, table, docId) {
    this.parentTable = parentTable; this.parentId = parentId;
    this.table = table; this.id = docId;
  }
  DocRef.prototype.collection = function(subName) {
    if (this.table !== 'enterprises') throw new Error('Sous-collection non supportée: ' + subName);
    if (subName === 'sessions') return new CollectionRef('enterprises', this.id, 'sessions');
    if (subName === 'backups') return new CollectionRef('enterprises', this.id, 'backups');
    throw new Error('Sous-collection inconnue: ' + subName);
  };
  DocRef.prototype.get = function() { return fetchDoc(this.parentTable, this.parentId, this.table, this.id); };
  DocRef.prototype.set = function(data, opts) { return writeDoc(this.parentTable, this.parentId, this.table, this.id, data, opts || {}); };
  DocRef.prototype.update = function(data) {
    if (this.table === 'enterprises') return writeDoc(this.parentTable, this.parentId, this.table, this.id, data, {});
    return writeDoc(this.parentTable, this.parentId, this.table, this.id, data, { __isUpdate: true });
  };
  DocRef.prototype.delete = function() {
    var self = this;
    if (this.table === 'enterprises') {
      var supprSplit = function() {
        return sb.from(SPLIT_TABLE).delete().eq('enterprise_id', self.id).then(function(r) {
          if (r.error) throw r.error;
          return sb.from('enterprises').delete().eq('id', self.id).then(function(r2) {
            if (r2.error) throw r2.error;
          });
        });
      };
      if (_splitOK === false) {
        return sb.from('enterprises').delete().eq('id', self.id).then(function(r) { if (r.error) throw r.error; });
      }
      return supprSplit().catch(function(e) {
        if (splitEstTableManquante(e)) {
          _splitOK = false;
          return sb.from('enterprises').delete().eq('id', self.id).then(function(r) { if (r.error) throw r.error; });
        }
        throw e;
      });
    }
    if (this.table === 'sessions') {
      return sb.from('sessions').delete()
        .eq('enterprise_id', self.parentId).eq('user_id', self.id).then(function(r) { if (r.error) throw r.error; });
    }
    if (this.table === 'enterprise_index') {
      return sb.from('enterprise_index').delete().eq('identifiant', self.id).then(function(r) { if (r.error) throw r.error; });
    }
    return sb.from(self.table).delete().eq(pkOf(self.table), self.id).then(function(r) { if (r.error) throw r.error; });
  };
  DocRef.prototype.onSnapshot = function(onData, onError) {
    return watchDoc(this.parentTable, this.parentId, this.table, this.id, onData, onError);
  };

  function QueryRef(parentTable, parentId, table, modifiers) {
    this.parentTable = parentTable; this.parentId = parentId;
    this.table = table; this.modifiers = modifiers || [];
  }
  QueryRef.prototype.where = function(f, op, v) {
    if (op !== '==') throw new Error('Opérateur where non supporté: ' + op);
    return new QueryRef(this.parentTable, this.parentId, this.table, this.modifiers.concat([{ type: 'where', field: f, value: v }]));
  };
  QueryRef.prototype.orderBy = function(field, dir) {
    var f = (this.table === 'license_keys' && field === 'createdAt') ? 'created_at' : field;
    return new QueryRef(this.parentTable, this.parentId, this.table, this.modifiers.concat([{ type: 'order', field: f, dir: dir || 'asc' }]));
  };
  QueryRef.prototype.limit = function(n) {
    return new QueryRef(this.parentTable, this.parentId, this.table, this.modifiers.concat([{ type: 'limit', n: n }]));
  };
  QueryRef.prototype.get = function() { return fetchQuery(this.table, this.modifiers); };

  function CollectionRef(parentTable, parentId, table) {
    this.parentTable = parentTable; this.parentId = parentId; this.table = table;
  }
  CollectionRef.prototype.doc = function(id) { return new DocRef(this.parentTable, this.parentId, this.table, id); };
  CollectionRef.prototype.add = function(data) {
    var id = genUid('id_');
    var conv = docToRow(this.table, id, data);
    /* add() n'est pas utilisé dans l'app ; implémenté par sécurité */
    return sb.from(this.table).insert(conv.row).then(function(r) { if (r.error) throw r.error; return { id: id }; });
  };
  CollectionRef.prototype.get = function() { return fetchQuery(this.table, []); };
  CollectionRef.prototype.where = function(f, op, v) { return new QueryRef(this.parentTable, this.parentId, this.table, [{ type: 'where', field: f, value: v }]); };
  CollectionRef.prototype.orderBy = function(field, dir) { return new QueryRef(this.parentTable, this.parentId, this.table, [{ type: 'order', field: (this.table === 'license_keys' && field === 'createdAt') ? 'created_at' : field, dir: dir || 'asc' }]); };
  CollectionRef.prototype.limit = function(n) { return new QueryRef(this.parentTable, this.parentId, this.table, [{ type: 'limit', n: n }]); };

  var TABLE_MAP = {
    enterprises: 'enterprises',
    enterpriseIndex: 'enterprise_index',
    licenseKeys: 'license_keys',
    resetCodes: 'reset_codes',
    superAdmin: 'super_admin_config'
  };

  /* ---------- API globale compatible firebase.firestore ---------- */

  var adapter = {
    collection: function(name) {
      var t = TABLE_MAP[name];
      if (!t) throw new Error('Collection inconnue: ' + name);
      return new CollectionRef(null, null, t);
    },
    getAllEnterprises: function() {
      /* Sans la colonne data (le dossier entier) : la liste ne telecharge
         que l'identite, sinon chaque ligne fait timeouter. */
      return sb.from('enterprises').select('id,identifiant,email,nom,updated_at');
    }
  };

  /* Référence canonique : un nom dédié que le code applicatif ne peut pas écraser */
  /* Ecriture protegee (controle de version + fusion 3 points) reutilisable par les
     pages qui ont leur propre transport (production.html). */
  adapter.ecrireRubriques = function(uid, data) {
    if (_splitOK === false) return Promise.reject({ __splitManquant: true });
    return writeEnterpriseSplit(uid, deepClean(data || {}));
  };
  window.__MDB_ADAPTER__ = adapter;
  window.firebaseDb = adapter;

  window.firebase_firestore_FieldValue_delete = FV_DELETE;
  window.SB_genUid = genUid;
  window.SB_ready = true;

  /* Exposes pour les tests automatises (round-trip decoupe/assemblage). */
  adapter.__splitInternals = {
    splitDocEnLignes: splitDocEnLignes,
    splitAssemble: splitAssemble,
    splitEstTableManquante: splitEstTableManquante,
    splitLignesParLots: splitLignesParLots,
    SPLIT_LOT_CIBLES: SPLIT_LOT_CIBLES,
    SPLIT_MIGRATION_CLE: SPLIT_MIGRATION_CLE
  };
  /* Diagnostic console : window.__MDB_ADAPTER__.__splitEtat()
     -> {split: true} = decoupe active, {split: false} = repli legacy,
        {split: null} = pas encore determine (recharger la page). */
  adapter.__splitEtat = function() {
    return { split: _splitOK };
  };

  console.log('[MDB] Adaptateur Supabase prêt (' + SUPABASE_URL + ')');

  /* ========================================================================
     INDICATEUR DE SYNCHRO (visible dans toutes les pages) : l'utilisateur sait
     a tout moment si ses saisies sont bien parties et si le poste est a jour.
     ======================================================================== */
  (function () {
    try {
      if (window.top !== window) return;
      var el = null, ouvertJusqua = 0;
      function creer() {
        if (el || !document.body) return;
        el = document.createElement('div');
        el.id = 'mdbSyncBadge';
        /* Petit voyant discret (point de couleur). Un appui affiche le detail
           quelques secondes, puis il redevient un simple point. */
        el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;font:600 11px/1.2 system-ui,Segoe UI,Arial,sans-serif;border-radius:999px;color:#fff;background:#16a34a;cursor:pointer;user-select:none;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 1px 3px rgba(0,0,0,.3);transition:all .2s';
        el.onclick = function () {
          ouvertJusqua = Date.now() + 4000; maj();
          setTimeout(maj, 4100);
          try { console.table(window.mdbSyncJournal().slice(-40)); } catch (e) {}
        };
        var st = document.createElement('style');
        st.textContent = '@media print{#mdbSyncBadge{display:none!important}}';
        document.head.appendChild(st);
        document.body.appendChild(el);
      }
      function maj() {
        creer();
        if (!el) return;
        var S = window.MDB_SYNC || {}, now = Date.now(), txt, bg;
        var dern = Math.max(S.lastWriteOk || 0, S.lastFetchOk || 0);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) { txt = '⚠ Hors ligne — saisies gardees sur ce poste'; bg = '#dc2626'; }
        else if ((S.errStreak || 0) >= 2) { txt = '⚠ Synchro en attente (' + S.errStreak + ' echecs) — reessai auto'; bg = '#ea580c'; }
        else if ((S.enCours || 0) > 0) { txt = '↻ Envoi en cours…'; bg = '#2563eb'; }
        else if (window.__MDB_RT__ === false) { txt = 'Relais : temps reel coupe — verification automatique'; bg = '#f59e0b'; }
        else if (dern) { var sec = Math.round((now - dern) / 1000); txt = 'En direct · synchro OK' + (sec < 90 ? '' : ' (' + Math.round(sec / 60) + ' min)'); bg = '#16a34a'; }
        else { txt = 'Connexion…'; bg = '#94a3b8'; }
        /* Point seul, sauf alerte (hors ligne / echecs) ou appui de l'utilisateur */
        var alerte = bg === '#dc2626' || bg === '#ea580c';
        var deplie = alerte || now < ouvertJusqua;
        el.style.background = bg;
        if (deplie) { el.textContent = txt; el.style.width = 'auto'; el.style.height = 'auto'; el.style.padding = '4px 9px'; el.style.opacity = '.92'; }
        else { el.textContent = ''; el.style.width = '12px'; el.style.height = '12px'; el.style.padding = '0'; el.style.opacity = '1'; }
        el.setAttribute('aria-label', txt);
        el.title = 'Conflits fusionnes : ' + (S.fusions || 0) + ' | Garde-fous : ' + (S.garde || 0) + (S.lastError ? ' | Derniere erreur : ' + S.lastError : '') + ' | Cliquer = journal dans la console (F12)';
      }
      setInterval(maj, 4000);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maj); else maj();
      window.addEventListener('online', maj); window.addEventListener('offline', maj);
    } catch (e) {}
  })();
})();
