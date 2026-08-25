/* ============================================================================
   MDB-SUPABASE.JS — Adaptateur Firestore -> Supabase pour MONTABBORD
   Expose une API compatible avec le sous-ensemble Firestore utilisé par l'app,
   adossé à PostgreSQL/Supabase. La logique métier reste inchangée.
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
    var conv = docToRow(table, docId, data);
    var row = conv.row;

    if (conv.mergeRpc) {
      return sb.rpc('mdb_upsert_enterprise', {
        p_id: row.id, p_data: row.data,
        p_identifiant: row.identifiant || '', p_email: row.email || '', p_nom: row.nom || ''
      }).then(function(res) { if (res.error) throw res.error; });
    }
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
    try { if (window._mdbFatal && table === 'enterprises') window._mdbFatal('[NET] requ\u00eate ' + table + '/' + String(docId).slice(0, 12) + '... envoy\u00e9e'); } catch (eNS) {}
    return _tmo(q.then(function(res) {
      try { if (window._mdbFatal && table === 'enterprises') window._mdbFatal('[NET] r\u00e9ponse ' + table + ' re\u00e7ue (' + ((res.data || []).length) + ' ligne(s), ' + Math.round(JSON.stringify(res.data || []).length / 1024) + ' Ko)'); } catch (eNT) {}
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
      var cfg = { event: '*', schema: 'public', table: table };
      if (table === 'enterprises') cfg.filter = 'id=eq.' + docId;
      else if (table === 'sessions') cfg.filter = 'enterprise_id=eq.' + parentId;
      else if (table === 'backups') cfg.filter = 'enterprise_id=eq.' + parentId;
      else if (table === 'license_keys') cfg.filter = 'code=eq.' + docId;
      channel = sb.channel('mdb-' + table + '-' + parentId + '-' + docId).on(
        'postgres_changes', cfg,
        function(payload) {
          if (stopped) return;
          try {
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
      return sb.from('enterprises').delete().eq('id', this.id).then(function(r) { if (r.error) throw r.error; });
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
    getAllEnterprises: function() { return sb.from('enterprises').select('*'); }
  };

  /* Référence canonique : un nom dédié que le code applicatif ne peut pas écraser */
  window.__MDB_ADAPTER__ = adapter;
  window.firebaseDb = adapter;

  window.firebase_firestore_FieldValue_delete = FV_DELETE;
  window.SB_genUid = genUid;
  window.SB_ready = true;

  console.log('[MDB] Adaptateur Supabase prêt (' + SUPABASE_URL + ')');
})();
