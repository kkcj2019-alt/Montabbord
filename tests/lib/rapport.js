'use strict';
/* =====================================================================
   tests/lib/rapport.js
   Petit(reporteur) : collecte les resultats et affiche un bilan lisible.
   ===================================================================== */
class Rapport {
  constructor(titre) {
    this.titre = titre;
    this.sections = [];
    this.cur = null;
    this.debut = Date.now();
  }

  section(nom) {
    this.cur = { nom: nom, lignes: [], echecs: 0, total: 0 };
    this.sections.push(this.cur);
    return this.cur;
  }

  ok(msg) {
    if (!this.cur) this.section('general');
    this.cur.lignes.push({ ok: true, msg: msg });
    this.cur.total++;
  }

  ko(msg) {
    if (!this.cur) this.section('general');
    this.cur.lignes.push({ ok: false, msg: msg });
    this.cur.total++;
    this.cur.echecs++;
  }

  info(msg) {
    if (!this.cur) this.section('general');
    this.cur.lignes.push({ ok: null, msg: msg });
  }

  get echecsTotal() {
    return this.sections.reduce((n, s) => n + s.echecs, 0);
  }

  afficher() {
    const L = [];
    L.push('');
    L.push('='.repeat(72));
    L.push('  ' + this.titre);
    L.push('='.repeat(72));
    this.sections.forEach(s => {
      L.push('');
      L.push('  ' + s.nom + '   ' + (s.echecs ? 'ECHEC : ' + s.echecs : 'OK') + ' / ' + s.total);
      s.lignes.forEach(l => {
        const marque = l.ok === true ? '  [ok] ' : l.ok === false ? '  [KO] ' : '  [..] ';
        L.push(marque + l.msg);
      });
    });
    L.push('');
    L.push('-'.repeat(72));
    const duree = ((Date.now() - this.debut) / 1000).toFixed(1);
    if (this.echecsTotal === 0) {
      L.push('  RESULTAT : TOUS LES CONTROLES SONT PASSES   (' + duree + ' s)');
    } else {
      L.push('  RESULTAT : ' + this.echecsTotal + ' ECHEC(S)   (' + duree + ' s)');
    }
    L.push('-'.repeat(72));
    const texte = L.join('\n');
    console.log(texte);
    return this.echecsTotal;
  }
}

module.exports = { Rapport };
