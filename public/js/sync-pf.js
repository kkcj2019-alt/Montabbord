/**
 * ACSER — Synchronisation Tripartite des Produits Finis
 * Assure une parfaite identité (nombre, codes, libellés, dimensions, prix)
 * entre Index (Nomenclature), Exploitation (Catalogue PF) et Paye (Articles Montage).
 *
 * Regle d'or (source unique) :
 * - L'INDEX (Nomenclature) est le SEUL endroit ou l'on CREE, RENOMME et
 *   SUPPRIME un produit fini. C'est ce qui faisait diverger les postes
 *   (23 produits ici, 16 la-bas, suppressions qui revenaient) : plusieurs
 *   ecrivains se marchaient dessus.
 * - Exploitation et Paye RECOIVENT (lecture seule sur l'existence) ; leurs
 *   modifications de PRIX/dimensions d'un produit existant restent propagees.
 * - Toute creation/suppression/renommage hors index est REFUSEE avec un
 *   message qui redirige vers l'Index. La Nomenclature synchronisee
 *   (cloud) est la seule verite : les listes se realignent dessus.
 */

var TRI_PF_ALIASES = {
  'PAL114': ['114', 'PALETTES 114*114*12', 'PAL 114'],
  'PAL112': ['112', 'PALETTES 112*112*12', 'PAL 112'],
  'COUV114': ['COUVERCLES 114*114*4', 'COUVERCLE 114', 'COUV 114', 'COUV', 'COUVERCLES', 'COUVERCLE'],
  'COUV112': ['COUVERCLE 112', 'COUVERCLES 112', 'COUV 112'],
  'BBAG': ['BBAG', 'BBAG4V', 'BIG BAG', 'BIGBAG'],
  'BBOX': ['BBOXB', 'BBOX B', 'BIG BOX BANANE', 'BIG BOX'],
  'CP': ['BBOXCP', 'BBOX CP', 'BIG BOX CP', 'PAL CP'],
  'E1': ['PALETTE EURO I', 'PALETTE EURO 1', 'EURO 1', 'EURO1', 'PAL111'],
  'E2': ['PAL EURO 2', 'PALETTE EURO 2', 'EURO 2', 'EURO2', 'PAL112E2'],
  'MDI114': ['MDI', 'MONDI 114', 'PAL MONDI 114', 'MONDI'],
  'FRI140': ['FRIES', 'FRIESLAND 140', 'PAL FRIESLAND 140'],
  'FRI120': ['FRIESLAND 120', 'PAL FRIESLAND 120'],
  'EUROB': ['EUB', 'EURO BANANE', 'PAL EURO BANANE'],
  'NES': ['NESTLE', 'PAL NESTLE'],
  'COM': ['COMAFRUIT', 'PAL COMAFRUIT'],
  'FEV': ['FEVE', 'PAL FEVE'],
  'CC': ['CAFE CACAO', 'CAFÉ CACAO', 'PAL CAFE CACAO'],
  'KIB': ['KIBBLED', 'PAL KIBBLED']
};

function triPfNorm(s) {
  return String(s || '').trim().toUpperCase()
    .replace(/[ÉÈÊË]/g, 'E').replace(/[ÀÂÄ]/g, 'A').replace(/[ÎÏ]/g, 'I').replace(/[ÔÖ]/g, 'O').replace(/[ÛÜÙ]/g, 'U')
    .replace(/[^A-Z0-9]/g, '');
}

function triPfCanonique(code, desig) {
  /* Le code saisi par l'utilisateur est respecte strictement : pas de renommage arbitraire */
  if (!code) return '';
  return String(code).trim().toUpperCase();
}

