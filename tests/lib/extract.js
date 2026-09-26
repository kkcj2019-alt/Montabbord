'use strict';
/* =====================================================================
   tests/lib/extract.js
   Utilitaires d'analyse des fichiers HTML de l'application.
   Aucune dependance externe.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/* Extrait les blocs <script> inline (ceux avec src= sont ignores).
   On utilise une expression reguliere non gloutonne : c'est la regle
   reelle du parseur HTML, qui ferme un script au premier "</script>".
   Certains fichiers historiques ecrivent "</script>" dans une chaine ;
   le scanners de l'ancienne version de smoke.js les detectait comme une
   erreur alors que le navigateur, lui, coupe aussi le bloc. */
function extractScripts(src) {
  const blocs = [];
  const re = /<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) blocs.push(m[1]);
  /* ce qui suit le dernier </script> sans bloc ferme est ignore */
  return blocs;
}

/* Profondeur d'accolades a chaque position, en ignorant commentaires,
   chaines, gabarits et expressions regulieres. Indispensable pour
   distinguer une fonction globale d'une fonction imbriquee. */
function braceDepths(code) {
  const dp = new Int32Array(code.length);
  let d = 0, i = 0;
  while (i < code.length) {
    dp[i] = d;
    const c = code[i], e = code[i + 1];
    if (c === '/' && e === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
    if (c === '/' && e === '*') { i += 2; while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < code.length) { if (code[i] === '\\') { i += 2; continue; } if (code[i] === q) { i++; break; } i++; }
      continue;
    }
    if (c === '/') {
      const prev = code.slice(Math.max(0, i - 40), i)
        .match(/(\(|\[|,|=|:|\?|&|\||\{|;|return|typeof|!|&&|\|\||=>)\s*$/);
      if (prev) {
        i++; let inClass = false;
        while (i < code.length) {
          if (code[i] === '\\') { i += 2; continue; }
          if (code[i] === '[') inClass = true;
          else if (code[i] === ']') inClass = false;
          else if (code[i] === '/' && !inClass) { i++; break; }
          else if (code[i] === '\n') break;
          i++;
        }
        while (i < code.length && /[gimsuyd]/.test(code[i])) i++;
        continue;
      }
    }
    if (c === '{') { d++; i++; continue; }
    if (c === '}') { d--; i++; continue; }
    i++;
  }
  return dp;
}

/* Corps d'une fonction declaration, par equilibre d'accolades. */
function functionBody(code, start) {
  const i = code.indexOf('{', start);
  if (i === -1) return '';
  let d = 0;
  for (let k = i; k < code.length; k++) {
    if (code[k] === '{') d++;
    else if (code[k] === '}') { d--; if (d === 0) return code.slice(start, k + 1); }
  }
  return '';
}

/* Toutes les definitions de fonctions de premier niveau, avec leur position. */
function globalFunctionDefinitions(code) {
  const dp = braceDepths(code);
  const out = new Map();
  const re = /(^|\n)([ \t]*)function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const idx = m.index + m[1].length + m[2].length;
    if ((dp[idx] || 0) !== 0) continue;           /* imbriquee : privee */
    const nom = m[3];
    if (!out.has(nom)) out.set(nom, []);
    out.get(nom).push({
      index: idx,
      ligne: code.slice(0, idx).split('\n').length,
      corps: functionBody(code, idx)
    });
  }
  return out;
}

/* Analyse complete d'un fichier de l'application. */
function loadApp(nomFichier) {
  const chemin = path.join(PUBLIC_DIR, nomFichier);
  const src = fs.readFileSync(chemin, 'utf8');
  const blocs = extractScripts(src);
  return {
    nom: nomFichier,
    chemin: chemin,
    src: src,
    blocs: blocs,
    js: blocs.join('\n;\n')
  };
}

const APPLICATIONS = ['index.html', 'paye.html', 'production.html'];

module.exports = {
  PUBLIC_DIR, APPLICATIONS, loadApp,
  extractScripts, braceDepths, functionBody, globalFunctionDefinitions
};
