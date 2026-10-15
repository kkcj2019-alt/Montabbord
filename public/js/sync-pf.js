/**
 * ACSER — Synchronisation Tripartite des Produits Finis
 * Assure une parfaite identité (nombre, codes, libellés, dimensions, prix)
 * entre Index (Nomenclature), Exploitation (Catalogue PF) et Paye (Articles Montage).
 * 
 * Règle d'or :
 * - Si un article est ajouté, modifié ou supprimé dans UNE application,
 *   il est automatiquement ajouté, modifié ou supprimé dans les DEUX autres.
 */

var TRI_PF_ALIASES = {
  'PAL114': ['114', 'PALETTES 114*114*12', 'PAL 114'],
  'PAL112': ['112', 'PALETTES 112*112*12', 'PAL 112'],
  'COUV114': ['COUVERCLES 114*114*4', 'COUVERCLE 114', 'COUV 114'],
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
  var cN = triPfNorm(code);
  var dN = triPfNorm(desig);
  for (var canon in TRI_PF_ALIASES) {
    if (cN === canon) return canon;
    var list = TRI_PF_ALIASES[canon];
    for (var i = 0; i < list.length; i++) {
      var aN = triPfNorm(list[i]);
      if (cN === aN || dN === aN) return canon;
    }
  }
  return code ? String(code).trim().toUpperCase() : '';
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

  // 2. Depuis mdb_production
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
      if (!canon) return;
      var lVal = parseFloat(a.length || a.longueur) || 0;
      var wVal = parseFloat(a.width || a.largeur) || 0;
      var tVal = parseFloat(a.thickness || a.epaisseur) || 0;
      if (!map[canon]) {
        map[canon] = {
          code: canon,
          designation: a.designation || canon,
          prix_vente: parseFloat(a.prix_vente) || 0,
          prix_montage: parseFloat(a.prix_montage) || 150,
          longueur: lVal,
          largeur: wVal,
          epaisseur: tVal,
          destination: a.destination || ''
        };
      } else {
        // Enrichir dimensions / destination si absents
        if (!map[canon].longueur && lVal > 0) map[canon].longueur = lVal;
        if (!map[canon].largeur && wVal > 0) map[canon].largeur = wVal;
        if (!map[canon].epaisseur && tVal > 0) map[canon].epaisseur = tVal;
        if (!map[canon].destination && a.destination) map[canon].destination = a.destination;
        if (!map[canon].prix_vente && parseFloat(a.prix_vente) > 0) map[canon].prix_vente = parseFloat(a.prix_vente);
        if (a.designation && (!map[canon].designation || map[canon].designation === canon)) map[canon].designation = a.designation;
      }
    });
  } catch (eP) {}

  // 3. Depuis mdb_paye (Articles Montage)
  try {
    var rawPaye = localStorage.getItem('mdb_paye');
    var payData = rawPaye ? JSON.parse(rawPaye) : {};
    var ams = Array.isArray(payData.articlesMontage) ? payData.articlesMontage : [];
    ams.forEach(function (a) {
      if (!a || !a.code) return;
      var canon = triPfCanonique(a.code, a.designation);
      if (!canon) return;
      if (!map[canon]) {
        map[canon] = {
          code: canon,
          designation: a.designation || canon,
          prix_vente: 0,
          prix_montage: parseFloat(a.prix) || 150,
          longueur: 0, largeur: 0, epaisseur: 0,
          destination: ''
        };
      } else {
        if (parseFloat(a.prix) > 0) map[canon].prix_montage = parseFloat(a.prix);
      }
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
function triSyncHarmoniserTout(forceList) {
  var list = Array.isArray(forceList) ? forceList : triSyncGetProduitsFinis();
  if (!list.length) return;

  var an = new Date().getFullYear();
  var canonSet = {};
  list.forEach(function (x) { canonSet[x.code] = x; });

  // 1. Mettre à jour mdb_nomenclature
  try {
    var rawNom = localStorage.getItem('mdb_nomenclature');
    var nom = rawNom ? JSON.parse(rawNom) : [];
    if (!Array.isArray(nom)) nom = [];

    // Conserver UNIQUEMENT les articles NON produits finis (matières premières, semi-finis, consommables)
    var newNom = nom.filter(function (a) {
      if (!a) return false;
      var tNorm = String(a.typeArticle || '').toLowerCase().replace(/[^a-z]/g, '');
      var cNorm = String(a.categorie || '').toLowerCase().replace(/[^a-z]/g, '');
      var isPF = (tNorm === 'produitfini' || cNorm === 'finished' || cNorm === 'produitfini');
      var canon = triPfCanonique(a.code, a.designation);
      if (canon && canonSet[canon]) isPF = true;
      return !isPF;
    });

    // Ajouter chaque Produit Fini canonique
    list.forEach(function (pf) {
      newNom.push({
        id: 'pf_' + pf.code,
        code: pf.code,
        designation: pf.designation,
        typeArticle: 'produit_fini',
        commercialise: true,
        longueur: pf.longueur || 0,
        largeur: pf.largeur || 0,
        epaisseur: pf.epaisseur || 0,
        destination: pf.destination || '',
        prix_montage: pf.prix_montage || 150,
        prixPeriodes: pf.prix_vente > 0 ? [{ dateDebut: an + '-01-01', dateFin: an + '-12-31', prixUnitaire: pf.prix_vente }] : []
      });
    });

    localStorage.setItem('mdb_nomenclature', JSON.stringify(newNom));
  } catch (e1) {}

  // 2. Mettre à jour mdb_production.articles
  try {
    var rawProd = localStorage.getItem('mdb_production');
    var pData = rawProd ? JSON.parse(rawProd) : {};
    var pArts = Array.isArray(pData.articles) ? pData.articles : [];

    // Conserver les composants / matières / consommables locaux
    var newPArts = pArts.filter(function (a) {
      if (!a) return false;
      var tNorm = String(a.typeArticle || '').toLowerCase().replace(/[^a-z]/g, '');
      var cNorm = String(a.categorie || '').toLowerCase().replace(/[^a-z]/g, '');
      var isPF = (cNorm === 'finished' || tNorm === 'produitfini' || cNorm === 'produitfini');
      var canon = triPfCanonique(a.code, a.designation);
      if (canon && canonSet[canon]) isPF = true;
      return !isPF;
    });

    // Conserver les composants (nomenclature technique) des anciens PF si existants
    var compoMap = {};
    pArts.forEach(function (a) {
      if (a && a.code && Array.isArray(a.composants)) compoMap[triPfCanonique(a.code, a.designation)] = a.composants;
    });

    list.forEach(function (pf) {
      newPArts.push({
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
        composants: compoMap[pf.code] || []
      });
    });

    pData.articles = newPArts;
    // Vider les fiches orphelines hors index
    pData.pfIgnores = [];
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
 */
function triSyncSupprimerProduitFini(codeOrId) {
  if (!codeOrId) return;
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
}

/**
 * Ajoute ou met à jour un Produit Fini dans les 3 applications simultanément.
 */
function triSyncSauvegarderProduitFini(art) {
  if (!art || !art.code) return;
  var canon = triPfCanonique(art.code, art.designation);
  var list = triSyncGetProduitsFinis();
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
}

// Initialisation automatique au chargement
if (typeof window !== 'undefined') {
  try {
    window.triSyncGetProduitsFinis = triSyncGetProduitsFinis;
    window.triSyncHarmoniserTout = triSyncHarmoniserTout;
    window.triSyncSupprimerProduitFini = triSyncSupprimerProduitFini;
    window.triSyncSauvegarderProduitFini = triSyncSauvegarderProduitFini;
  } catch (eW) {}
}
