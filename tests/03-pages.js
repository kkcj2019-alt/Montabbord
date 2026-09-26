'use strict';
/* =====================================================================
   tests/03-pages.js
   RENDU DE TOUTES LES PAGES DES TROIS APPLICATIONS, dans trois jeux de
   donnees : vide, reel, et volontairement corrompu.

   Ce test detecte les EXCEPTIONS (fiable : une exception dans un rendu
   signifie que la page est cassee). La longueur du HTML produit n'est
   pas jugee de facon fiable, car index.html construit son DOM avec
   createElement : on ne mesure donc que le resultat du rendu.
   ===================================================================== */
const vm = require('vm');
const { SCENARIOS, chargerApp, UTILISATEUR } = require('./lib/sandbox.js');

/* Dispatch de rendu par application. */
const DISPATCH = {
  'index.html': {
    pages: ['reunions', 'dashboard', 'adminDashboard', 'notes', 'tiers', 'facturation',
      'dashCommercial', 'nomenclature', 'bc', 'bl', 'factures', 'journal', 'prefinancement',
      'acomptesPrets', 'comptabilite', 'actif', 'amortissements', 'taches', 'employes',
      'contrats', 'licences', 'utilisateurs', 'entreprise', 'creance', 'fournisseurs',
      'tresorerie', 'dettes', 'bcFournisseurs', 'blFournisseurs', 'facturesFournisseurs',
      'comptesClients', 'comptesFournisseurs', 'previsions', 'costPrice', 'qualite',
      'stock', 'suiviLivraisons', 'creancesDettes', 'typeElementsAchats', 'elementsAchats',
      'bonsCommandeFournisseurs', 'rhdashboard', 'demandes', 'sanctions', 'conges', 'assiduite'],
    rendre: (p) => 'currentPage = ' + JSON.stringify(p) + '; navigateTo(' + JSON.stringify(p) + ');'
  },
  'production.html': {
    pages: ['dashboard', 'production', 'history', 'orders', 'stock-palettes', 'stock-raw',
      'stock-merch', 'stock-consum', 'inventory', 'stock-movements', 'epi', 'thermal',
      'thermal-types', 'articles', 'fiche-tech', 'definitions', 'species', 'stock-merch-art',
      'achats', 'achats-history', 'livraisons', 'preventive', 'corrective', 'qualite',
      'reports', 'rh-dashboard', 'departments', 'positions', 'presence', 'leaves', 'sanctions',
      'analyse-couts', 'cout-revient'],
    rendre: (p) => 'CURRENT_PAGE = ' + JSON.stringify(p) + '; renderPage();'
  }
};

/* paye.html n'a pas de dispatcher de pages (affichage/masquage de sections) :
   on appelle directement chaque fonction de rendu SANS REQUISIR D'ARGUMENT
   (une fonction qui attend un parametre ne peut pas etre testee ainsi : on
   l'ignore plutot que de signaler un faux echec). */
function rendusSansArgument(app) {
  const noms = new Set();
  Array.from(app.js.matchAll(/function\s+(render[A-Za-z0-9_$]*)\s*\(\s*([A-Za-z0-9_$]*)\s*\)/g))
    .forEach(function (m) {
      /* on ne teste que les fonctions dont la liste de parametres est vide */
      if (m[2] === '') noms.add(m[1]);
    });
  return [...noms].map(function (n) {
    return 'typeof ' + n + ' === "function" ? (function(){ try { ' + n + '(); return null; } catch (e) { return String(e && e.message || e); } })() : null';
  });
}

function run(rapport) {
  rapport.section('3. Rendu des pages (3 applications x 3 jeux de donnees)');

  let totalRendus = 0, totalErreurs = 0;

  /* ---- index.html et production.html ---- */
  ['index.html', 'production.html'].forEach(function (fichier) {
    const conf = DISPATCH[fichier];
    SCENARIOS.forEach(function (sc) {
      let h;
      try { h = chargerApp(fichier, sc.store()); }
      catch (e) {
        totalErreurs++;
        rapport.ko(fichier + ' [' + sc.nom + '] chargement impossible : ' + e.message);
        return;
      }
      let erreursScenario = 0;
      conf.pages.forEach(function (page) {
        totalRendus++;
        try {
          vm.runInContext(UTILISATEUR, h.ctx, { timeout: 10000 });
          vm.runInContext(conf.rendre(page), h.ctx, { timeout: 30000 });
        } catch (e) {
          erreursScenario++; totalErreurs++;
          rapport.ko(fichier + ' [' + sc.nom + '] page ' + page + ' : ' +
            (e && e.message ? e.message : String(e)).substring(0, 140));
          return;
        }
        /* production.html affiche un ecran d'erreur au lieu de laisser la page
           blanche : ce masque l'exception. On le detecte donc explicitement,
           sinon une regression peut passer inapercue. */
        try {
          const contenu = Object.keys(h.registre)
            .map(k => h.registre[k].innerHTML || '')
            .join(' ');
          if (contenu.indexOf("n'a pas pu s'afficher") !== -1) {
            erreursScenario++; totalErreurs++;
            rapport.ko(fichier + ' [' + sc.nom + '] page ' + page +
              ' : écran d\'erreur affiché (une exception a été rattrapée à l\'intérieur)');
          }
        } catch (e) { /* inspection impossible : sans conséquence */ }
      });
      if (erreursScenario === 0) {
        rapport.ok(fichier + ' [' + sc.nom + '] : ' + conf.pages.length + ' pages rendues sans exception');
      }
    });
  });

  /* ---- paye.html ---- */
  SCENARIOS.forEach(function (sc) {
    let h;
    try { h = chargerApp('paye.html', sc.store()); }
    catch (e) { totalErreurs++; rapport.ko('paye.html [' + sc.nom + '] chargement impossible : ' + e.message); return; }
    let erreursScenario = 0, nbFonctions = 0;
    try {
      vm.runInContext(UTILISATEUR, h.ctx, { timeout: 10000 });
      const res = vm.runInContext('[' + rendusSansArgument(h.app).join(', ') + ']', h.ctx, { timeout: 60000 });
      res.forEach(function (msg, i) {
        nbFonctions++;
        if (msg) { erreursScenario++; totalErreurs++; rapport.ko('paye.html [' + sc.nom + '] fonction de rendu #' + (i + 1) + ' : ' + String(msg).substring(0, 140)); }
      });
    } catch (e) { erreursScenario++; totalErreurs++; rapport.ko('paye.html [' + sc.nom + '] : ' + e.message); }
    if (erreursScenario === 0 && nbFonctions) rapport.ok('paye.html [' + sc.nom + '] : ' + nbFonctions + ' fonctions de rendu sans exception');
  });

  rapport.info('rendus de page effectues : ' + totalRendus + ' | exceptions : ' + totalErreurs);
  return { totalRendus: totalRendus, totalErreurs: totalErreurs };
}

module.exports = { run };
