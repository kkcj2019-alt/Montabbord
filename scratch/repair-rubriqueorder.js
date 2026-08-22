const fs = require('fs');
let t = fs.readFileSync('public/index.html', 'utf8');
const iA = t.indexOf('function computeActifData');
const iR = t.indexOf('function renderActif');

/* fragment tronque dans computeActifData : du commentaire jusqu'a var sd2=[]; */
let cStart = t.indexOf('// Define rubrique order', iA);
while (t[cStart - 1] === ' ') cStart--;
const SD = 'subDetails:(function(){var sd2=[];';
const cEnd = t.indexOf(SD, cStart) + SD.length;
const FRAG_C = t.substring(cStart, cEnd);
if (FRAG_C.indexOf('var rubriqueOrder = [') < 0) { console.error('FRAG_C invalide'); process.exit(1); }

/* fragment orphelin dans renderActif : de for(var pi3... jusqu'a la fermeture ]; du tableau */
const ORPH = 'for(var pi3=0;pi3<pfActifs.length;pi3++){';
const rStart = t.indexOf(ORPH, iR);
if (rStart < 0 || rStart < iR) { console.error('orphelin introuvable'); process.exit(1); }
const CDKEY = "key:'creance_douteuse'";
const cdIdx = t.indexOf(CDKEY, rStart);
if (cdIdx < 0) { console.error('cle creance_douteuse introuvable apres orphelin'); process.exit(1); }
const arrClose = t.indexOf('];', cdIdx) + 2;
const FRAG_R = t.substring(rStart, arrClose);
if (FRAG_R.indexOf('].concat(bankDetailsArr)') < 0) { console.error('FRAG_R incomplet'); process.exit(1); }

/* suppression des deux fragments (compute d'abord, puis render avec index recalcules) */
t = t.substring(0, cStart) + t.substring(cEnd);
const rStart2 = t.indexOf(ORPH, t.indexOf('function renderActif'));
const arrClose2 = t.indexOf('];', t.indexOf(CDKEY, rStart2)) + 2;
t = t.substring(0, rStart2) + t.substring(arrClose2);

/* reinsertion complete avant la boucle d'assemblage */
const fcNL = FRAG_C.indexOf('\n');
const FC_ARR = FRAG_C.substring(fcNL + 1);
const insRaw = t.indexOf('/* Assemblage partag');
let ip = insRaw; while (t[ip - 1] === ' ') ip--;
const FULL = '  // Define rubrique order (auto-computed + manual)\r\n  ' + FC_ARR + FRAG_R + '\r\n\r\n';
t = t.substring(0, ip) + FULL + t.substring(ip);
fs.writeFileSync('public/index.html', t);
console.log('reparation OK | FRAG_C=' + FRAG_C.length + 'ch FRAG_R=' + FRAG_R.length + 'ch');
