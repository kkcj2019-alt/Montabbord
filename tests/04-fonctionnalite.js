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
    nom: 'Pointage : la grille horaire porte son id et son bouton d\'impression dediee',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'presence'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var okTable = h.indexOf('id="ptGrilleTable"') !== -1;
      var okBtn = h.indexOf('printPointageGrille()') !== -1;
      (okTable && okBtn) ? 'OK : grille imprimable branchee' : 'ECHEC table=' + okTable + ' bouton=' + okBtn
    `,
    attenduPrefixe: 'OK'
  });

  /* Les pages de cout exigent une autorisation explicite de l'app principale. */
  /* ---------- Cout de revient : le mode Cout Reel doit recalculer la table ---------- */
  r.push({
    nom: 'Cout de revient : le mode Cout Reel recharge la main-d\u2019oeuvre depuis le pointage',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-revient';
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      acSetLaborMode('pointage');
      var cfg = getSection('costLabor', {});
      var h = document.getElementById('content').innerHTML || '';
      (cfg.modeLabor === 'pointage' && cfg._autoPointageActif === true && cfg._nbPresentsPointage >= 1
        && h.indexOf('Coût réel') !== -1)
        ? 'OK : pointage du ' + cfg.datePointage + ' (' + cfg._nbPresentsPointage + ' présent(s)) injecté dans le tableau'
        : 'ECHEC mode=' + cfg.modeLabor + ' actif=' + cfg._autoPointageActif + ' presents=' + cfg._nbPresentsPointage
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient : une date sans pointage est signalée au lieu de laisser la simulation',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
CURRENT_PAGE = 'cout-revient';
      acSetLaborMode('pointage');
      acDatePointageChanged('2001-01-01');
      var cfg = getSection('costLabor', {});
      var h = document.getElementById('content').innerHTML || '';
      (cfg._autoPointageActif === false && h.indexOf('introuvable') !== -1)
        ? 'OK : absence de pointage annoncée'
        : 'ECHEC actif=' + cfg._autoPointageActif
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Rubrique 4 : le prorata mensuel du loyer est conserve et se relit',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-revient';
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      acSaveChargeModelePoste('a1', 'mode_loyer', 'mensuel');
      acSaveChargeModelePoste('a1', 'loyer', 100000);
      var ch = acGetChargesModele('a1');
      var h = document.getElementById('content').innerHTML || '';
      (ch.mode_loyer === 'mensuel' && ch.loyer === 100000 && h.indexOf('Prorata mensuel') !== -1)
        ? 'OK : loyer 100000 F/mois lu en prorata mensuel'
        : 'ECHEC mode=' + ch.mode_loyer + ' loyer=' + ch.loyer + ' mention=' + (h.indexOf('Prorata mensuel') !== -1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Rubrique 4 : le reglage par ligne et le reglage en lot existent',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-revient'; renderPage();
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var h = document.getElementById('content').innerHTML || '';
      (typeof acStructSetTousModes === 'function' && typeof acStructReglerLignes === 'function'
        && typeof acJoursOuvresMois === 'function' && acJoursOuvresMois() >= 20
        && h.indexOf('acStructReglerLignes') !== -1 && h.indexOf('/mois') !== -1)
        ? 'OK : reglage par ligne + reglage en lot prêts'
        : 'ECHEC outils ou boutons manquants'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de production : la page calcule chaque jour et synthétise le mois',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-production'; renderPage();
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var h = document.getElementById('content').innerHTML || '';
      var ok = (typeof render_cout_production === 'function') && (typeof acCoutFicheJour === 'function')
        && h.indexOf('Coût de Production par Jour') !== -1
        && h.indexOf('Matières') !== -1 && h.indexOf('Main-d') !== -1
        && h.indexOf('SYNTH') !== -1;
      ok ? 'OK : cout journalier + synthese mensuelle' : 'ECHEC page incomplete'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de production : elle resiste aussi aux données corrompues',
    app: 'production.html', store: storeCorrompu,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-production'; renderPage();
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Coût de Production par Jour') !== -1 && h.indexOf('Aucune fiche') !== -1)
        ? 'OK : page vide mais lisible' : 'ECHEC'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Cout de revient : les deux sources, manuel et auto ---------- */
  r.push({
    nom: 'Cout de revient : les onglets MANUEL et AUTO existent et se memorisent',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      CURRENT_PAGE = 'cout-revient';
      acSetModeCout('manuel'); renderPage();
      var hM = document.getElementById('content').innerHTML || '';
      acSetModeCout('auto'); renderPage();
      var hA = document.getElementById('content').innerHTML || '';
      var cfg = getSection('costLabor', {});
      (typeof acSetModeCout === 'function' && getSection('costModeSource', 'manuel') === 'auto'
        && hM.indexOf('MANUEL') !== -1 && hA.indexOf('AUTO') !== -1
        && hA.indexOf('fiche de production du jour') !== -1
        && hA.indexOf('onglet AUTO') !== -1
        && cfg.modeLabor === 'pointage' && cfg._autoPointageActif === true)
        ? 'OK : mode auto = pointage Paye (' + cfg._nbPresentsPointage + ' présent(s)), mode manuel = saisie'
        : 'ECHEC source=' + getSection('costModeSource', 'manuel') + ' actif=' + cfg._autoPointageActif
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient : la page est refusee sans autorisation explicite',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodDashboard: 'write' } }));
      var k = prodPageKey('cout-revient');
      CURRENT_PAGE = 'cout-revient'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (k === 'prodCoutRevient' && prodCanRead(k) === false && h.indexOf('Acc') !== -1 && h.indexOf('non autoris') !== -1)
        ? 'OK : acces bloque, message affiche'
        : 'ECHEC cle=' + k + ' lecture=' + prodCanRead(k)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de production : la page est refusee sans autorisation explicite',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write' } }));
      var k = prodPageKey('cout-production');
      CURRENT_PAGE = 'cout-production'; renderPage();
      (k === 'prodCoutJour' && prodCanRead(k) === false)
        ? 'OK : acces bloque'
        : 'ECHEC cle=' + k + ' lecture=' + prodCanRead(k)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient : les autres pages ne sont pas affectees par la protection',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodStock: 'write' } }));
      (prodCanRead('prodStock') === true && prodCanRead('prodArticles') === true && prodCanRead('prodRapports') === true)
        ? 'OK : stocks, articles et rapports restent accessibles'
        : 'ECHEC la protection a deborde sur les autres pages'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Bois : le prix du m3 suit l'essence de chaque poste ---------- */
  r.push({
    nom: 'Cout de revient : le prix du m3 depend de l essence de chaque poste de bois',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var jour = (new Date()).toISOString().slice(0, 10);
      var db = getDB();
      db.achats = [
        { id: 'aR', category: 'raw-materials', date: jour, items: [{ colis_number: 'K1', quantity: 10, volume: 5, essence: 'Rouge', unit_price: 45000, total_price: 225000 }], montant_total: 225000 },
        { id: 'aB', category: 'raw-materials', date: jour, items: [{ colis_number: 'K2', quantity: 8, volume: 4, essence: 'Blanc', unit_price: 90000, total_price: 360000 }], montant_total: 360000 }
      ];
      db.species = [{ id: 's1', nom: 'Rouge' }, { id: 's2', nom: 'Blanc' }];
      db.composants = [
        { article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte rouge', quantity: 3, volume: 0.0018, essence: 'Rouge' },
        { article_id: 'a1', type: 'PLOT', code: 'P2', designation: 'Plot blanc', quantity: 4, volume: 0.0012, essence: 'Blanc' },
        { article_id: 'a1', type: 'POINTE', code: 'P1', designation: 'Pointes', quantity: 90 }
      ];
      setDB(db);
      var pxRouge = acPrixM3Essence('Rouge');
      var pxBlanc = acPrixM3Essence('Blanc');
      var pxArticle = acPrixM3Article('a1');
      /* moyenne ponderee par le volume : (0,0054*45000 + 0,0048*90000) / 0,0102 */
      var volR = 3 * 0.0018, volB = 4 * 0.0012;
      var attendu = Math.round((volR * 45000 + volB * 90000) / (volR + volB));
      var detail = acEssencesArticle('a1');
      (pxRouge === 45000 && pxBlanc === 90000 && Math.round(pxArticle) === attendu && detail.length === 2)
        ? 'OK : rouge ' + pxRouge + ' F/m3, blanc ' + pxBlanc + ' F/m3, article melange ' + Math.round(pxArticle) + ' F/m3'
        : 'ECHEC rouge=' + pxRouge + ' blanc=' + pxBlanc + ' article=' + Math.round(pxArticle) + ' attendu=' + attendu
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient : deux articles de bois differents n ont pas le meme cout',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var jour = (new Date()).toISOString().slice(0, 10);
      var db = getDB();
      db.achats = [
        { id: 'aR', category: 'raw-materials', date: jour, items: [{ colis_number: 'K1', quantity: 10, volume: 5, essence: 'Rouge', unit_price: 45000, total_price: 225000 }], montant_total: 225000 },
        { id: 'aB', category: 'raw-materials', date: jour, items: [{ colis_number: 'K2', quantity: 8, volume: 4, essence: 'Blanc', unit_price: 90000, total_price: 360000 }], montant_total: 360000 }
      ];
      db.species = [{ id: 's1', nom: 'Rouge' }, { id: 's2', nom: 'Blanc' }];
      db.composants = [
        { article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte rouge', quantity: 5, volume: 0.0018, essence: 'Rouge' },
        { article_id: 'a1', type: 'POINTE', code: 'P1', designation: 'Pointes', quantity: 90 }
      ];
      var arts = getArticles();
      arts.push({ id: 'a2', code: 'PAL2', designation: 'Palette blanc', categorie: 'finished', prix_vente: 52000, unite: 'pcs' });
      setArticles(arts);
      /* meme volume de bois que a1 (5 x 0,0018 = 0,009 m3 par palette) */
      db.composants.push({ article_id: 'a2', type: 'LATTE', code: 'L2', designation: 'Latte blanche', quantity: 3, volume: 0.003, essence: 'Blanc' });
      setDB(db);
      var x = acCoutArticleCampagne('a1', 100);
      var y = acCoutArticleCampagne('a2', 100);
      /* meme quantite de bois en volume, prix double pour le blanc */
      var volX = x.bois.reduce(function (s, b) { return s + b.vol; }, 0);
      var volY = y.bois.reduce(function (s, b) { return s + b.vol; }, 0);
      (Math.abs(volX - volY) < 0.001 && y.coutBois > x.coutBois * 1.9)
        ? 'OK : a1 ' + x.coutBois + ' F (rouge) contre a2 ' + y.coutBois + ' F (blanc), meme volume'
        : 'ECHEC volA=' + volX.toFixed(3) + ' volB=' + volY.toFixed(3) + ' coutA=' + x.coutBois + ' coutB=' + y.coutBois
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Reparations clients : fiche journaliere + sortie de stock ---------- */
  r.push({
    nom: 'Reparations clients : une fiche sort les pieces du stock et se retrouve au journal',
    app: 'production.html', store: storeRealiste,
    code: `
      var pieces = reparPiecesDisponibles();
      var echec = (!pieces.length) ? 'ECHEC aucune piece en stock' : '';
      var p = pieces[0];
      var stockAvant = p.stock;
      var res = enregistrerReparation({
        date: '2026-10-01', client: 'BTP CONSTRUCTIONS', lieu: 'Chantier X',
        technicien: 'Mamadou', motif: 'palettes cassees', travail: 'remplacement de lattes',
        pieces: [{ article_id: p.article_id, code: p.code, designation: p.designation, categorie: p.categorie, qte: 20, coutUnite: p.coutUnite }],
        mainOeuvre: 5000, fraisDeplacement: 2000
      });
      if (!res || res.erreur) echec = 'ECHEC ' + JSON.stringify(res && res.erreur);
      var f = res.fiche || {};
      var stockApres = reparPiecesDisponibles().filter(function (x) { return x.code === p.code; })[0];
      var ok1 = !echec && f.numero && (f.pieces || []).length === 1 && getReparationsPalettes().length === 1
        && stockApres && Math.abs(stockApres.stock - (stockAvant - 20)) < 0.001;
      ok1 ? 'OK : fiche ' + f.numero + ', stock ' + stockAvant + ' -> ' + stockApres.stock
        : (echec || ('ECHEC avant=' + stockAvant + ' apres=' + (stockApres ? stockApres.stock : '?') + ' pieces=' + ((f.pieces || []).length)))
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Reparations clients : le stock insuffisant est refuse, la fiche ne sort pas',
    app: 'production.html', store: storeRealiste,
    code: `
      var pieces = reparPiecesDisponibles();
      var p = pieces[0];
      var res = enregistrerReparation({
        date: '2026-10-02', client: 'Client X',
        pieces: [{ article_id: p.article_id, code: p.code, designation: p.designation, categorie: p.categorie, qte: 999999, coutUnite: p.coutUnite }]
      });
      (res && res.erreur && res.erreur.length && getReparationsPalettes().length === 0)
        ? 'OK : demande refusee (' + res.erreur[0] + ')'
        : 'ECHEC la demande a ete acceptee alors que le stock est insuffisant'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Reparations clients : annuler une fiche remet les pieces en stock',
    app: 'production.html', store: storeRealiste,
    code: `
      var pieces = reparPiecesDisponibles();
      var p = pieces[0];
      var stockAvant = p.stock;
      var res = enregistrerReparation({
        date: '2026-10-03', client: 'Client Y',
        pieces: [{ article_id: p.article_id, code: p.code, designation: p.designation, categorie: p.categorie, qte: 15, coutUnite: p.coutUnite }]
      });
      if (!res || res.erreur) { /* fiche non creee */ }
      var confirm2 = function () { return true; };
      supprimerReparation(res.fiche.id);
      var apres = reparPiecesDisponibles().filter(function (x) { return x.code === p.code; })[0];
      (getReparationsPalettes().length === 0 && apres && Math.abs(apres.stock - stockAvant) < 0.001)
        ? 'OK : stock remis a ' + apres.stock
        : 'ECHEC stock avant=' + stockAvant + ' apres=' + (apres ? apres.stock : '?')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Reparation palettes : la page affiche ses onglets et sa fiche journaliere',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'reparations-clients'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      /* le formulaire est fabrique par sa fonction dediee */
      var f = (typeof repFormHtml === 'function') ? repFormHtml() : '';
      (typeof render_reparation_palettes === 'function'
        && h.indexOf('Enregistrer reparation') !== -1
        && h.indexOf('Nouveau type') !== -1
        && f.indexOf('rep_date') !== -1 && f.indexOf('rep_client') !== -1
        && f.indexOf('sorties du stock') !== -1)
        ? 'OK : onglets + fiche journaliere disponibles'
        : 'ECHEC fiche absente'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Menu Qualite : il ne doit plus rester sur l ecran d attente ---------- */
  r.push({
    nom: 'Menu Qualite : la page s affiche au lieu du message de chargement',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'qualite'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Chargement du module') === -1 && h.length > 500 && h.indexOf('Service Qualit') !== -1)
        ? 'OK : module Qualite affiche (' + h.length + ' car.)'
        : 'ECHEC la page reste bloquee sur l ecran de chargement'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Menu Qualite : la page resiste aux donnees corrompues',
    app: 'production.html', store: storeCorrompu,
    code: `
      CURRENT_PAGE = 'qualite'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Chargement du module') === -1 && h.length > 100)
        ? 'OK : page rendue meme avec des donnees abimees'
        : 'ECHEC page bloquee'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Taux de perte par article ---------- */
  r.push({
    nom: 'Cout de production : le taux de perte est propre a chaque article',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      var defaut = acTauxPerteArticle('a1');
      setSection('costComposition', [{ article_id: 'a1', qte: 120, tauxPerte: 12 }]);
      var saisi = acTauxPerteArticle('a1');
      setSection('costComposition', []);
      (typeof acTauxPerteArticle === 'function' && defaut >= 0 && saisi === 12)
        ? 'OK : defaut ' + defaut + ' %, saisi ' + saisi + ' %'
        : 'ECHEC defaut=' + defaut + ' saisi=' + saisi
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de production : chaque ligne de composition porte son taux de perte',
    app: 'production.html', store: storeRealiste,
    code: `
      localStorage.setItem('mdb_prod_granted', JSON.stringify({ pages: { prodCoutRevient: 'write', prodCoutJour: 'write' } }));
      setSection('costComposition', [{ article_id: 'a1', qte: 120, tauxPerte: 12 }]);
      CURRENT_PAGE = 'cout-revient'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var ok = h.indexOf('Taux perte') !== -1 && h.indexOf('acSetTauxPerteArticle') !== -1;
      setSection('costComposition', []);
      ok ? 'OK : colonne taux de perte editable par article' : 'ECHEC colonne absente'
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Unite des pointes : carton <-> paquet <-> pointe ---------- */
  r.push({
    nom: 'Pointes : la conversion carton / paquet / pointe fonctionne dans les deux sens',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P1', designation: 'Pointes', type: 'POINTE', unit_cost: 15, qty_per_packet: 500, prix_carton: 45000 }]);
      var parPaquet = acPointesParPaquet('P1');
      var carton = acConvertirEnUnites(1, 'carton', 'P1');
      var paquet = acConvertirEnUnites(1, 'paquet', 'P1');
      var versPaquets = acConvertirDepuisUnites(25000, 'paquet', 'P1');
      var versCartons = acConvertirDepuisUnites(25000, 'carton', 'P1');
      (parPaquet === 500 && carton === 25000 && paquet === 500 && versPaquets === 50 && versCartons === 1)
        ? 'OK : 1 carton = 50 paquets = ' + carton + ' pointes, et la conversion inverse est exacte'
        : 'ECHEC paquet=' + parPaquet + ' carton=' + carton + ' paquetEnUnites=' + paquet + ' retourPaquets=' + versPaquets + ' retourCartons=' + versCartons
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointes : l unite saisie est proposee dans l inventaire',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P1', designation: 'Pointes', type: 'POINTE', unit_cost: 15, qty_per_packet: 500 }]);
      var champ = acChampUnite('P1', 25000, 'carton');
      (typeof acChampUnite === 'function'
        && champ.indexOf('carton') !== -1 && champ.indexOf('paquet') !== -1
        && champ.indexOf('value="1"') !== -1)
        ? 'OK : 25 000 pointes proposees en 1 carton, choix carton/paquet/pointe'
        : 'ECHEC champ=' + champ.slice(0, 120)
    `,
    attenduPrefixe: 'OK'
  });

  /* ---------- Inventaire : le mois suit la date de la fiche ---------- */
  r.push({
    nom: 'Inventaire : changer la date de la fiche change le mois d inventaire',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'inventory'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var i = h.indexOf('id="inv_date"');
      (i !== -1 && h.slice(i, i + 500).indexOf('launchInventory()') !== -1)
        ? 'OK : la date de la fiche declenche la regeneration de la liste'
        : 'ECHEC la date change sans regenerer la liste'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : unites carton et paquet disponibles pour les pointes',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P5', designation: 'POINTE5', type: 'POINTE', unit_cost: 0, qty_per_packet: 180, prix_carton: 0 }]);
      var c = acChampUnite('P5', 9000, 'carton');
      (typeof acChampUnite === 'function' && c.indexOf('carton') !== -1 && c.indexOf('paquet') !== -1
        && acConvertirEnUnites(2, 'carton', 'P5') === 18000)
        ? 'OK : champ avec unite + conversion (2 cartons = 18 000 pointes)'
        : 'ECHEC conversion absente'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : le cout de revient est calcule sur place, avec le moteur de Exploitation',
    app: 'index.html', store: storeRealiste,
    code: `
      currentPage = 'costPrice';
      renderCostPrice();
      var h = document.getElementById('content').innerHTML || '';
      var natif = (typeof render_cout_revient === 'function') && (typeof acCoutArticleAuto === 'function')
        && (typeof acEtapesHtml === 'function') && (typeof acGetChargesModele === 'function');
      var pasDeCadre = h.indexOf('production.html?page=') === -1 && h.indexOf('<iframe') === -1;
      var tableau = h.indexOf('POSTES DE CO') !== -1 || h.indexOf('CVAMP') !== -1;
      (natif && pasDeCadre && tableau)
        ? 'OK : moteur complet execute dans l app principale, sans cadre externe'
        : 'ECHEC natif=' + natif + ' pasDeCadre=' + pasDeCadre + ' tableau=' + tableau
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : le cout se recalcule quand Exploitation bouge',
    app: 'index.html', store: storeRealiste,
    code: `
      currentPage = 'costPriceJour';
      renderCostPriceJour();
      var h1 = document.getElementById('content').innerHTML || '';
      /* une production de plus dans Exploitation doit se répercuter ici */
      var prods = getProdSection('productions', []).slice();
      prods.push({ id: 'pX', numero: 'TEST-SYNC', date: (new Date()).toISOString().slice(0, 10), statut: 'validated', assemblage: [{ code: 'PAL', qte: 7 }] });
      var db = getProdDB(); db.productions = prods; DB.set('mdb_production', db);
      crRerender();
      var h2 = document.getElementById('content').innerHTML || '';
      (typeof crRerender === 'function' && h2.indexOf('TEST-SYNC') !== -1 && h2 !== h1)
        ? 'OK : la nouvelle fiche de production apparait dans le cout de l app principale'
        : 'ECHEC la fiche ajoutee n est pas reprise'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : la page cout par jour synthétise le mois',
    app: 'index.html', store: storeRealiste,
    code: `
      renderCostPriceJour();
      var h = document.getElementById('content').innerHTML || '';
      (typeof render_cout_production === 'function' && h.indexOf('Coût de production par jour') !== -1
        && h.indexOf('Matières') !== -1)
        ? 'OK : synthese mensuelle presente'
        : 'ECHEC page incomplete'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : les deux pages de cout sont accessibles depuis le menu',
    app: 'index.html', store: storeRealiste,
    code: `
      var h = document.body.innerHTML || '';
      var okMod = (typeof MODULES !== 'undefined') && MODULES.some(function (m) {
        return m.key === 'production' && m.pages.indexOf('prodCoutRevient') !== -1 && m.pages.indexOf('prodCoutJour') !== -1;
      });
      var okMap = (typeof PROD_PAGE_MAP !== 'undefined') && PROD_PAGE_MAP.prodCoutRevient === 'cout-revient' && PROD_PAGE_MAP.prodCoutJour === 'cout-production';
      (okMod && okMap) ? 'OK : menu et routage cout présents' : 'ECHEC menu=' + okMod + ' routage=' + okMap
    `,
attenduPrefixe: 'OK'
  });

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

  r.push({
    nom: 'Tableau de bord : la carte « Consommation Bois (mois) » affiche le bois sorti (vol_sortie_bois) des fiches validees du mois',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'dashboard'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var i = h.indexOf('kpi-consom');
      var carte = i === -1 ? '' : h.slice(i, i + 320);
      (i !== -1 && carte.indexOf('5.00 m³') !== -1 && carte.indexOf('Consommation Bois (mois)') !== -1)
        ? 'OK : carte Consommation Bois = 5.00 m³ (vol_sortie_bois de la fiche validee du mois)'
        : 'ECHEC : ' + (carte || h.substr(0, 200)).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').substr(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Tableau de bord : la carte « En Cours Production » suit les entrees et sorties d\u2019encours',
    app: 'production.html', store: storeRealiste,
    code: `
      var jours = new Date().toISOString().slice(0, 10);
      var prods = getProductions();
      prods.push({ id: 'p2', numero: '2609002', date: jours, statut: 'draft', vol_sortie_bois: 4, vol_total: 4, sortie_bois: [], lattes: [], plots: [], cp: [], assemblage: [],
        encours: [{ code: 'E1', qte: 10, volume: 2.5, wip_type: 'entrée' }, { code: 'E1', qte: 4, volume: 1.0, wip_type: 'reprise' }] });
      setProductions(prods);
      CURRENT_PAGE = 'dashboard'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var i = h.indexOf('kpi-encours');
      var carte = i === -1 ? '' : h.slice(i, i + 320);
      (i !== -1 && carte.indexOf('1.50 m') !== -1 && carte.indexOf('En Cours Production') !== -1)
        ? 'OK : 2.5 entree - 1.0 reprise = 1.50 m3 en En Cours (et non le total du brouillon)'
        : 'ECHEC : ' + (carte || h.substr(0, 200)).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').substr(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Produits finis : la validation ecrit la production dans le JOURNAL, la fiche de l\'article nest plus vide',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = new Date().toISOString().slice(0, 10);
      creditAssemblageFini({ numero: '260901', date: d, assemblage: [{ code: 'PAL', designation: 'Palette', qte: 100 }] });
      var fin = getStockFinished();
      var ligne = fin.find(function(s){ return s.code === 'PAL' && (s.quantite || 0) === 100; });
      var reg = _finRegistreData(ligne.id);
      var journal = getMovements().filter(function(m){ return m.article_id === 'a1' && m.type === 'entree'; });
      (reg && reg.movs.length === 1 && journal.length === 1 && reg.initial === 0
        && String(reg.movs[0].motif || '').indexOf('Production 260901') === 0)
        ? 'OK : fiche article = 1 mouvement, stock initial 0, motif « ' + reg.movs[0].motif + ' »'
        : 'ECHEC : fiche=' + (reg ? reg.movs.length : 'null') + ' journal=' + journal.length
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Rattrapage : les entrees produits finis deja au stock sans journal sont rejouees dans la fiche de l\'article (sans doublon)',
    app: 'production.html', store: storeRealiste,
    code: `
      var d = new Date().toISOString().slice(0, 10);
      setStockFinished([{ id: 'pfX', article_id: 'a1', code: 'PAL', designation: 'Palette', quantite: 100, motif: 'Production 260901 — assemblage : +100 PAL', obs: 'Production 260901 — assemblage : +100 PAL', created_at: d }]);
      var prods = getProductions();
      prods.push({ id: 'pX', numero: '260901', date: d, statut: 'validated', assemblage: [{ code: 'PAL', designation: 'Palette', qte: 100 }], sortie_bois: [], lattes: [], plots: [], cp: [], encours: [] });
      setProductions(prods);
      window.confirm2 = function(){ return true; };
      backfillFinishedCredits();
      var n = getMovements().filter(function(m){ return m.article_id === 'a1' && m.type === 'entree' && m.quantite === 100; }).length;
      backfillFinishedCredits();
      var n2 = getMovements().filter(function(m){ return m.article_id === 'a1' && m.type === 'entree' && m.quantite === 100; }).length;
      var reg = _finRegistreData(getStockFinished().find(function(s){ return s.article_id === 'a1'; }).id);
      (n === 1 && n2 === 1 && reg.movs.length === 1 && reg.initial === 0)
        ? 'OK : journal = 1 entree (2e passage sans doublon), fiche de l article remplie'
        : 'ECHEC : n=' + n + ' n2=' + n2 + ' fiche=' + (reg ? reg.movs.length : '-')
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
    nom: 'Assemblage : la production du jour compte (500 lattes produites couvrent 80 demandees)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a9', code: 'PAL114', designation: 'Palette 114', categorie: 'finished' }];
      p.composants = [{ article_id: 'a9', type: 'LATTE', code: 'L114*8*2', designation: 'Latte', quantity: 8 }];
      p.stockSemi = [];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var r = checkAssemblageStock([{ code: 'PAL114', qte: 10 }], [{ code: 'L114*8*2', qte: 500 }]);
      (r.ok === true && r.errors.length === 0)
        ? 'OK : stock ancien 0 + 500 du jour >= besoin 80, validation autorisee'
        : 'ECHEC : ' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Assemblage : sans production du jour le controle bloque avec le detail compte',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a9', code: 'PAL114', designation: 'Palette 114', categorie: 'finished' }];
      p.composants = [{ article_id: 'a9', type: 'LATTE', code: 'L114*8*2', designation: 'Latte', quantity: 8 }];
      p.stockSemi = [];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var r = checkAssemblageStock([{ code: 'PAL114', qte: 10 }], []);
      var m = (r.errors[0] || '');
      (!r.ok && m.indexOf('stock ancien 0') !== -1 && m.indexOf('besoin 80') !== -1
        && m.indexOf('aucune production du jour transmise') !== -1)
        ? 'OK : bloque avec le detail (ancien 0, jour 0, besoin 80)'
        : 'ECHEC : ' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Validation depuis l\u2019historique : elle deduit aussi l\u2019assemblage (pas seulement le bois)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a9', code: 'PAL114', designation: 'Palette 114', categorie: 'finished' }];
      p.composants = [{ article_id: 'a9', type: 'POINTE', code: 'P5', designation: 'Pointe 5', quantity: 160 }];
      p.stockConsum = [{ id: 'vp1', code: 'P5', designation: 'POINTE5', quantite: 5000, paquets: 0, cartons: 0, cond: 180, ctype: 'POINTE', created_at: '2026-09-01' }];
      p.productions = [{ id: 'fh1', numero: '260910', date: '2026-09-29', statut: 'draft',
                         sortie_bois: [], lattes: [], plots: [], cp: [],
                         assemblage: [{ code: 'PAL114', qte: 10 }] }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      window.confirm2 = function () { return true; };
      validateProd('fh1');
      var f = getProductions().filter(function (x) { return x.id === 'fh1'; })[0] || {};
      var agg = consoAggregate().filter(function (a) { return a.code === 'P5'; })[0] || {};
      var r = buildConsoMovements(_consoLignes('P5'));
      var sor = r.filter(function (x) { return x.sortie > 0 && /Production 260910/.test(x.obs || ''); })[0] || {};
      (f.statut === 'validated' && agg.unites === 3400 && sor.sortie === 1600)
        ? 'OK : fiche validee, 10 x 160 = 1 600 pointes sorties et tracees « Production 260910 »'
        : 'ECHEC : statut=' + f.statut + ' stock=' + agg.unites + ' registre=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression fiche : le bois sorti REVIENT, meme si le lot a disparu (il est recree)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      /* Le lot C10 n'existe plus au stock (consomme ou fusionne) : avant, la
         restitution l'ignorait en silence et le bois ne revenait jamais. */
      p.stockRaw = [{ id: 'r9', code: 'C11', quantite: 5, volume: 1.0 }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var r = restoreBoisSorti({ numero: '260901', sortie_bois: [{ code: 'C10', qte: 30, volume: 1.5, essence: 'Rouge' }], encours: [] });
      var lot = getStockRaw().filter(function (x) { return (x.code || x.colis_number) === 'C10'; })[0] || {};
      (lot.quantite === 30 && lot.volume === 1.5 && r.recrees.length === 1)
        ? 'OK : lot C10 recree a 30 / 1.5 m3, restitution annoncee'
        : 'ECHEC : ' + JSON.stringify(lot) + ' rapport=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression fiche : les entrees d\u2019encours sont retirees (le stock ne reste pas gonfle)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockRaw = [{ id: 'r8', code: 'C20', quantite: 100, volume: 5.0 }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      /* La validation avait AJOUTE 20 au lot (entree encours) : la
         suppression doit les retirer. */
      restoreBoisSorti({ numero: '260902', sortie_bois: [],
        encours: [{ code: 'C20', qte: 20, volume: 1.0, wip_type: 'entr\u00e9e' },
                  { code: 'C20', qte: 5, volume: 0.25, wip_type: 'reprise' }] });
      var lot = getStockRaw().filter(function (x) { return (x.code || x.colis_number) === 'C20'; })[0] || {};
      (lot.quantite === 85 && Math.abs(lot.volume - 4.25) < 0.001)
        ? 'OK : 100 - 20 (entree retiree) + 5 (reprise rendue) = 85'
        : 'ECHEC : ' + JSON.stringify(lot)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock BL : chaque BL affiche sa synthese (initial, entree, sortie, final, observation)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.achats = [{ id: 'bl1', category: 'raw-materials', date: '2026-09-01', reference: 'BL-36683', fournisseur: 'SMI',
                    items: [{ colis_number: '10', quantity: 200, volume: 30, essence: 'DAB', type: 'Rouge' }], montant_total: 1000 }];
      p.stockRaw = [{ id: 'rw1', code: '10', colis_number: '10', designation: 'DAB', essence: 'DAB', quantite: 160, volume: 24.0, origin: 'BL', created_at: '2026-09-01' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      setSection('stockRawEtat', 'tout');
      setSection('stockRawTab', 'bl');
      var h = render_stock_raw();
      var txt = h.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      /* 200 entres, 40 sortis (200-160), 160 restants, avec l'initial */
      (/Stock initial/.test(txt) && /Entrée/.test(txt) && /Sortie/.test(txt)
        && /Stock final/.test(txt) && /BL-36683/.test(txt) && /SMI/.test(txt))
        ? 'OK : synthese du BL affichee (initial, entree, sortie, final, BL + fournisseur)'
        : 'ECHEC : ' + txt.substr(0, 300)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression fiche : elle ecrit ANNULATION dans le journal (et rend le bois)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.stockRaw = [{ id: 'ra1', code: 'C10', colis_number: 'C10', designation: 'DAB', quantite: 160, volume: 24.0 }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      restoreBoisSorti({ numero: '260901', sortie_bois: [{ code: 'C10', qte: 30, volume: 4.5 }], encours: [] });
      var lot = getStockRaw().filter(function (x) { return (x.code || x.colis_number) === 'C10'; })[0] || {};
      var ann = getMovements().filter(function (m) { return m && m.famille === 'annulation-bois' && String(m.code).toUpperCase() === 'C10'; })[0] || {};
      (lot.quantite === 190 && ann.quantite === 30 && /ANNULATION fiche 260901/.test(ann.motif || ''))
        ? 'OK : lot rendu a 190, ANNULATION +30 tracee au journal'
        : 'ECHEC : lot=' + JSON.stringify(lot) + ' annulation=' + JSON.stringify(ann)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Registre colis : les ANNULATION s\u2019affichent et l\u2019ecart ne les recompte pas',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.achats = [{ id: 'bl1', category: 'raw-materials', date: '2026-09-01', reference: 'BL-1', fournisseur: 'X',
                    items: [{ colis_number: 'C10', quantity: 200, volume: 30 }], montant_total: 1 }];
      p.stockRaw = [{ id: 'ra1', code: 'C10', colis_number: 'C10', designation: 'DAB', quantite: 170, volume: 25.5 }];
      p.productions = [{ id: 'fp1', numero: '260901', date: '2026-09-05', statut: 'validated',
                         sortie_bois: [{ code: 'C10', qte: 40, volume: 6 }] }];
      p.movements = [{ id: 'an1', date: '2026-09-08', famille: 'annulation-bois', code: 'C10',
                       quantite: 10, volume: 1.5, motif: 'ANNULATION fiche 260902', fiche: '260902' }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      /* 200 achetes - 40 sortis + 10 annulation rendue = 170 en stock.
         L'ecart doit etre 0 (tout est explique), pas un faux inventaire. */
      var h = colisMouvementsHTML('C10', { date: '2026-09-01', ref: 'BL-1', q0: 200, v0: 30, label: 'Entree' }, null, 'DAB');
      var txt = h.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      var aAnnulation = /ANNULATION/.test(txt) && /260902/.test(txt);
      var aEcart = /cart non justifi|non justifi/.test(txt) || /Ajustement inventaire/.test(txt);
      (aAnnulation && !aEcart)
        ? 'OK : ANNULATION affichee, aucun faux « ajustement inventaire » (200-40+10=170 explique)'
        : 'ECHEC : ' + txt.substr(0, 320)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Registre colis : un ecart inexplique se dit « Ecart », pas « inventaire »',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.achats = [{ id: 'bl1', category: 'raw-materials', date: '2026-09-01', reference: 'BL-1', fournisseur: 'X',
                    items: [{ colis_number: 'C10', quantity: 200, volume: 30 }], montant_total: 1 }];
      /* 160 en stock sans sortie ni annulation : 40 inexpliques. */
      p.stockRaw = [{ id: 'ra1', code: 'C10', colis_number: 'C10', designation: 'DAB', quantite: 160, volume: 24.0 }];
      p.productions = [];
      p.movements = [];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var h = colisMouvementsHTML('C10', { date: '2026-09-01', ref: 'BL-1', q0: 200, v0: 30, label: 'Entree' }, null, 'DAB');
      var txt = h.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      (/cart/.test(txt) && !/Ajustement inventaire/.test(txt))
        ? 'OK : les 40 manquants sont un « Ecart » honnete, sans pretendre a un inventaire'
        : 'ECHEC : ' + txt.substr(0, 320)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression achats : quand tous les achats partent, le stock ne garde pas les entrees orphelines',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.achats = [
        { id: 901, category: 'consumables', date: '2026-09-28', reference: 'BL-A', fournisseur: 'TIJANI',
          items: [{ code: 'P5', designation: 'POINTE5', quantity: 9000, paquets: 50, cartons: 1, cond: 180, ctype: 'POINTE' }], montant_total: 28000 },
        { id: 902, category: 'consumables', date: '2026-09-28', reference: 'BL-B', fournisseur: 'TIJANI',
          items: [{ code: 'P6', designation: 'POINTE6', quantity: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE' }], montant_total: 84000 }
      ];
      p.stockConsum = [
        { id: 'sa1', code: 'P5', designation: 'POINTE5', quantite: 9000, paquets: 50, cartons: 1, cond: 180, ctype: 'POINTE', created_at: '2026-09-28' },
        { id: 'sa2', code: 'P6', designation: 'POINTE6', quantite: 24750, paquets: 150, cartons: 3, cond: 165, ctype: 'POINTE', created_at: '2026-09-28' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var vraiConfirm = null;
      try { vraiConfirm = confirm2; confirm2 = function () { return true; }; } catch (e) {}
      var messages = [];
      var vraiToast = null;
      try { vraiToast = toast; toast = function (m) { messages.push(String(m)); }; } catch (e) {}
      try {
        deleteAchat(901);
        deleteAchat(902);
      } catch (e) { messages.push('ERREUR: ' + e.message); }
      try { if (vraiConfirm) confirm2 = vraiConfirm; } catch (e) {}
      try { if (vraiToast) toast = vraiToast; } catch (e) {}
      var reste = getStockConsum().filter(function (x) { return (parseFloat(x.quantite) || 0) !== 0; });
      var ditRetire = messages.some(function (m) { return /stock déduit|déduit/i.test(m); });
      (getAchats().length === 0 && reste.length === 0 && ditRetire)
        ? 'OK : 2 achats supprimes, stock vide, message de retrait affiche'
        : 'ECHEC : achats=' + getAchats().length + ' stock restant=' + JSON.stringify(reste.map(function(x){return x.code + '=' + x.quantite;})) + ' messages=' + JSON.stringify(messages)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression achat : les lignes « Modification » du meme achat partent aussi (pas de stock negatif)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      /* BL cree avec P5, puis modifie pour retirer P5 (ligne -9000),
         puis supprime : il ne doit rester ni le +9000 ni le -9000. */
      p.achats = [{ id: 903, category: 'consumables', date: '2026-09-28', reference: 'BL-C', fournisseur: 'TIJANI',
                    items: [], montant_total: 0 }];
      p.stockConsum = [
        { id: 'sc1', code: 'P5', designation: 'POINTE5', quantite: 9000, cond: 180, ctype: 'POINTE', created_at: '2026-09-28' },
        { id: 'sc2', code: 'P5', designation: 'POINTE5', quantite: -9000, cond: 180, ctype: 'POINTE', motif: 'Modification BL-C (ligne retiree)', obs: 'Modification BL-C (ligne retiree)', created_at: '2026-09-28' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var vraiConfirm = null;
      try { vraiConfirm = confirm2; confirm2 = function () { return true; }; } catch (e) {}
      try { deleteAchat(903); } catch (e) {}
      try { if (vraiConfirm) confirm2 = vraiConfirm; } catch (e) {}
      var p5 = getStockConsum().filter(function (x) { return String(x.code).toUpperCase() === 'P5'; });
      var total = 0;
      p5.forEach(function (x) { total += parseFloat(x.quantite) || 0; });
      (p5.length === 0 && total === 0)
        ? 'OK : +9000 et -9000 partis ensemble, P5 absent (pas de -9000 fantome)'
        : 'ECHEC : ' + p5.length + ' ligne(s), total=' + total
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Reconstruction a zero : tout part sauf les ajustements d\u2019inventaire (meme le -9000 fantome)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.achats = [];
      p.stockConsum = [
        { id: 'oz1', code: 'P5', designation: 'POINTE5', quantite: -9000, cond: 180, ctype: 'POINTE', motif: 'Modification BL-X (ligne retiree)', obs: 'Modification BL-X (ligne retiree)', created_at: '2026-09-28' },
        { id: 'oz2', code: 'P6', designation: 'POINTE6', quantite: 24750, cond: 165, ctype: 'POINTE', created_at: '2026-09-28' },
        { id: 'oz3', code: 'P7', designation: 'POINTE7', quantite: 0, cond: 150, ctype: 'POINTE', created_at: '2026-09-28' },
        { id: 'oz4', code: 'P6', designation: 'POINTE6', quantite: 500, cond: 165, ctype: 'POINTE', _ajustInv: true, _invMois: '2026-09', obs: 'Inventaire 2026-09', created_at: '2026-09-28' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var vraiConfirm = null;
      try { vraiConfirm = confirm2; confirm2 = function () { return true; }; } catch (e) {}
      try { reconstruireStockConsum(); } catch (e) {}
      try { if (vraiConfirm) confirm2 = vraiConfirm; } catch (e) {}
      var reste = getStockConsum();
      var aj = reste.filter(function (x) { return x._ajustInv; });
      (reste.length === 1 && aj.length === 1 && aj[0].code === 'P6')
        ? 'OK : -9000 fantome, P6 orphelin et ligne a zero partis ; seul l\u2019ajustement d\u2019inventaire reste'
        : 'ECHEC : reste=' + reste.map(function(x){ return x.code + '=' + x.quantite; }).join(', ')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Tableau de bord : PRODUCTION DU MOIS totalise les assemblages, pas le volume de bois',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      var mois = new Date().toISOString().slice(0, 7);
      p.productions = [
        { id: 'pm1', numero: '260901', date: mois + '-05', statut: 'validated', vol_total: 4.5,
          assemblage: [{ code: 'PAL114', qte: 10 }, { code: 'PAL112', qte: 5 }] },
        { id: 'pm2', numero: '260902', date: mois + '-10', statut: 'draft', vol_total: 9.9,
          assemblage: [{ code: 'PAL114', qte: 100 }] }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      CURRENT_PAGE = 'dashboard'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      var i = h.indexOf('PRODUCTION DU MOIS');
      var carte = i === -1 ? '' : h.slice(i, i + 900).replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      /* 10 + 5 = 15 articles assembles sur fiches validees du mois (le
         brouillon a 100 n'est pas compte, et ce n'est pas un volume). */
      (i !== -1 && /15 article/.test(carte) && !/m³/.test(carte.split('Total assembl')[0]))
        ? 'OK : 15 articles assembles affiches (et non 4,5 m3 de bois)'
        : 'ECHEC : ' + carte.substr(0, 200)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Semi-finis (page dediee) : une ligne par composant avec deroulage, pas les lignes brutes',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.articles = [{ id: 'a1', code: 'PAL7', designation: 'Palette 7', categorie: 'finished' }];
      p.composants = [{ article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte 120', quantity: 5, volume: 0.0018 }];
      p.stockSemi = [
        { id: 'ss1', code: 'L1', designation: 'Latte 120', quantite: 500, created_at: '2026-09-01' },
        { id: 'ss2', code: 'L1', designation: 'Latte 120', quantite: -80, motif: 'Production 1', obs: 'Production 1', created_at: '2026-09-02' }
      ];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var h = render_stock_semi();
      var txt = h.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ');
      /* Une seule ligne L1 a 420 (500-80), deroulable, avec son registre. */
      var lignes = (txt.match(/L1/g) || []).length;
      (/420/.test(txt) && /toggleAccordion\\('semiPage_L1'\\)/.test(h) && /Mouvements/.test(txt))
        ? 'OK : L1 regroupe a 420, deroulage avec registre'
        : 'ECHEC : ' + txt.substr(0, 300)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Achat matiere premiere : le montant global de la ligne est P.U/m3 x volume, pas P.U x nb pieces',
    app: 'production.html', store: storeRealiste,
    code: `
      /* 20 pieces de 50 x 20 x 5 cm = 0,005 m3 chacune, soit 0,1 m3,
         au prix de 40 000 F le m3. */
      _tempAchatItems = [];
      var setv = function(id, v) { var el = document.getElementById(id); if (el) el.value = v; };
      setv('ai_qte', 20); setv('ai_long', 50); setv('ai_larg', 20); setv('ai_epais', 5);
      setv('ai_essence', 'AY'); setv('ai_type', 'Rouge'); setv('ai_pu', 40000);
      calcItemVolLive();
      var vol = parseFloat((document.getElementById('ai_vol') || {}).value || 0);
      addAchatItemLine('raw-materials');
      var it = _tempAchatItems[0] || {};
      /* 0,1 m3 x 40000 = 4 000 F. L'ancien calcul donnait
         20 x 40000 = 800 000 F, soit un prix du m3 de 8 millions. */
      var okVol = Math.abs(vol - 0.1) < 0.0001;
      var okBase = it.prix_base === 'm3';
      var okTot = Math.abs((parseFloat(it.total_price) || 0) - 4000) < 1;
      (okVol && okBase && okTot)
        ? 'OK : ' + it.total_price + ' F pour ' + vol.toFixed(4) + ' m3'
        : 'ECHEC vol=' + vol + ' base=' + it.prix_base + ' total=' + it.total_price
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Achat matiere premiere : le CUMP utilise P.U x volume (le prix du m3 n\'est plus gonfle)',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      /* 10 pieces, 0,25 m3 total, 40 000 F le m3 => 10 000 F reels.
         total_price存量ait 10 x 40000 = 400 000 (pieces x prix). */
      p.achats = [{
        id: 991, category: 'raw-materials', date: new Date().toISOString().slice(0, 10),
        reference: 'BL-M3', fournisseur: 'F', items: [{
          colis_number: 'C1', quantity: 10, volume: 0.25, essence: 'AY',
          unit_price: 40000, total_price: 400000
        }], item_count: 1, total_volume: 0.25, montant_total: 400000
      }];
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      window._acTout = true;
      var c = acCump('', '');
      var px = c.prixM3;
      /* 40000 F/m3 attendu. Avec le volume on recalcule 0,25 x 40000 = 10000 F,
         donc 10000 / 0,25 = 40000 F/m3. L'ancien code divisait 400000 par
         0,25 et obtenait 1 600 000 F/m3. */
      (Math.abs(px - 40000) < 1)
        ? 'OK : prix du m3 = ' + px
        : 'ECHEC : prix du m3 = ' + px
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Main-d\'oeuvre indirecte : poste de la campagne calcule et reporte dans l\'impression',
    app: 'production.html', store: storeRealiste,
    code: `
      var poste = AC_POSTES.filter(function(p) { return p.cle === 'indirect'; })[0];
      if (!poste) { throw new Error('ECHEC : poste indirect absent de AC_POSTES'); }
      setSection('costLabor', { articleId: 'a1', quantite: 100, jours: 10,
        monteur: { nb: 2, coutJour: 2000 }, machiniste: { nb: 1, coutJour: 2500 },
        manutentionnaire: { nb: 1, coutJour: 1800 }, indirect: { nb: 2, coutJour: 3000 } });
      window._acTout = true;
      var c = acCalcul('', '');
      var ind = c.mo.postes.filter(function(p) { return p.cle === 'indirect'; })[0];
      var okInd = ind && ind.montant === 2 * 10 * 3000;
      /* La directe ne doit PAS englober l'indirecte. */
      var directe = 0;
      c.mo.postes.forEach(function(p) { if (p.cle !== 'indirect') directe += p.montant; });
      var okSep = (directe === 2 * 10 * 2000 + 1 * 10 * 2500 + 1 * 10 * 1800);
      var okTotal = Math.abs(c.mo.total - (ind ? ind.montant : 0) - directe) < 0.01;
      (okInd && okSep && okTotal)
        ? 'OK : indirect ' + (ind ? ind.montant : 0) + ' F, directe ' + directe + ' F'
        : 'ECHEC ind=' + JSON.stringify(ind) + ' directe=' + directe + ' total=' + c.mo.total
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Cout de revient deduit : les frais fixes (main-d\'oeuvre indirecte) s\'ajoutent au cout de matiere',
    app: 'production.html', store: storeRealiste,
    code: `
      var avant = acCoutArticleAuto('a1');
      acSetFraisArticle('a1', 'main_oeuvre', 500);
      acSetFraisArticle('a1', 'autre', 100);
      var apres = acCoutArticleAuto('a1');
      var a = getArticles().filter(function(x) { return x.id === 'a1'; })[0];
      var okMatiere = Math.abs(apres.matiere - avant.matiere) < 0.001;
      var okTotal = Math.abs(apres.total - (apres.matiere + 600)) < 0.01;
      var okPersiste = a && a.frais_fixes && a.frais_fixes.main_oeuvre === 500 && a.frais_fixes.autre === 100;
      var okMarge = Math.abs(apres.marge - (45000 - apres.total)) < 0.01;
      (okMatiere && okTotal && okPersiste && okMarge)
        ? 'OK : matiere ' + apres.matiere.toFixed(0) + ' + frais 600 = ' + apres.total.toFixed(0)
        : 'ECHEC matiere=' + apres.matiere + ' total=' + apres.total + ' marge=' + apres.marge
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Enregistrement du cout deduit : il porte la matiere ET les frais fixes',
    app: 'production.html', store: storeRealiste,
    code: `
      acSetFraisArticle('a1', 'main_oeuvre', 800);
      acEnregistrerCoutArticle('a1');
      var a = getArticles().filter(function(x) { return x.id === 'a1'; })[0];
      var attendu = Math.round(acCoutArticleAuto('a1').total);
      (a && a.prix_revient === attendu && attendu > 1787)
        ? 'OK : prix_revient = ' + a.prix_revient + ' (matiere 1787 + indirecte 800)'
        : 'ECHEC prix_revient=' + (a && a.prix_revient) + ' attendu=' + attendu
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Impression du cout de revient : les deux documents se construisent (fenetre et page)',
    app: 'production.html', store: storeRealiste,
    code: `
      var captured = [];
      window.open = function () { return { document: { write: function (h) { captured.push(h); }, close: function () {} }, print: function () {} }; };
      window._acTout = true;
      setSection('costLabor', { articleId: 'a1', quantite: 100, jours: 10,
        monteur: { nb: 2, coutJour: 2000 }, machiniste: { nb: 1, coutJour: 2500 },
        manutentionnaire: { nb: 1, coutJour: 1800 }, indirect: { nb: 2, coutJour: 3000 } });
      printCoutRevient();
      printCoutArticle('a1');
      var un = captured[0] || '', deux = captured[1] || '';
      var okUn = (un.indexOf('CO\\u00dbT DE REVIENT TOTAL') !== -1) && (un.indexOf('Main-d\\u2019\\u0153uvre indirecte') !== -1)
        && (un.indexOf('MATI\\u00c8RE PREMI\\u00c8RE') !== -1) && (un.indexOf('CHARGES DE STRUCTURE') !== -1);
      var okDeux = (deux.indexOf('CO\\u00dbT DE REVIENT UNITAIRE') !== -1)
        && (deux.indexOf('FRAIS FIXES PAR UNIT') !== -1) && (deux.indexOf('Latte') !== -1);
      var okDoc = (un.indexOf('<!DOCTYPE html>') === 0) && (deux.indexOf('@page') !== -1);
      (captured.length === 2 && okUn && okDeux && okDoc)
        ? 'OK : campagne + article imprimables, indirecte presente'
        : 'ECHEC docs=' + captured.length + ' un=' + okUn + ' deux=' + okDeux + ' doc=' + okDoc
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Cout de revient deduit de la nomenclature : bois (volume x chute x prix/m3) + consommables',
    app: 'production.html', store: storeRealiste,
    code: `
      /* a1 = PAL : 5 lattes de 0,0018 m3 (=> 0,009 m3) + 90 pointes a 15 F.
         Achat bois du mois : 5 m3 pour 225000 F => 45000 F/m3.
         Chute par defaut 8 % => 0,00972 m3 x 45000 = 437,4 F
         + 90 x 15 = 1350 F  => 1787,4 F de matiere. */
      var c = acCoutArticleAuto('a1');
      var okVol = Math.abs(c.volNet - 0.009) < 0.000001;
      var okPx = Math.abs(c.pxM3 - 45000) < 1;
      var okBois = Math.abs(c.coutBois - 437.4) < 0.5;
      var okConso = Math.abs(c.coutConso - 1350) < 0.5;
      var okTot = Math.abs(c.matiere - 1787.4) < 1;
      var okMarge = Math.abs(c.marge - (45000 - 1787.4)) < 1;
      (okVol && okPx && okBois && okConso && okTot && okMarge)
        ? 'OK : ' + c.matiere.toFixed(2) + ' F (bois ' + c.coutBois.toFixed(2) + ' + conso ' + c.coutConso.toFixed(2) + ')'
        : 'ECHEC vol=' + c.volNet + ' pxM3=' + c.pxM3 + ' bois=' + c.coutBois + ' conso=' + c.coutConso + ' tot=' + c.matiere
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient deduit : les composants sans prix signale le manque, sans bloquer le calcul',
    app: 'production.html', store: () => {
      const s = storeRealiste();
      const p = JSON.parse(s.mdb_production);
      p.composants = [{ article_id: 'a1', type: 'POINTE', code: 'INCONNU', designation: 'Clous sans prix', quantity: 100 }];
      p.definitions = [];
      p.stockConsum = [];
      p.achats = p.achats.filter(function (a) { return a.category === 'raw-materials'; });
      s.mdb_production = JSON.stringify(p);
      return s;
    },
    code: `
      var c = acCoutArticleAuto('a1');
      /* Aucun prix pour le clou, aucun volume bois : rien ne doit exploser,
         le manque doit etre nomme. */
      var ok = (c.coutConso === 0) && (c.manquants.length >= 1) && isFinite(c.matiere) && (c.matiere === 0);
      ok ? 'OK : manques lists (' + c.manquants.length + ')' : 'ECHEC : ' + JSON.stringify(c.manquants) + ' matiere=' + c.matiere
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Articles : le cout de revient est affiche en "auto" quand il est deduit, marge recalculee',
    app: 'production.html', store: storeRealiste,
    code: `
      CURRENT_PAGE = 'articles'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      /* Les nombres sont groupes avec une espace insecable : on compare les
         chiffres seuls pour ne pas dependre du formatage. */
      var chiffres = h.replace(/[^0-9]/g, '');
      var ok = (h.indexOf('showCoutArticleAuto') !== -1)
        && (chiffres.indexOf('1787') !== -1) && (chiffres.indexOf('43213') !== -1)
        && (h.indexOf('auto') !== -1);
      ok ? 'OK : cout auto + bouton detail' : 'ECHEC : ' + chiffres.substr(0, 300)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cout de revient deduit : le detail composant par composant et l enregistrement du cout',
    app: 'production.html', store: storeRealiste,
    code: `
      var m = acCoutAutoHtml('a1', false);
      var chiffres = m.replace(/[^0-9]/g, '');
      var okHtml = (m.indexOf('coût de revient déduit') !== -1)
        && (m.indexOf('acEnregistrerCoutArticle') !== -1)
        && (m.indexOf('Latte') !== -1) && (m.indexOf('Pointes') !== -1)
        && (chiffres.indexOf('437') !== -1) && (chiffres.indexOf('1350') !== -1)
        && (chiffres.indexOf('1787') !== -1);
      acEnregistrerCoutArticle('a1');
      var a = getArticles().filter(function (x) { return x.id === 'a1'; })[0];
      var okSave = (a && Math.round(a.prix_revient) === 1787 && a._cout_auto === 1);
      (okHtml && okSave) ? 'OK : detail + cout enregistre 1787' : 'ECHEC : html=' + okHtml + ' prix_revient=' + (a && a.prix_revient)
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

  r.push({
    nom: 'Mouvements de Stock : un achat de pointes P5 crée une entrée au journal (visible sur la page)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('movements', []);
      document.getElementById('ach_ref').value = 'REF-P5';
      document.getElementById('ach_date').value = today();
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      _tempAchatItems = [{ code:'P5', designation:'Pointes 5', quantity:100000, unit_price:0.28, total_price:56000, paquets:2000, cond:50, ctype:'POINTE', cartons:40 }];
      saveAchatByCategory({ preventDefault: function(){} }, 'consumables');
      var movs = getMovements();
      var entree = movs.filter(function(m){ return m.type === 'entree' && m.reference === 'REF-P5'; });
      CURRENT_PAGE = 'stock-movements'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (entree.length === 1 && entree[0].code === 'P5' && entree[0].motif === 'Achat REF-P5'
        && h.indexOf('P5') !== -1 && h.indexOf('Entrée') !== -1)
        ? 'OK : entrée journal + affichage P5 dans Mouvements de Stock'
        : 'ECHEC : ' + JSON.stringify(movs)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : un achat de pointes P5 écrit aussi le journal des mouvements',
    app: 'index.html', store: storeRealiste,
    code: `
      var p2 = apProdGet();
      p2.movements = [];
      p2.stockConsum = [];
      p2.achats = [];
      apProdSet(p2);
      document.getElementById('ach_ref').value = 'REF-P5B';
      document.getElementById('ach_date').value = getToday();
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      _tempAchatItems = [{ code:'P5', designation:'Pointes 5', quantity:100000, unit_price:0.28, total_price:56000, paquets:2000, cond:50, ctype:'POINTE', cartons:40 }];
      saveApAchat(null, 'consumables');
      var apres = apProdGet();
      var entree = (apres.movements||[]).filter(function(m){ return m.type === 'entree' && m.reference === 'REF-P5B'; });
      (entree.length === 1 && entree[0].code === 'P5' && entree[0].motif === 'Achat REF-P5B')
        ? 'OK : entrée journal code P5'
        : 'ECHEC : ' + JSON.stringify(apres.movements)
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'App principale : ajouter une ligne P5 en modification reporte l\'ecart au stock',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      var p3 = apProdGet();
      p3.achats = [{ id:'BL1', reference:'BL1', date:'2026-09-26', fournisseur:'TIJANI', receiver_name:'X',
        category:'consumables', montant_total:28000,
        items:[{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 }] }];
      p3.stockConsum = [];
      p3.movements = [];
      apProdSet(p3);
      window._apEditingId = 'BL1';
      document.getElementById('ach_ref').value = 'BL1';
      document.getElementById('ach_date').value = getToday();
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 },
        { code:'P5', designation:'Pointes 5', quantity:15000, unit_price:0.28, total_price:4200, paquets:100, cond:150, ctype:'POINTE', cartons:2 }];
      saveApAchat(null, 'consumables');
      var apres = apProdGet();
      var p5 = (apres.stockConsum||[]).filter(function(x){ return String(x.code||'').toUpperCase() === 'P5'; });
      (apres.achats.length === 1 && p5.length === 1 && p5[0].quantite === 15000
        && String(p5[0].motif || '').indexOf('Modification BL1') === 0)
        ? 'OK : P5 arrive au stock (15 000, ligne tracee Modification BL1)'
        : 'ECHEC : ' + JSON.stringify(apres.stockConsum)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'App principale : une modification sans changement de quantites ne touche pas au stock',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      var p4 = apProdGet();
      p4.achats = [{ id:'BL2', reference:'BL2', date:'2026-09-26', fournisseur:'TIJANI', receiver_name:'X',
        category:'consumables', montant_total:28000,
        items:[{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 }] }];
      p4.stockConsum = [];
      apProdSet(p4);
      window._apEditingId = 'BL2';
      document.getElementById('ach_ref').value = 'BL2';
      document.getElementById('ach_date').value = getToday();
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 }];
      saveApAchat(null, 'consumables');
      var apres = apProdGet();
      (apres.achats.length === 1 && (apres.stockConsum||[]).length === 0)
        ? 'OK : aucun ecart, aucune ligne stock creee'
        : 'ECHEC : ' + JSON.stringify(apres.stockConsum)
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'App principale : supprimer l\'ancien de 2 achats P7 deduit vraiment le stock et nettoie le journal',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      window.confirm = function(){ return true; };
      var p5 = apProdGet();
      p5.achats = [];
      p5.stockConsum = [];
      p5.movements = [];
      apProdSet(p5);
      function sauver(ref, date) {
        document.getElementById('ach_ref').value = ref;
        document.getElementById('ach_date').value = date;
        document.getElementById('ach_fournisseur').value = 'TIJANI';
        _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:15000, unit_price:1.87, total_price:28000, paquets:100, cond:150, ctype:'POINTE', cartons:2 }];
        saveApAchat(null, 'consumables');
      }
      sauver('BL-2909', '2026-09-29');
      sauver('BL-3009', '2026-09-30');
      var idAncien = apProdGet().achats.filter(function(a){ return a.reference === 'BL-2909'; })[0].id;
      deleteApAchat(idAncien);
      var apres = apProdGet();
      var lignes = (apres.stockConsum||[]).filter(function(x){ return String(x.code||'').toUpperCase() === 'P7'; });
      var refs = (apres.movements||[]).map(function(m){ return m.reference; }).join(',');
      (apres.achats.length === 1 && lignes.length === 1 && lignes[0].quantite === 15000
        && String(lignes[0].created_at || '').indexOf('2026-09-30') === 0 && refs === 'BL-3009')
        ? 'OK : reste la ligne du 30/09 (15 000), journal sans BL-2909'
        : 'ECHEC : ' + JSON.stringify(apres.stockConsum) + ' / ' + refs
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression achat consommables : la fiche cumulee est deduite et le journal nettoye',
    app: 'production.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      window.confirm = function(){ return true; };
      setSection('movements', []);
      setStockConsum([]);
      setAchats([]);
      function sauver(ref, date) {
        document.getElementById('ach_ref').value = ref;
        document.getElementById('ach_date').value = date;
        document.getElementById('ach_fournisseur').value = 'TIJANI';
        _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:15000, unit_price:1.87, total_price:28000, paquets:100, cond:150, ctype:'POINTE', cartons:2 }];
        saveAchatByCategory({ preventDefault: function(){} }, 'consumables');
      }
      sauver('BL-2909', '2026-09-29');
      sauver('BL-3009', '2026-09-30');
      var idAncien = getAchats().filter(function(a){ return a.reference === 'BL-2909'; })[0].id;
      deleteAchat(idAncien);
      var lignes = getStockConsum().filter(function(x){ return String(x.code||'').toUpperCase() === 'P7'; });
      var refs = getMovements().map(function(m){ return m.reference; }).join(',');
      (getAchats().length === 1 && lignes.length === 1 && lignes[0].quantite === 15000 && refs === 'BL-3009')
        ? 'OK : fiche P7 a 15 000, journal sans BL-2909'
        : 'ECHEC : ' + JSON.stringify(lignes) + ' / ' + refs
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Mouvements de Stock : le bouton Orphelins supprime les entrees sans achat',
    app: 'production.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      setAchats([{ id:'x1', reference:'BL-3009', category:'consumables', date:'2026-09-30', items:[] }]);
      setSection('movements', [
        { id:'m1', date:'2026-09-29', type:'entree', article_id:'', code:'P7', designation:'Pointes 7', quantite:15000, reference:'BL-2909', motif:'Achat BL-2909' },
        { id:'m2', date:'2026-09-30', type:'entree', article_id:'', code:'P7', designation:'Pointes 7', quantite:15000, reference:'BL-3009', motif:'Achat BL-3009' }
      ]);
      cleanOrphanMovements();
      var refs = getMovements().map(function(m){ return m.reference; }).join(',');
      (refs === 'BL-3009')
        ? 'OK : entree orpheline BL-2909 supprimee'
        : 'ECHEC : ' + refs
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'App principale : modification (P5 ajoute) puis suppression — plus aucune ligne de l\'achat au stock',
    app: 'index.html', store: storeRealiste,
    code: `
      currentUser = { id:'u1', nom:'Test', isSuperAdmin:true, isAdmin:true };
      window.confirm = function(){ return true; };
      var p6 = apProdGet();
      p6.achats = [{ id:'BL3', reference:'BL3', date:'2026-09-29', fournisseur:'TIJANI', receiver_name:'X',
        category:'consumables', montant_total:28000,
        items:[{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 }] }];
      p6.stockConsum = [];
      p6.movements = [];
      apProdSet(p6);
      window._apEditingId = 'BL3';
      document.getElementById('ach_ref').value = 'BL3';
      document.getElementById('ach_date').value = getToday();
      document.getElementById('ach_fournisseur').value = 'TIJANI';
      _tempAchatItems = [{ code:'P7', designation:'Pointes 7', quantity:7500, unit_price:1.87, total_price:28000, paquets:50, cond:150, ctype:'POINTE', cartons:1 },
        { code:'P5', designation:'Pointes 5', quantity:15000, unit_price:0.28, total_price:4200, paquets:100, cond:150, ctype:'POINTE', cartons:2 }];
      saveApAchat(null, 'consumables');
      var idAchat = apProdGet().achats.filter(function(a){ return a.reference === 'BL3'; })[0].id;
      deleteApAchat(idAchat);
      var apres = apProdGet();
      (apres.achats.length === 0 && (apres.stockConsum||[]).length === 0 && (apres.movements||[]).length === 0)
        ? 'OK : achat, lignes taguees (origine + ecart) et journal supprimes'
        : 'ECHEC : ' + JSON.stringify(apres.stockConsum) + ' / ' + JSON.stringify(apres.movements)
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'I-USINAGE : les listes Lattes/Plots/CP ne proposent que les definitions du type (pas le catalogue articles)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('composants', []);
      setSection('definitions', [
        { id:'d1', code:'LAT1', designation:'Latte 5x10', type:'LATTE', length:500, width:10, thickness:5 },
        { id:'d2', code:'PL1', designation:'Plot 20x20', type:'PLOT', length:100, width:20, thickness:20 },
        { id:'d3', code:'CP1', designation:'CP 122x61', type:'CP', length:122, width:61, thickness:1 }
      ]);
      setSection('articles', [
        { id:'a1', code:'PAL1', designation:'Palette Europe', categorie:'fini' },
        { id:'a2', code:'P5', designation:'POINTE5', categorie:'consum' }
      ]);
      var lat = compDefOptionsHTML('LATTE'), plo = compDefOptionsHTML('PLOT'), cp = compDefOptionsHTML('CP');
      (lat.indexOf('LAT1') !== -1 && lat.indexOf('PAL1') === -1 && lat.indexOf('PL1') === -1 && lat.indexOf('[Article]') === -1
        && plo.indexOf('PL1') !== -1 && plo.indexOf('PAL1') === -1 && plo.indexOf('LAT1') === -1
        && cp.indexOf('CP1') !== -1 && cp.indexOf('PAL1') === -1)
        ? 'OK : LATTE->LAT1 seul, PLOT->PL1 seul, CP->CP1 seul, aucun article'
        : 'ECHEC : ' + lat + ' / ' + plo + ' / ' + cp
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Assemblage : la production du jour compte dans le stock disponible (stock 0 + 1000 lattes >= besoin 800)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('articles', [{ id:'a1', code:'PAL114', designation:'Palette 114' }]);
      setSection('composants', [{ article_id:'a1', code:'L114*8*2', type:'LATTE', quantity:8 }]);
      setStockSemi([]);
      var sans = checkAssemblageStock([{ code:'PAL114', qte:100 }]);
      var avec = checkAssemblageStock([{ code:'PAL114', qte:100 }], [{ code:'L114*8*2', qte:1000 }]);
      var court = checkAssemblageStock([{ code:'PAL114', qte:100 }], [{ code:'L114*8*2', qte:500 }]);
      (!sans.ok && sans.errors.join(' ').indexOf('stock ancien 0 + prod. du jour 0 = 0 < besoin 800') !== -1 && avec.ok && !court.ok)
        ? 'OK : bloque a 0 sans prod du jour, passe avec 1000, bloque avec 500'
        : 'ECHEC : ' + JSON.stringify(sans) + ' / ' + JSON.stringify(avec) + ' / ' + JSON.stringify(court)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Validation : l\'usinage du jour est crédité au stock semi (entrée tracée Production)',
    app: 'production.html', store: storeRealiste,
    code: `
      setStockSemi([]);
      creditUsinageStock({ numero:'260901', date:'2026-09-29',
        lattes:[{ code:'L114*8*2', designation:'L114*8*2', qte:1000 }],
        plots:[{ code:'P114*10', designation:'P114*10', qte:500 }], cp:[] });
      var lignes = getStockSemi();
      var e1 = lignes.filter(function(x){ return x.code === 'L114*8*2'; })[0] || {};
      var e2 = lignes.filter(function(x){ return x.code === 'P114*10'; })[0] || {};
      (semiStockQty('L114*8*2') === 1000 && semiStockQty('P114*10') === 500
        && String(e1.motif || '').indexOf('Production 260901') === 0 && String(e1.motif || '').indexOf('+1000 L114*8*2') !== -1)
        ? 'OK : +1000 lattes / +500 plots traces Production 260901'
        : 'ECHEC : ' + JSON.stringify(lignes)
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Validation : les quantites assemblees entrent au stock produits finis (visibles tableau de bord)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('articles', [{ id:'a1', code:'PAL114', designation:'Palette 114', prix_vente:50000 }]);
      setStockFinished([]);
      creditAssemblageFini({ numero:'260901', date:'2026-09-29', assemblage:[{ code:'PAL114', designation:'Palette 114', qte:100 }] });
      var lignes = getStockFinished();
      var e = lignes.filter(function(x){ return String(x.code || '') === 'PAL114'; })[0] || {};
      (lignes.length === 1 && e.quantite === 100 && e.article_id === 'a1'
        && String(e.motif || '').indexOf('Production 260901') === 0 && String(e.motif || '').indexOf('+100 PAL114') !== -1)
        ? 'OK : +100 PAL114 trace, article_id resolu (carte dashboard)'
        : 'ECHEC : ' + JSON.stringify(lignes)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Observations stock : la conso assemblage cite la production et la quantite fabriquee',
    app: 'production.html', store: storeRealiste,
    code: `
      setStockSemi([]);
      setStockConsum([]);
      deductSemiQty('L114*8*2', 800, { numero:'260901', date:'2026-09-29', article:'PAL114', qteAssemblee:100 });
      deductConsumQty('P5', 1600, { numero:'260901', date:'2026-09-29', article:'PAL114', qteAssemblee:100 });
      var s = getStockSemi().filter(function(x){ return x.code === 'L114*8*2'; })[0] || {};
      var c = getStockConsum().filter(function(x){ return x.code === 'P5'; })[0] || {};
      (String(s.motif || '') === 'Production 260901 - 100 PAL114'
        && String(c.motif || '') === 'Production 260901 - 100 PAL114')
        ? 'OK : « Production 260901 - 100 PAL114 » sur le semi et la pointe'
        : 'ECHEC : ' + JSON.stringify(s.motif) + ' / ' + JSON.stringify(c.motif)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Suppression fiche validee : toutes ses ecritures tracees repartent (semi, conso, finis, bois)',
    app: 'production.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      setSection('productions', [{ id:'f1', numero:'260901', date:'2026-09-29', statut:'validated',
        sortie_bois:[{ code:'C10', qte:30, volume:1.5 }], assemblage:[{ code:'PAL114', qte:100 }] }]);
      setStockRaw([{ id:'r1', code:'C10', quantite:0, volume:0 }]);
      setStockSemi([
        { id:'s1', code:'L114*8*2', quantite:1000, motif:'Production 260901 — usinage : +1000 L114*8*2' },
        { id:'s2', code:'L114*8*2', quantite:-800, motif:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)' }
      ]);
      setStockConsum([
        { id:'c1', code:'P5', quantite:-1600, motif:'Production 260901 — PAL114 ×100 → P5 : 1600 (conso. assemblage)' },
        { id:'c2', code:'P7', quantite:5, motif:'Achat BL-1' }
      ]);
      setStockFinished([
        { id:'f1s', code:'PAL114', quantite:100, motif:'Production 260901 — assemblage : +100 PAL114' }
      ]);
      deleteProd('f1');
      var lot = getStockRaw().filter(function(x){ return x.code === 'C10'; })[0] || {};
      var okSemi = getStockSemi().length === 0;
      var conso = getStockConsum();
      var okFin = getStockFinished().length === 0;
      (getProductions().length === 0 && lot.quantite === 30 && okSemi && conso.length === 1 && conso[0].code === 'P7' && okFin)
        ? 'OK : fiche supprimee, bois restaure (30), ecritures 260901 purgees, achat P7 intact'
        : 'ECHEC : semi=' + JSON.stringify(getStockSemi()) + ' conso=' + JSON.stringify(conso) + ' finis=' + JSON.stringify(getStockFinished())
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Rattrapage PF : les fiches validees sans entree finie sont creditessans doublon',
    app: 'production.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      setSection('articles', [{ id:'a1', code:'PAL114', designation:'Palette 114' }]);
      setSection('productions', [{ id:'f1', numero:'260901', date:'2026-09-29', statut:'validated', assemblage:[{ code:'PAL114', qte:100 }] }]);
      setStockFinished([]);
      backfillFinishedCredits();
      backfillFinishedCredits();
      var lignes = getStockFinished().filter(function(x){ return String(x.code || '') === 'PAL114'; });
      (lignes.length === 1 && lignes[0].quantite === 100)
        ? 'OK : +100 PAL114 cree une fois (2 passages, pas de doublon)'
        : 'ECHEC : ' + JSON.stringify(lignes)
    `,
    attenduPrefixe: 'OK'
  });

r.push({
    nom: 'Semi-finis : le registre dit d\'ou vient chaque mouvement (production du jour ou achat)',
    app: 'production.html', store: storeRealiste,
    code: `
      setStockSemi([
        { id:'u1', code:'L114*8*2', designation:'L114*8*2', quantite:1000, motif:'Production 260901 — usinage : +1000 L114*8*2', obs:'Production 260901 — usinage : +1000 L114*8*2', created_at:'2026-09-29' },
        { id:'c1', code:'L114*8*2', designation:'L114*8*2', quantite:-800, motif:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', obs:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', created_at:'2026-09-29' },
        { id:'a1', code:'L114*8*2', designation:'L114*8*2', quantite:500, fournisseur:'TIJANI', created_at:'2026-09-28' }
      ]);
      var rows = _semiMouvements('L114*8*2');
      var libs = rows.map(function(r){ return r.libelle; }).join(' | ');
      (libs === 'Stock initial | Entree — TIJANI | Entrée — Production | Sortie — Production')
        ? 'OK : ' + libs
        : 'ECHEC : ' + libs
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Semi-finis : le registre affiche Code + observations explicites (comme la fiche pointes)',
    app: 'production.html', store: storeRealiste,
    code: `
      setStockSemi([
        { id:'u1', code:'L114*8*2', designation:'L114*8*2', quantite:1000, motif:'Production 260901 — usinage : +1000 L114*8*2', obs:'Production 260901 — usinage : +1000 L114*8*2', created_at:'2026-09-29' },
        { id:'c1', code:'L114*8*2', designation:'L114*8*2', quantite:-800, motif:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', obs:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', created_at:'2026-09-29' }
      ]);
      var h = _semiRegistreHtml('L114*8*2');
      (h.indexOf('>Code<') !== -1 && h.indexOf('L114*8*2') !== -1
        && h.indexOf('Entrée — Production') !== -1 && h.indexOf('Sortie — Production') !== -1
        && h.indexOf('PAL114 ×100') !== -1 && h.indexOf('Stock fin') !== -1)
        ? 'OK : colonne Code, libelles et observation explicite presents'
        : 'ECHEC : ' + h.slice(0, 300)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Semi-finis : l\'onglet ne montre plus le tableau brut des lignes (registre seul, comme pointes)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockRawTab', 'semi');
      setSection('stockRawEtat', 'tout');
      setSection('composants', []);
      setSection('definitions', [{ id:'d1', code:'L114*8*2', designation:'L114*8*2', type:'LATTE', length:114, width:8, thickness:2 }]);
      setStockSemi([
        { id:'u1', code:'L114*8*2', designation:'L114*8*2', quantite:1000, motif:'Production 260901 — usinage : +1000 L114*8*2', obs:'Production 260901 — usinage : +1000 L114*8*2', created_at:'2026-09-29' },
        { id:'c1', code:'L114*8*2', designation:'L114*8*2', quantite:-800, motif:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', obs:'Production 260901 — PAL114 ×100 → L114*8*2 : 800 (conso. assemblage)', created_at:'2026-09-29' }
      ]);
      CURRENT_PAGE = 'stock-raw'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('Mouvements — L114*8*2') !== -1 && h.indexOf('ligne(s) de stock') === -1)
        ? 'OK : registre affiche, tableau brut retire'
        : 'ECHEC : ' + h.slice(0, 300)
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
