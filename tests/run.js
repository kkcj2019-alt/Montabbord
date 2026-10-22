'use strict';
/* =====================================================================
   tests/run.js — lanceur de la suite de tests.

   Utilisation :
     node tests/run.js            tous les controles
     node tests/run.js --verbose  affiche le detail de chaque page
     node tests/run.js --only=02  uniquement le test 02

   Code de sortie : 0 si tout passe, 1 sinon.
   ===================================================================== */
const path = require('path');
const { Rapport } = require('./lib/rapport.js');

const args = process.argv.slice(2);
const verbose = args.indexOf('--verbose') !== -1 || args.indexOf('-v') !== -1;
const only = (args.find(a => a.indexOf('--only=') === 0) || '').replace('--only=', '');

const ETAPES = [
  { cle: '01', nom: 'syntaxe', charger: () => require('./01-syntaxe.js') },
  { cle: '02', nom: 'fonctions', charger: () => require('./02-fonctions.js') },
  { cle: '03', nom: 'pages', charger: () => require('./03-pages.js') },
  { cle: '04', nom: 'fonctionnalite', charger: () => require('./04-fonctionnalite.js') },
  { cle: '05', nom: 'ergonomie', charger: () => require('./05-ergonomie.js') },
  { cle: '06', nom: 'split', charger: () => require('./06-split.js') },
  { cle: '07', nom: 'pf-source', charger: () => require('./07-pf-source.js') },
  { cle: '08', nom: 'securite', charger: () => require('./08-securite.js') },
  { cle: '09', nom: 'synchro', charger: () => require('./09-synchro.js') }
];

const rapport = new Rapport('MONTABBORD — CONTROLE QUALITE DES APPLICATIONS');

/* Certaines etapes sont asynchrones (06 : faux Supabase en promesses) :
   on les attend avant d'afficher le resultat, sinon leurs controles
   arriveraient apres la fin du programme. */
async function principal() {
  let executees = 0;
  for (const e of ETAPES) {
    if (only && e.cle !== only) continue;
    executees++;
    const etape = e.charger();
    const r = (e.cle === '03') ? etape.run(rapport, { verbose: verbose }) : etape.run(rapport);
    if (r && typeof r.then === 'function') await r;
  }

  if (!executees) {
    console.error('Aucune etape ne correspond a --only=' + only);
    process.exit(2);
  }

  const echecs = rapport.afficher();
  process.exit(echecs === 0 ? 0 : 1);
}

principal().catch(function (e) {
  console.error('Echec du lanceur : ' + (e && e.message));
  process.exit(1);
});
