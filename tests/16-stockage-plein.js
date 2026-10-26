'use strict';
/* tests/16-stockage-plein.js — telephone au stockage plein : les pages ne
   doivent jamais relire une copie perimee (soldes/totaux faux). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE = path.join(__dirname, '..', 'public', 'js', 'stockage-memoire.js');

function navigateur(quota) {
  function Storage() { this._d = {}; }
  function taille(d) { let n = 0; for (const k in d) n += k.length + d[k].length; return n; }
  Storage.prototype.setItem = function (k, v) {
    const d = Object.assign({}, this._d); d[k] = String(v);
    if (taille(d) > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
    this._d[k] = String(v);
  };
  Storage.prototype.getItem = function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; };
  Storage.prototype.removeItem = function (k) { delete this._d[k]; };
  Storage.prototype.clear = function () { this._d = {}; };
  Storage.prototype.key = function (i) { return Object.keys(this._d)[i] || null; };
  Object.defineProperty(Storage.prototype, 'length', { get: function () { return Object.keys(this._d).length; } });
  const ls = new Storage();
  const win = { Storage: Storage, localStorage: ls };
  vm.runInNewContext(fs.readFileSync(MODULE, 'utf8'), { window: win, String: String, Date: Date, Object: Object, Math: Math, console: { warn: function () {}, log: function () {} } });
  return win;
}

function run(rapport) {
  rapport.section('16. Telephone au stockage plein');
  const w = navigateur(1000);
  const ls = w.localStorage;
  ls.setItem('mdb_acomptesPrets', JSON.stringify([{ id: 'a1', montant: 100 }]));     /* ancienne copie */
  ls.setItem('mdb_backup_1', 'x'.repeat(300));                                         /* copie de securite */
  ls.setItem('mdb_paye', 'y'.repeat(400));
  /* 1. Plus de place : la copie de securite est sacrifiee, la donnee passe */
  const v2 = JSON.stringify([{ id: 'a1', montant: 100 }, { id: 'a2', montant: 200 }]) + ' '.repeat(250);
  let erreur1 = null;
  try { ls.setItem('mdb_acomptesPrets', v2); } catch (e) { erreur1 = e; }
  const ok1 = !erreur1 && ls.getItem('mdb_acomptesPrets') === v2 && ls.getItem('mdb_backup_1') === null;
  /* 2. Vraiment plein : l'ecriture echoue (la page est prevenue) mais la relecture donne la valeur a jour */
  const v3 = 'z'.repeat(900);
  let erreur2 = null;
  try { ls.setItem('mdb_acomptesPrets', v3); } catch (e) { erreur2 = e; }
  const ok2 = !!erreur2 && erreur2.name === 'QuotaExceededError' && ls.getItem('mdb_acomptesPrets') === v3;
  /* 3. Place liberee : l'ecriture suivante passe et la memoire est videe */
  ls.removeItem('mdb_paye');
  ls.setItem('mdb_acomptesPrets', 'petit');
  const ok3 = ls.getItem('mdb_acomptesPrets') === 'petit' && !Object.keys(w.__mdbStockageMemoire.cles).length;
  /* 4. Une copie de securite ne prend jamais la place d'une donnee */
  let e4 = null; try { ls.setItem('mdb_backup_2', 'b'.repeat(2000)); } catch (e) { e4 = e; }
  const ok4 = !!e4 && ls.getItem('mdb_backup_2') === null;
  if (ok1 && ok2 && ok3 && ok4) rapport.ok('stockage plein : vieilles copies de securite purgees d\'abord ; sinon valeur gardee en memoire et relue a jour (plus de solde/total perime) ; retour a la normale quand la place revient');
  else rapport.ko('stockage plein : ' + JSON.stringify({ ok1: ok1, ok2: ok2, ok3: ok3, ok4: ok4, e1: erreur1 && erreur1.message }));
  /* 5. Donnees reelles plus grosses que la place : compression automatique */
  const { storeRealiste } = require('./lib/sandbox.js');
  const base = storeRealiste();
  const gros = {};
  /* rubriques volumineuses fabriquees (pointage, caisse) : ~1,5 M caracteres */
  const pt = []; for (let i = 0; i < 4000; i++) pt.push({ id: 'p' + i, date: '2026-10-' + String(1 + i % 28).padStart(2, '0'), employee_id: 'e' + (i % 45), present: i % 7 !== 0, h_j_manual: '8', j_arrivee: '08:00', j_fin: '17:00', obs: '' });
  gros.mdb_paye = JSON.stringify({ pointage: pt, societe: { nom: 'ACSER' } });
  const ops = []; for (let i = 0; i < 2500; i++) ops.push({ id: 'o' + i, date: '2026-09-' + String(1 + i % 28).padStart(2, '0'), libelle: 'Achat consommable atelier ' + i, montant: 1000 + i, sens: i % 2 ? 'sortie' : 'entree', caisseId: 'c' + (i % 5) });
  gros.mdb_operationsCaisse = JSON.stringify(ops);
  const total = Object.keys(gros).reduce((a, k) => a + gros[k].length, 0);
  const w5 = navigateur(Math.round(total * 0.6));
  let err5 = null;
  try { for (const k in base) w5.localStorage.setItem(k, base[k]); for (const k in gros) w5.localStorage.setItem(k, gros[k]); } catch (e) { err5 = e; }
  const tous = Object.keys(gros).every(k => w5.localStorage.getItem(k) === gros[k]);
  const occupe = Object.keys(w5.localStorage._d).reduce((a, k) => a + k.length + w5.localStorage._d[k].length, 0);
  if (!err5 && tous && occupe < total) rapport.ok('stockage plein : les grosses rubriques sont compressees automatiquement (' + total + ' -> ' + occupe + ' caracteres) et relues a l\'identique');
  else rapport.ko('compression : ' + JSON.stringify({ err: err5 && err5.message, tous: tous, occupe: occupe, total: total }));
}
module.exports = { run: run };
