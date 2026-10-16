'use strict';
/* =====================================================================
   tests/06-split.js
   Decoupage anti-timeouts : 1 ligne par rubrique dans enterprise_data
   au lieu du dossier entier (2,5 Mo) dans enterprises.data.

   On stubbe le client Supabase (en memoire) et on charge le VRAI
   adaptateur public/supabase-sdk/mdb-supabase.js dans un contexte isole.
   Puis on controle le VRAI production.html (helpers de transport).

   Etape asynchrone : run() rend une promesse (supportee par run.js).
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chargerApp, storeRealiste } = require('./lib/sandbox.js');

const ADAPTATEUR = path.join(__dirname, '..', 'public', 'supabase-sdk', 'mdb-supabase.js');

/* ---------- Faux Supabase en memoire ---------- */
function creerFauxSupabase(tables, options) {
  const opt = options || {};
  const appels = { upsert: [], rpc: [], select: [], delete: [], update: [] };
  const manquantes = opt.tablesManquantes || new Set();

  function reponseSucces(donnees) { return { data: donnees, error: null }; }
  function reponseTableManquante(t) {
    return { data: null, error: { code: '42P01', message: 'relation "public.' + t + '" does not exist', details: '', hint: '' } };
  }

  function Requete(table, op) {
    this._table = table;
    this._op = op;           /* select | upsert | delete | update */
    this._payload = null;
    this._cols = '*';
    this._filtres = [];
    this._limite = null;
    this._conflit = null;
  }
  Requete.prototype.select = function (c) { this._cols = c; return this; };
  Requete.prototype.eq = function (c, v) { this._filtres.push({ op: 'eq', c: c, v: v }); return this; };
  Requete.prototype.in = function (c, vs) { this._filtres.push({ op: 'in', c: c, v: vs }); return this; };
  Requete.prototype.like = function (c, motif) { this._filtres.push({ op: 'like', c: c, v: motif }); return this; };
  Requete.prototype.limit = function (n) { this._limite = n; return this; };
  Requete.prototype.order = function () { return this; };
  function correspond(ligne, f) {
    if (f.op === 'eq') return String(ligne[f.c]) === String(f.v);
    if (f.op === 'in') return f.v.map(String).indexOf(String(ligne[f.c])) !== -1;
    if (f.op === 'like') {
      const motif = '^' + String(f.v).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$';
      return new RegExp(motif).test(String(ligne[f.c] || ''));
    }
    return true;
  }
  Requete.prototype.executer = function () {
    const self = this;
    if (manquantes.has(self._table)) {
      if (self._op === 'select') appels.select.push({ table: self._table, cols: self._cols });
      return reponseTableManquante(self._table);
    }
    if (self._op === 'select') {
      appels.select.push({ table: self._table, cols: self._cols });
      let lignes = (tables[self._table] || []).filter(function (l) {
        return self._filtres.every(function (f) { return correspond(l, f); });
      });
      if (self._limite !== null) lignes = lignes.slice(0, self._limite);
      if (self._cols !== '*') {
        const cols = String(self._cols).split(',').map(function (c) { return c.trim(); });
        lignes = lignes.map(function (l) {
          const o = {};
          cols.forEach(function (c) { o[c] = l[c]; });
          return o;
        });
      }
      return reponseSucces(JSON.parse(JSON.stringify(lignes)));
    }
    if (self._op === 'upsert') {
      appels.upsert.push({ table: self._table, lignes: self._payload, conflit: self._conflit });
      const sac = tables[self._table] || (tables[self._table] = []);
      const pk = self._table === 'enterprise_data' ? ['enterprise_id', 'cle']
        : self._table === 'enterprises' ? ['id'] : null;
      self._payload.forEach(function (pl) {
        let idx = -1;
        if (pk) {
          for (let i = 0; i < sac.length; i++) {
            if (pk.every(function (k) { return String(sac[i][k]) === String(pl[k]); })) { idx = i; break; }
          }
        }
        if (idx === -1) sac.push(JSON.parse(JSON.stringify(pl)));
        else sac[idx] = Object.assign({}, sac[idx], JSON.parse(JSON.stringify(pl)));
      });
      return reponseSucces([]);
    }
    if (self._op === 'delete') {
      appels.delete.push({ table: self._table });
      tables[self._table] = (tables[self._table] || []).filter(function (l) {
        return !self._filtres.every(function (f) { return correspond(l, f); });
      });
      return reponseSucces([]);
    }
    return reponseSucces([]);
  };
  Requete.prototype.then = function (res, rej) {
    try { return Promise.resolve(this.executer()).then(res, rej); }
    catch (e) { return Promise.reject(e).then(res, rej); }
  };

  const client = {
    from: function (table) {
      return {
        select: function (c) { const r = new Requete(table, 'select'); return r.select(c); },
        upsert: function (lignes, o) {
          const r = new Requete(table, 'upsert');
          r._payload = Array.isArray(lignes) ? lignes : [lignes];
          r._conflit = o && o.onConflict;
          return r;
        },
        insert: function (lignes) {
          const r = new Requete(table, 'upsert');
          r._payload = Array.isArray(lignes) ? lignes : [lignes];
          return r;
        },
        delete: function () { return new Requete(table, 'delete'); },
        update: function (v) {
          const r = new Requete(table, 'update');
          r._payload = v;
          return { eq: function () { return r; }, then: function (a, b) { return Promise.resolve(reponseSucces([])).then(a, b); } };
        }
      };
    },
    rpc: function (nom, args) {
      appels.rpc.push({ nom: nom, args: args });
      if (nom === 'mdb_upsert_enterprise') {
        /* Vieux comportement serveur : fusionne p_data dans la ligne. */
        const sac = tables.enterprises || (tables.enterprises = []);
        let ligne = sac.find(function (l) { return String(l.id) === String(args.p_id); });
        if (!ligne) { ligne = { id: args.p_id }; sac.push(ligne); }
        ligne.data = Object.assign({}, ligne.data, args.p_data);
        if (args.p_identifiant) ligne.identifiant = args.p_identifiant;
        if (args.p_email) ligne.email = args.p_email;
        if (args.p_nom) ligne.nom = args.p_nom;
        return Promise.resolve(reponseSucces([]));
      }
      return Promise.resolve(reponseSucces([]));
    },
    channel: function () {
      return { on: function () { return { subscribe: function () {} }; } };
    },
    removeChannel: function () {}
  };
  return { client: client, appels: appels, tables: tables };
}

