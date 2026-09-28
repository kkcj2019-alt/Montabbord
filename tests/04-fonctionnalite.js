'use strict';
/* =====================================================================
   tests/04-fonctionnalite.js
   Garde-fous sur les comportements qui ont ete corriges ou qui sont
   spatiaux : si quelqu'un touche au code sans faire exprès, ces
   controles le signalent.

   C'est ce fichier qu'il faut enrichir quand on ajoute une fonction.
   ===================================================================== */
const vm = require('vm');
const { storeRealiste, storeCorrompu, chargerApp } = require('./lib/sandbox.js');

function controles() {
  const r = [];

  /* ---------- Exploitation : le pointage doit rester accessible ---------- */
  r.push({
    nom: 'Exploitation : le bouton « Marquer une présence » est présent',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'presence'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('showMarkPresence()') !== -1) ? 'OK' : 'ABSENT'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'Exploitation : showMarkPresence() construit sa modale',
    app: 'production.html', store: storeRealiste,
    code: `
      showMarkPresence();
      document.getElementById('pres_emp') ? 'OK' : 'ECHEC'
    `,
    attendu: 'OK'
  });

  /* ---------- Exploitation : le detail d'inventaire doit rester ---------- */
  r.push({
    nom: 'Exploitation : la fiche d\'inventaire garde son tableau par article',
    app: 'production.html', store: storeRealiste,
    code: `
      window.__capture = '';
      window.openModal = function (h) { window.__capture = h; };
      setSection('inventories', [{ id:'i1', date:'2026-09-30', month:'2026-09', supervisor:'Chef',
        articles_comptes:2, ecarts:1, heure_debut:'08:00', heure_fin:'17:00',
        items:[ { code:'PAL', nom:'Palette', categorie:'PF', theo_qte:100, real_qte:95 },
                { code:'COU', nom:'Couvercle', categorie:'PF', theo_qte:50, real_qte:52 } ] }]);
      viewInventory('i1');
      var h = window.__capture || '';
      var ok = h.indexOf('<table') !== -1 && h.indexOf('PAL') !== -1 && h.indexOf('COU') !== -1;
      ok ? 'OK' : 'TABLEAU ABSENT'
    `,
    attendu: 'OK'
  });

  /* ---------- Lectures typees : une donnee abimee ne doit rien casser ---------- */
  r.push({
    nom: 'Exploitation : une section corrompue ne casse pas la page Achats',
    app: 'production.html', store: storeCorrompu,
    code: `
      CURRENT_PAGE = 'achats'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.length > 40 && h.indexOf("n'a pas pu s'afficher") === -1) ? 'OK' : 'PAGE CASSEE'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'Exploitation : une section corrompue ne casse pas le tableau de bord',
    app: 'production.html', store: storeCorrompu,
    code: `
      CURRENT_PAGE = 'dashboard'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.length > 40 && h.indexOf("n'a pas pu s'afficher") === -1) ? 'OK' : 'PAGE CASSEE'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'Exploitation : les pages d\'analyse fonctionnent meme en donnees corrompues',
    app: 'production.html', store: storeCorrompu,
    code: `
      var res = [];
      ['analyse-couts', 'cout-revient', 'articles', 'stock-raw', 'inventory', 'epi'].forEach(function (p) {
        CURRENT_PAGE = p; renderPage();
        var h = document.getElementById('content').innerHTML || '';
        if (h.length < 40 || h.indexOf("n'a pas pu s'afficher") !== -1) res.push(p);
      });
      res.length ? 'CASSEE : ' + res.join(', ') : 'OK'
    `,
    attendu: 'OK'
  });

  /* ---------- Impression caisse : le resultat filtre s'imprime juste ---------- */
  r.push({
    nom: 'Caisse : l\u2019impression lit les bonnes colonnes (beneficiaire, moyen, solde)',
    app: 'index.html', store: storeRealiste,
    code: `
      /* Fausse ligne reproduisant la structure reelle du tableau :
         0 case, 1 Date, 2 Piece, 3 Code, 4 Libelle, 5 Entree, 6 Sortie,
         7 Charge, 8 Frais, 9 S+F, 10 Beneficiaire, 11 Executant,
         12 Moyen/N, 13 Remettant, 14 Obs, 15 Solde, 16 Actions. */
      function cellule(t) { return { textContent: t }; }
      var ligne = {
        cells: [cellule(''), cellule('28/09/26'), cellule('KKCJ2609176'), cellule('Carb-G'),
                cellule('Carburant-groupe'), cellule(''), cellule('- 41 000'), cellule(''), cellule('410'), cellule('41 410'),
                cellule('ODD - OULAI'), cellule(''), cellule('Wave/0707000155'), cellule('CAISSE KKCI - KANGA KOUAME'),
                cellule('-'), cellule('1 644 951'), cellule('')],
        getAttribute: function (k) {
          if (k === 'data-entree') return '0';
          if (k === 'data-sortie') return '41000';
          if (k === 'data-frais') return '410';
          return '';
        }
      };
      var o = _caisseRowToOp(ligne);
      (o.date === '28/09/26' && o.piece === 'KKCJ2609176' && o.code === 'Carb-G'
        && o.libelle === 'Carburant-groupe' && o.benef === 'ODD - OULAI'
        && o.moyen === 'Wave' && o.trans === '0707000155'
        && o.remettant === 'CAISSE KKCI - KANGA KOUAME' && o.soldeCell === '1 644 951'
        && o.sortie === 41000 && o.frais === 410)
        ? 'OK : beneficiaire, moyen, trans, remettant et solde lus aux bonnes colonnes'
        : 'ECHEC : ' + JSON.stringify(o)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : la recherche « carb » ne retient que les ecritures carburant',
    app: 'index.html', store: storeRealiste,
    code: `
      var a = { code: 'Carb-G', libelle: 'Carburant-groupe', numeroPiece: 'KKCJ1', executant: 'ODD', moyen: 'Wave', remettant: 'X', observations: '' };
      var b = { code: 'SAL', libelle: 'Salaire septembre', numeroPiece: 'KKCJ2', executant: 'Y', moyen: 'Cash', remettant: 'Z', observations: '' };
      (_caisseOpMatchRecherche(a, 'carb') === true && _caisseOpMatchRecherche(b, 'carb') === false
        && _caisseOpMatchRecherche(b, '') === true)
        ? 'OK : « carb » garde le carburant et ecarte le salaire, vide = tout'
        : 'ECHEC'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Code de validation administrateur ---------- */
  r.push({
    nom: 'Le changement du code de validation exige l\'ancien code',
    app: 'index.html', store: storeRealiste,
    code: `
      DB.set('mdb_entreprise', { nom:'ACSER', devise:'FCFA', validationCode:'1234' });
      var champ = document.getElementById('entValidationCode');
      champ.value = '9999';
      /* 1) mauvais ancien code -> refus, le code ne doit pas changer */
      window.prompt = function () { return '0000'; };
      saveEntreprise();
      var apresRefus = (getEntreprise().validationCode || '');
      /* 2) annulation -> refus */
      window.prompt = function () { return null; };
      champ.value = '9999';
      saveEntreprise();
      var apresAnnulation = (getEntreprise().validationCode || '');
      /* 3) bon ancien code -> accepte */
      window.prompt = function () { return '1234'; };
      champ.value = '9999';
      saveEntreprise();
      var apresOk = (getEntreprise().validationCode || '');
      (apresRefus === '1234' && apresAnnulation === '1234' && apresOk === '9999')
        ? 'OK' : 'refus=' + apresRefus + ' annulation=' + apresAnnulation + ' ok=' + apresOk
    `,
    attendu: 'OK'
  });

  /* ---------- Achat : modification d'un achat avec identifiant de type chaine ---------- */
  r.push({
    nom: 'Achat : modifier un achat dont l\'identifiant est une chaîne',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = getDB();
      d.achats = [{ id:'id_chaine_test', category:'consumables', date:'2026-09-21', reference:'FA-1',
        fournisseur:'Quincaillerie', items:[{ code:'P', quantity:2, unit_price:100, total_price:200 }],
        item_count:1, total_volume:0, montant_total:200 }];
      localStorage.setItem('mdb_production', JSON.stringify(d));
      editAchat('id_chaine_test');
      (String(window._editingAchatId) === 'id_chaine_test' &&
       document.getElementById('ach_ref').value === 'FA-1') ? 'OK' : 'ECHEC'
    `,
    attendu: 'OK'
  });

  /* ---------- Coût de revient : la page calcule bien un total ---------- */
  r.push({
    nom: 'Coût de revient : le calcul produit un coût unitaire',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('costLabor', { articleId:'a1', quantite:500, jours:10, tauxPerte:8,
        prixM3:0, structParM3:0, prixVente:45000,
        monteur:{nb:2,coutJour:35000}, machiniste:{nb:1,coutJour:40000}, manutentionnaire:{nb:1,coutJour:30000} });
      var c = acCalcul('2026-09-01','2026-09-30');
      (c && c.total > 0 && c.volUn > 0 && c.crUnitaire > 0)
        ? 'OK : ' + Math.round(c.crUnitaire) + ' F/palette, total ' + Math.round(c.total) + ' F'
        : 'ECHEC'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- CUMP : calculé à partir des achats réels ---------- */
  r.push({
    nom: 'Analyse des coûts : le CUMP du bois vient des achats',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = getDB();
      d.achats = [{ id:1, category:'raw-materials', date:'2026-09-03',
        items:[{ volume:50, essence:'Rouge', unit_price:150000, total_price:7500000 }] }];
      localStorage.setItem('mdb_production', JSON.stringify(d));
      var cuma = acCump('2026-09-01','2026-09-30');
      (Math.abs(cuma.prixM3 - 150000) < 1) ? 'OK : ' + Math.round(cuma.prixM3) + ' F/m3' : 'ECHEC : ' + cuma.prixM3
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Dette fournisseur sur le compte du fournisseur ---------- */
  r.push({
    nom: 'Achat : la dette est bien imputée au fournisseur',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_fournisseurs', JSON.stringify([{ id:'frn_x', nom:'Scierie Test' }]));
      syncProdAchatDette({ id:'a1', fournisseur:'Scierie Test', montant_total:450000, reference:'BL-9', date:'2026-09-20' });
      var d = JSON.parse(localStorage.getItem('mdb_dettesFournisseurs') || '[]');
      var e = null;
      for (var i = 0; i < d.length; i++) if (String(d[i].prodAchatId) === 'a1') e = d[i];
      (e && e.fournisseurId === 'frn_x' && e.montant === 450000)
        ? 'OK : ' + e.fournisseur + ' (' + e.fournisseurId + ') ' + e.montant + ' F'
        : 'ECHEC : ' + JSON.stringify(e)
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Tableau de bord : le stock de pointes compte en CARTONS ---------- */
  r.push({
    nom: 'Tableau de bord Exploitation : la carte « Stock Pointes (Paquets) » est presente',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'dashboard'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('STOCK POINTES (PAQUETS)') !== -1) ? 'OK' : 'ABSENT'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'Tableau de bord Exploitation : 100 pointes sont comptees en 2 cartons de 50',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var t = dashCartePointes().replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      (/\\b2 c\\./.test(t) && /100 paq ·/.test(t) && /100 paquets · 2 cartons/.test(t))
        ? 'OK : 2 cartons / 100 paquets'
        : 'ECHEC : ' + t.substr(0, 220)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Tableau de bord Exploitation : le nombre de cartons suit le reglage paquets/carton',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_packs_per_carton', '25');
      var t = dashCartePointes().replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      localStorage.setItem('mdb_packs_per_carton', '50');
      (/\\b4 cartons\\b/.test(t) && /25 paquets\\/carton/.test(t))
        ? 'OK : 4 cartons a 25 paquets/carton'
        : 'ECHEC : ' + t.substr(0, 220)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Tableau de bord : la carte Stock Pointes est compacte et partage la rangee des autres cartes',
    app: 'production.html', store: storeRealiste,
    code: `
      var h = dashCartePointes();
      /* Carte de meme gabarit que ses voisines : pas de pleine largeur,
         anneau reduit, et plus de bande a 5 colonnes. */
      (/class="card"/.test(h) && !/dash-card/.test(h) && /width:72px/.test(h)
        && !/flex-wrap:wrap/.test(h) && /TOTAL/.test(h))
        ? 'OK : carte compacte, anneau 72 px, integratee a la rangee'
        : 'ECHEC : ' + h.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').substr(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Achat de pointes : on saisit un PRIX PAR CARTON ---------- */
  r.push({
    nom: 'Achat pointes : 2 cartons a 45 000 F donnent bien 90 000 F',
    app: 'production.html', store: storeRealiste,
    code: `
      document.getElementById('ai_qte').value = '2';
      document.getElementById('ai_qte_paquet').value = '50';
      document.getElementById('ai_cond').value = '1000';
      document.getElementById('ai_pu').value = '45000';
      var c = apConsoCalc();
      (c.cartons === 2 && c.paquets === 100 && c.unites === 100000 && c.total === 90000)
        ? 'OK : 2 c / ' + c.paquets + ' paq / ' + c.unites + ' pointes / ' + c.total + ' F'
        : 'ECHEC : ' + JSON.stringify(c)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : le prix a la pointe vaut prix du carton / pointes du carton',
    app: 'production.html', store: storeRealiste,
    code: `
      document.getElementById('ai_qte').value = '2';
      document.getElementById('ai_qte_paquet').value = '50';
      document.getElementById('ai_cond').value = '1000';
      document.getElementById('ai_pu').value = '45000';
      document.getElementById('ai_code').value = 'P6';
      document.getElementById('ai_designation').value = 'Pointes 6';
      document.getElementById('ai_constype').value = 'POINTE';
      _tempAchatItems = [];
      addAchatItemLine('consumable');
      var it = _tempAchatItems[0];
      (it.cartons === 2 && it.paquets === 100 && it.quantity === 100000
        && it.prix_carton === 45000 && it.total_price === 90000
        && Math.abs(it.unit_price - 0.9) < 0.0001)
        ? 'OK : ' + it.cartons + ' carton(s), ' + it.unit_price + ' F/pointe, ' + it.total_price + ' F'
        : 'ECHEC : ' + JSON.stringify(it)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : la ligne reprise en modification conserve cartons et prix du carton',
    app: 'production.html', store: storeRealiste,
    code: `
      _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:60000, paquets:60,
        cartons:2, ppc:30, cond:1000, ctype:'POINTE', prix_carton:12000, unit_price:0.2, total_price:24000 }];
      editAchatItemLine(0, 'consumable');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_qte') === '2' && g('ai_qte_paquet') === '30'
        && g('ai_cond') === '1000' && g('ai_pu') === '12000')
        ? 'OK : 2 cartons x 30 paq x 1000 = 60 000 pointes, 12 000 F/carton'
        : 'ECHEC : qte=' + g('ai_qte') + ' ppc=' + g('ai_qte_paquet')
          + ' cond=' + g('ai_cond') + ' pu=' + g('ai_pu')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : « Pointes / paquet » est repris du catalogue (pas la valeur d\'exemple 1000)',
    app: 'production.html', store: storeRealiste,
    code: `
      setDefinitions([{ id:'d6', code:'P6', designation:'POINTE 6', type:'POINTE', qty_per_packet:165, unit_cost:0 }]);
      document.getElementById('ai_code').value = 'P6';
      apAchatCondFill();
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_cond') === '165' && apAchatCondLookup() === 165)
        ? 'OK : P6 -> ' + g('ai_cond') + ' pointes/paquet (catalogue)'
        : 'ECHEC : ai_cond=' + g('ai_cond') + ' lookup=' + apAchatCondLookup()
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : une valeur saisie a la main n\'est pas ecrasee par le catalogue',
    app: 'production.html', store: storeRealiste,
    code: `
      setDefinitions([{ id:'d6', code:'P6', designation:'POINTE 6', type:'POINTE', qty_per_packet:165, unit_cost:0 }]);
      var el = document.getElementById('ai_cond');
      el.value = '200';
      apAchatCondTouched();
      document.getElementById('ai_code').value = 'P6';
      apAchatCondFill();
      (String(el.value) === '200')
        ? 'OK : 200 pointe(s)/paquet conservee(s)'
        : 'ECHEC : ' + el.value
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : une ligne POINTE sans conditionnement est refusee (pas de stock faux)',
    app: 'production.html', store: storeRealiste,
    code: `
      setDefinitions([]);
      document.getElementById('ai_code').value = 'P8';
      document.getElementById('ai_designation').value = 'POINTE 8';
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_qte').value = '2';
      document.getElementById('ai_cond').value = '';
      _tempAchatItems = [];
      addAchatItemLine('consumable');
      (_tempAchatItems.length === 0)
        ? 'OK : aucune ligne ajoutee, conditionnement obligatoire'
        : 'ECHEC : ' + JSON.stringify(_tempAchatItems[0])
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Import de BL : ce que le texte extrait remplit reellement ---------- */
  const ocrBordereau = [
    'SCIERIE S.M.I  TEL: (+228) 27 35 50 73 ABENGOUROU',
    'BORDEREAU DE LIVRAISON N 000114',
    'CODE EXPORTEUR TRANSPORTEUR : 146   S.M.I',
    'DATE DE CHARGEMENT : 30/07/2026',
    'ESPECE : Acajou',
    'DESTINATION DU PRODUIT : Depot de Nkol-ogon',
    'N COLIS   NOMBRE D ELEMENTS   LONGUEUR   LARGEUR   EPAIS   CUBAGE   OBSERVATION'
  ].join('\n');
  const razImport = `
    ['ach_fournisseur','ach_ref','ach_date','ai_essence','ai_qte','ai_long','ai_larg','ai_epais','ai_colis','ach_doc_status']
      .forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  `;

  r.push({
    nom: 'Import BL : le numero d\'un BORDEREAU DE LIVRAISON est extrait',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData(${JSON.stringify(ocrBordereau)});
      var v = String(document.getElementById('ach_ref').value);
      (v === '000114') ? 'OK : ach_ref = ' + v : 'ECHEC : ach_ref = ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : la date du document est extraite (avant : la date du jour)',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData(${JSON.stringify(ocrBordereau)});
      var v = String(document.getElementById('ach_date').value);
      (v === '2026-07-30') ? 'OK : ach_date = ' + v : 'ECHEC : ach_date = ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : l\'essence ACAJOU est reconnue',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData(${JSON.stringify(ocrBordereau)});
      var v = String(document.getElementById('ai_essence').value);
      (v === 'ACAJOU') ? 'OK : essence = ' + v : 'ECHEC : essence = ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : aucune quantite inventee quand le document ne la nomme pas',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData(${JSON.stringify(ocrBordereau)});
      var v = String(document.getElementById('ai_qte').value);
      (v === '') ? 'OK : champ laisse vide plutot que rempli au hasard'
                 : 'ECHEC : ai_qte = ' + v + ' (nombre sorti de nulle part)'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : une quantite explicitement nommee est reprise',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData('BON DE LIVRAISON N 4471\\nQUANTITE : 225\\nLONGUEUR 2,50 x LARGEUR 40 x EPAIS 5');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_qte') === '225' && g('ach_ref') === '4471')
        ? 'OK : qte = ' + g('ai_qte') + ', ref = ' + g('ach_ref')
        : 'ECHEC : qte=' + g('ai_qte') + ' ref=' + g('ach_ref')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : « BL » ne s\'apparie plus dans un mot qui le contient (table, detail)',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData('SCIERIE TEST\\nTABLEAU DE REPARTITION\\nDETAIL DES COLIS');
      var v = String(document.getElementById('ach_ref').value);
      (v === '') ? 'OK : aucun faux numero de document'
                 : 'ECHEC : ach_ref = ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : le message annonce ce qui reste a saisir',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData(${JSON.stringify(ocrBordereau)});
      var m = String(document.getElementById('ach_doc_status').textContent || '');
      (/extrait/.test(m) && /[àÀ] compl/.test(m) && /quantit/.test(m))
        ? 'OK : ' + m
        : 'ECHEC : ' + m
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import BL : un document illisible ne pretend pas avoir extrait des donnees',
    app: 'production.html', store: storeRealiste,
    code: razImport + `
      applyExtractedAchatData('pr es / er ae te\\no n es nat rte 1 0e) Mes ea ts');
      var m = String(document.getElementById('ach_doc_status').textContent || '');
      (/Rien de lisible/.test(m)) ? 'OK : ' + m : 'ECHEC : ' + m
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Prix du carton : parametre par le catalogue, jamais melange
     avec le prix a la pointe (cas reel : P7 a 28 000 F/carton affichait
     3,733 = 28000/7500 dans le champ « Prix du carton ») ---------- */
  const storePrixCarton = () => {
    const s = storeRealiste();
    const p = JSON.parse(s.mdb_production);
    p.definitions = [
      { id: 'd7', code: 'P7', designation: 'POINTE7', type: 'POINTE', qty_per_packet: 150, prix_carton: 28000, unit_cost: 3.73 }
    ];
    s.mdb_production = JSON.stringify(p);
    return s;
  };

  r.push({
    nom: 'Prix carton : le catalogue remplit le prix du carton a la selection du code',
    app: 'production.html', store: storePrixCarton,
    code: `
      document.getElementById('ai_code').value = 'P7';
      apAchatCodeFill('consumable');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_pu') === '28000' && g('ai_cond') === '150')
        ? 'OK : cond = ' + g('ai_cond') + ', prix carton = ' + g('ai_pu')
        : 'ECHEC : cond=' + g('ai_cond') + ' prix=' + g('ai_pu')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Prix carton : le cout unitaire A LA POINTE ne remplit jamais le prix du carton',
    app: 'production.html', store: storePrixCarton,
    code: `
      var d = defCatalog().filter(function (c) { return c.code === 'P7'; })[0] || {};
      (d.prix_carton === 28000 && d.unit_cost === 3.73)
        ? 'OK : le catalogue distingue prix carton (28000) et cout pointe (3.73)'
        : 'ECHEC : ' + JSON.stringify(d)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Prix carton : une 2e ligne ne recupere pas le prix a la pointe de la 1re (3,733 au lieu de 28 000)',
    app: 'production.html', store: storePrixCarton,
    code: `
      _tempAchatItems = [];
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_code').value = 'P7';
      apAchatCodeFill('consumable');
      document.getElementById('ai_qte').value = '1';
      document.getElementById('ai_qte_paquet').value = '50';
      document.getElementById('ai_cond').value = '150';
      document.getElementById('ai_pu').value = '28000';
      addAchatItemLine('consumable');
      var l1 = _tempAchatItems[0];
      /* On simule la saisie de la ligne suivante : le conditionnement a ete
         vide par apAchatResetInputs, l'utilisateur resaisit le code. */
      document.getElementById('ai_code').value = 'P7';
      apAchatCodeFill('consumable');
      document.getElementById('ai_cond').value = '150';
      addAchatItemLine('consumable');
      var l2 = _tempAchatItems[1];
      (l1 && l1.prix_carton === 28000 && Math.abs(l1.unit_price - 3.7333) < 0.001
        && l2 && l2.prix_carton === 28000)
        ? 'OK : ligne 1 = 28000 F/carton (3,73 F/pointe), ligne 2 = 28000 F/carton'
        : 'ECHEC : l1=' + JSON.stringify(l1) + ' l2=' + JSON.stringify(l2)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat pointes : les zones de saisie sont liberees apres la ligne (pas de report sur la suivante)',
    app: 'production.html', store: storePrixCarton,
    code: `
      _tempAchatItems = [];
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_code').value = 'P7';
      document.getElementById('ai_designation').value = 'POINTE7';
      apAchatCodeFill('consumable');
      document.getElementById('ai_qte').value = '3';
      document.getElementById('ai_qte_paquet').value = '50';
      document.getElementById('ai_cond').value = '150';
      document.getElementById('ai_pu').value = '28000';
      document.getElementById('ai_emplacement').value = 'Zone A';
      document.getElementById('ai_obs').value = 'note test';
      addAchatItemLine('consumable');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_code') === '' && g('ai_designation') === '' && g('ai_cond') === ''
        && g('ai_pu') === '' && g('ai_emplacement') === '' && g('ai_obs') === ''
        && g('ai_qte') === '1' && g('ai_qte_paquet') === '50')
        ? 'OK : champs liberes, quantites remises a 1 carton / 50 paquets par carton'
        : 'ECHEC : code=' + g('ai_code') + ' cond=' + g('ai_cond') + ' pu=' + g('ai_pu')
          + ' qte=' + g('ai_qte') + ' ppc=' + g('ai_qte_paquet')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : le cout a la pointe ne devient pas un prix de carton',
    app: 'index.html', store: storePrixCarton,
    code: `
      var items = apAchatCatalogue('consumables');
      var p7 = items.filter(function (i) { return i.code === 'P7'; })[0];
      (p7 && p7.pu === 28000)
        ? 'OK : P7 propose a 28 000 F le carton (et non 3,73 F la pointe)'
        : 'ECHEC : ' + JSON.stringify(p7)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : une ligne POINTE sans conditionnement est refusee',
    app: 'index.html', store: storePrixCarton,
    code: `
      document.getElementById('ai_code').value = 'P7';
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_qte').value = '1';
      document.getElementById('ai_qte_paquet').value = '';
      document.getElementById('ai_pu').value = '28000';
      _tempAchatItems = [];
      addAchatItemLine('consumable');
      (_tempAchatItems.length === 0)
        ? 'OK : aucune ligne ajoutee, conditionnement obligatoire'
        : 'ECHEC : ' + JSON.stringify(_tempAchatItems[0])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : un prix saisi a la main n\'est pas ecrase par le catalogue',
    app: 'index.html', store: storePrixCarton,
    code: `
      document.getElementById('ai_pu').value = '31000';
      apMarkUserSet(document.getElementById('ai_pu'));
      document.getElementById('ai_code').value = 'P7';
      apFillConsumableCond();
      var v = String(document.getElementById('ai_pu').value);
      (v === '31000') ? 'OK : 31 000 conserve' : 'ECHEC : ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : les zones de saisie sont liberees apres la ligne',
    app: 'index.html', store: storePrixCarton,
    code: `
      _tempAchatItems = [];
      document.getElementById('ai_code').value = 'P7';
      document.getElementById('ai_constype').value = 'POINTE';
      apFillConsumableCond();
      document.getElementById('ai_qte').value = '2';
      document.getElementById('ai_cartons').value = '2';
      document.getElementById('ai_pu').value = '28000';
      document.getElementById('ai_emplacement').value = 'Quai';
      addAchatItemLine('consumable');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_code') === '' && g('ai_pu') === '' && g('ai_emplacement') === ''
        && g('ai_qte_paquet') === '' && g('ai_qte') === '1' && g('ai_cartons') === '0')
        ? 'OK : champs liberes'
        : 'ECHEC : code=' + g('ai_code') + ' pu=' + g('ai_pu')
          + ' cond=' + g('ai_qte_paquet') + ' qte=' + g('ai_qte')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : le nombre de paquets est saisi et reste coherent avec les cartons',
    app: 'production.html', store: storePrixCarton,
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var g = function (id) { return String(document.getElementById(id).value); };
      /* 1) on saisit des cartons -> les paquets s'affichent */
      document.getElementById('ai_qte').value = '4';
      document.getElementById('ai_qte_paquet').value = '50';
      apAchatSyncPaquets('cartons');
      var a = g('ai_paquets');
      /* 2) on saisit des paquets -> les cartons se calculent */
      document.getElementById('ai_paquets').value = '100';
      apAchatSyncPaquets('paquets');
      var b = g('ai_qte');
      (a === '200' && b === '2')
        ? 'OK : 4 cartons = 200 paquets, puis 100 paquets = 2 cartons'
        : 'ECHEC : 4 cartons -> ' + a + ' paq, 100 paq -> ' + b + ' cartons'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : le message ne dit plus « absent du catalogue » pour un code qui y est',
    app: 'production.html', store: storePrixCarton,
    code: `
      /* Reproduction du cas signale : on frappe le code lettre par lettre,
         la derniere frappe remplit la valeur mais le message restait orange. */
      document.getElementById('ai_code').value = 'P';
      apAchatCondFill();
      document.getElementById('ai_code').value = 'P7';
      apAchatCondFill();
      apAchatCodeFill('consumable');
      var m = String(document.getElementById('ai_cond_hint').textContent || '');
      var v = String(document.getElementById('ai_cond').value);
      (/Catalogue : 150/.test(m) && !/absent/.test(m) && v === '150')
        ? 'OK : "' + m + '"'
        : 'ECHEC : message = "' + m + '", valeur = ' + v
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : un code au catalogue sans Qté par Paquet est distingue d\'un code absent',
    app: 'production.html', store: storePrixCarton,
    code: `
      setDefinitions([
        { id:'d6', code:'P6', designation:'POINTE 6', type:'POINTE', qty_per_packet:165, prix_carton:28000 },
        { id:'d9', code:'P9', designation:'POINTE 9', type:'POINTE', qty_per_packet:0, prix_carton:28000 }
      ]);
      document.getElementById('ai_code').value = 'P9';
      apAchatCondFill();
      var m9 = String(document.getElementById('ai_cond_hint').textContent || '');
      document.getElementById('ai_code').value = 'ZZ';
      apAchatCondFill();
      var mz = String(document.getElementById('ai_cond_hint').textContent || '');
      (/sans/.test(m9) && /P9/.test(m9) && /absent/.test(mz) && /ZZ/.test(mz))
        ? 'OK : P9 signale comme "au catalogue mais sans Qté par Paquet", ZZ comme absent'
        : 'ECHEC : P9 -> "' + m9 + '" | ZZ -> "' + mz + '"'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : une valeur de conditionnement modifiee est signalee comme telle',
    app: 'production.html', store: storePrixCarton,
    code: `
      document.getElementById('ai_code').value = 'P7';
      apAchatCondFill();
      document.getElementById('ai_cond').value = '200';
      apAchatCondTouched();
      apAchatCondHint();
      var m = String(document.getElementById('ai_cond_hint').textContent || '');
      (/Valeur modifi/.test(m) && /150/.test(m))
        ? 'OK : "' + m + '"'
        : 'ECHEC : "' + m + '"'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : la liste affiche les cartons par produit (1 carton P6, 2 cartons P7)',
    app: 'production.html', store: storeRealiste,
    code: `
      var a = { id:'x1', date:'2026-09-28', category:'consumables', reference:'BL-TEST', fournisseur:'X',
        items: [ { code:'P6', designation:'POINTE 6', cartons:1, paquets:50, quantity:7500, ctype:'POINTE' },
                 { code:'P7', designation:'POINTE 7', cartons:2, paquets:100, quantity:15000, ctype:'POINTE' } ] };
      var h = achatResumeColis(a).replace(/<[^>]*>/g, '');
      (/1 carton P6/.test(h) && /2 cartons P7/.test(h))
        ? 'OK : "' + h + '"'
        : 'ECHEC : "' + h + '"'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : le bois garde son comptage de colis, pas un libelle carton',
    app: 'production.html', store: storeRealiste,
    code: `
      var a = { id:'x2', category:'raw-materials', items: [ { colis_number:'C1' }, { colis_number:'C2' } ] };
      var h = achatResumeColis(a);
      (/2 colis/.test(h) && !/carton/.test(h))
        ? 'OK : "' + h + '"'
        : 'ECHEC : "' + h + '"'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : les categories sans volume sont reconnues (pas de « 0.000 m3 » trompeur)',
    app: 'production.html', store: storeRealiste,
    code: `
      (achatSansVolume('consumables') === true && achatSansVolume('consumable') === true
        && achatSansVolume('epi') === true && achatSansVolume('raw-materials') === false
        && achatSansVolume('finished') === false)
        ? 'OK : consommables/EPI distingues du bois'
        : 'ECHEC : cons=' + achatSansVolume('consumables') + ' epi=' + achatSansVolume('epi')
          + ' raw=' + achatSansVolume('raw-materials')
    `,
    attenduPrefixe: 'OK : consommables/EPI distingues du bois'
  });

  r.push({
    nom: 'Fiche de stock : le registre porte date, stock initial, entree, sortie, ajust et stock final',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'm1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', fournisseur: 'TIJANI', created_at: '2026-07-16' },
        { id: 'm2', code: 'P7', designation: 'POINTE 7', quantite: -3000, cond: 150, ctype: 'POINTE', motif: 'Consommation palette 2605', date: '2026-07-20' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var lignes = getStockConsum().map(consoNorm).filter(function (x) {
        return x.type === 'POINTE' && String(x.code || '').toUpperCase() === 'P7';
      });
      var r = buildConsoMovements(lignes);
      var init = r.filter(function (x) { return x.estInitial; })[0] || {};
      var ent = r.filter(function (x) { return x.entree > 0; })[0] || {};
      var sor = r.filter(function (x) { return x.sortie > 0; })[0] || {};
      (r.length === 3 && init.final === 0 && String(init.obs || '').indexOf('debut de la periode') !== -1
        && ent.date === '2026-07-16' && ent.initial === 0 && ent.entree === 15000 && ent.final === 15000
        && sor.date === '2026-07-20' && sor.initial === 15000 && sor.sortie === 3000 && sor.final === 12000
        && /Consommation/.test(sor.obs || ''))
        ? 'OK : initial 0 -> entree +15 000 -> sortie -3 000 -> final 12 000, dates et observations presentes'
        : 'ECHEC : ' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Fiche de stock : la date d\'un achat est lue dans created_at (elle s\'affichait « - »)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'd1', code: 'P7', designation: 'POINTE 7', quantite: 7500, paquets: 50, cartons: 1, cond: 150, ctype: 'POINTE', created_at: '2026-09-28' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var lignes = getStockConsum().map(consoNorm).filter(function (x) { return x.type === 'POINTE'; });
      var r = buildConsoMovements(lignes);
      var ecriture = r.filter(function (x) { return !x.estInitial; })[0] || {};
      (ecriture.date === '2026-09-28')
        ? 'OK : date retrouvee = ' + ecriture.date
        : 'ECHEC : date = "' + ecriture.date + '"'
    `,
    attenduPrefixe: 'OK : date'
  });

  r.push({
    nom: 'Tableau de bord : la carte Stock Pointes affiche au moins 5 types',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'q1', code: 'P6', designation: 'POINTE 6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE' },
        { id: 'q2', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE' },
        { id: 'q3', code: 'P5', designation: 'POINTE 5', quantite: 0, paquets: 0, cartons: 0, cond: 180, ctype: 'POINTE' },
        { id: 'q4', code: 'P8', designation: 'POINTE 8', quantite: 0, paquets: 0, cartons: 0, cond: 120, ctype: 'POINTE' },
        { id: 'q5', code: 'P4', designation: 'POINTE 4', quantite: 0, paquets: 0, cartons: 0, cond: 200, ctype: 'POINTE' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var h = dashCartePointes();
      var codes = ['P5', 'P6', 'P7', 'P8', 'P4'].filter(function (c) { return h.indexOf('>' + c + '<') !== -1; });
      (codes.length >= 5)
        ? 'OK : ' + codes.join(', ') + ' affiches (5 types, y compris sans stock)'
        : 'ECHEC : seulement ' + codes.length + ' type(s) : ' + codes.join(', ')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Impression : la fiche de stock se genere avec totaux et une ligne par produit',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'i1', code: 'P6', designation: 'POINTE 6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE' },
        { id: 'i2', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var capture = '';
      var faux = { document: { write: function (x) { capture = x; }, close: function () {}, title: '' }, onload: null, print: function () {}, focus: function () {} };
      var vraiOpen = window.open;
      var l1 = '', l2 = '', err = '';
      window.open = function () { return faux; };
      try { printStockConsum(); l1 = capture; } catch (e) { err = 'fiche: ' + e.message; }
      capture = '';
      try { printConsoDetail('P7'); l2 = capture; } catch (e) { err = err || ('detail: ' + e.message); }
      window.open = vraiOpen;
      (/FICHE DE STOCK/.test(l1) && /P6/.test(l1) && /P7/.test(l1)
        && /TOTAL/.test(l1) && /Visa responsable/.test(l1)
        && /HISTORIQUE DES MOUVEMENTS/.test(l2) && /Stock init/.test(l2)
        && /Stock fin/.test(l2) && /Visa magasinier/.test(l2))
        ? 'OK : fiche complete + fiche detaillee generees, totaux et signatures inclus'
        : 'ECHEC : ' + (err || ('l1=' + l1.length + ' l2=' + l2.length + ' | ' + l2.substr(0, 160)))
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : il corrige le stock par un AJUSTEMENT, il n\'ecrase pas l\'achat',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'v1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-07-16' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var avant = getStockConsum()[0];
      /* Reel constate a l'inventaire : 12 000 (soit -3 000) */
      applyInventoryAsInitial('2026-07', [{ store: 'stockConsum', ref: 'P7', code: 'P7', real_qte: 12000 }]);
      var lignes = getStockConsum();
      var achat = lignes.filter(function (l) { return !l._ajustInv; })[0] || {};
      var aj = lignes.filter(function (l) { return l._ajustInv; })[0] || {};
      var total = 0;
      lignes.forEach(function (l) { total += parseFloat(l.quantite) || 0; });
      var r = buildConsoMovements(lignes.map(consoNorm).filter(function (x) { return String(x.code).toUpperCase() === 'P7'; }));
      var ligneAj = r.filter(function (x) { return x.ajust !== 0; })[0] || {};
      (achat.quantite === 15000 && aj.quantite === -3000 && total === 12000
        && ligneAj.ajust === -3000 && ligneAj.entree === 0 && ligneAj.sortie === 0
        && /Inventaire/.test(ligneAj.obs || '') && r[r.length - 1].final === 12000)
        ? 'OK : achat conserve (15 000), ecart d\\'inventaire en ajustement (-3 000), stock reel 12 000'
        : 'ECHEC : achat=' + JSON.stringify(achat) + ' ajust=' + JSON.stringify(aj) + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : stock 50, reel annonce 10 -> le stock devient bien 10 (ajustement de -40)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'w1', code: 'P5', designation: 'POINTE 5', quantite: 50, paquets: 0, cartons: 0, cond: 0, ctype: 'DIVERS', created_at: '2026-07-01' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      applyInventoryAsInitial('2026-08', [{ store: 'stockConsum', ref: 'P5', code: 'P5', real_qte: 10 }]);
      var lignes = getStockConsum();
      var total = 0;
      lignes.forEach(function (l) { total += parseFloat(l.quantite) || 0; });
      var agg = consoAggregate().filter(function (a) { return a.code === 'P5'; })[0] || {};
      var r = buildConsoMovements(lignes.map(consoNorm).filter(function (x) { return String(x.code).toUpperCase() === 'P5'; }));
      var aj = r.filter(function (x) { return x.ajust !== 0; })[0] || {};
      var fin = r[r.length - 1] || {};
      (total === 10 && agg.unites === 10 && aj.ajust === -40 && fin.final === 10)
        ? 'OK : 50 -> reel 10, le stock vaut 10, l\\'ecart -40 est trace en Ajustement'
        : 'ECHEC : total=' + total + ' agg=' + JSON.stringify(agg) + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : le materiel et les semi-finis prennent aussi la valeur reelle',
    app: 'production.html', store: storeRealiste,
    code: `
      var s0 = getStockSemi();
      if (!s0.length) { 'OK : aucun semi-fini en base, rien a vérifier'; }
      else {
        var code = s0[0].code;
        var reel = 7;
        applyInventoryAsInitial('2026-08', [{ store: 'stockSemi', ref: code, code: code, real_qte: reel }]);
        var apres = getStockSemi().filter(function (l) { return l.code === code; })[0] || {};
        (parseFloat(apres.quantite) === reel) ? 'OK : ' + code + ' = ' + reel : 'ECHEC : ' + JSON.stringify(apres);
      }
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Impression : chaque page de stock imprime SA fiche (le bouton semi-finis imprimait la matiere premiere)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockSemi = [{ id: 'sf1', code: 'CP1', designation: 'CHARPENTE PAL', quantite: 12, volume: 0.4, zone: 'A' }];
      p.stockRaw = [{ id: 'rw1', code: 'K9', designation: 'BOIS ROUGE', quantite: 8, volume: 2.5, zone: 'B' }];
      p.epiItems = [{ id: 'ep1', code: 'CASQ', designation: 'CASQUE', quantite_stock: 14, emplacement: 'MAG', seuil_minimum: 5 }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var capture = '', faux = { document: { write: function (x) { capture = x; }, close: function () {}, title: '' }, onload: null, print: function () {}, focus: function () {} };
      var vraiOpen = window.open, out = {}, err = '';
      [['stock-semi'], ['stock-raw'], ['stock-merch'], ['stock-epi']].forEach(function (k) {
        capture = ''; window.open = function () { return faux; };
        try { printStockFiche(k[0]); out[k[0]] = capture; } catch (e) { err = err || (k[0] + ': ' + e.message); }
        window.open = vraiOpen;
      });
      var okSemi = /SEMI-FINIS/.test(out['stock-semi'] || '') && /CP1/.test(out['stock-semi'] || '');
      var okRaw = /MATIERE PREMIERE/.test(out['stock-raw'] || '') && /K9/.test(out['stock-raw'] || '');
      var okEpi = /EPI/.test(out['stock-epi'] || '') && /CASQ/.test(out['stock-epi'] || '');
      (okSemi && okRaw && okEpi && !err)
        ? 'OK : semi-finis, matiere premiere et EPI impriment chacun leur propre fiche'
        : 'ECHEC : ' + (err || ('semi=' + okSemi + ' raw=' + okRaw + ' epi=' + okEpi))
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock : cliquer sur un produit DEROULE le registre (pas de fenetre)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'z1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-07-16' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var h = render_stock_consum();
      var sansFenetre = !/onclick="openConsoDetail/.test(h);
      var deroule = /toggleConsoDetailRow\\(this\\)/.test(h);
      var ligneCachee = /id="consoDet_P7"[^>]*display:none/.test(h);
      var registre = /Stock init/.test(h) && /Stock fin/.test(h) && /Observation/.test(h);
      var impression = /printConsoDetail\\('P7'\\)/.test(h);
      (sansFenetre && deroule && ligneCachee && registre && impression)
        ? 'OK : le registre deroule sous la ligne, avec son bouton imprimer, sans fenetre'
        : 'ECHEC : fenetre=' + (!sansFenetre) + ' deroule=' + deroule + ' cache=' + ligneCachee
          + ' registre=' + registre + ' impression=' + impression
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Fiche de stock : le Stock initial est date du 1er du mois de la premiere ecriture',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'pd1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-07-16' },
        { id: 'pd2', code: 'P7', designation: 'POINTE 7', quantite: 30000, paquets: 200, cartons: 4, cond: 150, ctype: 'POINTE', created_at: '2026-08-05' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var lignes = getStockConsum().map(consoNorm).filter(function (x) { return String(x.code).toUpperCase() === 'P7'; });
      var r = buildConsoMovements(lignes);
      var init = r.filter(function (x) { return x.estInitial; })[0] || {};
      var obs = String(init.obs || '');
      /* La premiere ecriture est du 16/07 : l'ouverture doit porter le
         01/07/2026, pas le 16/07. */
      (init.date === '2026-07-01' && obs.indexOf('01/07/26') !== -1 && obs.indexOf('05/08/26') !== -1)
        ? 'OK : ouverture au 01/07/2026 (1er du mois), periode annoncee jusqu au 05/08/2026'
        : 'ECHEC : date=' + init.date + ' obs=' + obs
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Sortie de pointe : elle diminue le stock et apparait dans le registre',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'so1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-09-01' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var stock = getStockConsum();
      stock.unshift({ id: 'soX', code: 'P7', designation: 'POINTE 7', fournisseur: '', quantite: -3000,
                      paquets: 0, cartons: 0, cond: 150, ctype: 'POINTE', emplacement: '',
                      prix_unitaire: 0, motif: 'Consommation atelier', obs: 'Consommation atelier',
                      created_at: '2026-09-10' });
      setStockConsum(stock);
      var agg = consoAggregate().filter(function (a) { return a.code === 'P7'; })[0] || {};
      var r = buildConsoMovements(_consoLignes('P7'));
      var sortie = r.filter(function (x) { return x.sortie > 0; })[0] || {};
      var final = r[r.length - 1] || {};
      (agg.unites === 12000 && sortie.sortie === 3000 && sortie.date === '2026-09-10'
        && /Consommation atelier/.test(sortie.obs || '') && final.final === 12000)
        ? 'OK : 15 000 - 3 000 = 12 000, sortie datee et motivee dans le registre'
        : 'ECHEC : ' + JSON.stringify(agg) + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock : une ligne d\'achat sans stock est detectee puis recreatee depuis le BL',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      /* BL-2809 contient un carton de P5, mais le stock n'a aucune ligne P5. */
      p.stockConsum = [{ id: 'ok1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-09-01' }];
      p.achats = [{ id: 'bl1', category: 'consumables', date: '2026-09-28', reference: 'BL-2809', fournisseur: 'TIJANI',
                    items: [{ code: 'P5', designation: 'POINTE5', quantity: 18000, paquets: 100, cartons: 1, cond: 180, ctype: 'POINTE', prix_carton: 28000 }],
                    montant_total: 28000 }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var avant = stockConsumRapport();
      var reponses = [true];
      var vraiConfirm = confirm2;
      confirm2 = function () { return reponses.shift(); };
      try { reconstruireStockConsum(); } catch (e) { confirm2 = vraiConfirm; }
      confirm2 = vraiConfirm;
      var agg = consoAggregate();
      var p5 = agg.filter(function (a) { return a.code === 'P5'; })[0] || {};
      var p7 = agg.filter(function (a) { return a.code === 'P7'; })[0] || {};
      (avant.manquants.length === 1 && avant.manquants[0].code === 'P5'
        && p5.unites === 18000 && p5.cartons === 1 && p7.unites === 15000)
        ? 'OK : P5 detecte sans stock puis recree (18 000 pointes / 1 carton), P7 intact'
        : 'ECHEC : manquants=' + JSON.stringify(avant.manquants) + ' p5=' + JSON.stringify(p5) + ' p7=' + JSON.stringify(p7)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Semi-finis : « Tout » affiche les composants latte/plot/CP meme sans stock (0)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.composants = [
        { article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte 120', quantity: 5, volume: 0.0018 },
        { article_id: 'a1', type: 'PLOT', code: 'PL1', designation: 'Plot 100', quantity: 2, volume: 0.002 },
        { article_id: 'a1', type: 'CP', code: 'CP1', designation: 'Contreplaque', quantity: 1, volume: 0.001 },
        { article_id: 'a1', type: 'POINTE', code: 'P7', designation: 'Pointe 7', quantity: 90 }
      ];
      p.stockSemi = [];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var agg = semiAggregate();
      var codes = agg.map(function (e) { return e.code; });
      (agg.length === 3 && codes.indexOf('L1') !== -1 && codes.indexOf('PL1') !== -1 && codes.indexOf('CP1') !== -1
        && agg.every(function (e) { return e.quantite === 0; }))
        ? 'OK : latte, plot et CP affiches a 0 (aucun stock, mais presents)'
        : 'ECHEC : ' + JSON.stringify(codes)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Sortie de pointe : assemblage deduit les pointes et les trace (date, motif, numero)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a1', code: 'PAL7', designation: 'Palette 7', categorie: 'finished' }];
      p.composants = [{ article_id: 'a1', type: 'POINTE', code: 'P7', designation: 'Pointe 7', quantity: 90 }];
      p.stockConsum = [{ id: 'sp1', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', created_at: '2026-09-01' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      /* 2 palettes x 90 pointes = 180 sorties, referencees au numero de fiche */
      deductAssemblageStock({ numero: '2609007', date: '2026-09-15', assemblage: [{ code: 'PAL7', qte: 2 }] });
      var agg = consoAggregate().filter(function (a) { return a.code === 'P7'; })[0] || {};
      var r = buildConsoMovements(_consoLignes('P7'));
      var sor = r.filter(function (x) { return x.sortie > 0; }).filter(function (x) { return /Production 2609007/.test(x.obs || ''); })[0] || {};
      (agg.unites === 14820 && sor.sortie === 180 && sor.date === '2026-09-15')
        ? 'OK : 15 000 - 180 = 14 820, sortie tracee « Production 2609007 » le 15/09'
        : 'ECHEC : total=' + agg.unites + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Miroir app principale : les consommables sont regroupes et valorises au prix du carton',
    app: 'index.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      /* Cas reel de la capture : une ligne par achat, dont une avec le prix
         de carton fourre dans prix_unitaire (ancienne confusion d'unite). */
      p.stockConsum = [
        { id: 'r1', code: 'P7', designation: 'POINTE7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE', prix_carton: 28000, prix_unitaire: 3.73 },
        { id: 'r2', code: 'P6', designation: 'POINTE6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE', prix_carton: 28000, prix_unitaire: 3.39 },
        { id: 'r3', code: 'P6', designation: 'POINTE6', quantite: 16500, paquets: 100, cartons: 2, cond: 165, ctype: 'POINTE', prix_carton: 0, prix_unitaire: 28000 }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var list = getProductionStocksReel().filter(function (l) { return l.categorie === 'Consommables'; });
      var p7 = list.filter(function (l) { return l.designation.indexOf('P7') === 0; })[0] || {};
      var p6 = list.filter(function (l) { return l.designation.indexOf('P6') === 0; })[0] || {};
      /* P7 : 1 ligne au lieu des saisies, 2 cartons x 28 000 = 56 000 (et non
         15 000 x 28 000). P6 : les 2 lignes fusionnees, 5 cartons = 140 000. */
      (list.length === 2 && p7.montant === 56000 && p7.prixUnitaire === 28000
        && p6.quantite === 41250 && p6.montant === 140000)
        ? 'OK : P7 = 56 000 F (2 cart.), P6 = 140 000 F (5 cart.), aucun montant absurde'
        : 'ECHEC : ' + JSON.stringify(list)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock : le deroulement est identique sur BL, specifique, semi-finis et en-cours',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a1', code: 'PAL7', designation: 'Palette 7', categorie: 'finished' }];
      p.composants = [{ article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte 120', quantity: 5, volume: 0.0018 }];
      p.stockRaw = [
        { id: 'rb1', code: 'K9', colis_number: 'K9', designation: 'BOIS', essence: 'Rouge', quantite: 8, volume: 2.5, zone: 'B', origin: 'SPECIFIC', created_at: '2026-09-01' }
      ];
      p.achats = [{ id: 'bl9', category: 'raw-materials', date: '2026-09-01', reference: 'BL-9', fournisseur: 'X',
                    items: [{ colis_number: 'K9', quantity: 8, volume: 2.5, essence: 'Rouge' }], montant_total: 1000 }];
      p.productionOrders = [{ numero: 'OP-3', article_id: 'a1', quantite_prevue: 10, quantite_realisee: 4, statut: 'en_cours' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      setSection('stockRawEtat', 'tout');
      setSection('stockRawTab', 'bl');
      var bl = render_stock_raw();
      /* L'onglet BL liste les bons : chaque BL puis chaque colis se deroule
         avec ses mouvements ( Init / Sortie / Final ). */
      var blOk = /toggleAccordion\\('blAchat_bl9'\\)/.test(bl) && /toggleAccordion\\('blColis_bl9_0'\\)/.test(bl)
        && /Init Qté|Sortie Qté|Stock final|Observation/.test(bl);
      setSection('stockRawTab', 'spe');
      var spe = render_stock_raw();
      var speOk = /toggleAccordion\\('mvtColis_rb1'\\)/.test(spe) && /Init Qté/.test(spe);
      setSection('stockRawTab', 'semi');
      var semi = render_stock_raw();
      var semiOk = /toggleAccordion\\('semiDet_L1'\\)/.test(semi) && /Utilisé par/.test(semi) && /PAL7/.test(semi);
      setSection('stockRawTab', 'wip');
      var wip = render_stock_raw();
      var wipOk = /toggleAccordion\\('wipDet_OP-3'\\)/.test(wip) && /Composants restant/.test(wip);
      (blOk && speOk && semiOk && wipOk)
        ? 'OK : BL, specifique, semi et en-cours se deroulent tous en ligne'
        : 'ECHEC : bl=' + blOk + ' spe=' + speOk + ' semi=' + semiOk + ' wip=' + wipOk
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock : un deroulage se REPLIE au second clic (il restait ouvert)',
    app: 'production.html', store: storeRealiste,
    code: `
      /* Faux DOM minimal mais fidele : la ligne detaillee suit la ligne
         cliquable, fermee au depart. */
      var det = { id: 'consoDet_P7', style: { display: 'none' } };
      var cell = { textContent: '▸ P7' };
      var tr = { nextElementSibling: det, style: {}, querySelector: function () { return cell; } };
      toggleConsoDetailRow(tr);
      var ouvert = (det.style.display !== 'none');
      toggleConsoDetailRow(tr);
      var referme = (det.style.display === 'none');
      (ouvert && referme)
        ? 'OK : ouvert au 1er clic, referme au 2e'
        : 'ECHEC : ouvert=' + ouvert + ' referme=' + referme
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: "Modification d'un achat : une ligne AJOUTEE en modification arrive au stock",
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [{ id: 'ed1', code: 'P5', designation: 'POINTE5', quantite: 0, paquets: 0, cartons: 0, cond: 180, ctype: 'POINTE', created_at: '2026-09-01' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      /* BL-2809 cree SANS P5, puis modifie pour l'ajouter : avant, P5
         n'arrivait jamais au stock. */
      var avant = [];
      var apres = [{ code: 'P5', designation: 'POINTE5', quantity: 18000, paquets: 100, cartons: 1, cond: 180, ctype: 'POINTE', prix_carton: 28000 }];
      _reporterEcartAchatConso(avant, apres, 'BL-2809', '2026-09-28', 'TIJANI');
      var agg = consoAggregate().filter(function (a) { return a.code === 'P5'; })[0] || {};
      var r = buildConsoMovements(_consoLignes('P5'));
      var ligne = r.filter(function (x) { return !x.estInitial; })[0] || {};
      (agg.unites === 18000 && agg.cartons === 1 && /Modification BL-2809/.test(ligne.obs || ''))
        ? 'OK : P5 arrive au stock (18 000 / 1 carton), ligne tracee « Modification BL-2809 »'
        : 'ECHEC : stock=' + JSON.stringify(agg) + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Tableau de bord : la carte MARGES PAR ARTICLE a disparu',
    app: 'production.html', store: storeRealiste,
    code: `
      navigate('dashboard');
      var el = document.getElementById('content');
      var h = (el && el.innerHTML) || '';
      (!/MARGES PAR ARTICLE/.test(h))
        ? 'OK : plus de carte marges sur le tableau de bord'
        : 'ECHEC : la carte est toujours la'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Palettes : le clic sur le code DEROULE le registre (oeil et fenetre supprimes)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'f1', code: 'PAL7', designation: 'Palette 7', categorie: 'finished' }];
      p.stockFinished = [{ id: 'sf1', article_id: 'f1', quantite: 12 }];
      p.movements = [{ id: 'mv1', article_id: 'f1', date: '2026-09-10', type: 'entree', quantite: 12, motif: 'Production 2609001' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var h = renderStockFiche('stock-finished', getStockFinished, 'Fiche de Stock - Palettes', 'showAddStock');
      var deroule = /toggleAccordion\\('finDet_sf1'\\)/.test(h);
      var registre = /Stock Initial/.test(h) && /Entrée/.test(h) && /Stock Final/.test(h);
      var sansFenetre = !/showFinishedFiche/.test(h);
      var impression = /printFinishedFicheId\\('sf1'\\)/.test(h);
      (deroule && registre && sansFenetre && impression)
        ? 'OK : le registre deroule sous la ligne, avec son bouton imprimer, sans oeil ni fenetre'
        : 'ECHEC : deroule=' + deroule + ' registre=' + registre + ' sansFenetre=' + sansFenetre + ' impression=' + impression
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Semi-finis : le deroulage affiche le registre des mouvements du composant',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a1', code: 'PAL7', designation: 'Palette 7', categorie: 'finished' }];
      p.composants = [{ article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte 120', quantity: 5, volume: 0.0018 }];
      p.stockSemi = [{ id: 'sm1', code: 'L1', designation: 'Latte 120', quantite: 40, created_at: '2026-09-05' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var reg = _semiRegistreHtml('L1');
      var txt = reg.replace(/<[^>]*>/g, ' ');
      var ok = /Stock initial/.test(reg) && /Entrée/.test(reg) && /Stock fin/.test(reg)
        && txt.indexOf('05/09/26') !== -1 && /Observation/.test(reg);
      (ok) ? 'OK : le registre du semi-fini porte date, initial, entree, fin et observation'
           : 'ECHEC : ' + reg.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').substr(0, 220)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock consommables : une seule ligne par PRODUIT meme si le meme code a plusieurs fiches',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'c1', code: 'P6', designation: 'POINTE 6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE' },
        { id: 'c2', code: 'P6', designation: 'POINTE 6', quantite: 16500, paquets: 100, cartons: 2, cond: 165, ctype: 'POINTE' },
        { id: 'c3', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var agg = consoAggregate();
      var p6s = agg.filter(function (a) { return a.code === 'P6'; });
      var p7s = agg.filter(function (a) { return a.code === 'P7'; });
      var p6 = p6s[0] || {}, p7 = p7s[0] || {};
      /* Une seule entree par code, quantites cumulees (les fiches a zero
         du seed ne changent pas les totaux). */
      (p6s.length === 1 && p7s.length === 1 && p6.unites === 41250 && p6.paquets === 250 && p6.cartons === 5
        && p7.unites === 15000 && p7.paquets === 100 && p7.cartons === 2)
        ? 'OK : une ligne par produit — P6 = 41 250 pointes / 250 paq / 5 cartons, P7 = 15 000 / 100 paq / 2 cartons'
        : 'ECHEC : P6 x' + p6s.length + ' ' + JSON.stringify(p6) + ' | P7 x' + p7s.length + ' ' + JSON.stringify(p7)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock consommables : la fusion reelle regroupe les fiches en double',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockConsum = [
        { id: 'c1', code: 'P6', designation: 'POINTE 6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE' },
        { id: 'c2', code: 'P6', designation: 'POINTE 6', quantite: 16500, paquets: 100, cartons: 2, cond: 165, ctype: 'POINTE' },
        { id: 'c3', code: 'P7', designation: 'POINTE 7', quantite: 15000, paquets: 100, cartons: 2, cond: 150, ctype: 'POINTE' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      localStorage.setItem('mdb_packs_per_carton', '50');
      var avant = getStockConsum().length;
      var n = consoRepaire();
      var apres = getStockConsum();
      var p6s = apres.filter(function (a) { return a.code === 'P6'; });
      var p6 = p6s[0] || {};
      /* Idempotent : un second passage ne doit plus rien regrouper. */
      var n2 = consoRepaire();
      (n === 3 && apres.length === avant - 3 && p6s.length === 1
        && p6.quantite === 41250 && p6.paquets === 250 && p6.cartons === 5 && n2 === 0)
        ? 'OK : ' + avant + ' fiches -> ' + apres.length + ', P6 cumule a 41 250 / 5 cartons, second passage sans effet'
        : 'ECHEC : fusionne=' + n + ' avant=' + avant + ' apres=' + apres.length
          + ' p6x' + p6s.length + ' ' + JSON.stringify(p6) + ' n2=' + n2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock consommables : un nouvel achat CUMULE dans la fiche du produit (pas de nouvelle fiche)',
    app: 'production.html', store: storePrixCarton,
    code: `
      setStockConsum([{ id:'k1', code:'P7', designation:'POINTE 7', quantite:15000, paquets:100, cartons:2, cond:150, ctype:'POINTE', prix_unitaire:1.87 }]);
      _tempAchatItems = [];
      document.getElementById('ai_code').value = 'P7';
      apAchatCodeFill('consumable');
      document.getElementById('ai_qte').value = '1';
      document.getElementById('ai_paquets').value = '50';
      document.getElementById('ai_qte_paquet').value = '50';
      document.getElementById('ai_cond').value = '150';
      document.getElementById('ai_pu').value = '28000';
      document.getElementById('ai_constype').value = 'POINTE';
      addAchatItemLine('consumable');
      _saveAchatConsumStock(_tempAchatItems, 'TIJANI');
      var apres = getStockConsum();
      var p7 = apres.filter(function (a) { return a.code === 'P7'; })[0] || {};
      (apres.length === 1 && p7.quantite === 22500 && p7.paquets === 150 && p7.cartons === 3)
        ? 'OK : 2 + 1 carton = 3 cartons, 22 500 pointes, une seule fiche P7'
        : 'ECHEC : ' + apres.length + ' fiche(s) : ' + JSON.stringify(p7)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock pointes : les cartons saisis sont repris tels quels, les anciennes lignes restent deductible',
    app: 'production.html', store: storeRealiste,
    code: `
      varAvec = consoNorm({ code:'P6', designation:'Pointes 6', ctype:'POINTE', cond:1000, quantite:100000, paquets:100, cartons:2 });
      varAnc = consoNorm({ code:'P5', designation:'Pointes 5', ctype:'POINTE', cond:1000, quantite:50000, paquets:50 });
      (varAvec.cartons === 2 && varAnc.cartons === 1)
        ? 'OK : saisie 2 cartons, ancienne ligne 50 paq => 1 carton'
        : 'ECHEC : ' + varAvec.cartons + ' / ' + varAnc.cartons
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Achats : une entree inutilisable ne doit pas casser la page ---------- */
  r.push({
    nom: 'Achats : une entree null/undefined dans la liste n\'empêche plus l\'affichage',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = JSON.parse(localStorage.getItem('mdb_production') || '{}');
      d.achats = [null, undefined, 'texte', 42, [], { id:'B1', reference:'B1', date:'2026-09-24', category:'consumables', montant_total:1000, items:[null, { code:'P6', quantity:10 }] }];
      localStorage.setItem('mdb_production', JSON.stringify(d));
      CURRENT_PAGE = 'achats'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Cette page n') === -1 && h.indexOf('B1') !== -1) ? 'OK' : 'CASSE'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'Achats : la reparation retire les entrees invalides du tableau',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = JSON.parse(localStorage.getItem('mdb_production') || '{}');
      d.achats = [null, undefined, 'texte', 42, { id:'B1', reference:'B1', date:'2026-09-24', items:'pas un tableau' }];
      localStorage.setItem('mdb_production', JSON.stringify(d));
      var r = prodRepareSections();
      var apres = JSON.parse(localStorage.getItem('mdb_production') || '{}').achats;
      (Array.isArray(apres) && apres.length === 1 && apres[0].id === 'B1'
        && Array.isArray(apres[0].items) && apres[0].items.length === 0
        && r.join(',').indexOf('achats') !== -1)
        ? 'OK : 1 achat conserve, ' + (5 - 1) + ' entrees retirees'
        : 'ECHEC : ' + JSON.stringify(apres) + ' / ' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achats : un achat dont items est un objet ne casse plus le detail',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = JSON.parse(localStorage.getItem('mdb_production') || '{}');
      d.achats = [{ id:'B2', reference:'B2', date:'2026-09-24', category:'consumables', montant_total:2000, items:{ 0:{ code:'P6', quantity:5 } } }];
      localStorage.setItem('mdb_production', JSON.stringify(d));
      CURRENT_PAGE = 'achats'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Cette page n') === -1 && h.indexOf('B2') !== -1) ? 'OK' : 'CASSE'
    `,
    attendu: 'OK'
  });

  /* ---------- App principale : modifier un achat depuis la liste ---------- */
  r.push({
    nom: 'App principale : le bouton Modifier existe sur chaque achat',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      var p = apProdGet();
      p.achats = [{ id:'B2409', reference:'B2409', date:'2026-09-24', fournisseur:'TIJANI',
        receiver_name:'GABOU LAURE CLEMENCE', category:'consumables', total_volume:0, montant_total:55000,
        items:[{ code:'P6', designation:'Pointes 6', quantity:1000, cond:500, unit_price:27500, total_price:55000 }] }];
      apProdSet(p);
      renderAchatsProduction();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf("editApAchat('B2409')") !== -1 && h.indexOf('Modifier cet achat') !== -1) ? 'OK' : 'ABSENT'
    `,
    attendu: 'OK'
  });

  r.push({
    nom: 'App principale : modifier un achat met a jour sans en creer un second',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      var p = apProdGet();
      p.achats = [{ id:'B2409', reference:'B2409', date:'2026-09-24', fournisseur:'TIJANI',
        receiver_name:'GABOU', category:'consumables', montant_total:55000,
        items:[{ code:'P6', designation:'Pointes 6', quantity:1000, unit_price:27500, total_price:55000 }] }];
      p.stockConsum = [];
      apProdSet(p);
      window._apEditingId = 'B2409';
      document.getElementById('ach_ref').value = 'B2409';
      document.getElementById('ach_date').value = '2026-09-25';
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      document.getElementById('ach_receiver').value = 'GABOU';
      document.getElementById('ach_acheteur').value = '';
      _tempAchatItems = [{ code:'P6', designation:'Pointes 6', quantity:2000, unit_price:27500, total_price:55000, volume:0 }];
      saveApAchat(null, 'consumables');
      var apres = apProdGet();
      (apres.achats.length === 1 && apres.achats[0].date === '2026-09-25'
        && apres.achats[0].montant_total === 55000
        && apres.achats[0].items.length === 1 && apres.achats[0].items[0].quantity === 2000)
        ? 'OK : 1 achat, date 2026-09-25, 2000 pointes'
        : 'ECHEC : ' + JSON.stringify(apres.achats)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : le prix saisi est le prix d\'UN carton (2 cartons x 28 000 F = 56 000 F)',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      localStorage.setItem('mdb_packs_per_carton', '50');
      document.getElementById('ai_code').value = 'P6';
      document.getElementById('ai_designation').value = 'Pointes 6';
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_qte_paquet').value = '1000';
      document.getElementById('ai_cartons').value = '2';
      document.getElementById('ai_pu').value = '28000';
      calcConsommableCartons('cartons');
      _tempAchatItems = [];
      addAchatItemLine('consumable');
      var it = _tempAchatItems[0];
      (it.cartons === 2 && it.paquets === 100 && it.quantity === 100000
        && it.prix_carton === 28000 && it.total_price === 56000
        && Math.abs(it.unit_price - 0.56) < 0.0001)
        ? 'OK : ' + it.cartons + ' cartons / ' + it.total_price + ' F / ' + it.unit_price + ' F par pointe'
        : 'ECHEC : ' + JSON.stringify(it)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : reprise d\'une ligne en modification avec le prix du carton',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:60000, paquets:60,
        cartons:2, ppc:30, cond:1000, ctype:'POINTE', prix_carton:28000, unit_price:0.56, total_price:56000 }];
      editAchatItemLine(0, 'consumable');
      var g = function (id) { return String(document.getElementById(id).value); };
      (g('ai_qte') === '60' && g('ai_cartons') === '2'
        && g('ai_qte_paquet') === '1000' && g('ai_pu') === '28000')
        ? 'OK : 60 paquets / 2 cartons / 28 000 F le carton'
        : 'ECHEC : qte=' + g('ai_qte') + ' cartons=' + g('ai_cartons') + ' pu=' + g('ai_pu')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : le recap live annonce le total en fonction des cartons',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      localStorage.setItem('mdb_packs_per_carton', '50');
      document.getElementById('ai_constype').value = 'POINTE';
      document.getElementById('ai_qte_paquet').value = '1000';
      document.getElementById('ai_cartons').value = '2';
      document.getElementById('ai_pu').value = '28000';
      calcConsommableRecap();
      var t = document.getElementById('ai_conso_resume').innerHTML || '';
      (t.indexOf('2 carton(s)') !== -1 && t.indexOf('56 000 F') !== -1)
        ? 'OK : recap = 2 cartons, total 56 000 F'
        : 'ECHEC : ' + t
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Consommables : les pointes definies doivent etre proposees ---------- */
  function storePointeP8() {
    const s = storeRealiste();
    const p = JSON.parse(s.mdb_production);
    p.definitions = (p.definitions || []).concat([{ id: 'd8', code: 'P8', designation: 'Pointe 8 cm', type: 'POINTE', unit_cost: 120 }]);
    p.composants = (p.composants || []).concat([{ article_id: 'a1', type: 'POINTE', code: 'P8', designation: 'Pointe 8 cm', quantity: 8 }]);
    p.stockConsum = (p.stockConsum || []).filter(function (x) { return x.code !== 'P8'; });
    s.mdb_production = JSON.stringify(p);
    return s;
  }

  r.push({
    nom: 'Achat consommables : la pointe P8 definie (sans stock) est proposee',
    app: 'production.html', store: storePointeP8,
    code: `
      var codes = apAchatCatalog('consumables').map(function(o) { return o.code; });
      var dl = apAchatDatalist('consumables', 'aiCodeList', 'code');
      var dlD = apAchatDatalist('consumables', 'aiDesigList', 'des');
      var unique = codes.indexOf('P8') === codes.lastIndexOf('P8');
      (codes.indexOf('P8') !== -1 && unique && dl.indexOf('value="P8"') !== -1 && dlD.indexOf('value="Pointe 8 cm"') !== -1)
        ? 'OK : ' + codes.join(',')
        : 'ECHEC : ' + codes.join(',')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : la pointe P8 definie (sans stock) est proposee',
    app: 'index.html', store: storePointeP8,
    code: `
      var codes = apAchatCatalogue('consumables').map(function(o) { return o.code; });
      var opts = apAchatCodeOptions('consumables');
      var dopts = apAchatDesigOptions('consumables');
      var unique = codes.indexOf('P8') === codes.lastIndexOf('P8');
      (codes.indexOf('P8') !== -1 && unique && opts.indexOf('value="P8"') !== -1 && dopts.indexOf('value="Pointe 8 cm"') !== -1)
        ? 'OK : ' + codes.join(',')
        : 'ECHEC : ' + codes.join(',')
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Regressions : le lancement avait lieu AVANT les globales ---------- */
  r.push({
    nom: 'Exploitation : ouvrir l\'app directement sur la page Achats ne plante plus',
    app: 'production.html',
    store: function () { const s = storeRealiste(); s.mdb_prod_currentPage = 'achats'; return s; },
    code: `
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('pas pu s') === -1 && h.indexOf('Nouvel Achat') !== -1)
        ? 'OK : rendu au demarrage sans erreur'
        : 'ECHEC : ' + h.slice(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Exploitation : l\'historique des achats supporte des lignes abimees',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('achats', [
        { id: 1, category: 'raw-materials', date: today(), items: { a: 1 } },
        { id: 2, category: 'raw-materials', date: today(), items: [null, undefined, { colis_number: 'K9', quantity: 1, length: 100 }] }
      ]);
      CURRENT_PAGE = 'achats-history'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('pas pu s') === -1 && h.indexOf('Historique des Achats') !== -1)
        ? 'OK : historique rendu sans erreur'
        : 'ECHEC : ' + h.slice(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  return r;
}

function run(rapport) {
  rapport.section('4. Garde-fous fonctionnels');
  const liste = controles();
  const parApp = {};

  liste.forEach(function (c) {
    if (!parApp[c.app]) parApp[c.app] = [];
    parApp[c.app].push(c);
  });

  Object.keys(parApp).forEach(function (app) {
    parApp[app].forEach(function (c) {
      let h;
      try { h = chargerApp(app, c.store()); }
      catch (e) { rapport.ko(c.nom + ' : chargement impossible (' + e.message + ')'); return; }
      let res;
      try { res = String(vm.runInContext(c.code, h.ctx, { timeout: 30000 })).trim(); }
      catch (e) { rapport.ko(c.nom + ' : exception ' + (e && e.message ? e.message : e)); return; }

      if (c.attenduPrefixe) {
        if (res.indexOf(c.attenduPrefixe) === 0) rapport.ok(c.nom + '  ->  ' + res);
        else rapport.ko(c.nom + '  ->  ' + res + ' (attendu : ' + c.attenduPrefixe + '...)');
      } else if (res === c.attendu) rapport.ok(c.nom + '  ->  ' + res);
      else rapport.ko(c.nom + '  ->  ' + res + ' (attendu : ' + c.attendu + ')');
    });
  });

  return liste.length;
}

module.exports = { run, controles };
