'use strict';
/* =====================================================================
   tests/07-pf-source.js
   SOURCE UNIQUE des produits finis : l'Index (Nomenclature) est le seul
   endroit ou l'on CREE, RENOMME et SUPPRIME. Exploitation et Paie
   recoivent (leurs mises a jour de PRIX restent propagees).

   On charge le VRAI public/js/sync-pf.js dans un contexte isole, avec
   localStorage simule et chemin de page reglable (/index, /production,
   /paye).
   ===================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SYNC_PF = path.join(__dirname, '..', 'public', 'js', 'sync-pf.js');

function creerStore(contenu) {
  const d = Object.assign({}, contenu || {});
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null; },
    setItem: function (k, v) { d[k] = String(v); },
    removeItem: function (k) { delete d[k]; },
    _dump: function () { return d; }
  };
}

function graine() {
  return {
    mdb_nomenclature: JSON.stringify([
      { id: 'n1', code: 'A1', designation: 'Article 1', typeArticle: 'produit_fini', prixPeriodes: [{ prixUnitaire: 5000 }] },
      { id: 'n2', code: 'A2', designation: 'Article 2', typeArticle: 'produit_fini', prixPeriodes: [{ prixUnitaire: 6000 }] }
    ]),
    mdb_production: JSON.stringify({ articles: [] }),
    mdb_paye: JSON.stringify({})
  };
}

function charger(bac) {
  const code = fs.readFileSync(SYNC_PF, 'utf8');
  vm.runInNewContext(code, bac, { filename: 'sync-pf.js' });
  return bac.window;
}

function run(rapport) {
  rapport.section('7. Produits finis : source unique Index');

  function contexte(page, contenu) {
    const toasts = [];
    const bac = {
      localStorage: creerStore(contenu || graine()),
      location: { pathname: page },
      console: console,
      toast: function (m) { toasts.push(String(m)); },
      window: {}
    };
    const w = charger(bac);
    return { bac: bac, w: w, toasts: toasts };
  }
  function nomCodes(bac) {
    return JSON.parse(bac.localStorage.getItem('mdb_nomenclature')).map(function (a) { return a.code; }).sort();
  }

  /* ---------- 1. Index : creation propagee partout ---------- */
  try {
    const c = contexte('/index.html');
    const r = c.w.triSyncSauvegarderProduitFini({ code: 'A3', designation: 'Article 3', prix_vente: 7000 });
    const nom = nomCodes(c.bac);
    const prod = JSON.parse(c.bac.localStorage.getItem('mdb_production')).articles.map(function (a) { return a.code; });
    const paye = JSON.parse(c.bac.localStorage.getItem('mdb_paye')).articlesMontage.map(function (a) { return a.code; });
    if (r === true && nom.join(',') === 'A1,A2,A3' && prod.indexOf('A3') !== -1 && paye.indexOf('A3') !== -1) {
      rapport.ok('index : creation A3 propagee (nomenclature + exploitation + paie)');
    } else {
      rapport.ko('index : creation incomplète r=' + r + ' nom=' + nom.join(','));
    }
  } catch (e) { rapport.ko('index : exception ' + e.message); }

  /* ---------- 2. Production : creation refusee, rien ne bouge ---------- */
  try {
    const c = contexte('/production.html');
    const r = c.w.triSyncSauvegarderProduitFini({ code: 'B1', designation: 'Babar 1', prix_vente: 1000 });
    const nom = nomCodes(c.bac);
    const aAverti = c.toasts.some(function (t) { return t.indexOf('Index') !== -1; });
    if (r === false && nom.join(',') === 'A1,A2' && aAverti) {
      rapport.ok('production : creation B1 refusee + message Index, nomenclature intacte');
    } else {
      rapport.ko('production : creation r=' + r + ' nom=' + nom.join(',') + ' toast=' + aAverti);
    }
  } catch (e) { rapport.ko('production : exception ' + e.message); }

  /* ---------- 3. Production : suppression refusee ---------- */
  try {
    const c = contexte('/production.html');
    const r = c.w.triSyncSupprimerProduitFini('A1');
    const nom = nomCodes(c.bac);
    if (r === false && nom.join(',') === 'A1,A2') {
      rapport.ok('production : suppression A1 refusee, nomenclature intacte');
    } else {
      rapport.ko('production : suppression r=' + r + ' nom=' + nom.join(','));
    }
  } catch (e) { rapport.ko('production : exception ' + e.message); }

  /* ---------- 4. Production : mise a jour de prix autorisee ---------- */
  try {
    const c = contexte('/production.html');
    const r = c.w.triSyncSauvegarderProduitFini({ code: 'A1', prix_vente: 5500 });
    const prod = JSON.parse(c.bac.localStorage.getItem('mdb_production')).articles;
    const fiche = prod.filter(function (a) { return a.code === 'A1'; })[0] || {};
    if (r === true && fiche.prix_vente === 5500) {
      rapport.ok('production : prix A1 mis a jour et propage (5500)');
    } else {
      rapport.ko('production : maj prix r=' + r + ' prix=' + fiche.prix_vente);
    }
  } catch (e) { rapport.ko('production : exception ' + e.message); }

  /* ---------- 5. Paie : suppression refusee ---------- */
  try {
    const c = contexte('/paye.html');
    const r = c.w.triSyncSupprimerProduitFini('A1');
    const nom = nomCodes(c.bac);
    if (r === false && nom.join(',') === 'A1,A2') {
      rapport.ok('paie : suppression A1 refusee, nomenclature intacte');
    } else {
      rapport.ko('paie : suppression r=' + r + ' nom=' + nom.join(','));
    }
  } catch (e) { rapport.ko('paie : exception ' + e.message); }

  /* ---------- 6. Paie : renommage refuse ---------- */
  try {
    const c = contexte('/paye.html');
    const r = c.w.triSyncSauvegarderProduitFini({ code: 'A1X', designation: 'Article 1 X', prix_montage: 200 }, 'A1');
    const nom = nomCodes(c.bac);
    if (r === false && nom.join(',') === 'A1,A2') {
      rapport.ok('paie : renommage A1->A1X refuse, nomenclature intacte');
    } else {
      rapport.ko('paie : renommage r=' + r + ' nom=' + nom.join(','));
    }
  } catch (e) { rapport.ko('paie : exception ' + e.message); }

  /* ---------- 7. Paie : tarif montage autorise ---------- */
  try {
    const c = contexte('/paye.html');
    const r = c.w.triSyncSauvegarderProduitFini({ code: 'A1', prix_montage: 250 });
    const paye = JSON.parse(c.bac.localStorage.getItem('mdb_paye')).articlesMontage;
    const fiche = paye.filter(function (a) { return a.code === 'A1'; })[0] || {};
    if (r === true && fiche.prix === 250) {
      rapport.ok('paie : tarif montage A1 propage (250)');
    } else {
      rapport.ko('paie : tarif r=' + r + ' prix=' + fiche.prix);
    }
  } catch (e) { rapport.ko('paie : exception ' + e.message); }

  /* ---------- 8. Nettoyage unique des vieux tombstones locaux ---------- */
  try {
    const g = graine();
    g.mdb_pf_tombstones = JSON.stringify({ X1: 123 });
    const c = contexte('/index.html', g);
    c.w.triSyncSauvegarderProduitFini({ code: 'A1', prix_vente: 5100 });
    const reste = c.bac.localStorage.getItem('mdb_pf_tombstones');
    const flag = c.bac.localStorage.getItem('mdb_pf_tombstones_nettoyes_v1');
    if (reste === null && flag === '1') {
      rapport.ok('nettoyage : vieux tombstones supprimes une fois (flag pose)');
    } else {
      rapport.ko('nettoyage : reste=' + reste + ' flag=' + flag);
    }
  } catch (e) { rapport.ko('nettoyage : exception ' + e.message); }

  /* ---------- 9. Index : suppression propagee partout ---------- */
  try {
    const c = contexte('/index.html');
    const r = c.w.triSyncSupprimerProduitFini('A2');
    const nom = nomCodes(c.bac);
    const prod = JSON.parse(c.bac.localStorage.getItem('mdb_production')).articles.map(function (a) { return a.code; });
    const paye = JSON.parse(c.bac.localStorage.getItem('mdb_paye')).articlesMontage.map(function (a) { return a.code; });
    if (r === true && nom.join(',') === 'A1' && prod.indexOf('A2') === -1 && paye.indexOf('A2') === -1) {
      rapport.ok('index : suppression A2 propagee (nomenclature + exploitation + paie)');
    } else {
      rapport.ko('index : suppression r=' + r + ' nom=' + nom.join(','));
    }
  } catch (e) { rapport.ko('index : exception ' + e.message); }
}

module.exports = { run };
