/* Verifie que la suite de tests detecte bien une regression
   (un test qui ne detecte rien ne sert a rien). */
const fs = require('fs');
const { execFileSync } = require('child_process');
const APP = 'C:/Users/KKCJ-10e/Desktop/2409/Montabbord/public/production.html';
const SAUVE = process.env.TEMP + '/prod_sauvegarde.html';

function lancer() {
  try {
    const out = execFileSync(process.execPath, ['tests/run.js'],
      { cwd: 'C:/Users/KKCJ-10e/Desktop/2409/Montabbord', encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out: out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}
function ligne(out, motif) {
  const l = out.split(/\r?\n/).find(x => x.indexOf(motif) !== -1);
  return l ? l.trim() : '(absent)';
}

const original = fs.readFileSync(APP, 'utf8');
fs.writeFileSync(SAUVE, original, 'utf8');

function saboter(transform, nom) {
  fs.writeFileSync(APP, original, 'utf8');
  const mod = transform(original);
  if (mod === original) { console.log('  [' + nom + '] sabotage sans effet (motif non trouve)'); return; }
  fs.writeFileSync(APP, mod, 'utf8');
  const r = lancer();
  const verdict = ligne(r.out, 'RESULTAT');
  const ko = (r.out.match(/\[KO\]/g) || []).length;
  console.log('  [' + nom + '] code=' + r.code + '  contrôles en échec=' + ko);
  console.log('      ' + verdict);
}

console.log('=== La suite detecte-t-elle une regression ? ===\n');

const etat = lancer();
console.log('  [aucune sabotage] code=' + etat.code + '  echecs=' + (etat.out.match(/\[KO\]/g) || []).length);
console.log('      ' + ligne(etat.out, 'RESULTAT'));
console.log('');

saboter(function (s) {
  return s.replace(/function lsArr\(key\) \{[\s\S]*?\r?\n\}/,
    "function lsArr(key) { return JSON.parse(localStorage.getItem(key)) || []; }");
}, 'lecture non protegee');

saboter(function (s) {
  return s.replace('showMarkPresence()', 'nothingHere()');
}, 'bouton Marquer presence supprime');

saboter(function (s) {
  return s.replace('function acCump(du, au) {', 'function acCump(du, au) { return { essences: [], prixM3: 0 }; /*function acCumpOLD(du, au) {');
}, 'calcul CUMP neutralise');

/* restauration */
fs.writeFileSync(APP, original, 'utf8');
const final = lancer();
console.log('\n  [restaure] code=' + final.code + '  echecs=' + (final.out.match(/\[KO\]/g) || []).length);
console.log('      ' + ligne(final.out, 'RESULTAT'));