/* Source unique : quelle application appelle ? (defaut index : tests, scripts) */
function triPfPage() {
  try {
    var p = String((typeof location !== 'undefined' && location.pathname) || '');
    if (p.indexOf('paye') !== -1) return 'paye';
    if (p.indexOf('production') !== -1) return 'production';
  } catch (e) {}
  return 'index';
}
var TRI_PF_MESSAGE_SOURCE = 'Produits finis : création, renommage et suppression dans l’Index (Nomenclature) uniquement. Exploitation et Paie reçoivent automatiquement.';
function triPfRefuser() {
  try { if (typeof toast === 'function') toast(TRI_PF_MESSAGE_SOURCE, 'error'); } catch (e) {}
  try { console.warn('[triSync] ' + TRI_PF_MESSAGE_SOURCE); } catch (e2) {}
  return false;
}
/* Nettoyage unique : les tombstones PF locales (jamais partagees entre
   postes) faisaient diverger les comptes. La Nomenclature synchronisee
   redevient la seule verite. */
var TRI_PF_NETTOYAGE_CLE = 'mdb_pf_tombstones_nettoyes_v1';
var TRI_PF_TOMBSTONE_KEY = 'mdb_pf_tombstones'; /* cle historique, nettoyee une fois */
function triPfNettoyerTombstones() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(TRI_PF_NETTOYAGE_CLE) === '1') return;
    localStorage.removeItem(TRI_PF_TOMBSTONE_KEY);
    localStorage.setItem(TRI_PF_NETTOYAGE_CLE, '1');
  } catch (e) {}
}

/**
 * Lit et fusionne les Produits Finis des 3 applications, élimine les doublons,
 * et renvoie la liste canonique uniforme.
 */
