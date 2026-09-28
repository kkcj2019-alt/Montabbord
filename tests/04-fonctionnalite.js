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
      (/\\b2 c\\./.test(t) && /\\b100 paq\\./.test(t) && /\\b2 cartons\\b/.test(t))
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
