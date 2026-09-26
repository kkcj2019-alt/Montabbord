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