function triSyncGetProduitsFinis() {
  var map = {};

  // 1. Depuis mdb_nomenclature
  try {
    var rawNom = localStorage.getItem('mdb_nomenclature');
    var nomList = rawNom ? JSON.parse(rawNom) : [];
    if (Array.isArray(nomList)) {
      nomList.forEach(function (a) {
        if (!a || !a.code) return;
        var typ = String(a.typeArticle || '').toLowerCase();
        var cat = String(a.categorie || '').toLowerCase();
        var isPF = (typ === 'produit_fini' || cat === 'finished' || cat === 'produit_fini');
        if (!isPF) return;
        var canon = triPfCanonique(a.code, a.designation);
        if (!canon) return;
        var px = 0;
        if (Array.isArray(a.prixPeriodes) && a.prixPeriodes.length) {
          px = parseFloat(a.prixPeriodes[a.prixPeriodes.length - 1].prixUnitaire) || 0;
        } else {
          px = parseFloat(a.prixUnitaire || a.prix_vente) || 0;
        }
        var lVal = parseFloat(a.longueur || a.length) || 0;
        var wVal = parseFloat(a.largeur || a.width) || 0;
        var tVal = parseFloat(a.epaisseur || a.thickness) || 0;
        if (!map[canon]) {
          map[canon] = {
            code: canon,
            designation: a.designation || canon,
            prix_vente: px,
            prix_montage: parseFloat(a.prix_montage) || 150,
            longueur: lVal,
            largeur: wVal,
            epaisseur: tVal,
            destination: a.destination || ''
          };
        } else {
          if (!map[canon].prix_vente && px > 0) map[canon].prix_vente = px;
          if (!map[canon].longueur && lVal > 0) map[canon].longueur = lVal;
          if (!map[canon].largeur && wVal > 0) map[canon].largeur = wVal;
          if (!map[canon].epaisseur && tVal > 0) map[canon].epaisseur = tVal;
          if (!map[canon].destination && a.destination) map[canon].destination = a.destination;
          if (a.designation && (!map[canon].designation || map[canon].designation === canon)) map[canon].designation = a.designation;
        }
      });
    }
  } catch (eN) {}

  // 2. Depuis mdb_production — ENRICHISSEMENT UNIQUEMENT (la Nomenclature est le maitre)
  //    Un PF present dans production mais ABSENT de mdb_nomenclature est ignore :
  //    il ne doit pas « contaminer » les autres applications.
  try {
    var rawProd = localStorage.getItem('mdb_production');
    var pData = rawProd ? JSON.parse(rawProd) : {};
    var pArts = Array.isArray(pData.articles) ? pData.articles : [];
    pArts.forEach(function (a) {
      if (!a || !a.code) return;
      var cat = String(a.categorie || '').toLowerCase();
      var typ = String(a.typeArticle || '').toLowerCase();
      var isPF = (cat === 'finished' || cat === 'produit_fini' || typ === 'produit_fini');
      if (!isPF) return;
      var canon = triPfCanonique(a.code, a.designation);
      if (!canon || !map[canon]) return; /* PAS dans la Nomenclature -> ignore */
      var lVal = parseFloat(a.length || a.longueur) || 0;
      var wVal = parseFloat(a.width || a.largeur) || 0;
      var tVal = parseFloat(a.thickness || a.epaisseur) || 0;
      /* Enrichir dimensions / prix / destination si absents dans la Nomenclature */
      if (!map[canon].longueur && lVal > 0) map[canon].longueur = lVal;
      if (!map[canon].largeur && wVal > 0) map[canon].largeur = wVal;
      if (!map[canon].epaisseur && tVal > 0) map[canon].epaisseur = tVal;
      if (!map[canon].destination && a.destination) map[canon].destination = a.destination;
      if (!map[canon].prix_vente && parseFloat(a.prix_vente) > 0) map[canon].prix_vente = parseFloat(a.prix_vente);
      if (a.designation && (!map[canon].designation || map[canon].designation === canon)) map[canon].designation = a.designation;
    });
  } catch (eP) {}

  // 3. Depuis mdb_paye (Articles Montage) — ENRICHISSEMENT prix_montage UNIQUEMENT
  //    Un article present dans paye mais ABSENT de la Nomenclature est ignore.
  try {
    var rawPaye = localStorage.getItem('mdb_paye');
    var payData = rawPaye ? JSON.parse(rawPaye) : {};
    var ams = Array.isArray(payData.articlesMontage) ? payData.articlesMontage : [];
    ams.forEach(function (a) {
      if (!a || !a.code) return;
      var canon = triPfCanonique(a.code, a.designation);
      if (!canon || !map[canon]) return; /* PAS dans la Nomenclature -> ignore */
      if (parseFloat(a.prix) > 0) map[canon].prix_montage = parseFloat(a.prix);
    });
  } catch (eM) {}

  var res = [];
  for (var k in map) res.push(map[k]);
  res.sort(function (a, b) { return a.code.localeCompare(b.code); });
  return res;
}

/**
 * Synchronise les 3 applications sur la liste canonique uniforme.
 * Écrit de manière synchrone et idempotente dans :
 * 1. mdb_nomenclature
 * 2. mdb_production.articles
 * 3. mdb_paye.articlesMontage
 */

/* Nettoyage des doublons de composants causes par la fusion cloud. Les anciennes
   lignes genId (aleatoires) et les nouvelles lignes comp: (deterministes) ont des
   ids differents : a chaque sync, l'union par id les additionnait → lignes qui se
   dupliquent. Dedup par (article_id, type, code) SEULEMENT — sans dims ni
   position : deux posts qui divergent sur un champ ou une position gardent la
   meme ligne logique, et c'etait precisement ce qui empechait l'effacement.
   On garde la ligne avec l'id deterministe comp: si presente, sinon la premiere
   (les lignes locales passent en premier dans les fusions).
   GARDE EN PARITE avec production.html (meme corps de fonction). */
