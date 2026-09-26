'use strict';
/* =====================================================================
   tests/01-syntaxe.js
   Chaque bloc <script> de chaque application doit etre analysable par
   le moteur JavaScript. C'est le controle de reference : on laisse
   Node analyser le code plutot que de compter des accolades.
   ===================================================================== */
const vm = require('vm');
const { APPLICATIONS, loadApp } = require('./lib/extract.js');

function run(rapport) {
  rapport.section('1. Syntaxe JavaScript (analyse par le moteur)');
  let totalBlocs = 0;
  APPLICATIONS.forEach(function (nom) {
    const app = loadApp(nom);
    let ko = 0;
    app.blocs.forEach(function (b, i) {
      totalBlocs++;
      try { new vm.Script(b, { filename: nom + '#bloc' + (i + 1) }); }
      catch (e) { ko++; rapport.ko(nom + ' bloc ' + (i + 1) + ' : ' + e.message); }
    });
    if (ko === 0) rapport.ok(nom + ' : ' + app.blocs.length + ' bloc(s) analyses sans erreur');
  });
  rapport.info('total : ' + totalBlocs + ' blocs de script');
  return totalBlocs;
}

module.exports = { run };
