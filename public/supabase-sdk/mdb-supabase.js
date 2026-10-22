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

  function writeEnterpriseSplit(uid, data) {
    var lignes = splitDocEnLignes(uid, data);
    var ident = splitIdentite(data);
    var upsertIdent = { id: uid, updated_at: isoNow() };
    for (var k in ident) { if (ident.hasOwnProperty(k)) upsertIdent[k] = ident[k]; }
    var lots = splitLignesParLots(lignes);
    try { console.log('[mdb] push decoupe en ' + lots.length + ' lot(s) pour ' + lignes.length + ' ligne(s)'); } catch (eL) {}
    var p1 = (lignes.length > 0)
      ? upsertLots(lots)
      : Promise.resolve();
    return p1.then(function() {
      return sb.from('enterprises').upsert(upsertIdent, { onConflict: 'id' })
        .then(function(r2) { if (r2.error) throw r2.error; });
    }).then(function() {
      return sb.from(SPLIT_TABLE).upsert(
        [{ enterprise_id: uid, cle: SPLIT_MIGRATION_CLE, data: { v: 1 }, updated_at: isoNow() }],
        { onConflict: 'enterprise_id,cle' })
        .then(function(r3) { if (r3.error) throw r3.error; });
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

  function fetchEnterpriseSplit(uid) {
    return sb.from(SPLIT_TABLE).select('cle,data').eq('enterprise_id', uid).then(function(res) {
      if (res.error) {
        if (splitEstTableManquante(res.error)) {
          _splitOK = false;
          return fetchEnterpriseLegacy(uid);
        }
        throw res.error;
      }
      _splitOK = true;
      var lignes = res.data || [];
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
      var debT = null;
      channel = sb.channel(chName).on(
        'postgres_changes', cfg,
        function(payload) {
          if (stopped) return;
          try {
            if (useSplit) {
              /* Un evenement par ligne modifiee : on coalesce puis relit */
              if (debT) clearTimeout(debT);
              debT = setTimeout(function() {
                debT = null;
                if (stopped) return;
                fetchDoc(parentTable, parentId, table, docId).then(function(s2) {
                  if (stopped) return;
                  try { onData(s2); } catch (e2) { console.warn('[SB] snapshot cb error:', e2); }
                }).catch(function() {});
              }, 400);
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
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (onError) onError(new Error('Realtime: ' + status));
        }
      });
    }).catch(function(e) { if (onError) onError(e); });

    return function() {
      stopped = true;
      if (channel) { try { sb.removeChannel(channel); } catch (e) {} }
    };
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
})();