function pfComposantsNettoyerDoublons(comps) {
  if (!Array.isArray(comps) || comps.length < 2) return comps;
  var groupes = {}, ordre = [];
  for (var i = 0; i < comps.length; i++) {
    var c = comps[i];
    if (!c || typeof c !== 'object') continue;
    var cle = String(c.article_id || '') + '|' + String(c.type || '').toUpperCase() + '|' + String(c.code || '').trim().toUpperCase();
    if (!groupes[cle]) { groupes[cle] = []; ordre.push(cle); }
    groupes[cle].push(c);
  }
  var sortie = [];
  for (var j = 0; j < ordre.length; j++) {
    var g = groupes[ordre[j]];
    var choisie = g[0];
    for (var k = 0; k < g.length; k++) {
      if (String((g[k] && g[k].id) || '').indexOf('comp:') === 0) { choisie = g[k]; break; }
    }
    sortie.push(choisie);
  }
  return sortie;
}

function triSyncHarmoniserTout(forceList) {
  var _force = Array.isArray(forceList);
  var list = _force ? forceList : triSyncGetProduitsFinis();
  /* Source unique : la liste vient de la Nomenclature synchronisee. Un code
     supprime dans l'Index est simplement absent : il n'est jamais re-ajoute
     (les autres applications ne creent plus, donc rien ne ressuscite). */
  /* Liste vide = rien a propager, sauf ordre explicite de suppression
     (forceList, meme vide) qui doit vider Production/Paye. Avant, le
     `return` premature empechait de propager la suppression du dernier PF. */
  if (!list.length && !_force) return;

  var an = new Date().getFullYear();
  var canonSet = {};
  list.forEach(function (x) { canonSet[x.code] = x; });

  // 1. mdb_nomenclature est la SOURCE UNIQUE : on ne la vide JAMAIS !
  // On s'assure seulement que les PF y sont bien marques typeArticle = 'produit_fini'
  // sans toucher aux IDs existants ni aux prixPeriodes ni aux destinations.
  try {
    var rawNom = localStorage.getItem('mdb_nomenclature');
    var nom = rawNom ? JSON.parse(rawNom) : [];
    if (Array.isArray(nom)) {
      var nomMod = false;
      list.forEach(function (pf) {
        var existing = nom.find(function(a) { return a && String(a.code||'').trim().toUpperCase() === pf.code; });
        if (existing) {
          if (!existing.destination && pf.destination) { existing.destination = pf.destination; nomMod = true; }
        } else {
          nom.push({
            id: 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            code: pf.code,
            designation: pf.designation || pf.code,
            typeArticle: 'produit_fini',
            commercialise: true,
            longueur: pf.longueur || 0,
            largeur: pf.largeur || 0,
            epaisseur: pf.epaisseur || 0,
            destination: pf.destination || '',
            prixPeriodes: pf.prix_vente > 0 ? [{ dateDebut: an + '-01-01', dateFin: an + '-12-31', prixUnitaire: pf.prix_vente }] : []
          });
          nomMod = true;
        }
      });
      if (nomMod) {
        localStorage.setItem('mdb_nomenclature', JSON.stringify(nom));
        if (typeof _dbMemCache !== 'undefined' && _dbMemCache) delete _dbMemCache['mdb_nomenclature'];
      }
    }
  } catch (e1) {}

  // 2. Mettre à jour mdb_production.articles — MISE A JOUR EN PLACE.
  //    Avant : filtre + reconstruction avec un id « art_pf_CODE » : l'id de
  //    l'article changeait a chaque synchro, les composants (section separee,
  //    lies par article_id) devenaient orphelins, et les champs saisis par
  //    l'utilisateur (essence, portance, poids, traitement...) etaient jetes.
  //    C'etait la cause des fiches techniques qui « se perdaient ».
  try {
    var rawProd = localStorage.getItem('mdb_production');
    var pData = rawProd ? JSON.parse(rawProd) : {};
    var pArts = Array.isArray(pData.articles) ? pData.articles : [];

    /* References : un doublon de code ne doit jamais etre celui qui ne porte
       ni composant ni stock — l'autre perdrait sa fiche technique. */
    var refs = {};
    try {
      (Array.isArray(pData.composants) ? pData.composants : []).forEach(function (c) {
        if (c && c.article_id) refs[String(c.article_id)] = (refs[String(c.article_id)] || 0) + 1;
      });
      ['stockFinished', 'stockSemi'].forEach(function (sec) {
        (Array.isArray(pData[sec]) ? pData[sec] : []).forEach(function (s) {
          if (s && s.article_id) refs[String(s.article_id)] = (refs[String(s.article_id)] || 0) + 1;
        });
      });
    } catch (eRef) {}

    var dejaVus = {}; /* canon -> article retenu */
    var perdants = []; /* doublons PF perdu : { art, canon } a rattacher */
    var nonPF = [];

    /* 2a. Parcourir les articles existants : non-PF conserves tels quels,
       PF du canonSet mis a jour sur place (id et champs conserves), doublons
       et PF hors liste retires (supprimes de l'Index). */
    pArts.forEach(function (a) {
      if (!a) return;
      var canon = triPfCanonique(a.code, a.designation);
      var dansListe = !!(canon && canonSet[canon]);
      if (!dansListe) {
        /* Non-PF (lattes, matieres, consommables…) : conserve tel quel.
           PF hors Index : retire (source unique = Nomenclature). */
        var tNorm = String(a.typeArticle || '').toLowerCase().replace(/[^a-z]/g, '');
        var cNorm = String(a.categorie || '').toLowerCase().replace(/[^a-z]/g, '');
        var estPF = (cNorm === 'finished' || tNorm === 'produitfini' || cNorm === 'produitfini');
        if (!estPF) nonPF.push(a);
        return;
      }
      var retenu = dejaVus[canon];
      if (retenu) {
        /* Doublon : garde celui qui a des references (composants/stock),
           sinon la 1re occurrence. Le perdu n'est pas jete : ses composants
           et stocks sont rattaches au retenu juste apres — sinon la fiche
           gagnante restait incompletle et la synchro suivante additionnait
           les deux versions → lignes qui se dupliquaient. */
        if ((refs[String(a.id)] || 0) > (refs[String(retenu.id)] || 0)) {
          dejaVus[canon] = a;
          perdants.push({ art: retenu, canon: canon });
        } else {
          perdants.push({ art: a, canon: canon });
        }
        return;
      }
      dejaVus[canon] = a;
    });

    /* Rattacher les composants/stocks des doublons perdus au gagnant, puis
       dedupliquer les lignes de composants (meme article/type/code = meme
       ligne logique : les ids genId vs comp: ne doivent pas s'additionner). */
    try {
      perdants.forEach(function (e) {
        var gagnant = dejaVus[e.canon];
        if (!gagnant || !e.art || String(gagnant.id) === String(e.art.id)) return;
        var pid = String(e.art.id);
        (Array.isArray(pData.composants) ? pData.composants : []).forEach(function (c) {
          if (c && String(c.article_id) === pid) c.article_id = gagnant.id;
        });
        ['stockFinished', 'stockSemi'].forEach(function (sec) {
          (Array.isArray(pData[sec]) ? pData[sec] : []).forEach(function (s) {
            if (s && String(s.article_id) === pid) s.article_id = gagnant.id;
          });
        });
      });
      if (typeof pfComposantsNettoyerDoublons === 'function' &&
          Array.isArray(pData.composants) && pData.composants.length > 1) {
        var propres = pfComposantsNettoyerDoublons(pData.composants);
        if (propres.length !== pData.composants.length) pData.composants = propres;
      }
    } catch (eRm) {}

    var nouvelles = nonPF.slice();
    Object.keys(dejaVus).forEach(function (canon) {
      var a = dejaVus[canon];
      var pf = canonSet[canon];
      /* Mise à jour en place : l'id et tous les champs hors périmètre Index
         (essence, portance, poids, traitement, composants inline…) sont
         conservés. Seuls les champs sources-Index sont recalés. */
      a.code = pf.code;
      if (pf.designation) a.designation = pf.designation;
      if (pf.longueur) a.length = pf.longueur;
      if (pf.largeur) a.width = pf.largeur;
      if (pf.epaisseur) a.thickness = pf.epaisseur;
      if (pf.prix_vente > 0) a.prix_vente = pf.prix_vente;
      if (pf.prix_montage > 0) a.prix_montage = pf.prix_montage;
      if (pf.destination) a.destination = pf.destination;
      a.categorie = 'finished';
      a.typeArticle = 'produit_fini';
      nouvelles.push(a);
    });

    /* 2b. Creations : les PF de la liste absents localement. Id deterministe
       art_pf_CODE (identique sur tous les postes) : la fusion cloud reconnait
       alors le meme article au lieu d'en creer deux. */
    list.forEach(function (pf) {
      if (dejaVus[pf.code]) return;
      nouvelles.push({
        id: 'art_pf_' + pf.code,
        code: pf.code,
        designation: pf.designation,
        categorie: 'finished',
        typeArticle: 'produit_fini',
        length: pf.longueur || 0,
        width: pf.largeur || 0,
        thickness: pf.epaisseur || 0,
        destination: pf.destination || '',
        prix_vente: pf.prix_vente || 0,
        prix_montage: pf.prix_montage || 150,
        composants: []
      });
    });

    pData.articles = nouvelles;
    localStorage.setItem('mdb_production', JSON.stringify(pData));
  } catch (e2) {}

  // 3. Mettre à jour mdb_paye.articlesMontage (SANS AUCUN DOUBLON !)
  try {
    var rawPaye = localStorage.getItem('mdb_paye');
    var payData = rawPaye ? JSON.parse(rawPaye) : {};
    var ams = [];

    list.forEach(function (pf) {
      ams.push({
        code: pf.code,
        designation: pf.designation,
        prix: pf.prix_montage || 150,
        compte_prime: true,
        estProduitFini: true,
        updatedAt: Date.now()
      });
    });

    payData.articlesMontage = ams;
    localStorage.setItem('mdb_paye', JSON.stringify(payData));
  } catch (e3) {}

  // Déclencher rafraîchissement
  try {
    localStorage.setItem('mdb_pf_sync_event', JSON.stringify({ action: 'sync_all', count: list.length, time: Date.now() }));
  } catch (eEv) {}
}

