'use strict';
/* tests/15-convention.js — module partage js/convention-ci.js :
   regles chiffrees, controles de conformite, affichage. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MODULE = path.join(__dirname, '..', 'public', 'js', 'convention-ci.js');

function charger(store) {
  const st = Object.assign({}, store);
  const el = { innerHTML: '', querySelector: () => null };
  const bac = {
    window: {}, console: console, Intl: Intl, JSON: JSON, Math: Math, Date: Date, String: String, Object: Object, Array: Array, parseFloat: parseFloat, parseInt: parseInt, isNaN: isNaN, Infinity: Infinity,
    localStorage: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } }
  };
  vm.runInNewContext(fs.readFileSync(MODULE, 'utf8'), bac, { filename: 'convention-ci.js' });
  return { C: bac.window.ConventionCI, el: el };
}

function run(rapport) {
  rapport.section('15. Convention collective : regles et conformite');
  const mois = '2026-10';
  const store = {
    mdb_employes: JSON.stringify([
      { id: 'a', matricule: 'A1', nom: 'SOUS SMIG', salaire_base: 60000, categorie_id: '1 MO', date_entree: '2024-01-01', num_cnps: '1' },
      { id: 'b', matricule: 'B1', nom: 'SOUS CATEGORIE', salaire_base: 90000, categorie_id: '6B', date_entree: '2024-01-01', num_cnps: '1' },
      { id: 'c', matricule: 'C1', nom: 'CONFORME', salaire_base: 150000, categorie_id: '6B', date_entree: '2020-01-01', num_cnps: '1' },
      { id: 'd', matricule: 'D1', nom: 'INCOMPLET', salaire_base: 120000 },
      { id: 'e', matricule: 'E1', nom: 'JOURNALIER', type_contrat: 'Journalier', salaire_base: 3000, date_entree: '2025-01-01', num_cnps: '1' },
      { id: 'f', matricule: 'F1', nom: 'SORTI', salaire_base: 10000, date_sortie: '2025-12-31' },
      { id: 'g', matricule: 'G1', nom: 'ETRANGER LOCAL', nationalite: 'Burkinabè', salaire_base: 120000, categorie_id: '6B', date_entree: '2024-01-01', num_cnps: '1' },
      { id: 'h', matricule: 'H1', nom: 'EXPATRIE', nationalite: 'Française', expatrie: true, salaire_base: 900000, categorie_id: '6B', date_entree: '2024-01-01', num_cnps: '1' }
    ]),
    mdb_paye: JSON.stringify({
      categories: [{ code: '1 MO', salaire_min: 75000 }, { code: '6B', salaire_min: 99200 }],
      pointage: [
        /* semaine du lundi 5/10 : 6 jours x 10 h = 60 h > 55 h */
        { id: 'p1', employee_id: 'c', date: '2026-10-05', h_j_manual: '10' },
        { id: 'p2', employee_id: 'c', date: '2026-10-06', h_j_manual: '10' },
        { id: 'p3', employee_id: 'c', date: '2026-10-07', h_j_manual: '10' },
        { id: 'p4', employee_id: 'c', date: '2026-10-08', h_j_manual: '10' },
        { id: 'p5', employee_id: 'c', date: '2026-10-09', h_j_manual: '10' },
        { id: 'p6', employee_id: 'c', date: '2026-10-10', h_n_manual: '10' }
      ]
    })
  };
  let r;
  try { r = charger(store); } catch (e) { rapport.ko('chargement du module : ' + e.message); return; }
  const C = r.C;

  const R = C.regles;
  if (R.smigMensuel === 75000 && R.congeJoursParMois === 2.2 && R.majorations.hs41a46 === 0.15 && R.hsMaxSemaine === 15 && R.cnps.plafondPfAt === 75000 && R.taxesPatronales.formationContinue === 0.012)
    rapport.ok('regles chiffrees : SMIG 75 000, conges 2,2 j, HS +15 %, 15 h/sem max, plafond PF/AT 75 000, FPC 1,2 %');
  else rapport.ko('regles chiffrees inattendues : ' + JSON.stringify(R).slice(0, 300));

  const l = C.controler(mois);
  function a(id, sujet) { return l.some(x => x.employe.indexOf(id) === 0 && x.sujet.indexOf(sujet) === 0); }
  const checks = {
    smig: a('A1', 'Salaire sous le SMIG'),
    cat: a('B1', 'Salaire sous le minimum de la catégorie'),
    conformeSansErreur: !l.some(x => x.employe.indexOf('C1') === 0 && x.niveau === 'erreur'),
    hs: a('C1', 'Plus de 15 h supplémentaires'),
    entree: a('D1', 'Date d’entrée absente'),
    sansCat: a('D1', 'Catégorie non renseignée'),
    journalier: a('E1', 'Taux journalier sous le SMIG'),
    sortiIgnore: !l.some(x => x.employe.indexOf('F1') === 0),
    etrangerLocal: a('G1', 'Étranger traité en personnel local'),
    expatOk: !l.some(x => x.employe.indexOf('H1') === 0)
  };
  const ko = Object.keys(checks).filter(k => !checks[k]);
  if (!ko.length) rapport.ok('conformite : SMIG, minimum de categorie, > 15 h sup/semaine, fiche incomplete, journalier sous SMIG, etranger en personnel local signale ; sorti et expatrie declare sans remarque');
  else rapport.ko('conformite : controles manquants ' + ko.join(', ') + ' -> ' + JSON.stringify(l.map(x => x.employe + ':' + x.sujet)));

  const h = C.render(r.el);
  if (h.indexOf('Convention collective') !== -1 && h.indexOf('Prime d’ancienneté') !== -1 && h.indexOf('CCI art. 55') !== -1)
    rapport.ok('affichage : fiches consultables avec article (ex. prime d’anciennete, CCI art. 55)');
  else rapport.ko('affichage incomplet');
  if (h.indexOf('Qui est « personnel expatrié »') !== -1 && h.indexOf('3338') !== -1) rapport.ok('fiche « Qui est personnel expatrie ? » (note DGI 3338/2002) presente');
  else rapport.ko('fiche expatrie absente');
  C._q('préavis');
  if (r.el.innerHTML.indexOf('Préavis') !== -1 && r.el.innerHTML.indexOf('Prime d’ancienneté') === -1) rapport.ok('recherche : « préavis » ne garde que les fiches concernees');
  else rapport.ko('recherche inefficace');
}
module.exports = { run: run };
