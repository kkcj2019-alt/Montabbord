'use strict';
/* =====================================================================
   tests/05-ergonomie.js
   Contrôles statiques d'ergonomie. Ils portent sur la QUALITE D'USAGE, pas
   sur le fonctionnement : ces points ne cassent rien, mais ils rendent
   l'application pénible ou risquée au quotidien.

     A. Suppression definitive : toute suppression d'ENREGISTREMENT doit
        demander confirmation. Les suppressions de lignes d'un formulaire en
        cours de saisie en sont exemptes (elles seraient pénibles et ne
        protégeraient rien).
     B. Saisie mobile : sur iOS, un champ dont la police fait moins de
        16 px declenche un zoom automatique a la focalisation. La regle
        mobile doit donc l'emporter sur les regles de classe.
     C. Boutons icones : un bouton qui n'affiche qu'un symbole doit avoir un
        title (infobulle) ou un aria-label (lecteur d'ecran).
     D. Coherence des libelles : un meme verbe pour une meme action.
   ===================================================================== */
const fs = require('fs');
const { PUBLIC_DIR, APPLICATIONS, loadApp } = require('./lib/extract.js');

/* Suppressions de lignes de saisie : sans confirmation, volontairement. */
const LIGNES_SAISIE = /(remove|delete)\w*(Ligne|Line|Lignes|Lines)\b/;
/* Fonctions exclues, avec la raison :
     - lignes d'un formulaire ou d'une liste en cours d'edition (une
       confirmation a chaque ligne rendrait la saisie penible sans
       proteger d'un enregistrement definitif) ;
     - helpers internes appeles par une suppression qui demande DEJA
       confirmation ;
     - "deliverFrom..." :Despite le nom, ce n'est pas une suppression
       mais la preparation d'un bon de livraison a partir du stock. */
