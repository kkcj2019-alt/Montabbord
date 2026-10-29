'use strict';
/* =====================================================================
   tests/10-multiposte.js
   Synchro blindee : deux (ou trois) postes qui travaillent en meme temps
   sur le MEME dossier ne doivent jamais s'ecraser.

   On charge le VRAI adaptateur public/supabase-sdk/mdb-supabase.js une fois
   PAR POSTE (chacun avec son propre localStorage), tous branches sur le meme
   faux serveur en memoire, qui reproduit le comportement reel qui compte :
   ecriture conditionnelle (compare-and-set sur updated_at), insertion qui
   refuse un doublon, evenements temps reel.
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ADAPTATEUR = path.join(__dirname, '..', 'public', 'supabase-sdk', 'mdb-supabase.js');

function creerServeur() {
  const tables = { enterprises: [], enterprise_data: [] };
  const journal = { selects: [], updates: 0, inserts: 0, upserts: 0 };
  const canaux = [];
  let horloge = 1000;
  const ts = function () { horloge += 1; return '2026-10-24T05:00:00.' + String(horloge).padStart(6, '0') + '+00:00'; };

  function ok(d) { return { data: d, error: null }; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function Req(table, op) { this.t = table; this.op = op; this.f = []; this.cols = '*'; this.lim = null; this.payload = null; this.ret = false; }
  Req.prototype.select = function (c) { if (this.op === 'select') this.cols = c; else { this.ret = true; this.cols = c; } return this; };
  Req.prototype.eq = function (c, v) { this.f.push(['eq', c, v]); return this; };
  Req.prototype.in = function (c, v) { this.f.push(['in', c, v]); return this; };
  Req.prototype.like = function (c, v) { this.f.push(['like', c, v]); return this; };
  Req.prototype.limit = function (n) { this.lim = n; return this; };
  Req.prototype.order = function () { return this; };
  function match(l, f) {
    if (f[0] === 'eq') return String(l[f[1]]) === String(f[2]);
    if (f[0] === 'in') return f[2].map(String).indexOf(String(l[f[1]])) !== -1;
    if (f[0] === 'like') return new RegExp('^' + String(f[2]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$').test(String(l[f[1]]));
    return true;
  }
  function proj(rows, cols) {
    if (cols === '*') return rows;
    const cs = cols.split(',').map(function (c) { return c.trim(); });
    return rows.map(function (r) { const o = {}; cs.forEach(function (c) { o[c] = r[c]; }); return o; });
  }
  Req.prototype.run = function () {
    const sac = tables[this.t] || (tables[this.t] = []);
    const self = this;
    if (this.op === 'select') {
      journal.selects.push({ table: this.t, cols: this.cols, filtres: this.f.map(function (x) { return x.slice(); }) });
      let r = sac.filter(function (l) { return self.f.every(function (f) { return match(l, f); }); });
      if (this.lim !== null) r = r.slice(0, this.lim);
      return ok(clone(proj(r, this.cols)));
    }
    if (this.op === 'update') {
      journal.updates++;
      const touchees = [];
      sac.forEach(function (l) {
        if (self.f.every(function (f) { return match(l, f); })) {
          Object.assign(l, clone(self.payload));
          touchees.push(l);
          diffuser(self.t, 'UPDATE', l);
        }
      });
      return ok(self.ret ? clone(proj(touchees, this.cols)) : []);
    }
    if (this.op === 'insert') {
      journal.inserts++;
      const nouvelles = [];
      for (const p of this.payload) {
        const dup = sac.some(function (l) { return l.enterprise_id === p.enterprise_id && l.cle === p.cle; });
        if (dup) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        sac.push(clone(p)); nouvelles.push(p);
        diffuser(this.t, 'INSERT', p);
      }
      return ok(this.ret ? clone(proj(nouvelles, this.cols)) : []);
    }
    if (this.op === 'upsert') {
      journal.upserts++;
      for (const p of this.payload) {
        const pk = this.t === 'enterprise_data' ? ['enterprise_id', 'cle'] : ['id'];
        const i = sac.findIndex(function (l) { return pk.every(function (k) { return String(l[k]) === String(p[k]); }); });
        if (i === -1) sac.push(clone(p)); else Object.assign(sac[i], clone(p));
        if (this.t === 'enterprise_data') diffuser(this.t, 'UPDATE', p);
      }
      return ok([]);
    }
    if (this.op === 'delete') {
      tables[this.t] = sac.filter(function (l) { return !self.f.every(function (f) { return match(l, f); }); });
      return ok([]);
    }
    return ok([]);
  };
  Req.prototype.then = function (a, b) {
    try { return Promise.resolve(this.run()).then(a, b); } catch (e) { return Promise.reject(e).then(a, b); }
  };
  /* Comme le vrai client (et le builder D1) : upsert(...).catch(...) */
  Req.prototype.catch = function (b) {
    try { return Promise.resolve(this.run()).then(undefined, b); } catch (e) { return Promise.reject(e).then(undefined, b); }
  };
  Req.prototype.finally = function (fn) {
    try { return Promise.resolve(this.run()).finally(fn); } catch (e) { return Promise.reject(e).finally(fn); }
  };
  function diffuser(table, type, ligne) {
    canaux.forEach(function (c) {
      if (c.cfg && c.cfg.table === table) c.cb({ eventType: type, new: clone(ligne), old: {} });
    });
  }

  function client() {
    return {
      from: function (t) {
        return {
          select: function (c) { const r = new Req(t, 'select'); r.cols = c; return r; },
          update: function (v) { const r = new Req(t, 'update'); r.payload = v; return r; },
          insert: function (l) { const r = new Req(t, 'insert'); r.payload = Array.isArray(l) ? l : [l]; return r; },
          upsert: function (l) { const r = new Req(t, 'upsert'); r.payload = Array.isArray(l) ? l : [l]; return r; },
          delete: function () { return new Req(t, 'delete'); }
        };
      },
      rpc: function () { return Promise.resolve(ok([])); },
      channel: function () {
        const c = { cfg: null, cb: null };
        const api = {
          on: function (type, cfg, cb) { c.cfg = cfg; c.cb = cb; canaux.push(c); return api; },
          subscribe: function (f) { try { f && f('SUBSCRIBED'); } catch (e) {} return api; }
        };
        return api;
      },
      removeChannel: function () {}
    };
  }
  /* Le serveur horodate les ecritures (comme un defaut/trigger Postgres) */
  const brut = Req.prototype.run;
  Req.prototype.run = function () {
    if ((this.op === 'update' || this.op === 'insert' || this.op === 'upsert') && this.t === 'enterprise_data') {
      const lignes = this.op === 'update' ? [this.payload] : this.payload;
      lignes.forEach(function (l) { l.updated_at = ts(); });
    }
    return brut.call(this);
  };
  return { tables: tables, journal: journal, client: client, canaux: canaux };
}