/**
 * Supprime un Produit Fini de TOUTES les applications simultanément.
 * SOURCE UNIQUE : Index uniquement. Hors index : refuse, rien ne bouge.
 */
function triSyncSupprimerProduitFini(codeOrId) {
  if (!codeOrId) return false;
  triPfNettoyerTombstones();
  if (triPfPage() !== 'index') return triPfRefuser();
  var cStr = String(codeOrId).trim().toUpperCase();
  var canon = triPfCanonique(cStr, '');

  var list = triSyncGetProduitsFinis();
  var filtered = list.filter(function (x) {
    return x.code !== canon && triPfNorm(x.code) !== triPfNorm(cStr);
  });

  triSyncHarmoniserTout(filtered);

  // Supprimer aussi de mdb_nomenclature si cherché par ID
  try {
    var rawNom = localStorage.getItem('mdb_nomenclature');
    var nom = rawNom ? JSON.parse(rawNom) : [];
    if (Array.isArray(nom)) {
      var n2 = nom.filter(function (a) { return a && String(a.id) !== cStr && a.code !== canon; });
      localStorage.setItem('mdb_nomenclature', JSON.stringify(n2));
    }
  } catch (eN) {}

  // Supprimer de mdb_production si cherché par ID
  try {
    var rawProd = localStorage.getItem('mdb_production');
    var pData = rawProd ? JSON.parse(rawProd) : {};
    var pArts = Array.isArray(pData.articles) ? pData.articles : [];
    pData.articles = pArts.filter(function (a) { return a && String(a.id) !== cStr && a.code !== canon; });
    localStorage.setItem('mdb_production', JSON.stringify(pData));
  } catch (eP) {}

  // Supprimer de mdb_paye si cherché par code
  try {
    var rawPaye = localStorage.getItem('mdb_paye');
    var payData = rawPaye ? JSON.parse(rawPaye) : {};
    var ams = Array.isArray(payData.articlesMontage) ? payData.articlesMontage : [];
    payData.articlesMontage = ams.filter(function (a) { return a && a.code !== canon && triPfNorm(a.code) !== triPfNorm(cStr); });
    localStorage.setItem('mdb_paye', JSON.stringify(payData));
  } catch (eM) {}
  return true;
}

