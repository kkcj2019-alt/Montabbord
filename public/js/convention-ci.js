/* ============================================================================
   CONVENTION-CI.JS — Droit du travail ivoirien dans Montabbord
   Module PARTAGE par les 3 applications (Gestion, Paie, Exploitation) :
     1. CONSULTATION : regles du Code du travail (loi 2015-532), de la
        Convention collective interprofessionnelle (CCI 1977, version 2024),
        des decrets et baremes en vigueur, avec article et source officielle ;
     2. REGLES : les memes valeurs exposees aux calculs (ConventionCI.regles) ;
     3. CONFORMITE : controle des fiches employes et des pointages (salaire
        sous le SMIG ou sous le minimum de la categorie, heures supplementaires
        au-dela de 15 h/semaine, fiche incomplete...).
   Les donnees sont lues dans le stockage local commun (mdb_employes, mdb_paye).
   Verifie le 24/10/2026 sur les sources citees. A mettre a jour si la loi change.
   ============================================================================ */
(function () {
  'use strict';
  if (window.ConventionCI) return;

  var SRC = {
    ccI: { t: 'Convention collective interprofessionnelle (version 2024)', u: 'https://civlii.laws.africa/en/akn/ci/act/convention/1977/convention-collective-interprofessionnelle/fra@2024-02-16/source' },
    ctConges: { t: 'Code du travail 2015, chapitre 5 : congés payés', u: 'https://loidici.biz/2018/08/26/chapitre-5-conges-payes-et-permissions-exceptionnelles-2015/lois-article-par-article/codes/le-code-du-travail/1650/naty/' },
    ccSalaire: { t: 'Convention collective, titre IV : salaire', u: 'https://loidici.biz/2018/09/12/titre-iv-salaire/lois-article-par-article/plus-de-textes-de-lois/la-convention-collective-interpro/5329/naty/' },
    decret2024: { t: 'Décret n° 2024-898 du 16 octobre 2024 relatif à la durée du travail', u: 'https://loidici.biz/2026/01/08/la-duree-du-travail-en-vigueur/lois-article-par-article/codes/le-code-du-travail/75129/naty/' },
    cnps: { t: 'CNPS : nouveau plafond des cotisations (01/01/2023)', u: 'https://www.cnps.ci/wp-content/uploads/2023/01/NOUVEAU-PLAFOND-DES-COTISATIONS-SOCIALES-DE-LA-CNPS.pdf' },
    dgi: { t: 'DGI : impôts et taxes en Côte d’Ivoire', u: "https://www.dgi.gouv.ci/assets/documents/IMPOTS%20ET%20TAXES%20EN%20COTE%20D'IVOIRE%20.pdf" },
    fdfp: { t: 'FDFP : taxes de formation', u: 'https://fdfp.ci/presentation-du-fdfp/' },
    transport: { t: 'CGECI : revalorisation de la prime de transport', u: 'https://cgeci.com/prime-de-transport-dans-le-secteur-prive-les-mesures-de-revalorisation-entree-en-vigueur/' },
    pwc: { t: 'PwC Worldwide Tax Summaries : Côte d’Ivoire', u: 'https://taxsummaries.pwc.com/ivory-coast/individual/taxes-on-personal-income' },
    cleiss: { t: 'CLEISS : cotisations en Côte d’Ivoire (SMIG au 01/01/2023)', u: 'https://www.cleiss.fr/docs/cotisations/cotedivoire.html' },
    expat: { t: 'Contrat de travail expatrié (note DGI n° 3338 du 26/12/2002, arrêtés AGEPE 2004 et 2019)', u: 'https://www.mhconsultingafrica.com/fr/actualites/contrat-de-travail-expatrie' }
  };

  /* Valeurs chiffrees utilisables par les calculs */
  var SMIG = 75000;
  var REGLES = {
    smigMensuel: SMIG,                         /* depuis le 01/01/2023, 40 h/semaine */
    heuresMois: 173.33,
    smigHoraire: Math.round(SMIG / 173.33 * 100) / 100,
    dureeHebdo: 40,
    hsMaxSemaine: 15,
    majorations: { hs41a46: 0.15, hsAuDela46: 0.50, nuit: 0.75, dimancheJour: 0.75, dimancheNuit: 1.00 },
    nuit: { debut: '21:00', fin: '05:00' },
    congeJoursParMois: 2.2,
    congeMajorations: [[30, 8], [25, 7], [20, 5], [15, 3], [10, 2], [5, 1]],
    anciennete: { debutAnnees: 2, tauxDebut: 0.02, parAn: 0.01, plafond: 0.25 },
    gratificationMin: 0.75,
    transport: { abidjan: 30000, bouake: 24000, autres: 20000 },
    licenciement: [[5, 0.30], [10, 0.35], [Infinity, 0.40]],
    cnps: { retraiteSal: 0.063, retraitePat: 0.077, plafondRetraite: 3375000, pf: 0.05, maternite: 0.0075, atMin: 0.02, atMax: 0.05, plafondPfAt: 75000, cmuParPersonne: 1000 },
    its: [[75000, 0], [240000, 0.16], [800000, 0.21], [2400000, 0.24], [8000000, 0.28], [Infinity, 0.32]],
    ricfDemiPart: 5500, ricfMax: 44000,
    taxesPatronales: { contributionNationale: 0.012, taxeApprentissage: 0.004, formationContinue: 0.012, contributionEmployeurExpatrie: 0.092 }
  };
  REGLES.panier = Math.round(3 * REGLES.smigHoraire);
  REGLES.salissure = Math.round(13 * REGLES.smigHoraire);
  REGLES.outillage = Math.round(10 * REGLES.smigHoraire);
  REGLES.entretienTenue = Math.round(7 * REGLES.smigHoraire);

  function f(n) { try { return new Intl.NumberFormat('fr-FR').format(Math.round(n)); } catch (e) { return String(Math.round(n)); } }

  /* ---------- Fiches de consultation ---------- */
  var FICHES = [
    { th: 'Salaire', titre: 'SMIG (salaire minimum)', ref: 'En vigueur depuis le 01/01/2023', src: 'cleiss',
      txt: 'Salaire minimum interprofessionnel : ' + f(SMIG) + ' F CFA par mois pour 40 h par semaine, soit environ ' + f(REGLES.smigHoraire) + ' F de l’heure (173,33 h par mois).' },
    { th: 'Salaire', titre: 'Salaire minimum de la catégorie', ref: 'CCI, classification et barème', src: 'ccI',
      txt: 'Chaque travailleur est classé dans une catégorie dont le salaire minimum ne peut pas être dépassé à la baisse. Le salaire de base ne peut pas être inférieur au minimum de sa catégorie.' },
    { th: 'Salaire', titre: 'Prime d’ancienneté', ref: 'CCI art. 55', src: 'ccSalaire',
      txt: '2 % après 2 ans d’ancienneté, puis +1 % par année supplémentaire jusqu’à la 25e année incluse (25 % au maximum). Calculée sur le salaire minimum de la catégorie du travailleur.' },
    { th: 'Salaire', titre: 'Gratification (prime de fin d’année)', ref: 'CCI art. 53', src: 'ccSalaire',
      txt: 'Au moins les 3/4 du salaire minimum conventionnel mensuel de la catégorie. Versée au prorata du temps de service pour un travailleur entré, sorti ou licencié en cours d’année.' },
    { th: 'Salaire', titre: 'Prime de panier', ref: 'CCI art. 54', src: 'ccSalaire',
      txt: 'Égale à 3 fois le SMIG horaire (≈ ' + f(REGLES.panier) + ' F) : 6 heures consécutives de nuit, ou journée de 10 heures prolongée d’au moins une heure dans la nuit, ou 10 heures continues de jour.' },
    { th: 'Salaire', titre: 'Indemnité de transport', ref: 'CCI art. 56 ; arrêté 2020', src: 'transport',
      txt: 'Minimum mensuel : ' + f(REGLES.transport.abidjan) + ' F à Abidjan, ' + f(REGLES.transport.bouake) + ' F à Bouaké, ' + f(REGLES.transport.autres) + ' F dans les autres villes. Déplacements fréquents pour l’employeur : remboursement des frais réels.' },
    { th: 'Salaire', titre: 'Primes de salissure, d’outillage, d’entretien de la tenue', ref: 'CCI art. 60, 61', src: 'ccI',
      txt: 'Salissure : 13 × SMIG horaire (≈ ' + f(REGLES.salissure) + ' F/mois). Outillage fourni par le travailleur : 10 × SMIG horaire (≈ ' + f(REGLES.outillage) + ' F/mois). Entretien de la tenue par le travailleur : 7 × SMIG horaire (≈ ' + f(REGLES.entretienTenue) + ' F/mois).' },
    { th: 'Durée du travail', titre: 'Durée légale et heures supplémentaires', ref: 'Décret 2024-898 art. 2, 25, 27', src: 'decret2024',
      txt: '40 heures par semaine (entreprises non agricoles). Majorations : +15 % de la 41e à la 46e heure, +50 % au-delà de la 46e, +75 % la nuit, +75 % le dimanche et les jours fériés de jour, +100 % le dimanche et les jours fériés de nuit. Au plus 15 heures supplémentaires par semaine et 3 heures par jour.' },
    { th: 'Durée du travail', titre: 'Heures de nuit', ref: 'CCI art. 51', src: 'ccSalaire',
      txt: 'Les heures de nuit sont celles effectuées entre 21 h et 5 h. Les heures de nuit comprises dans les 40 heures de la semaine sont des heures normales ; la majoration de +75 % porte sur les heures supplémentaires de nuit.' },
    { th: 'Congés', titre: 'Acquisition des congés payés', ref: 'Code du travail art. 25.1', src: 'ctConges',
      txt: '2,2 jours ouvrables par mois de service effectif, soit 26,4 jours ouvrables par an. Jours ouvrables = tous les jours sauf le dimanche (et les jours fériés).' },
    { th: 'Congés', titre: 'Majorations des congés', ref: 'Code du travail art. 25.2', src: 'ctConges',
      txt: 'Selon l’ancienneté dans l’entreprise : +1 jour après 5 ans, +2 après 10, +3 après 15, +5 après 20, +7 après 25, +8 après 30. Enfants dont le salarié a la garde : +2 jours par enfant si le salarié a moins de 21 ans en fin de période ; s’il a plus de 18 ans, +2 jours par enfant à partir du 4e. +1 jour pour la médaille d’honneur du travail.' },
    { th: 'Congés', titre: 'Absences qui ne réduisent pas le congé', ref: 'Code du travail art. 25.3', src: 'ctConges',
      txt: 'Les absences pour accident du travail ou maladie professionnelle, et la maladie constatée par un médecin agréé (dans la limite de 6 mois), ne sont pas déduites du congé acquis.' },
    { th: 'Congés', titre: 'Allocation de congé', ref: 'Code du travail art. 25.7, 25.9', src: 'ctConges',
      txt: 'L’allocation, versée au départ en congé, est au moins égale aux salaires et éléments de rémunération que le travailleur aurait perçus. Travailleurs à l’heure ou à la journée : 1/12 de la rémunération de la période.' },
    { th: 'Fin de contrat', titre: 'Préavis', ref: 'CCI art. 34, 35', src: 'ccI',
      txt: 'Mensuels catégories 1 à 5 : 1 mois jusqu’à 6 ans, 2 mois de 6 à 11 ans, 3 mois de 11 à 16 ans, 4 mois au-delà. Catégorie 6 et plus : 3 mois jusqu’à 16 ans, 4 mois au-delà. Horaires et journaliers : 8 jours (< 6 mois), 15 jours (< 1 an), puis comme les mensuels. Préavis non respecté : indemnité égale au salaire de la période restante.' },
    { th: 'Fin de contrat', titre: 'Indemnité de licenciement', ref: 'CCI art. 39', src: 'ccI',
      txt: 'Par année de service, en pourcentage du salaire global mensuel moyen des 12 derniers mois : 30 % jusqu’à 5 ans, 35 % de la 6e à la 10e année, 40 % au-delà. Fractions d’année au prorata. Non due en cas de faute lourde.' },
    { th: 'Fin de contrat', titre: 'Indemnité de départ à la retraite', ref: 'CCI art. 40', src: 'ccI',
      txt: 'Calculée sur la même base que l’indemnité de licenciement (art. 39).' },
    { th: 'Cotisations', titre: 'CNPS', ref: 'CNPS, plafonds au 01/01/2023', src: 'cnps',
      txt: 'Retraite : 6,3 % salarié + 7,7 % employeur, plafond ' + f(REGLES.cnps.plafondRetraite) + ' F/mois. Prestations familiales 5 %, maternité 0,75 %, accident du travail 2 à 5 % (employeur), plafond ' + f(REGLES.cnps.plafondPfAt) + ' F/mois. CMU : 1 000 F par personne et par mois (500 salarié, 500 employeur).' },
    { th: 'Cotisations', titre: 'ITS (impôt sur salaire)', ref: 'CGI, réforme 2024', src: 'dgi',
      txt: 'Barème mensuel : 0 % jusqu’à 75 000 F ; 16 % jusqu’à 240 000 ; 21 % jusqu’à 800 000 ; 24 % jusqu’à 2 400 000 ; 28 % jusqu’à 8 000 000 ; 32 % au-delà. Réduction pour charges de famille : 5 500 F par demi-part au-delà de la première part, 44 000 F au plus (5 parts).' },
    { th: 'Cotisations', titre: 'Taxes patronales sur salaires', ref: 'CGI art. 146 ; FDFP', src: 'dgi',
      txt: 'Contribution nationale 1,2 % (locaux et expatriés) ; taxe d’apprentissage 0,4 % ; taxe additionnelle à la formation professionnelle continue 1,2 %. Contribution employeur : 9,2 % pour le personnel expatrié, personnel local exonéré.' },
    { th: 'Cotisations', titre: 'Qui est « personnel expatrié » ?', ref: 'Note DGI n° 3338/MEMEF/DGI-DLC du 26/12/2002', src: 'expat',
      txt: 'Être étranger ne suffit pas. Est expatrié au sens de l’impôt : (1) tout salarié, quelle que soit sa nationalité, titulaire d’un contrat de travail expatrié visé par l’AGEPE ; (2) un salarié étranger sans contrat visé qui occupe de hautes fonctions (cadre, chef de chantier…) ou dont la rémunération, avantages compris, dépasse celle habituellement versée aux Ivoiriens. Un étranger embauché sur place aux conditions locales reste personnel local. Tout travailleur étranger doit avoir un contrat visé par le ministère de l’Emploi et une carte de travail.' },
    { th: 'Absences', titre: 'Congé de maternité', ref: 'Code du travail', src: 'ctConges',
      txt: '14 semaines (6 avant et 8 après l’accouchement), indemnisées par la CNPS.' }
  ];

  /* ---------- Lecture des donnees communes ---------- */
  function lsArr(k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function lsObj(k) { try { var v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; } }
  function aujourdHui() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function moisCourant() { return aujourdHui().slice(0, 7); }
  function nomEmp(e) { return ((e.matricule ? e.matricule + ' — ' : '') + (e.nom || '') + ' ' + (e.prenoms || '')).trim(); }
  function estActif(e, mois) {
    if (!e) return false;
    var st = String(e.statut || e.status || '').toLowerCase();
    if (st === 'inactif' || st === 'sorti' || st === 'parti') return false;
    var ds = String(e.date_sortie || '').slice(0, 7);
    if (ds && ds < mois) return false;
    return true;
  }
  function typeEmp(e) {
    if (e.type_contrat === 'Journalier') return 'journalier';
    if (e.type_contrat === 'Externe' || e.categorie === 'externe') return 'externe';
    return 'titulaire';
  }
  function heures(v) {
    if (v === undefined || v === null || v === '') return 0;
    var s = String(v).trim().toLowerCase().replace(',', '.');
    var m = s.match(/^(\d+)\s*[h:]\s*(\d{1,2})?$/);
    if (m) return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  /* Lundi de la semaine d'une date AAAA-MM-JJ */
  function lundi(d) {
    var x = new Date(String(d).slice(0, 10) + 'T12:00:00');
    var w = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - w);
    return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
  }

  /* ---------- Controles de conformite ---------- */
  function controler(mois) {
    mois = mois || moisCourant();
    var emps = lsArr('mdb_employes').filter(function (e) { return estActif(e, mois); });
    var paye = lsObj('mdb_paye');
    var cats = Array.isArray(paye.categories) ? paye.categories : [];
    var catBy = {}; cats.forEach(function (c) { if (c && c.code) catBy[c.code] = c; });
    var pts = Array.isArray(paye.pointage) ? paye.pointage : [];
    var tomb = {}; (Array.isArray(paye.pointage_tombstones) ? paye.pointage_tombstones : []).forEach(function (t) { tomb[String(t)] = true; });
    var out = [];
    function add(niv, e, sujet, detail, ref) { out.push({ niveau: niv, employe: e ? nomEmp(e) : '—', empId: e ? e.id : '', sujet: sujet, detail: detail, ref: ref }); }

    /* Heures par employe et par semaine (semaines touchant le mois) */
    var hSem = {};
    pts.forEach(function (p) {
      if (!p || !p.employee_id || !p.date || tomb[String(p.id)]) return;
      var d = String(p.date).slice(0, 10);
      var lu = lundi(d);
      var fin = new Date(lu + 'T12:00:00'); fin.setDate(fin.getDate() + 6);
      var finS = fin.getFullYear() + '-' + ('0' + (fin.getMonth() + 1)).slice(-2);
      if (lu.slice(0, 7) !== mois && finS !== mois) return;
      var k = p.employee_id + '|' + lu;
      hSem[k] = (hSem[k] || 0) + heures(p.h_j_manual) + heures(p.h_n_manual);
    });

    emps.forEach(function (e) {
      var t = typeEmp(e);
      var sal = parseFloat(e.salaire_base) || 0;
      if (t === 'titulaire') {
        if (sal > 0 && sal < REGLES.smigMensuel) add('erreur', e, 'Salaire sous le SMIG', 'Salaire de base ' + f(sal) + ' F < SMIG ' + f(REGLES.smigMensuel) + ' F (temps plein).', 'SMIG');
        var c = catBy[e.categorie_id];
        if (!e.categorie_id) add('info', e, 'Catégorie non renseignée', 'Sans catégorie, le minimum conventionnel et la prime d’ancienneté ne peuvent pas être contrôlés.', 'CCI classification');
        else if (c && (parseFloat(c.salaire_min) || 0) > 0 && sal > 0 && sal < parseFloat(c.salaire_min)) add('erreur', e, 'Salaire sous le minimum de la catégorie', 'Salaire de base ' + f(sal) + ' F < minimum de la catégorie ' + e.categorie_id + ' : ' + f(c.salaire_min) + ' F.', 'CCI barème');
      } else if (t === 'journalier') {
        var minJour = REGLES.smigHoraire * 8;
        if (sal > 0 && sal < minJour) add('erreur', e, 'Taux journalier sous le SMIG', 'Taux ' + f(sal) + ' F/jour < SMIG horaire × 8 h = ' + f(minJour) + ' F.', 'SMIG');
      }
      if (t !== 'externe') {
        if (!e.date_entree && !e.date_embauche) add('alerte', e, 'Date d’entrée absente', 'Ancienneté, congés, préavis et indemnités de départ ne peuvent pas être calculés.', 'Code du travail art. 25 ; CCI art. 39, 55');
        if (!e.num_cnps && !e.cnps) add('info', e, 'N° CNPS absent', 'Le numéro d’immatriculation CNPS est nécessaire aux déclarations.', 'CNPS');
        var nat = String(e.nationalite || '').trim().toLowerCase();
        var expa = e.expatrie === true || e.expatrie === 'oui' || e.expatrie === '1';
        if (nat && nat.indexOf('ivoir') === -1 && !expa) add('info', e, 'Étranger traité en personnel local', 'Nationalité « ' + e.nationalite + ' ». Correct s’il est embauché aux conditions locales ; à passer en « expatrié » s’il a un contrat expatrié visé ou un poste/salaire d’expatrié. Vérifier aussi le contrat visé et la carte de travail.', 'Note DGI 3338/2002');
      }
      Object.keys(hSem).forEach(function (k) {
        var parts = k.split('|');
        if (parts[0] !== String(e.id)) return;
        var h = hSem[k];
        if (h > REGLES.dureeHebdo + REGLES.hsMaxSemaine + 1e-6) add('alerte', e, 'Plus de 15 h supplémentaires', 'Semaine du ' + parts[1].split('-').reverse().join('/') + ' : ' + (Math.round(h * 10) / 10) + ' h pointées (> ' + (REGLES.dureeHebdo + REGLES.hsMaxSemaine) + ' h). Autorisation de l’inspection du travail nécessaire.', 'Décret 2024-898 art. 27');
      });
    });
    var ordre = { erreur: 0, alerte: 1, info: 2 };
    out.sort(function (a, b) { return (ordre[a.niveau] - ordre[b.niveau]) || a.employe.localeCompare(b.employe); });
    return out;
  }

  /* ---------- Affichage ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var etat = { onglet: 'regles', q: '', mois: '' };
  function css() {
    return '<style>' +
      '.ccv{font-family:inherit;color:inherit;max-width:1100px}' +
      '.ccv h2{font-size:1.15rem;margin:0 0 .3rem}' +
      '.ccv .sub{font-size:.8rem;opacity:.75;margin-bottom:.8rem}' +
      '.ccv .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:.8rem}' +
      '.ccv .tabs button{border:1px solid #cbd5e1;background:transparent;color:inherit;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;font-size:.82rem}' +
      '.ccv .tabs button.on{background:#1e3a8a;color:#fff;border-color:#1e3a8a}' +
      '.ccv input[type=search],.ccv input[type=month]{padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:.85rem;min-width:220px;max-width:100%;background:transparent;color:inherit}' +
      '.ccv .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}' +
      '.ccv .card{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:rgba(148,163,184,.06)}' +
      '.ccv .card .th{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;opacity:.65;font-weight:700}' +
      '.ccv .card h3{font-size:.92rem;margin:.15rem 0 .35rem}' +
      '.ccv .card p{font-size:.82rem;line-height:1.45;margin:0 0 .4rem}' +
      '.ccv .ref{font-size:.72rem;font-weight:700;color:#1d4ed8}' +
      '.ccv .ref a{color:inherit}' +
      '.ccv table{width:100%;border-collapse:collapse;font-size:.8rem}' +
      '.ccv th,.ccv td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}' +
      '.ccv .niv{font-weight:800;font-size:.7rem;padding:2px 7px;border-radius:10px;white-space:nowrap}' +
      '.ccv .niv.erreur{background:#fee2e2;color:#991b1b}.ccv .niv.alerte{background:#fef3c7;color:#92400e}.ccv .niv.info{background:#e0f2fe;color:#075985}' +
      '.ccv .vide{padding:18px;text-align:center;opacity:.7}' +
      '@media (max-width:600px){.ccv .grid{grid-template-columns:1fr}.ccv td,.ccv th{padding:5px}}' +
      '</style>';
  }
  function rendreRegles() {
    var q = etat.q.toLowerCase();
    var l = FICHES.filter(function (x) { return !q || (x.titre + ' ' + x.txt + ' ' + x.ref + ' ' + x.th).toLowerCase().indexOf(q) !== -1; });
    var h = '<div style="margin-bottom:.7rem"><input type="search" placeholder="Rechercher (ex : congé, nuit, préavis, CNPS)…" value="' + esc(etat.q) + '" oninput="ConventionCI._q(this.value)"></div>';
    if (!l.length) return h + '<div class="vide">Aucune règle ne correspond à « ' + esc(etat.q) + ' ».</div>';
    h += '<div class="grid">';
    l.forEach(function (x) {
      var s = SRC[x.src] || {};
      h += '<div class="card"><div class="th">' + esc(x.th) + '</div><h3>' + esc(x.titre) + '</h3><p>' + esc(x.txt) + '</p>' +
        '<div class="ref">' + esc(x.ref) + (s.u ? ' · <a href="' + esc(s.u) + '" target="_blank" rel="noopener">source</a>' : '') + '</div></div>';
    });
    return h + '</div>';
  }
  function rendreConformite() {
    var mois = etat.mois || moisCourant();
    var l = controler(mois);
    var nE = l.filter(function (x) { return x.niveau === 'erreur'; }).length, nA = l.filter(function (x) { return x.niveau === 'alerte'; }).length;
    var h = '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:.7rem"><label style="font-size:.82rem;font-weight:600">Mois contrôlé <input type="month" value="' + esc(mois) + '" onchange="ConventionCI._m(this.value)"></label>' +
      '<span style="font-size:.82rem">' + nE + ' erreur(s) · ' + nA + ' alerte(s) · ' + (l.length - nE - nA) + ' information(s)</span></div>';
    if (!l.length) return h + '<div class="vide">Aucun écart détecté pour ce mois.</div>';
    h += '<div style="overflow-x:auto"><table><thead><tr><th>Niveau</th><th>Employé</th><th>Point</th><th>Détail</th><th>Référence</th></tr></thead><tbody>';
    l.forEach(function (x) {
      h += '<tr><td><span class="niv ' + x.niveau + '">' + (x.niveau === 'erreur' ? 'Erreur' : x.niveau === 'alerte' ? 'Alerte' : 'Info') + '</span></td><td>' + esc(x.employe) + '</td><td style="font-weight:600">' + esc(x.sujet) + '</td><td>' + esc(x.detail) + '</td><td class="ref">' + esc(x.ref) + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }
  function rendreSources() {
    var h = '<p style="font-size:.82rem">Règles vérifiées le 24/10/2026 sur les textes suivants. En cas de changement de la loi, ces valeurs doivent être mises à jour.</p><ul style="font-size:.85rem;line-height:1.7">';
    Object.keys(SRC).forEach(function (k) { h += '<li><a href="' + esc(SRC[k].u) + '" target="_blank" rel="noopener">' + esc(SRC[k].t) + '</a></li>'; });
    return h + '</ul>';
  }
  var _hote = null;
  function render(el, opts) {
    if (el) _hote = el;
    if (!_hote) return '';
    var h = css() + '<div class="ccv"><h2>Convention collective et droit du travail</h2>' +
      '<div class="sub">Code du travail (loi 2015-532), Convention collective interprofessionnelle, décrets et barèmes en vigueur en Côte d’Ivoire.</div>' +
      '<div class="tabs">' +
      '<button class="' + (etat.onglet === 'regles' ? 'on' : '') + '" onclick="ConventionCI._t(\'regles\')">Règles</button>' +
      '<button class="' + (etat.onglet === 'conformite' ? 'on' : '') + '" onclick="ConventionCI._t(\'conformite\')">Conformité</button>' +
      '<button class="' + (etat.onglet === 'sources' ? 'on' : '') + '" onclick="ConventionCI._t(\'sources\')">Sources</button></div>' +
      (etat.onglet === 'conformite' ? rendreConformite() : etat.onglet === 'sources' ? rendreSources() : rendreRegles()) + '</div>';
    _hote.innerHTML = h;
    return h;
  }
  function rerender(focusSearch) {
    render();
    if (focusSearch && _hote) { try { var i = _hote.querySelector('input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } catch (e) {} }
  }

  window.ConventionCI = {
    regles: REGLES,
    fiches: FICHES,
    sources: SRC,
    controler: controler,
    render: render,
    /* Nombre d'erreurs/alertes du mois (badge de menu, tableau de bord) */
    nbEcarts: function (mois) { return controler(mois).filter(function (x) { return x.niveau !== 'info'; }).length; },
    _t: function (o) { etat.onglet = o; rerender(false); },
    _q: function (v) { etat.q = String(v || ''); rerender(true); },
    _m: function (v) { etat.mois = String(v || ''); rerender(false); }
  };
})();