const EXCLUS = [
  { motif: /^removeForm/, raison: 'ligne de formulaire en cours' },
  { motif: /^removeActif/, raison: 'ligne de tableau de bord' },
  { motif: /^removeReglement/, raison: 'helper interne (la suppression parente confirme)' },
  { motif: /^removeDash/, raison: 'ligne de tableau de bord' },
  { motif: /^deliverFrom/, raison: 'ce n\'est pas une suppression' },
  { motif: /^removeByTombstone/, raison: 'helper interne' },
  { motif: /^removeDeletedOperations/, raison: 'filtre de fusion cloud : ne modifie aucune donnée' },
  { motif: /^removeFilter|^removePin|^removeLogo/, raison: 'filtre ouLogo, pas un enregistrement' }
];
const CONFIRMER = /(window\.)?confirm2?\s*\(/;

function corpsDe(code, start) {
  const i = code.indexOf('{', start);
  if (i === -1) return '';
  let d = 0;
  for (let k = i; k < code.length; k++) {
    if (code[k] === '{') d++;
    else if (code[k] === '}') { d--; if (d === 0) return code.slice(start, k + 1); }
  }
  return '';
}

function run(rapport) {
  rapport.section('5. Ergonomie et securite d\'usage');

  /* ---------- A. confirmations avant suppression ---------- */
  const sansConfirm = [];
  APPLICATIONS.forEach(function (f) {
    const app = loadApp(f);
    const re = /function\s+((?:delete|del|remove|supprimer)\w*)\s*\(/gi;
    let m;
    while ((m = re.exec(app.js)) !== null) {
      const nom = m[1];
      if (LIGNES_SAISIE.test(nom)) continue;                 /* ligne de saisie : exclu */
      if (EXCLUS.some(e => e.motif.test(nom))) continue;      /* exclu avec raison documentee */
      const corps = corpsDe(app.js, m.index);
      if (!corps || CONFIRMER.test(corps)) continue;
      sansConfirm.push(f + ' : ' + nom);
    }
  });
  if (!sansConfirm.length) rapport.ok('toute suppression d\'enregistrement demande confirmation');
  else {
    sansConfirm.forEach(x => rapport.ko('suppression sans confirmation -> ' + x));
  }

  /* ---------- B. saisie lisible sur mobile ---------- */
  /* Sur iOS, un champ dont la police fait moins de 16 px declenche un zoom
     automatique a la focalisation. Il faut donc qu'une regle mobile 16 px
     s'applique REELLEMENT, c'est-a-dire qu'elle soit declaree apres les
     regles "petites" (a specificite egale, la derniere regle gagne). */
  APPLICATIONS.forEach(function (f) {
    const app = loadApp(f);
    const lignes = app.src.split(/\r?\n/);

    /* 1. derniere regle non mobile imposant moins de 16 px a un champ */
    let dernierePetite = -1;
    const petits = [];
    lignes.forEach(function (l, i) {
      const m = /([^{}]*(?:input|select|textarea)[^{}]*)\{[^}]*font-size:\s*([0-9.]+)px/g;
      let mm;
      while ((mm = m.exec(l)) !== null) {
        const v = parseFloat(mm[2]);
        if (v > 0 && v < 16) {
          dernierePetite = Math.max(dernierePetite, i);
          petits.push(mm[1].trim().substring(0, 46) + ' ' + v + 'px');
        }
      }
    });

    /* 2. derniere regle mobile imposant 16 px */
    let derniereMobile = -1;
    lignes.forEach(function (l, i) {
      if (/@media[^{]*max-width:\s*(768|820|900)px\)/.test(l)) {
        const bloc = lignes.slice(i, i + 25).join('\n');
        if (/font-size:\s*16px\s*!important/.test(bloc)) derniereMobile = i;
      }
    });

    if (derniereMobile === -1 && petits.length) {
      rapport.ko(f + ' : ' + petits.length + ' champ(s) sous 16 px et aucune règle mobile 16 px → zoom iOS à la saisie');
    } else if (derniereMobile !== -1 && derniereMobile < dernierePetite) {
      rapport.ko(f + ' : une règle ' + petits[petits.length - 1] + ' est déclarée APRÈS la règle mobile 16 px, elle l\'emporte');
    } else if (derniereMobile === -1) {
      rapport.ok(f + ' : aucun champ sous 16 px, pas de règle mobile nécessaire');
    } else {
      rapport.ok(f + ' : règle mobile 16 px effective (aucune règle plus petite ne la supplante)');
    }
  });

  /* ---------- C. boutons icones sans etiquette ---------- */
  const sansTitre = [];
  APPLICATIONS.forEach(function (f) {
    const app = loadApp(f);
    const re = /<button[^>]*>([\s\S]{0,140}?)<\/button>/gi;
    let m;
    while ((m = re.exec(app.src)) !== null) {
      const tag = m[0];
      const txt = m[1].replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, '').trim();
      const estIcone = (/^[\u2190-\u27bf\u{1F300}-\u{1FAFF}\u2705\u274c\u2714\u2716\u2b06\u2b07\u270d\u271a\u2716\u00d7\u2713\u2714\u2699\u2261\u2051\u25b6\u23f8\u2b1b\u2b1c]+$/u.test(txt) && txt.length > 0);
      const estSvg = /<svg/i.test(m[1]);
      if ((estIcone || estSvg) && !/title\s*=/i.test(tag) && !/aria-label/i.test(tag)) {
        sansTitre.push(f + ' : "' + (txt || 'svg').substring(0, 10) + '"');
      }
    }
  });
  const nSans = sansTitre.length;
  if (!nSans) rapport.ok('tous les boutons icones ont une étiquette');
  else rapport.ko(nSans + ' bouton(s) icône sans title ni aria-label : ' + sansTitre.slice(0, 6).join(' | ') + (nSans > 6 ? ' ...' : ''));

  /* ---------- D. coherence des libelles ---------- (information, pas echec)
     Un meme bouton d'action peut legitimement porter deux libelles : "X" dans
     l'en-tete d'une modale et "Annuler" dans son pied, "Retour" et
     "← Retour" avec ou sans icone. Ce controle sert a reperer les liberes,
     pas a bloquer une mise en production. */
  const parAction = {};
  APPLICATIONS.forEach(function (f) {
    const app = loadApp(f);
    const re = /<button[^>]*onclick="([^"]{0,200}?)"[^>]*>([\s\S]{0,80}?)<\/button>/gi;
    let m;
    while ((m = re.exec(app.src)) !== null) {
      const action = m[1].replace(/\s+/g, ' ').trim();
      const libelle = m[2].replace(/<[^>]*>/g, '').replace(/&[a-z]+;|&#\d+;/gi, '').replace(/\s+/g, ' ').trim();
      if (!action || !libelle || libelle.length > 40) continue;
      if (!parAction[action]) parAction[action] = {};
      parAction[action][libelle] = (parAction[action][libelle] || 0) + 1;
    }
  });
  const doubles = [];
  Object.keys(parAction).forEach(function (action) {
    const ls = Object.keys(parAction[action]);
    /* on ignore les libelles purement iconiques : elles ont deja un title */
    if (ls.length <= 1) return;
    if (ls.every(l => l.length <= 2)) return;
    doubles.push(ls.map(l => '"' + l + '"').join(' / ') + ' → ' + action);
  });
  if (!doubles.length) rapport.ok('aucun libelle vraiment ambigue');
  else {
    rapport.info(doubles.length + ' action(s) avec plusieurs libelles (a harmoniser si souhaitable) :');
    doubles.slice(0, 8).forEach(x => rapport.info('   ' + x));
  }

  return { sansConfirm: sansConfirm.length, sansTitre: nSans, doubles: doubles.length };
}

module.exports = { run };