/**
 * Ajoute ou met à jour un Produit Fini dans les 3 applications simultanément.
 * SOURCE UNIQUE : creation et renommage dans l'Index uniquement (refuses
 * ailleurs). La mise a jour des champs d'un produit EXISTANT (prix,
 * dimensions, designation) reste propagee depuis tous les postes.
 */
function triSyncSauvegarderProduitFini(art, oldCode) {
  if (!art || !art.code) return false;
  triPfNettoyerTombstones();
  var canon = triPfCanonique(art.code, art.designation);
  var list = triSyncGetProduitsFinis();
  var existe = false;
  for (var ei = 0; ei < list.length; ei++) {
    if (list[ei] && list[ei].code === canon) { existe = true; break; }
  }
  var renomme = false;
  if (oldCode) {
    var oldCanon = triPfCanonique(oldCode, '');
    if (oldCanon && oldCanon !== canon) renomme = true;
  }
  if ((!existe || renomme) && triPfPage() !== 'index') return triPfRefuser();

  if (oldCode) {
    var oldCanon = triPfCanonique(oldCode, '');
    if (oldCanon && oldCanon !== canon) {
      list = list.filter(function (x) {
        return x.code !== oldCanon && triPfNorm(x.code) !== triPfNorm(oldCode);
      });
    }
  }

  var found = false;

  list.forEach(function (item) {
    if (item.code === canon) {
      found = true;
      if (art.designation) item.designation = art.designation;
      if (parseFloat(art.prix_vente) > 0) item.prix_vente = parseFloat(art.prix_vente);
      if (parseFloat(art.prix_montage) > 0) item.prix_montage = parseFloat(art.prix_montage);
      if (parseFloat(art.longueur) > 0) item.longueur = parseFloat(art.longueur);
      if (parseFloat(art.largeur) > 0) item.largeur = parseFloat(art.largeur);
      if (parseFloat(art.epaisseur) > 0) item.epaisseur = parseFloat(art.epaisseur);
      if (art.destination) item.destination = art.destination;
    }
  });

  if (!found) {
    list.push({
      code: canon,
      designation: art.designation || canon,
      prix_vente: parseFloat(art.prix_vente) || 0,
      prix_montage: parseFloat(art.prix_montage) || 150,
      longueur: parseFloat(art.longueur || art.length) || 0,
      largeur: parseFloat(art.largeur || art.width) || 0,
      epaisseur: parseFloat(art.epaisseur || art.thickness) || 0,
      destination: art.destination || ''
    });
  }

  triSyncHarmoniserTout(list);
  return true;
}

// Initialisation automatique au chargement
if (typeof window !== 'undefined') {
  try {
    window.triPfNorm = triPfNorm;
    window.triPfCanonique = triPfCanonique;
    window.triSyncGetProduitsFinis = triSyncGetProduitsFinis;
    window.triSyncHarmoniserTout = triSyncHarmoniserTout;
    window.triSyncSupprimerProduitFini = triSyncSupprimerProduitFini;
    window.triSyncSauvegarderProduitFini = triSyncSauvegarderProduitFini;
    window.triPfPage = triPfPage;
  } catch (eW) {}

  /* Auto-harmonisation au demarrage : nettoie les orphelins et aligne
     les 3 applications sur la Nomenclature comme source de verite.
     Delai de 3s pour laisser la page initialiser ses propres donnees. */
  /* Auto-harmonisation aveugle supprimee */
}