function chargerAdaptateur(faux) {
  const bac = {
    supabase: { createClient: function () { return faux.client; } },
    window: {},
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    Date: Date,
    JSON: JSON,
    Object: Object,
    Math: Math
  };
  const code = fs.readFileSync(ADAPTATEUR, 'utf8');
  vm.runInNewContext(code, bac, { filename: 'mdb-supabase.js' });
  return bac.window.__MDB_ADAPTER__;
}

function egal(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function attendre(ms) {
  return new Promise(function (res) { setTimeout(res, ms); });
}

async function run(rapport) {
  rapport.section('6. Decoupage enterprise_data (anti timeouts)');

  /* ---------- 1. Ecriture : cles entieres + sections mdb_paye ---------- */
  try {
    const faux = creerFauxSupabase({ enterprises: [], enterprise_data: [] });
    const ad = chargerAdaptateur(faux);
    const doc = {
      identifiant: 'ENT1', nom: 'Test',
      mdb_clients: [{ id: 'c1', nom: 'Cli' }],
      mdb_paye: { pointage: [{ id: 'p1', heures: 8 }], primes: [{ id: 'pr1' }] }
    };
    await ad.collection('enterprises').doc('ENT1').set(doc, { merge: true });
    const cles = faux.tables.enterprise_data.map(function (l) { return l.cle; });
    /* identifiant/nom voyagent aussi en lignes (doc re-assemble a l'identique
       de l'ancien) + sentinelle posee en dernier par l'ecriture */
    const sansSent = cles.filter(function (c) { return c !== '__split_migration_ok'; });
    if (egal(sansSent.sort(), ['identifiant', 'nom', 'mdb_clients', 'mdb_paye.pointage', 'mdb_paye.primes'].sort()) &&
        cles.indexOf('__split_migration_ok') !== -1) {
      rapport.ok('ecriture decoupee : cles + sections mdb_paye (' + sansSent.join(', ') + ')');
    } else {
      rapport.ko('ecriture decoupee : cles inattendues ' + JSON.stringify(cles));
    }
    const ident = faux.tables.enterprises.find(function (l) { return l.id === 'ENT1'; });
    if (ident && ident.identifiant === 'ENT1' && ident.updated_at) {
      rapport.ok('identite + updated_at leger sur enterprises (sondes OK)');
    } else {
      rapport.ko('identite enterprises manquante : ' + JSON.stringify(ident));
    }
    const det = ad.__splitInternals.splitEstTableManquante;
    if (typeof ad.__splitEtat === 'function' &&
        det({ code: 'PGRST205', message: 'Could not find the table public.enterprise_data in the schema cache' }) === true &&
        det({ code: '57014', message: 'canceling statement due to statement timeout' }) === false) {
      rapport.ok('diagnostic __splitEtat + detection PGRST205 (sans confondre avec timeout)');
    } else {
      rapport.ko('diagnostic/detection PGRST205 inattendus');
    }

    /* ---------- 2. Lecture : re-assemble a l'identique ---------- */
    const snap = await ad.collection('enterprises').doc('ENT1').get();
    const d = snap.data();
    if (snap.exists && egal(d, doc) && snap._split === true) {
      rapport.ok('lecture re-assemblee a l\'identique (doc complet, _split=true)');
    } else {
      rapport.ko('lecture : document different ' + JSON.stringify(d));
    }
  } catch (e) { rapport.ko('ecriture/lecture decoupee : exception ' + (e && e.message)); }

  /* ---------- 3. Migration legacy -> decoupe (sans ecraser le frais) ---------- */
  try {
    const faux = creerFauxSupabase({
      enterprises: [{ id: 'E9', identifiant: 'VIEUX', data: {
        mdb_clients: [{ id: 'c9' }],
        mdb_paye: { pointage: [{ id: 'p9' }] }
      } }],
      enterprise_data: [
        /* ecriture fraiche posterieure au legacy : ne doit pas etre ecrasee */
        { enterprise_id: 'E9', cle: 'mdb_paye.primes', data: [{ id: 'frais' }], updated_at: 'x' }
      ]
    });
    const ad = chargerAdaptateur(faux);
    const snap = await ad.collection('enterprises').doc('E9').get();
    const legacyOk = snap.exists && egal(snap.data().mdb_clients, [{ id: 'c9' }]);
    await attendre(150);
    const cles = faux.tables.enterprise_data.map(function (l) { return l.cle; });
    const frais = faux.tables.enterprise_data.find(function (l) { return l.cle === 'mdb_paye.primes'; });
    if (legacyOk && cles.indexOf('mdb_clients') !== -1 &&
        cles.indexOf('mdb_paye.pointage') !== -1 &&
        cles.indexOf('__split_migration_ok') !== -1 &&
        frais && egal(frais.data, [{ id: 'frais' }])) {
      rapport.ok('migration : legacy lu + cles migrees + frais preserve + sentinelle');
    } else {
      rapport.ko('migration : legacy=' + legacyOk + ' cles=' + JSON.stringify(cles));
    }
  } catch (e) { rapport.ko('migration : exception ' + (e && e.message)); }

  /* ---------- 4. Repli legacy si table absente ---------- */
  try {
    const faux = creerFauxSupabase(
      { enterprises: [], enterprise_data: [] },
      { tablesManquantes: new Set(['enterprise_data']) }
    );
    const ad = chargerAdaptateur(faux);
    await ad.collection('enterprises').doc('X').set({ mdb_clients: [{ id: 'c' }] }, { merge: true });
    const rpc = faux.appels.rpc.find(function (a) { return a.nom === 'mdb_upsert_enterprise'; });
    if (rpc && faux.tables.enterprise_data.length === 0) {
      rapport.ok('repli legacy : RPC appelee quand enterprise_data absente');
    } else {
      rapport.ko('repli legacy : RPC=' + !!rpc + ' lignes=' + faux.tables.enterprise_data.length);
    }
    const snap = await ad.collection('enterprises').doc('X').get();
    if (snap.exists && egal(snap.data().mdb_clients, [{ id: 'c' }]) && snap._split !== true) {
      rapport.ok('repli legacy : lecture relit le chemin historique');
    } else {
      rapport.ko('repli legacy : lecture inattendue');
    }
  } catch (e) { rapport.ko('repli legacy : exception ' + (e && e.message)); }

  /* ---------- 5. Suppression + liste allegee ---------- */
  try {
    const faux = creerFauxSupabase({
      enterprises: [{ id: 'DEL' }],
      enterprise_data: [{ enterprise_id: 'DEL', cle: 'mdb_clients', data: [] }]
    });
    const ad = chargerAdaptateur(faux);
    await ad.collection('enterprises').doc('DEL').delete();
    if (faux.tables.enterprise_data.length === 0 && faux.tables.enterprises.length === 0) {
      rapport.ok('suppression : lignes + identite effacees');
    } else {
      rapport.ko('suppression : restes ' + faux.tables.enterprise_data.length + '/' + faux.tables.enterprises.length);
    }
    await ad.getAllEnterprises();
    const dernierSelect = faux.appels.select[faux.appels.select.length - 1];
    const sel = dernierSelect ? dernierSelect.cols : '';
    if (sel.indexOf('*') === -1 && sel.indexOf('identifiant') !== -1) {
      rapport.ok('getAllEnterprises allege : "' + sel + '" (plus de data *)');
    } else {
      rapport.ko('getAllEnterprises : colonnes=' + sel);
    }
  } catch (e) { rapport.ko('suppression : exception ' + (e && e.message)); }

  /* ---------- 6. Helpers production.html ---------- */
  try {
    const h = chargerApp('production.html', storeRealiste());
    const res = String(vm.runInContext(`
      (function () {
        var asm = prodSplitAssemble([
          { cle: 'mdb_production.articles', data: [{ id: 'a1' }] },
          { cle: 'mdb_production.__prodUpdatedAt', data: 123 },
          { cle: 'mdb_dettesFournisseurs', data: [{ id: 'd1' }] },
          { cle: '__split_migration_ok', data: { v: 1 } }
        ], 'mdb_production');
        var okAsm = asm.articles && asm.articles.length === 1 && asm.__prodUpdatedAt === 123;
        var okMiss = prodSplitEstTableManquante({ code: '42P01', message: 'x' }) === true
          && prodSplitEstTableManquante({ message: 'relation "public.enterprise_data" does not exist' }) === true
          && prodSplitEstTableManquante({ code: 'PGRST205', message: 'Could not find the table public.enterprise_data in the schema cache' }) === true
          && prodSplitEstTableManquante({ message: 'timeout' }) === false;
        return (okAsm && okMiss) ? 'OK : assemble + detecte table manquante' : 'ECHEC asm=' + okAsm + ' miss=' + okMiss;
      })()
    `, h.ctx)).trim();
    if (res.indexOf('OK') === 0) rapport.ok('production.html : ' + res);
    else rapport.ko('production.html : ' + res);
  } catch (e) { rapport.ko('production.html : exception ' + e.message); }
}

module.exports = { run };
