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
  vm.runInNewContext(fs.readFileSync(MODULE, 'utf8'), { window: win, String: String, Date: Date, Object: Object });
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
}
module.exports = { run: run };
