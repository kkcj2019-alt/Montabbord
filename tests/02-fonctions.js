'use strict';
/* =====================================================================
   tests/02-fonctions.js
   Deux problemes historiques :
     a) une fonction declaree deux fois au niveau global : la derniere
        ecrase la premiere, qui devient du code mort ;
     b) une version morte qui contient des fonctionnalites absentes de
        la version active -> regression silencieuse.
   On distingue les fonctions globales des fonctions imbriquees (privées)
   en tenant compte de la profondeur d'accolades.
   ===================================================================== */
const { APPLICATIONS, loadApp, globalFunctionDefinitions } = require('./lib/extract.js');

function normaliser(c) { return c.replace(/\s+/g, ' ').trim(); }

function jetons(c) {
  const set = new Set();
  let m;
  const reId = /[A-Za-z_$][\w$]{3,}/g;
  while ((m = reId.exec(c)) !== null) set.add(m[0]);
  const reCh = /'([^'\\]{4,60})'/g;
  while ((m = reCh.exec(c)) !== null) set.add('"' + m[1] + '"');
  return set;
}

/* Mots du langage : leur absence n'a pas de sens. */
const MOTS = new Set(['function', 'return', 'var', 'let', 'const', 'true', 'false', 'null',
  'undefined', 'typeof', 'this', 'string', 'number', 'object', 'length', 'push', 'forEach',
  'filter', 'map', 'indexOf', 'splice', 'toString', 'innerHTML', 'textContent', 'value',
  'style', 'classList', 'querySelector', 'getElementById', 'addEventListener', 'toFixed',
  'Math', 'Date', 'String', 'Number', 'Array', 'Object', 'JSON', 'parseInt', 'parseFloat',
  'isNaN', 'continue', 'break', 'switch', 'case', 'default', 'try', 'catch', 'finally',
  'throw', 'new', 'delete', 'void', 'document', 'window', 'console']);

function run(rapport, options) {
  const opt = options || {};
  const warnRegression = opt.warnRegression !== false;
  rapport.section('2. Fonctions definies plusieurs fois');

  let totalConflits = 0, totalDoublons = 0, totalPerte = 0;

  APPLICATIONS.forEach(function (nom) {
    const app = loadApp(nom);
    const defs = globalFunctionDefinitions(app.js);
    const dups = [];
    defs.forEach(function (liste, nomFn) { if (liste.length > 1) dups.push(nomFn); });
    if (!dups.length) { rapport.ok(nom + ' : aucune fonction dupliquee'); return; }

    dups.forEach(function (nomFn) {
      const liste = defs.get(nomFn);
      const variants = new Set(liste.map(d => normaliser(d.corps)));
      const derniere = normaliser(liste[liste.length - 1].corps);

      if (variants.size === 1) {
        totalDoublons++;
        rapport.ko(nom + ' : ' + nomFn + ' definie ' + liste.length +
          ' fois a l\'identique (lignes ' + liste.map(d => d.ligne).join(', ') + ')');
        return;
      }

      totalConflits++;
      rapport.ko(nom + ' : CONFLIT sur ' + nomFn + ' — ' + variants.size + ' versions ; ' +
        'seule la definition ligne ' + liste[liste.length - 1].ligne + ' s\'execute');

      /* la version morte contient-elle quelque chose que l'active n'a pas ? */
      if (!warnRegression) return;
      const setActif = jetons(derniere);
      const perdus = new Set();
      liste.slice(0, -1).forEach(function (d) {
        jetons(normaliser(d.corps)).forEach(function (t) { if (!setActif.has(t)) perdus.add(t); });
      });
      const significatifs = [...perdus].filter(t => !MOTS.has(t));
      if (significatifs.length) {
        totalPerte++;
        rapport.ko('   -> PERTE POSSIBLE dans ' + nomFn + ' : ' +
          significatifs.slice(0, 14).join(', ') + (significatifs.length > 14 ? ' ...' : ''));
      }
    });
  });

  rapport.info('doublons identiques : ' + totalDoublons +
    ' | conflits de versions : ' + totalConflits +
    ' | pertes possibles : ' + totalPerte);
  return { totalConflits: totalConflits, totalDoublons: totalDoublons };
}

module.exports = { run };