function creerPoste(serveur, tombstones) {
  const stock = {};
  if (tombstones) stock.mdb_tombstones = JSON.stringify(tombstones);
  const bac = {
    supabase: { createClient: function () { return serveur.client(); } },
    window: {},
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(stock, k) ? stock[k] : null; },
      setItem: function (k, v) { stock[k] = String(v); },
      removeItem: function (k) { delete stock[k]; }
    },
    console: { log: function () {}, warn: function () {}, error: function () {} },
    setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; },
    Promise: Promise, Date: Date, JSON: JSON, Object: Object, Math: Math, Array: Array, String: String,
    Number: Number, Error: Error, parseInt: parseInt, isNaN: isNaN, RegExp: RegExp
  };
  vm.runInNewContext(fs.readFileSync(ADAPTATEUR, 'utf8'), bac, { filename: 'mdb-supabase.js' });
  const ad = bac.window.__MDB_ADAPTER__;
  const doc = function () { return ad.collection('enterprises').doc('E1'); };
  return {
    ad: ad, win: bac.window, stock: stock,
    ecrire: function (data) { return doc().set(data, { merge: true }); },
    lire: async function () { return (await doc().get()).data(); },
    ecouter: function (cb) { return doc().onSnapshot(cb); }
  };
}

function ligne(serveur, cle) {
  const l = serveur.tables.enterprise_data.find(function (x) { return x.cle === cle; });
  return l ? l.data : undefined;
}
function ids(a) { return (a || []).map(function (x) { return x.id; }).sort().join(','); }
function attendre(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function rec(id, v) { return { id: id, v: v === undefined ? 0 : v }; }

async function run(rapport) {
  rapport.section('10. Synchro blindee : plusieurs postes en meme temps');

  async function cas(nom, fn) {
    try { await fn(); } catch (e) { rapport.ko(nom + ' : exception ' + (e && e.stack || e)); }
  }

  /* Prepare un serveur avec une liste partagee deja connue des deux postes */
  async function deuxPostes(liste, tombA, tombB) {
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_x', data: liste, updated_at: '2026-10-24T04:00:00.000000+00:00' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: '__split_migration_ok', data: { v: 1 }, updated_at: 'x' });
    const A = creerPoste(serveur, tombA), B = creerPoste(serveur, tombB);
    await A.ecrire({ mdb_x: liste }); /* etablit la base de chaque poste */
    await B.ecrire({ mdb_x: liste });
    return { serveur: serveur, A: A, B: B };
  }

  await cas('ajouts croises', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1'), rec('a2')]);
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2'), rec('a3')] });
    await B.ecrire({ mdb_x: [rec('a1'), rec('a2'), rec('b3')] }); /* B ne connait pas a3 */
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'a1,a2,a3,b3') rapport.ok('deux postes ajoutent en meme temps : les DEUX saisies sont conservees (' + r + ')');
    else rapport.ko('ajouts croises : perte de saisie, serveur = ' + r);
  });

  await cas('modifications de lignes differentes', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1', 0), rec('a2', 0)]);
    await A.ecrire({ mdb_x: [rec('a1', 11), rec('a2', 0)] });
    await B.ecrire({ mdb_x: [rec('a1', 0), rec('a2', 22)] }); /* B n'a pas vu la modif de A sur a1 */
    const l = ligne(serveur, 'mdb_x');
    const a1 = l.find(function (x) { return x.id === 'a1'; }), a2 = l.find(function (x) { return x.id === 'a2'; });
    if (a1.v === 11 && a2.v === 22) rapport.ok('modifs de lignes differentes : chacune garde sa valeur (a1=11 par A, a2=22 par B)');
    else rapport.ko('modifs croisees : a1=' + a1.v + ' a2=' + a2.v);
  });

  await cas('meme ligne modifiee : le dernier arrive gagne', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1', 0)]);
    await A.ecrire({ mdb_x: [rec('a1', 5)] });
    await B.ecrire({ mdb_x: [rec('a1', 9)] });
    const v = ligne(serveur, 'mdb_x')[0].v;
    if (v === 9) rapport.ok('meme ligne modifiee des deux cotes : la derniere ecriture gagne, sans doublon');
    else rapport.ko('meme ligne : v=' + v);
  });

  await cas('suppression volontaire honoree', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1'), rec('a2'), rec('a3')]);
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2'), rec('a3'), rec('a4')] });
    await B.ecrire({ mdb_x: [rec('a1'), rec('a3')] }); /* B supprime a2 */
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'a1,a3,a4') rapport.ok('une suppression volontaire est respectee ET l\'ajout de l\'autre poste est garde (' + r + ')');
    else rapport.ko('suppression : serveur = ' + r);
  });

  await cas('suppression contre modification', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1', 0), rec('a2', 0)]);
    await A.ecrire({ mdb_x: [rec('a1', 7), rec('a2', 0)] }); /* A modifie a1 */
    await B.ecrire({ mdb_x: [rec('a2', 0)] });               /* B supprime a1 sans connaitre la modif */
    const l = ligne(serveur, 'mdb_x');
    const a1 = l.find(function (x) { return x.id === 'a1'; });
    if (a1 && a1.v === 7) rapport.ok('supprimee par l\'un mais modifiee par l\'autre : on garde la ligne modifiee (rien ne se perd)');
    else rapport.ko('suppression vs modification : ' + JSON.stringify(l));
  });

  await cas('ligne ressuscitee refusee quand supprimee volontairement (tombstone)', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1'), rec('a2')], null, { mdb_x: { a2: Date.now() } });
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2'), rec('a3')] });
    await B.ecrire({ mdb_x: [rec('a1'), rec('b4')] }); /* B a supprime a2 volontairement */
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'a1,a3,b4') rapport.ok('suppression memorisee : la ligne ne revient pas, les ajouts des deux postes restent (' + r + ')');
    else rapport.ko('tombstone : serveur = ' + r);
  });

  await cas('fournisseur : copie perimee sans suppression volontaire', async function () {
    /* A cree F3 ; A recoit ensuite une copie perimee (autre fenetre) sans F3 et
       la renvoie : sans pierre tombale, F3 ne doit PAS disparaitre du serveur. */
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_fournisseurs', data: [rec('f1'), rec('f2')], updated_at: '2026-10-24T04:00:00.000000+00:00' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: '__split_migration_ok', data: { v: 1 }, updated_at: 'x' });
    const A = creerPoste(serveur);
    await A.ecrire({ mdb_fournisseurs: [rec('f1'), rec('f2')] });
    await A.ecrire({ mdb_fournisseurs: [rec('f1'), rec('f2'), rec('f3')] });
    await A.ecrire({ mdb_fournisseurs: [rec('f1'), rec('f2')] });
    const r1 = ids(ligne(serveur, 'mdb_fournisseurs'));
    const B = creerPoste(serveur, { mdb_fournisseurs: { f2: Date.now() } });
    await B.ecrire({ mdb_fournisseurs: [rec('f1'), rec('f2'), rec('f3')] });
    await B.ecrire({ mdb_fournisseurs: [rec('f1'), rec('f3')] });
    const r2 = ids(ligne(serveur, 'mdb_fournisseurs'));
    if (r1 === 'f1,f2,f3' && r2 === 'f1,f3') rapport.ok('fournisseur cree : une copie perimee ne l\'efface plus (' + r1 + '), une vraie suppression passe (' + r2 + ')');
    else rapport.ko('fournisseurs : apres copie perimee = ' + r1 + ' ; apres suppression = ' + r2);
  });

  await cas('poste neuf (sans base) n\'efface pas le serveur', async function () {
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_x', data: [rec('s1'), rec('s2'), rec('s3')], updated_at: '2026-10-24T04:00:00.000000+00:00' });
    const N = creerPoste(serveur);
    await N.ecrire({ mdb_x: [rec('n1')] });
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'n1,s1,s2,s3') rapport.ok('un poste qui vient de demarrer (liste incomplete) n\'efface pas les donnees du serveur (' + r + ')');
    else rapport.ko('poste neuf : serveur = ' + r);
  });

  await cas('garde-fou anti chute massive', async function () {
    const gros = []; for (let i = 0; i < 20; i++) gros.push(rec('g' + i));
    const { serveur, A } = await deuxPostes(gros);
    await A.ecrire({ mdb_x: [rec('g0'), rec('g1'), rec('g2'), rec('g3'), rec('g4')] }); /* 15 lignes disparaissent d'un coup */
    const n = ligne(serveur, 'mdb_x').length;
    const gard = A.win.MDB_SYNC && A.win.MDB_SYNC.garde;
    if (n === 20 && gard === 1) rapport.ok('une ecriture qui retirerait 15 lignes sur 20 sans suppression volontaire est refusee (20 conservees, garde-fou compte)');
    else rapport.ko('garde-fou : ' + n + ' lignes, garde=' + gard);
  });

  await cas('garde-fou : grosse suppression volontaire autorisee', async function () {
    const gros = []; for (let i = 0; i < 20; i++) gros.push(rec('g' + i));
    const t = {}; for (let i = 5; i < 20; i++) t['g' + i] = Date.now();
    const { serveur, A } = await deuxPostes(gros, { mdb_x: t });
    await A.ecrire({ mdb_x: [rec('g0'), rec('g1'), rec('g2'), rec('g3'), rec('g4')] });
    const n = ligne(serveur, 'mdb_x').length;
    if (n === 5) rapport.ok('une grosse suppression VOLONTAIRE (memorisee) passe normalement');
    else rapport.ko('suppression volontaire massive bloquee a tort : ' + n);
  });

  await cas('on n\'ecrit que ce qui change', async function () {
    const { serveur, A } = await deuxPostes([rec('a1')]);
    const avant = serveur.journal.updates + serveur.journal.inserts + serveur.journal.upserts;
    await A.ecrire({ mdb_x: [rec('a1')] }); /* identique */
    await A.ecrire({ mdb_x: [rec('a1')] });
    const apres = serveur.journal.updates + serveur.journal.inserts + serveur.journal.upserts;
    if (apres === avant) rapport.ok('ecriture identique a la precedente : aucune requete envoyee (moins de charge sur le serveur)');
    else rapport.ko('ecritures inutiles : ' + (apres - avant));
  });

  await cas('plusieurs rubriques : seule celle qui change part', async function () {
    const { serveur, A } = await deuxPostes([rec('a1')]);
    await A.ecrire({ mdb_x: [rec('a1')], mdb_y: [rec('y1')], mdb_z: { k: 1 } });
    const u0 = serveur.journal.updates, i0 = serveur.journal.inserts;
    await A.ecrire({ mdb_x: [rec('a1')], mdb_y: [rec('y1'), rec('y2')], mdb_z: { k: 1 } });
    const envoyees = (serveur.journal.updates - u0) + (serveur.journal.inserts - i0);
    if (envoyees === 1 && ids(ligne(serveur, 'mdb_y')) === 'y1,y2') rapport.ok('3 rubriques, 1 modifiee : 1 seule requete d\'ecriture');
    else rapport.ko('rubriques envoyees : ' + envoyees);
  });

  await cas('ecritures simultanees (vraie concurrence)', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    /* Les deux postes lancent leur ecriture AU MEME INSTANT, sans attendre l'autre */
    await Promise.all([
      A.ecrire({ mdb_x: [rec('a1'), rec('fromA1'), rec('fromA2')] }),
      B.ecrire({ mdb_x: [rec('a1'), rec('fromB1'), rec('fromB2')] })
    ]);
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'a1,fromA1,fromA2,fromB1,fromB2') rapport.ok('ecritures lancees exactement en meme temps : aucune perte (' + r + ')');
    else rapport.ko('concurrence : serveur = ' + r);
  });

  await cas('trois postes en rafale', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    const C = creerPoste(serveur);
    await C.ecrire({ mdb_x: [rec('a1')] });
    const lots = [];
    const mesLignes = { A: [rec('a1')], B: [rec('a1')], C: [rec('a1')] };
    for (let i = 0; i < 4; i++) {
      /* chaque poste garde SES lignes et ne voit jamais celles des autres (pire cas) */
      mesLignes.A.push(rec('A' + i)); mesLignes.B.push(rec('B' + i)); mesLignes.C.push(rec('C' + i));
      lots.push(A.ecrire({ mdb_x: mesLignes.A.slice() }));
      lots.push(B.ecrire({ mdb_x: mesLignes.B.slice() }));
      lots.push(C.ecrire({ mdb_x: mesLignes.C.slice() }));
      await Promise.all(lots.splice(0));
    }
    const l = ligne(serveur, 'mdb_x');
    const r = ids(l);
    const tous = ['a1'].concat([0, 1, 2, 3].map(function (i) { return 'A' + i; }), [0, 1, 2, 3].map(function (i) { return 'B' + i; }), [0, 1, 2, 3].map(function (i) { return 'C' + i; })).sort().join(',');
    if (r === tous) rapport.ok('3 postes x 4 tours en rafale : les 13 lignes sont toutes presentes, aucune ecrasee');
    else rapport.ko('rafale : ' + r + ' (attendu ' + tous + ')');
  });

  await cas('tombstones : l\'union ne perd jamais une suppression', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    await A.ecrire({ mdb_tombstones: { mdb_x: { t1: 111 } } });
    await B.ecrire({ mdb_tombstones: { mdb_x: { t2: 222 } } });
    const t = ligne(serveur, 'mdb_tombstones');
    if (t && t.mdb_x && t.mdb_x.t1 === 111 && t.mdb_x.t2 === 222) rapport.ok('les listes de suppressions des deux postes sont fusionnees (t1 + t2)');
    else rapport.ko('tombstones : ' + JSON.stringify(t));
  });

  await cas('tombstones : remise a zero volontaire (restauration)', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    await A.ecrire({ mdb_tombstones: { mdb_x: { vieux: 100 } } });
    await B.ecrire({ mdb_tombstones: { __resetAt: 5000, mdb_x: { neuf: 6000 } } });
    const t = ligne(serveur, 'mdb_tombstones');
    if (t.__resetAt === 5000 && t.mdb_x.neuf === 6000 && !t.mdb_x.vieux) rapport.ok('remise a zero : les vieilles suppressions obsoletes tombent, les nouvelles restent');
    else rapport.ko('resetAt : ' + JSON.stringify(t));
  });

  await cas('objet partage (config) : champs de chacun fusionnes', async function () {
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_entreprise', data: { nom: 'ACSER', tel: '1' }, updated_at: '2026-10-24T04:00:00.000000+00:00' });
    const A = creerPoste(serveur), B = creerPoste(serveur);
    await A.ecrire({ mdb_entreprise: { nom: 'ACSER', tel: '1' } });
    await B.ecrire({ mdb_entreprise: { nom: 'ACSER', tel: '1' } });
    await A.ecrire({ mdb_entreprise: { nom: 'ACSER', tel: '2' } });
    await B.ecrire({ mdb_entreprise: { nom: 'ACSER SARL', tel: '1' } });
    const e = ligne(serveur, 'mdb_entreprise');
    if (e.nom === 'ACSER SARL' && e.tel === '2') rapport.ok('config : le telephone change par A et le nom change par B sont tous les deux gardes');
    else rapport.ko('config : ' + JSON.stringify(e));
  });

  await cas('pointages (section mdb_paye)', async function () {
    const serveur = creerServeur();
    const base = [{ id: 'p1', h: 8 }, { id: 'p2', h: 8 }];
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_paye.pointage', data: base, updated_at: '2026-10-24T04:00:00.000000+00:00' });
    const A = creerPoste(serveur), B = creerPoste(serveur);
    await A.ecrire({ mdb_paye: { pointage: base } });
    await B.ecrire({ mdb_paye: { pointage: base } });
    await A.ecrire({ mdb_paye: { pointage: base.concat([{ id: 'p3', h: 7 }]) } });
    await B.ecrire({ mdb_paye: { pointage: base.concat([{ id: 'p4', h: 6 }]) } });
    const r = ids(ligne(serveur, 'mdb_paye.pointage'));
    if (r === 'p1,p2,p3,p4') rapport.ok('pointages saisis en meme temps sur 2 postes : tous conserves (' + r + ')');
    else rapport.ko('pointages : ' + r);
  });

  await cas('temps reel : lecture ciblee + echo ignore', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_autre', data: [rec('o1')], updated_at: '2026-10-24T04:00:00.000000+00:00' });
    const recus = [];
    const stop = B.ecouter(function (snap) { recus.push(snap.data()); });
    await attendre(60);
    const initial = recus.length; /* premiere livraison complete */
    const selectsAvant = serveur.journal.selects.length;
    await A.ecrire({ mdb_x: [rec('a1'), rec('a9')] });
    await attendre(700);
    const apres = serveur.journal.selects.slice(selectsAvant);
    const ciblees = apres.filter(function (s) { return s.filtres.some(function (f) { return f[0] === 'in'; }); });
    const completes = apres.filter(function (s) { return s.table === 'enterprise_data' && !s.filtres.some(function (f) { return f[0] === 'in' || (f[0] === 'eq' && f[1] === 'cle'); }); });
    const dernier = recus[recus.length - 1];
    if (recus.length === initial + 1 && ids(dernier.mdb_x) === 'a1,a9' && ids(dernier.mdb_autre) === 'o1' && ciblees.length === 1 && completes.length === 0)
      rapport.ok('l\'autre poste recoit la saisie en < 1 s, en ne relisant QUE la rubrique modifiee (pas tout le dossier)');
    else rapport.ko('temps reel : livraisons=' + (recus.length - initial) + ' ciblees=' + ciblees.length + ' completes=' + completes.length + ' mdb_x=' + (dernier && ids(dernier.mdb_x)));
    /* echo de B sur sa propre ecriture : aucune relecture */
    const n0 = recus.length, s0 = serveur.journal.selects.length;
    await B.ecrire({ mdb_x: [rec('a1'), rec('a9'), rec('b7')] });
    await attendre(700);
    const echoRelu = serveur.journal.selects.slice(s0).filter(function (s) { return s.filtres.some(function (f) { return f[0] === 'in'; }); }).length;
    if (echoRelu === 0) rapport.ok('l\'echo de sa propre ecriture ne declenche aucune relecture');
    else rapport.ko('echo relu ' + echoRelu + ' fois');
    stop();
  });

  await cas('fusion : la page recoit le resultat fusionne', async function () {
    const { serveur, A, B } = await deuxPostes([rec('a1')]);
    const recus = [];
    const stop = B.ecouter(function (snap) { recus.push(snap.data()); });
    await attendre(60);
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2')] });
    await attendre(600);
    await B.ecrire({ mdb_x: [rec('a1'), rec('b2')] }); /* B ne connait pas a2 (base perimee) : fusion */
    await attendre(300);
    const dernier = recus[recus.length - 1];
    if (dernier && ids(dernier.mdb_x) === 'a1,a2,b2') rapport.ok('apres une fusion, la page de B recoit aussitot la liste complete (a1,a2,b2)');
    else rapport.ko('notification de fusion : ' + (dernier && ids(dernier.mdb_x)));
    stop();
  });

  await cas('erreur reseau : rien n\'est perdu, reprise ensuite', async function () {
    const { serveur, A } = await deuxPostes([rec('a1')]);
    const orig = serveur.client;
    let panne = true;
    const clientOrig = serveur.client;
    /* coupe l'ecriture le temps d'un essai */
    const A2 = creerPoste({ tables: serveur.tables, journal: serveur.journal, canaux: serveur.canaux, client: function () {
      const c = clientOrig();
      const from = c.from;
      c.from = function (t) {
        const o = from(t);
        const up = o.update;
        o.update = function (v) { if (panne) { return { eq: function () { return this; }, select: function () { return Promise.resolve({ data: null, error: { code: '500', message: 'Internal Server Error' } }); } }; } return up(v); };
        return o;
      };
      return c;
    } });
    let echoue = false;
    await A2.ecrire({ mdb_x: [rec('a1')] }).catch(function () { echoue = true; }); /* etablit la base : lecture + maj */
    panne = false;
    await A2.ecrire({ mdb_x: [rec('a1'), rec('z1')] });
    const r = ids(ligne(serveur, 'mdb_x'));
    if (r === 'a1,z1') rapport.ok('apres une panne du serveur, la meme saisie repart correctement (' + r + ')');
    else rapport.ko('reprise : ' + r + ' echec1=' + echoue);
  });

  await cas('stress 4 postes au hasard', async function () {
    let graine = 12345;
    const alea = function () { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_x', data: [rec('a1')], updated_at: '2026-10-24T04:00:00.000000+00:00' });
    const postes = [0, 1, 2, 3].map(function () { return creerPoste(serveur); });
    const vues = postes.map(function () { return [rec('a1')]; });
    const crees = { a1: true };
    let n = 0;
    for (let tour = 0; tour < 40; tour++) {
      const lot = [];
      postes.forEach(function (P, i) {
        if (alea() < 0.6) {
          const id = 'p' + i + '_' + (n++);
          crees[id] = true;
          vues[i].push(rec(id));
          /* parfois le poste se remet a jour depuis le serveur (comme une page qui recoit le temps reel) */
          lot.push(P.ecrire({ mdb_x: vues[i].slice() }).then(async function () {
            if (alea() < 0.3) { const d = await P.lire(); vues[i] = (d.mdb_x || []).slice(); }
          }));
        }
      });
      await Promise.all(lot);
    }
    const finale = ligne(serveur, 'mdb_x');
    const presents = {}; finale.forEach(function (x) { presents[x.id] = (presents[x.id] || 0) + 1; });
    const manquants = Object.keys(crees).filter(function (id) { return !presents[id]; });
    const doublons = Object.keys(presents).filter(function (id) { return presents[id] > 1; });
    if (!manquants.length && !doublons.length) rapport.ok('stress : 4 postes, 40 tours au hasard, ' + Object.keys(crees).length + ' saisies : aucune perdue, aucun doublon');
    else rapport.ko('stress : manquants=' + manquants.join(',') + ' doublons=' + doublons.join(','));
  });

  await cas('lecture differentielle : seules les rubriques changees sont retelechargees', async function () {
    const serveur = creerServeur();
    const gros = []; for (let i = 0; i < 500; i++) gros.push(rec('g' + i, i));
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: '__split_migration_ok', data: { v: 1 }, updated_at: 'x' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_gros', data: gros, updated_at: '2026-10-24T04:00:00.000001+00:00' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_x', data: [rec('a1')], updated_at: '2026-10-24T04:00:00.000002+00:00' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_y', data: [rec('y1')], updated_at: '2026-10-24T04:00:00.000003+00:00' });
    const A = creerPoste(serveur), B = creerPoste(serveur);
    await B.lire();                                   /* 1re lecture : complete */
    await A.lire();
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2')] }); /* A modifie une seule rubrique */
    const n0 = serveur.journal.selects.length;
    const d = await B.lire();
    const lus = serveur.journal.selects.slice(n0);
    const avecData = lus.filter(function (q) { return q.cols.indexOf('data') !== -1; });
    const cles = avecData.map(function (q) { const f = q.filtres.filter(function (x) { return x[0] === 'in'; })[0]; return f ? f[2].join('+') : 'TOUT'; }).join(',');
    const ok1 = ids(d.mdb_x) === 'a1,a2' && (d.mdb_gros || []).length === 500 && ids(d.mdb_y) === 'y1' && cles === 'mdb_x';
    /* une rubrique supprimee sur le serveur disparait aussi de la lecture */
    serveur.tables.enterprise_data = serveur.tables.enterprise_data.filter(function (l) { return l.cle !== 'mdb_y'; });
    serveur.tables.enterprise_data.forEach(function () {});
    const n1 = serveur.journal.selects.length;
    const d2 = await B.lire();
    const rien = serveur.journal.selects.slice(n1).filter(function (q) { return q.cols.indexOf('data') !== -1; }).length;
    /* la propre ecriture de A ne lui est pas retelechargee */
    const n2 = serveur.journal.selects.length;
    await A.lire();
    const echoL = serveur.journal.selects.slice(n2).filter(function (q) { return q.cols.indexOf('data') !== -1; }); const echoA = echoL.length;
    const ok2 = d2.mdb_y === undefined && (d2.mdb_gros || []).length === 500 && rien === 0;
    if (ok1 && ok2 && echoA === 0) rapport.ok('lecture differentielle : apres une modif de mdb_x, seul mdb_x est retelecharge (pas le gros dossier) ; suppression vue ; sa propre ecriture non relue');
    else rapport.ko('lecture differentielle : ' + JSON.stringify({ cles: cles, x: ids(d.mdb_x), gros: (d.mdb_gros || []).length, y2: d2.mdb_y, rien: rien, echoA: echoA }));
  });

  await cas('acompte recree depuis la caisse : un autre poste ne le re-efface pas', async function () {
    const serveur = creerServeur();
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: '__split_migration_ok', data: { v: 1 }, updated_at: 'x' });
    serveur.tables.enterprise_data.push({ enterprise_id: 'E1', cle: 'mdb_acomptesPrets', data: [{ id: 'B0' }], updated_at: '2026-10-24T04:00:00.000001+00:00' });
    const A = creerPoste(serveur, { mdb_acomptesPrets: { A1: Date.now(), A9: Date.now() } });
    A.stock.mdb_operationsCaisse = JSON.stringify([{ id: 'OP1', apType: 'acompte', acomptePretId: 'A1' }, { id: 'OP2', code: 'SOLDE_SALAIRE' }, { id: 'OPF', code: 'com', acomptePretId: 'A9' }]);
    await A.ecrire({ mdb_acomptesPrets: [{ id: 'B0' }] });          /* base de A */
    /* la Paie (autre poste) recree A1 (piece OP1), A2 (piece OP2, lien perdu) et A9 (sans piece) */
    const l = serveur.tables.enterprise_data.find(function (x) { return x.cle === 'mdb_acomptesPrets'; });
    l.data = [{ id: 'B0' }, { id: 'A1', caisseOpId: 'OP1' }, { id: 'A2', caisseOpId: 'OP2' }, { id: 'A9', caisseOpId: 'OPX' }]; l.updated_at = '2026-10-24T04:00:00.000009+00:00';
    const t = JSON.parse(A.stock.mdb_tombstones); t.mdb_acomptesPrets.A2 = Date.now(); A.stock.mdb_tombstones = JSON.stringify(t);
    await A.ecrire({ mdb_acomptesPrets: [{ id: 'B0', v: 1 }] });    /* A modifie sans connaitre les recrees */
    const r = ids(ligne(serveur, 'mdb_acomptesPrets'));
    if (r === 'A1,A2,B0') rapport.ok('acomptes recrees depuis une piece de caisse existante gardes malgre une ancienne suppression ; sans piece : suppression respectee (' + r + ')');
    else rapport.ko('acomptes recrees re-effaces : serveur = ' + r);
  });

  await cas('journal des ecritures', async function () {
    const { A } = await deuxPostes([rec('a1')]);
    await A.ecrire({ mdb_x: [rec('a1'), rec('a2')] });
    const j = A.win.mdbSyncJournal();
    if (Array.isArray(j) && j.some(function (e) { return e.cle === 'mdb_x' && e.apres === 2; })) rapport.ok('le journal garde la trace des ecritures (rubrique, avant/apres)');
    else rapport.ko('journal vide ou incomplet : ' + JSON.stringify(j).slice(0, 200));
  });
}

module.exports = { run: run, creerServeur: creerServeur };
