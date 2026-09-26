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
  { cle: '04', nom: 'fonctionnalite', charger: () => require('./04-fonctionnalite.js') }
];

const rapport = new Rapport('MONTABBORD — CONTROLE QUALITE DES APPLICATIONS');

let executees = 0;
ETAPES.forEach(function (e) {
  if (only && e.cle !== only) return;
  executees++;
  const etape = e.charger();
  if (e.cle === '03') {
    etape.run(rapport, { verbose: verbose });
  } else {
    etape.run(rapport);
  }
});

if (!executees) {
  console.error('Aucune etape ne correspond a --only=' + only);
  process.exit(2);
}

const echecs = rapport.afficher();
process.exit(echecs === 0 ? 0 : 1);
