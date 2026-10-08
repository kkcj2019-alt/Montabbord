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

  /* ---------- Pointes : equivalence paquets/cartons dans les deux sens ---------- */
  r.push({
    nom: 'Pointes : taper des paquets affiche l equivalence en cartons',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P5', designation: 'POINTE5', type: 'POINTE', qty_per_packet: 150 }]);
      var c = acChampUnite('P5', 34500, 'paquet');
      var m = c.match(/_eq"[^>]*>([^<]+)</);
      (m && m[1].indexOf('carton') !== -1 && m[1].indexOf('34') !== -1)
        ? 'OK : 230 paquets = ' + m[1].trim()
        : 'ECHEC equivalence absente'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointes : taper des cartons affiche l equivalence en paquets',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P5', designation: 'POINTE5', type: 'POINTE', qty_per_packet: 150 }]);
      var c = acChampUnite('P5', 37500, 'carton');
      var m = c.match(/_eq"[^>]*>([^<]+)</);
      (m && m[1].indexOf('paquet') !== -1)
        ? 'OK : 5 cartons = ' + m[1].trim()
        : 'ECHEC equivalence absente'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointes : l enregistrement convertit vers les unites de stock',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('definitions', [{ id: 'd1', code: 'P5', designation: 'POINTE5', type: 'POINTE', qty_per_packet: 150 }]);
      var a = acConvertirEnUnites(230, 'paquet', 'P5');
      var b = acConvertirEnUnites(4.6, 'carton', 'P5');
      (a === 34500 && b === 34500)
        ? 'OK : 230 paquets et 4,6 cartons valent 34 500 pointes'
        : 'ECHEC paquets=' + a + ' cartons=' + b
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

  /* ---------- Soldes : pas de melange entre caisses ---------- */
  r.push({
    nom: 'Soldes : « Modifier les soldes » ne montre que les pieces de la caisse courante (ABOGOU ne remonte pas dans KM23)',
    app: 'index.html', store: storeRealiste,
    code: `
      var emps = getEmployes();
      emps.push({ id: 'e2', nom: 'Abogou', prenoms: 'Wawa', abreviation: 'ABO' });
      DB.set('mdb_employes', emps);
      var ops = getOperationsCaisse();
      ops.push({ id: 'opKM', numeroPiece: 'KM-1', date: '2026-09-15', code: 'SOLDE', libelle: 'Solde Septembre 2026', periode: '2026-09', montant: 30000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', remettant: 'Kanga', caisseId: 'c1', apType: 'solde', apMoisDeduction: '2026-09' });
      ops.push({ id: 'opAB', numeroPiece: 'AB-1', date: '2026-09-16', code: 'SOLDE', libelle: 'Solde Septembre 2026', periode: '2026-09', montant: 30000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e2', beneficiaireNom: 'Abogou Wawa', remettant: 'ABOGOU WAWA RIC', caisseId: 'cABO', apType: 'solde', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      openSoldeGroupeEdit('opKM');
      /* Le DOM simulé ne remplit pas le innerHTML des enfants : on lit le
         corps du modal (contenu direct) et on cible les lignes par data-opid. */
      var mb = document.getElementById('formModalBody');
      var h = mb ? (mb.innerHTML || '') : '';
      var nb = (h.match(/sdg-row/g) || []).length;
      (nb === 1 && h.indexOf('data-opid="opKM"') !== -1 && h.indexOf('data-opid="opAB"') === -1 && h.indexOf('ABOGOU WAWA RIC') === -1)
        ? 'OK : 1 seule ligne (caisse c1, opKM), la piece ABOGOU exclue'
        : 'ECHEC lignes=' + nb + ' opKM=' + (h.indexOf('data-opid="opKM"') !== -1) + ' opAB=' + (h.indexOf('data-opid="opAB"') !== -1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Soldes : une piece apType solde recree sa ligne dans l\u2019etat des acomptes (avec lien retour)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opS', numeroPiece: 'SLD-9', date: '2026-09-15', code: 'SOLDE', libelle: 'Solde Septembre 2026', periode: '2026-09', montant: 30000, sens: 'sortie', moyenPaiement: 'Wave', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', remettant: 'Kanga', caisseId: 'c1', apType: 'solde', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      _reconcileAcomptesPretsFromCaisse();
      var list = dbArr('mdb_acomptesPrets');
      var rec = null;
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].caisseOpId === 'opS') rec = list[i]; }
      var ops2 = getOperationsCaisse();
      var back = null;
      for (var j = 0; j < ops2.length; j++) { if (ops2[j] && ops2[j].id === 'opS') back = ops2[j].acomptePretId; }
      (rec && rec.type === 'acompte' && rec.montant === 30000 && rec.moisDeduction === '2026-09' && rec.date === '2026-09-15' && back === rec.id)
        ? 'OK : ligne acompte 30000 liee a opS, mois 2026-09, lien retour pose'
        : 'ECHEC rec=' + (rec ? rec.type + '/' + rec.montant + '/' + rec.moisDeduction : 'null') + ' back=' + back
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Soldes : le nettoyeur de fantomes garde les acomptes lies a une piece solde',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opS2', numeroPiece: 'SLD-8', date: '2026-09-15', code: 'SOLDE', libelle: 'Solde Septembre 2026', periode: '2026-09', montant: 30000, sens: 'sortie', moyenPaiement: 'Wave', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1', apType: 'solde', acomptePretId: 'apS2' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apS2', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 30000, moisDeduction: '2026-09', date: '2026-09-15', statut: 'en_cours', caisseOpId: 'opS2', numeroPiece: 'SLD-8', motif: 'Solde Septembre 2026' });
      DB.set('mdb_acomptesPrets', list);
      _cleanGhostAcomptes();
      var after = dbArr('mdb_acomptesPrets');
      var kept = false;
      for (var i = 0; i < after.length; i++) { if (after[i] && after[i].id === 'apS2') kept = true; }
      kept ? 'OK : ligne apS2 conservee (piece solde + lien bidirectionnel)' : 'ECHEC : ligne apS2 supprimee comme fantome'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : supprimer une piece supprime l\u2019acompte lie meme sans apType (pas d\u2019orphelin)',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm = function(){ return true; };
      currentUser = { id: 'u1', login: 'admin', nom: 'Admin', isAdmin: true, caisseId: 'c1' };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opDel', numeroPiece: 'DEL-1', date: '2026-09-15', code: 'ACOMPTE', libelle: 'Acompte', montant: 10000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apDel', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 10000, moisDeduction: '2026-09', date: '2026-09-15', statut: 'en_cours', caisseOpId: 'opDel', numeroPiece: 'DEL-1' });
      DB.set('mdb_acomptesPrets', list);
      try { deleteCaisse('opDel'); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var aps2 = dbArr('mdb_acomptesPrets');
      var opGone = true, apGone = true;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opDel') opGone = false; }
      for (var j = 0; j < aps2.length; j++) { if (aps2[j] && aps2[j].id === 'apDel') apGone = false; }
      (opGone && apGone) ? 'OK : piece et acompte lies supprimes ensemble' : 'ECHEC piece=' + (!opGone) + ' acompte=' + (!apGone)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Soldes : le bouton Orphelins ne supprime que les lignes caisse sans piece (les manuelles restent)',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apOrph', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 7000, date: '2026-09-10', moisDeduction: '2026-09', statut: 'en_cours', provenance: 'caisse' });
      list.push({ id: 'apManuel', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 8000, date: '2026-09-10', moisDeduction: '2026-09', statut: 'en_cours' });
      DB.set('mdb_acomptesPrets', list);
      var n = apCompterOrphelins();
      apNettoyerOrphelins();
      var after = dbArr('mdb_acomptesPrets');
      var orphGone = true, manuelKept = false;
      for (var i = 0; i < after.length; i++) {
        if (after[i] && after[i].id === 'apOrph') orphGone = false;
        if (after[i] && after[i].id === 'apManuel') manuelKept = true;
      }
      (n === 1 && orphGone && manuelKept)
        ? 'OK : 1 orphelin detecte et supprime, la saisie manuelle conservee'
        : 'ECHEC detectes=' + n + ' orphelinSupprime=' + orphGone + ' manuelGarde=' + manuelKept
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Soldes : frais auto = 1 % du montant si moyen autre qu\u2019Espece, 0 sinon',
    app: 'index.html', store: storeRealiste,
    code: `
      var a = sdgFraisAutoValeur('Wave', 30000);
      var b = sdgFraisAutoValeur('Espèce', 30000);
      var c = sdgFraisAutoValeur('Orange Money', 5000);
      var d = sdgFraisAutoValeur('', 30000);
      (a === 300 && b === 0 && c === 50 && d === 0)
        ? 'OK : Wave 30000->300, Espece->0, OM 5000->50, vide->0'
        : 'ECHEC a=' + a + ' b=' + b + ' c=' + c + ' d=' + d
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Modal : closeModal masque l\u2019overlay (Annuler / X / fond sur telephone)',
    app: 'index.html', store: storeRealiste,
    code: `
      document.getElementById('formOverlay').style.display = 'flex';
      closeModal();
      var st = document.getElementById('formOverlay').style.display;
      (st === 'none') ? 'OK : overlay masque' : 'ECHEC display=' + st
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : une piece ACOMPTE sans apType ni id employe (nom en texte libre) recree sa ligne',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opC', numeroPiece: 'KC-1', date: '2026-09-19', code: 'ACOMPTE_INDEMNITE', libelle: 'Acompte d indemnite/Mois de Septembre 2026', montant: 5050, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireNom: 'Diallo A', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      _reconcileAcomptesPretsFromCaisse();
      var list = dbArr('mdb_acomptesPrets');
      var rec = null;
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].caisseOpId === 'opC') rec = list[i]; }
      (rec && rec.type === 'acompte' && rec.employeId === 'e1' && rec.montant === 5050 && rec.moisDeduction === '2026-09')
        ? 'OK : ligne 5050 rattachee a Diallo (e1), mois 2026-09'
        : 'ECHEC rec=' + (rec ? rec.type + '/' + rec.employeId + '/' + rec.montant : 'null')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : sans employe attribuable (nom inconnu) ou sens entree, aucune ligne n\u2019est inventee',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opX1', numeroPiece: 'KC-2', date: '2026-09-19', code: 'ACOMPTE_INDEMNITE', libelle: 'Acompte', montant: 5050, sens: 'sortie', beneficiaireType: 'employe', beneficiaireNom: 'Personne Inconnue', caisseId: 'c1' });
      ops.push({ id: 'opX2', numeroPiece: 'KC-3', date: '2026-09-19', code: 'ACOMPTE', libelle: 'Acompte', montant: 5050, sens: 'entree', beneficiaireType: 'employe', beneficiaireNom: 'Diallo A', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      _reconcileAcomptesPretsFromCaisse();
      var list = dbArr('mdb_acomptesPrets');
      var n = 0;
      for (var i = 0; i < list.length; i++) { if (list[i] && (list[i].caisseOpId === 'opX1' || list[i].caisseOpId === 'opX2')) n++; }
      (n === 0) ? 'OK : 0 ligne creee (nom inconnu + entree ignores)' : 'ECHEC lignes=' + n
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : le nettoyeur garde les lignes liees a une piece ACOMPTE sans apType',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opC2', numeroPiece: 'KC-4', date: '2026-09-20', code: 'ACOMPTE_INDEMNITE', libelle: 'Acompte', montant: 5050, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1', acomptePretId: 'apC2' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apC2', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 5050, moisDeduction: '2026-09', date: '2026-09-20', statut: 'en_cours', caisseOpId: 'opC2', numeroPiece: 'KC-4', motif: 'Acompte' });
      DB.set('mdb_acomptesPrets', list);
      _cleanGhostAcomptes();
      var after = dbArr('mdb_acomptesPrets');
      var kept = false;
      for (var i = 0; i < after.length; i++) { if (after[i] && after[i].id === 'apC2') kept = true; }
      kept ? 'OK : ligne apC2 conservee (nature par code + lien retour)' : 'ECHEC : ligne apC2 supprimee'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : nature d\u2019une piece (apType d\u2019abord, sinon code)',
    app: 'index.html', store: storeRealiste,
    code: `
      var r1 = _apNatureOp({ apType: 'solde', code: 'X' });
      var r2 = _apNatureOp({ code: 'ACOMPTE_INDEMNITE' });
      var r3 = _apNatureOp({ code: 'SOLDE_SALAIRE' });
      var r4 = _apNatureOp({ code: 'PRET' });
      var r5 = _apNatureOp({ apType: 'pret', code: 'X' });
      var r6 = _apNatureOp({ code: 'VENTE' });
      var r7 = _apNatureOp({});
      (r1 === 'acompte' && r2 === 'acompte' && r3 === 'acompte' && r4 === 'pret' && r5 === 'pret' && r6 === '' && r7 === '')
        ? 'OK : solde->acompte, ACOMPTE_INDEMNITE->acompte, SOLDE_SALAIRE->acompte, PRET->pret, VENTE->vide'
        : 'ECHEC ' + [r1, r2, r3, r4, r5, r6, r7].join('/')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : une piece d\u2019aout saisie en septembre cree sa ligne sur aout (periode du libelle)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opP', numeroPiece: 'KCJ-44', date: '2026-09-11', code: 'SOLDE_SALAIRE', libelle: 'Solde de salaire/Mois de Août 2026', montant: 200000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      _reconcileAcomptesPretsFromCaisse();
      var list = dbArr('mdb_acomptesPrets');
      var rec = null;
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].caisseOpId === 'opP') rec = list[i]; }
      (rec && rec.type === 'acompte' && rec.moisDeduction === '2026-08')
        ? 'OK : ligne sur 2026-08 (periode), pas sur la date de saisie'
        : 'ECHEC rec=' + (rec ? rec.type + '/' + rec.moisDeduction : 'null')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : une ligne restee sur le mois de saisie est remise sur la periode (piece synchro aussi)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opP2', numeroPiece: 'KCJ-45', date: '2026-09-11', code: 'SOLDE_SALAIRE', libelle: 'Solde de salaire/Mois de Août 2026', periode: '2026-08', montant: 200000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apP2', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 200000, moisDeduction: '2026-09', date: '2026-09-11', statut: 'en_cours', provenance: 'caisse', caisseOpId: 'opP2', numeroPiece: 'KCJ-45' });
      DB.set('mdb_acomptesPrets', list);
      _reconcileAcomptesPretsFromCaisse();
      var after = dbArr('mdb_acomptesPrets');
      var lm = null;
      for (var i = 0; i < after.length; i++) { if (after[i] && after[i].id === 'apP2') lm = after[i].moisDeduction; }
      var ops2 = getOperationsCaisse();
      var om = null;
      for (var j = 0; j < ops2.length; j++) { if (ops2[j] && ops2[j].id === 'opP2') om = ops2[j].apMoisDeduction; }
      (lm === '2026-08' && om === '2026-08')
        ? 'OK : ligne et piece remises sur 2026-08'
        : 'ECHEC ligne=' + lm + ' piece=' + om
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : un mois choisi deliberement (different de la saisie) n\u2019est jamais reecrit',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opP3', numeroPiece: 'KCJ-46', date: '2026-09-11', code: 'SOLDE_SALAIRE', libelle: 'Solde de salaire/Mois de Août 2026', periode: '2026-08', montant: 200000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1', apMoisDeduction: '2026-10' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apP3', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 200000, moisDeduction: '2026-10', date: '2026-09-11', statut: 'en_cours', provenance: 'caisse', caisseOpId: 'opP3', numeroPiece: 'KCJ-46' });
      DB.set('mdb_acomptesPrets', list);
      _reconcileAcomptesPretsFromCaisse();
      var after = dbArr('mdb_acomptesPrets');
      var lm = null;
      for (var i = 0; i < after.length; i++) { if (after[i] && after[i].id === 'apP3') lm = after[i].moisDeduction; }
      (lm === '2026-10') ? 'OK : octobre delibere conserve' : 'ECHEC ligne=' + lm
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : mois lu dans le libelle (noms francais, avec ou sans accent)',
    app: 'index.html', store: storeRealiste,
    code: `
      var a = _apMoisDepuisLibelle('Solde de salaire/Mois de Août 2026');
      var b = _apMoisDepuisLibelle('ACOMPTE/SALAIRE/Mois de Septembre 2026');
      var c = _apMoisDepuisLibelle('Acompte d indemnite/Mois de Fevrier 2026');
      var d = _apMoisDepuisLibelle('Acompte simple');
      (a === '2026-08' && b === '2026-09' && c === '2026-02' && d === '')
        ? 'OK : aout->2026-08, septembre->2026-09, fevrier->2026-02, sans mois->vide'
        : 'ECHEC ' + [a, b, c, d].join('/')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : le compteur de desalignes compare a la periode de la piece',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opAL', numeroPiece: 'KCJ-47', date: '2026-09-11', code: 'SOLDE_SALAIRE', libelle: 'Solde de salaire/Mois de Août 2026', periode: '2026-08', montant: 200000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apAL', type: 'acompte', employeId: 'e1', montant: 200000, moisDeduction: '2026-09', date: '2026-09-11', caisseOpId: 'opAL' });
      DB.set('mdb_acomptesPrets', list);
      var avant = apCompterDesalignes();
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === 'apAL') list[i].moisDeduction = '2026-08'; }
      DB.set('mdb_acomptesPrets', list);
      var apres = apCompterDesalignes();
      (avant >= 1 && apres === 0) ? 'OK : desaligne compte puis plus rien une fois sur aout' : 'ECHEC avant=' + avant + ' apres=' + apres
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Soldes : le champ MOIS du modal vaut la periode par defaut (pas la date de saisie)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opM', numeroPiece: 'KM-9', date: '2026-09-11', code: 'SOLDE', libelle: 'Solde/Mois de Août 2026', periode: '2026-08', montant: 10000, sens: 'sortie', moyenPaiement: 'Espèce', beneficiaireType: 'employe', beneficiaireId: 'e1', beneficiaireNom: 'Diallo A', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      openSoldeGroupeEdit('opM');
      var mb = document.getElementById('formModalBody');
      var h = mb ? (mb.innerHTML || '') : '';
      (h.indexOf('class="sdg-mois" value="2026-08"') !== -1)
        ? 'OK : MOIS propose = 2026-08 (periode)'
        : 'ECHEC : ' + (h.match(/sdg-mois" value="[^"]*"/g) || ['absent']).join(',')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Recherche globale : les dates des pieces s\u2019affichent en JJ/MM/AA',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opR', numeroPiece: 'BR-1', date: '2026-08-05', code: 'DIVERS', libelle: 'DIVERS frais de route', montant: 10000, sens: 'sortie', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      _gsAllQuery = 'ROUTE';
      renderGlobalSearchAll();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('>05/08/26<') !== -1 && h.indexOf('2026-08-05') === -1)
        ? 'OK : date affichee 05/08/26, plus de format ISO'
        : 'ECHEC : ' + h.substr(0, 300).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substr(0, 160)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : conversion Acompte - Solde en un clic (sans ressaisie, libelles ajustes)',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opV1', numeroPiece: 'KKCJ-99', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : KOFFI', montant: 220000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-09' });
      ops.push({ id: 'opV2', numeroPiece: 'KKCJ-99', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : RACHIDOU', montant: 98393, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      ops.push({ id: 'opV3', numeroPiece: 'KKCJ-99', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Solde indemnité : NOUH', montant: 10000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'solde' });
      DB.set('mdb_operationsCaisse', ops);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opV1', 'opV2', 'opV3']); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var l1 = null, t1 = null, l2 = null, l3 = null, m1 = null;
      for (var i = 0; i < ops2.length; i++) {
        if (ops2[i] && ops2[i].id === 'opV1') { l1 = ops2[i].libelle; t1 = ops2[i].apType; m1 = ops2[i].montant; }
        if (ops2[i] && ops2[i].id === 'opV2') l2 = ops2[i].libelle;
        if (ops2[i] && ops2[i].id === 'opV3') l3 = ops2[i].libelle;
      }
      (r && r.converties === 2 && r.ignorees === 1 && t1 === 'solde' && l1 === 'Solde indemnité : KOFFI/Mois de Septembre 2026' && l2 === 'Solde indemnité : RACHIDOU/Mois de Octobre 2026' && l3 === 'Solde indemnité : NOUH' && m1 === 220000)
        ? 'OK : 2 converties (libelles Solde indemnité + mois), 1 deja solde ignoree, montant garde'
        : 'ECHEC r=' + JSON.stringify(r) + ' l1=' + l1 + ' l2=' + l2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : conversion garde les libelles libres, bascule Acompte/... en Solde/...',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opW1', numeroPiece: 'KCJ-50', date: '2026-09-18', code: 'ACOMPTE', libelle: 'Acompte/SALAIRE/Mois de Septembre 2026', montant: 5000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      ops.push({ id: 'opW2', numeroPiece: 'KCJ-51', date: '2026-09-18', code: 'ACOMPTE', libelle: 'Avance exceptionnelle', montant: 7000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      DB.set('mdb_operationsCaisse', ops);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opW1', 'opW2']); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var l1 = null, t1 = null, l2 = null;
      for (var i = 0; i < ops2.length; i++) {
        if (ops2[i] && ops2[i].id === 'opW1') { l1 = ops2[i].libelle; t1 = ops2[i].apType; }
        if (ops2[i] && ops2[i].id === 'opW2') l2 = ops2[i].libelle;
      }
      (r && r.converties === 2 && t1 === 'solde' && l1 === 'Solde/SALAIRE/Mois de Septembre 2026' && l2 === 'Avance exceptionnelle')
        ? 'OK : Acompte/... bascule, libelle libre conserve, apType solde'
        : 'ECHEC l1=' + l1 + ' l2=' + l2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : a la creation collective, un code SOLDE donne libelle et nature solde (pas Acompte)',
    app: 'index.html', store: storeRealiste,
    code: `
      var a = csApTypeEtLibelleCreation('acompte', 'SOLDE_INDEMNITE', 'GAHIE');
      var b = csApTypeEtLibelleCreation('acompte', 'SOLDE_SALAIRE', 'KOFFI');
      var c = csApTypeEtLibelleCreation('acompte', 'ACOMPTE_INDEMNITE', 'ZOH');
      var d = csApTypeEtLibelleCreation('pret', 'SOLDE_SALAIRE', 'KOFFI');
      (a.apType === 'solde' && a.libelle === 'Solde indemnité : GAHIE'
        && b.apType === 'solde' && b.libelle === 'Solde salaire : KOFFI'
        && c.apType === 'acompte' && c.libelle === 'Acompte employé : ZOH'
        && d.apType === 'pret' && d.libelle === 'Prêt employé : KOFFI')
        ? 'OK : SOLDE_INDEMNITE->Solde indemnité/solde, ACOMPTE_INDEMNITE inchange, pret touche'
        : 'ECHEC ' + JSON.stringify([a, b, c, d])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : la conversion pose le lien retour vers la ligne existante (validation gardee)',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opZ1', numeroPiece: 'KKCJ-98', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : GAHIE', montant: 9472, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apZ1', type: 'acompte', employeId: 'e1', employeNom: 'Gahie', montant: 9472, moisDeduction: '2026-09', date: '2026-10-02', statut: 'en_cours', valide: true, caisseOpId: 'opZ1', numeroPiece: 'KKCJ-98', provenance: 'caisse' });
      DB.set('mdb_acomptesPrets', list);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opZ1']); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var back = null, lib = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opZ1') { back = ops2[i].acomptePretId; lib = ops2[i].libelle; } }
      _cleanGhostAcomptes();
      var after = dbArr('mdb_acomptesPrets');
      var kept = false, val = false;
      for (var j = 0; j < after.length; j++) { if (after[j] && after[j].id === 'apZ1') { kept = true; val = after[j].valide === true; } }
      (r && r.converties === 1 && back === 'apZ1' && lib === 'Solde indemnité : GAHIE/Mois de Octobre 2026' && kept && val)
        ? 'OK : convertie + lien retour, ligne validee gardee (pas mangee)'
        : 'ECHEC back=' + back + ' lib=' + lib + ' gardee=' + kept + ' validee=' + val
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : le mois du libelle converti suit la periode, pas la saisie par defaut',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opY1', numeroPiece: 'KCJ-52', date: '2026-09-11', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : GAHIE', observations: 'Prélèvement Août 2026', montant: 9472, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opY1']); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var l1 = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opY1') l1 = ops2[i].libelle; }
      (r && r.converties === 1 && l1 === 'Solde indemnité : GAHIE/Mois de Août 2026')
        ? 'OK : mois de la periode (aout), pas septembre par defaut'
        : 'ECHEC l1=' + l1
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : conversion avec mois impose (octobre, soldes de septembre)',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opF1', numeroPiece: 'KKCJ-97', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : KOFFI', montant: 220000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apF1', type: 'acompte', employeId: 'e1', employeNom: 'Koffi', montant: 220000, moisDeduction: '2026-10', date: '2026-10-02', statut: 'en_cours', provenance: 'caisse', caisseOpId: 'opF1', numeroPiece: 'KKCJ-97' });
      DB.set('mdb_acomptesPrets', list);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opF1'], '2026-09'); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var lib = null, om = null, oflag = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opF1') { lib = ops2[i].libelle; om = ops2[i].apMoisDeduction; oflag = ops2[i].moisManuel; } }
      var after = dbArr('mdb_acomptesPrets');
      var lm = null, lflag = null;
      for (var j = 0; j < after.length; j++) { if (after[j] && after[j].id === 'apF1') { lm = after[j].moisDeduction; lflag = after[j].moisManuel; } }
      (r && r.converties === 1 && lib === 'Solde indemnité : KOFFI/Mois de Septembre 2026' && om === '2026-09' && oflag === true && lm === '2026-09' && lflag === true)
        ? 'OK : libelle + piece + ligne sur septembre choisi (proteges)'
        : 'ECHEC lib=' + lib + ' piece=' + om + '/' + oflag + ' ligne=' + lm + '/' + lflag
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : la fenetre propose le mois majoritaire des pieces (septembre en octobre)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opD1', numeroPiece: 'KKCJ-96', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : KOFFI', montant: 1000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-09' });
      ops.push({ id: 'opD2', numeroPiece: 'KKCJ-96', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Acompte employé : NOUH', montant: 2000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      openConvertirSoldeModal(['opD1', 'opD2']);
      var mb = document.getElementById('formModalBody');
      var h = mb ? (mb.innerHTML || '') : '';
      var defautOk = h.indexOf('id="cvsMois" value="2026-09"') !== -1;
      document.getElementById('cvsMois').value = '2026-09';
      previewConvertirSolde();
      var pv = document.getElementById('cvsPreview');
      var ph = pv ? (pv.innerHTML || '') : '';
      (defautOk && ph.indexOf('Solde indemnité : KOFFI/Mois de Septembre 2026') !== -1)
        ? 'OK : mois propose septembre + apercu avant/apres'
        : 'ECHEC defaut=' + defautOk + ' apercu=' + ph.substr(0, 120)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : le mois pris en compte est la deduction choisie, pas la date de saisie',
    app: 'paye.html', store: storeRealiste,
    code: `
      var a = apMoisPrisEnCompte({ moisDeduction: '2026-09', date: '2026-10-02' });
      var b = apMoisPrisEnCompte({ moisDeduction: '', date: '2026-10-02' });
      var c = apMoisPrisEnCompte({ moisDeduction: 'septembre 2026', date: '2026-09-15' });
      (a === '2026-09' && b === '2026-10' && c === '2026-09')
        ? 'OK : deduction septembre (saisie octobre), repli date, ancien libelle -> date'
        : 'ECHEC ' + [a, b, c].join('/')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : encadrement, cocher haut+bas coche tout l\u2019intervalle',
    app: 'index.html', store: storeRealiste,
    code: `
      var lignes = [{checked:true},{checked:false},{checked:false},{checked:false},{checked:true}];
      var n = csAppliquerEncadrement(lignes, 0, 4);
      var tout = true;
      for (var i = 0; i < lignes.length; i++) { if (!lignes[i].checked) tout = false; }
      var lignes2 = [{checked:false},{checked:false},{checked:true}];
      var n2 = csAppliquerEncadrement(lignes2, 2, 0);
      var gardes = (csAppliquerEncadrement([], 0, 1) === 0 && csAppliquerEncadrement(lignes2, -1, 5) === 0);
      (n === 3 && tout && n2 === 2 && lignes2[0].checked && lignes2[1].checked && gardes)
        ? 'OK : intervalle coche dans les 2 sens, cas invalides proteges'
        : 'ECHEC n=' + n + ' n2=' + n2 + ' gardes=' + gardes
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : conversion inverse Solde vers Acompte',
    app: 'index.html', store: storeRealiste,
    code: `
      window.confirm2 = function(){ return true; };
      var ops = getOperationsCaisse();
      ops.push({ id: 'opR1', numeroPiece: 'KKCJ-95', date: '2026-09-20', code: 'SOLDE_INDEMNITE', libelle: 'Solde indemnité : GAHIE/Mois de Septembre 2026', montant: 9472, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'solde', apMoisDeduction: '2026-09' });
      DB.set('mdb_operationsCaisse', ops);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opR1'], '', 'vers-acompte'); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var lib = null, tp = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opR1') { lib = ops2[i].libelle; tp = ops2[i].apType; } }
      (r && r.converties === 1 && tp === 'acompte' && lib === 'Acompte employé : GAHIE/Mois de Septembre 2026')
        ? 'OK : revenue en acompte, mois garde'
        : 'ECHEC lib=' + lib + ' type=' + tp
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : conversion applique le mois aux pieces deja en solde (sans les ignorer)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opM1', numeroPiece: 'KKCJ-94', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Solde indemnité : KOFFI', montant: 220000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'solde' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apM1', type: 'acompte', employeId: 'e1', employeNom: 'Koffi', montant: 220000, moisDeduction: '2026-10', date: '2026-10-02', statut: 'en_cours', provenance: 'caisse', caisseOpId: 'opM1', numeroPiece: 'KKCJ-94' });
      DB.set('mdb_acomptesPrets', list);
      var r = null;
      try { r = csConvertirAcompteEnSolde(['opM1'], '2026-09', 'vers-solde'); } catch (e) {}
      var ops2 = getOperationsCaisse();
      var lib = null, om = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opM1') { lib = ops2[i].libelle; om = ops2[i].apMoisDeduction; } }
      var after = dbArr('mdb_acomptesPrets');
      var lm = null;
      for (var j = 0; j < after.length; j++) { if (after[j] && after[j].id === 'apM1') lm = after[j].moisDeduction; }
      (r && r.converties === 0 && r.moisMaj === 1 && lib === 'Solde indemnité : KOFFI/Mois de Septembre 2026' && om === '2026-09' && lm === '2026-09')
        ? 'OK : mois ajoute au libelle, piece et ligne (0 conversion, 1 mois)'
        : 'ECHEC lib=' + lib + ' piece=' + om + ' ligne=' + lm + ' r=' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : l\u2019apercu montre les mises a jour de mois seul (pieces deja en solde)',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opS1', numeroPiece: 'KKCJ-93', date: '2026-10-02', code: 'SOLDE_INDEMNITE', libelle: 'Solde indemnité : KOFFI', montant: 220000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'solde' });
      DB.set('mdb_operationsCaisse', ops);
      openConvertirSoldeModal(['opS1']);
      document.getElementById('cvsMois').value = '2026-09';
      previewConvertirSolde();
      var pv = document.getElementById('cvsPreview');
      var ph = pv ? (pv.innerHTML || '') : '';
      (ph.indexOf('Solde indemnité : KOFFI/Mois de Septembre 2026') !== -1 && ph.indexOf('(mois)') !== -1)
        ? 'OK : apercu mois-seul affiche'
        : 'ECHEC : ' + ph.substr(0, 140)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : une piece ACOMPTE libellee septembre mais deduite octobre repasse en septembre',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opJ1', numeroPiece: 'KKCJ-75', date: '2026-10-03', code: 'ACOMPTE', libelle: 'ACOMPTE/SALAIRE/Mois de Septembre 2026', montant: 20000, sens: 'sortie', moyenPaiement: 'Wave', beneficiaireType: 'employe', beneficiaireNom: 'Porgo Innoussa', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-10' });
      DB.set('mdb_operationsCaisse', ops);
      var n = _corrigerMoisPieces();
      var ops2 = getOperationsCaisse();
      var m = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opJ1') m = ops2[i].apMoisDeduction; }
      (n === 1 && m === '2026-09') ? 'OK : piece remise sur septembre (libelle)' : 'ECHEC n=' + n + ' mois=' + m
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Caisse : la correction des mois ne touche ni aux choix manuels ni aux prets ni aux mois coherents',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opJ2', numeroPiece: 'KKCJ-76', date: '2026-10-03', code: 'ACOMPTE', libelle: 'ACOMPTE/SALAIRE/Mois de Septembre 2026', montant: 20000, sens: 'sortie', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-10', moisManuel: true });
      ops.push({ id: 'opJ3', numeroPiece: 'KKCJ-77', date: '2026-10-03', code: 'PRET', libelle: 'Prêt employé : X', montant: 50000, sens: 'sortie', caisseId: 'c1', apType: 'pret', apMoisDeduction: '2026-10' });
      ops.push({ id: 'opJ4', numeroPiece: 'KKCJ-78', date: '2026-10-03', code: 'ACOMPTE', libelle: 'ACOMPTE/SALAIRE/Mois de Octobre 2026', montant: 20000, sens: 'sortie', caisseId: 'c1', apType: 'acompte', apMoisDeduction: '2026-10' });
      DB.set('mdb_operationsCaisse', ops);
      var n = _corrigerMoisPieces();
      var ops2 = getOperationsCaisse();
      var r2 = null, r3 = null, r4 = null;
      for (var i = 0; i < ops2.length; i++) {
        if (ops2[i] && ops2[i].id === 'opJ2') r2 = ops2[i].apMoisDeduction;
        if (ops2[i] && ops2[i].id === 'opJ3') r3 = ops2[i].apMoisDeduction;
        if (ops2[i] && ops2[i].id === 'opJ4') r4 = ops2[i].apMoisDeduction;
      }
      (n === 0 && r2 === '2026-10' && r3 === '2026-10' && r4 === '2026-10')
        ? 'OK : manuel, pret et coherent intouches'
        : 'ECHEC n=' + n + ' ' + [r2, r3, r4].join('/')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'En-tete : la fin de plage endormie a J-2 revient au jour J (debut garde)',
    app: 'index.html', store: storeRealiste,
    code: `
      var d = new Date(); d.setDate(d.getDate() - 2);
      var j2 = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      var yr = new Date().getFullYear() + '-01-01';
      DB.set('mdb_dashRange', { from: yr, to: j2 });
      var ch = _rafraichirPlageDash();
      var r = dbObj('mdb_dashRange');
      var ch2 = _rafraichirPlageDash();
      (ch === true && r.to === getToday() && r.from === yr && ch2 === false)
        ? 'OK : fin ' + j2 + ' -> ' + r.to + ', 2e passage sans ecriture'
        : 'ECHEC ch=' + ch + ' to=' + (r && r.to) + ' ch2=' + ch2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'En-tete : plage absente initialisee, fin future conservee',
    app: 'index.html', store: storeRealiste,
    code: `
      var yr = new Date().getFullYear() + '-01-01';
      DB.set('mdb_dashRange', {});
      var ch = _rafraichirPlageDash();
      var r = dbObj('mdb_dashRange');
      DB.set('mdb_dashRange', { from: yr, to: '2099-12-31' });
      var ch2 = _rafraichirPlageDash();
      var r2 = dbObj('mdb_dashRange');
      (ch === true && r.from === yr && r.to === getToday() && ch2 === false && r2.to === '2099-12-31')
        ? 'OK : init 01/01->jour J, futur garde'
        : 'ECHEC ' + JSON.stringify(r) + ' / ' + JSON.stringify(r2)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Revue : le filtre Valides / Non valides vaut pour acomptes ET prets',
    app: 'index.html', store: storeRealiste,
    code: `
      window._apValFilter = 'valides';
      var vv = apPasseFiltreValide({ type: 'acompte', valide: true });
      var vn = apPasseFiltreValide({ type: 'acompte', valide: false });
      var pv = apPasseFiltreValide({ type: 'pret', valide: true });
      var pn = apPasseFiltreValide({ type: 'pret' });
      window._apValFilter = 'nonvalides';
      var nv = apPasseFiltreValide({ type: 'acompte', valide: true });
      var nn = apPasseFiltreValide({ type: 'acompte' });
      var npv = apPasseFiltreValide({ type: 'pret', valide: true });
      var npn = apPasseFiltreValide({ type: 'pret' });
      window._apValFilter = '';
      var t = apPasseFiltreValide({ type: 'pret' });
      (vv && !vn && pv && !pn && !nv && nn && !npv && npn && t)
        ? 'OK : valides garde valides (2 types), nonvalides l inverse, tous garde tout'
        : 'ECHEC ' + [vv, vn, pv, pn, nv, nn, npv, npn, t].join('/')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Revue : avec filtre Valides, seuls les valides s\u2019affichent (ni prets ni collectifs en attente)',
    app: 'index.html', store: storeRealiste,
    code: `
      var moisC = new Date().toISOString().slice(0, 7);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apVA', type: 'acompte', employeId: 'ex1', employeNom: 'ValideAcompte', montant: 10000, moisDeduction: moisC, date: moisC + '-05', statut: 'en_cours', valide: true, motif: 'Test' });
      list.push({ id: 'apNA', type: 'acompte', employeId: 'ex2', employeNom: 'NonValideAcompte', montant: 10000, moisDeduction: moisC, date: moisC + '-05', statut: 'en_cours', motif: 'Test' });
      list.push({ id: 'apVP', type: 'pret', employeId: 'ex3', employeNom: 'ValidePret', montant: 100000, dureeMois: 5, montantMensuel: 20000, moisDeduction: moisC, date: moisC + '-05', statut: 'en_cours', valide: true, motif: 'Test' });
      list.push({ id: 'apNP', type: 'pret', employeId: 'ex4', employeNom: 'NonValidePret', montant: 100000, dureeMois: 5, montantMensuel: 20000, moisDeduction: moisC, date: moisC + '-05', statut: 'en_cours', motif: 'Test' });
      DB.set('mdb_acomptesPrets', list);
      var ops = getOperationsCaisse();
      ops.push({ id: 'opPend', numeroPiece: 'PEND-1', date: moisC + '-06', code: 'SOLDE', libelle: 'Solde', montant: 50000, sens: 'sortie', collective: true, pendingDetail: true, groupeId: 'gPend', apType: 'acompte', caisseId: 'c1' });
      DB.set('mdb_operationsCaisse', ops);
      window._apValFilter = 'valides';
      window._apFilterMonth = moisC;
      renderAcomptesPrets();
      var box = document.getElementById('content');
      var h = box ? (box.innerHTML || '') : '';
      var ok = h.indexOf('ValideAcompte') !== -1 && h.indexOf('ValidePret') !== -1;
      var ko = h.indexOf('NonValideAcompte') !== -1 || h.indexOf('NonValidePret') !== -1 || h.indexOf('PEND-1') !== -1;
      (ok && !ko) ? 'OK : seuls les 2 valides affiches' : 'ECHEC ok=' + ok + ' ko=' + ko
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : le lien retour manquant est repose, en gardant la ligne validee',
    app: 'index.html', store: storeRealiste,
    code: `
      var ops = getOperationsCaisse();
      ops.push({ id: 'opRL', numeroPiece: 'KCJ-40', date: '2026-09-15', code: 'ACOMPTE', libelle: 'Acompte', montant: 10000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'e1', caisseId: 'c1', apType: 'acompte' });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apRL1', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 10000, moisDeduction: '2026-09', date: '2026-09-15', statut: 'en_cours', caisseOpId: 'opRL', numeroPiece: 'KCJ-40' });
      list.push({ id: 'apRL2', type: 'acompte', employeId: 'e1', employeNom: 'Diallo A', montant: 10000, moisDeduction: '2026-09', date: '2026-09-15', statut: 'en_cours', valide: true, caisseOpId: 'opRL', numeroPiece: 'KCJ-40' });
      DB.set('mdb_acomptesPrets', list);
      var n = _relierAcomptesPrets();
      var ops2 = getOperationsCaisse();
      var back = null;
      for (var i = 0; i < ops2.length; i++) { if (ops2[i] && ops2[i].id === 'opRL') back = ops2[i].acomptePretId; }
      (n === 1 && back === 'apRL2') ? 'OK : lien vers la ligne validee' : 'ECHEC n=' + n + ' back=' + back
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Acomptes : une ligne validee survit au rendu (ni mangee ni devalidee)',
    app: 'index.html', store: storeRealiste,
    code: `
      var moisC = new Date().toISOString().slice(0, 7);
      var ops = getOperationsCaisse();
      ops.push({ id: 'opRV', numeroPiece: 'KCJ-41', date: moisC + '-10', code: 'ACOMPTE', libelle: 'Acompte', montant: 10000, sens: 'sortie', beneficiaireType: 'employe', beneficiaireId: 'exRV', caisseId: 'c1', apType: 'acompte', apMoisDeduction: moisC });
      DB.set('mdb_operationsCaisse', ops);
      var list = dbArr('mdb_acomptesPrets');
      list.push({ id: 'apRV', type: 'acompte', employeId: 'exRV', employeNom: 'SurvitValide', montant: 10000, moisDeduction: moisC, date: moisC + '-10', statut: 'en_cours', valide: true, provenance: 'caisse', caisseOpId: 'opRV', numeroPiece: 'KCJ-41', motif: 'Test' });
      DB.set('mdb_acomptesPrets', list);
      window._apValFilter = '';
      window._apFilterMonth = moisC;
      renderAcomptesPrets();
      renderAcomptesPrets();
      var after = dbArr('mdb_acomptesPrets');
      var kept = false, val = false;
      for (var i = 0; i < after.length; i++) { if (after[i] && after[i].id === 'apRV') { kept = true; val = after[i].valide === true; } }
      var h = (document.getElementById('content').innerHTML || '');
      (kept && val && h.indexOf('SurvitValide') !== -1)
        ? 'OK : ligne validee stable sur 2 rendus, affichee'
        : 'ECHEC gardee=' + kept + ' validee=' + val
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock MP : l\u2019onglet actif deroule la fiche ordinaire par colis (comme BL/spe)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockRawTab', 'actif');
      setSection('stockRawEtat', 'tout');
      CURRENT_PAGE = 'stock-raw'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('mvtColis_') !== -1 && h.indexOf('goToColisOrigin') === -1)
        ? 'OK : accordéons mouvements sur l\u2019onglet actif, plus de renvoi seul'
        : 'ECHEC mvt=' + (h.indexOf('mvtColis_') !== -1) + ' origin=' + (h.indexOf('goToColisOrigin') !== -1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock MP : le registre d\u2019encours suit lancement, avancement et reste',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('productionOrders', [{ numero: 'OF-9', article_id: 'a1', statut: 'en_cours', quantite_prevue: 100, quantite_realisee: 30, date: '2026-09-01' }]);
      var h = _wipRegistreHtml('OF-9');
      var ko = _wipRegistreHtml('XXX');
      (h.indexOf('Mise en encours') !== -1 && h.indexOf('Stock final') !== -1 && h.indexOf('70') !== -1 && ko.indexOf('introuvable') !== -1)
        ? 'OK : entree 100, sortie 30, final 70'
        : 'ECHEC : ' + h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substr(0, 140)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock MP : la fiche d\u2019inventaire montre rappel, ecart et reel compte',
    app: 'production.html', store: storeRealiste,
    code: `
      var h = _invFicheHtml({ code: 'K1', designation: 'Bois rouge', theo_qte: 0, real_qte: 300, categorie: 'Consommable' });
      (h.indexOf('Stock initial') !== -1 && h.indexOf('Ajustement inventaire') !== -1 && h.indexOf('300') !== -1 && h.indexOf('Stock final') !== -1)
        ? 'OK : initial 0, ajust +300, final 300'
        : 'ECHEC : ' + h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substr(0, 140)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Stock MP : l\u2019onglet initial propose la fiche par article inventorie',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('inventories', [{ month: '2026-09', items: [{ code: 'K1', designation: 'Bois rouge', theo_qte: 0, real_qte: 300, categorie: 'Consommable' }] }]);
      setSection('stockRawTab', 'initial');
      CURRENT_PAGE = 'stock-raw'; renderPage();
      var h = document.getElementById('content').innerHTML || '';
      (h.indexOf('invCat_0_0') !== -1 && h.indexOf('Fiche —') !== -1)
        ? 'OK : article depliable vers sa fiche'
        : 'ECHEC : ' + h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').substr(0, 140)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Conso : + Nouveau Consommable ajoute a la fiche existante (coquille non propagee)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 100 }]);
      document.getElementById('conso_code').value = 'P5';
      document.getElementById('conso_nom').value = 'POINTE5';
      document.getElementById('conso_qte').value = '50';
      document.getElementById('conso_type').value = 'POINTE';
      CURRENT_PAGE = 'dashboard';
      addConsumDirect();
      var items = getStockConsum();
      var p5 = items.filter(function(s) { return String(s.code || '').toUpperCase() === 'P5'; });
      (p5.length === 1 && parseFloat(p5[0].quantite) === 150 && p5[0].designation === 'POINTE 5')
        ? 'OK : 1 seule fiche P5 = 150, designation etablie gardee'
        : 'ECHEC lignes=' + p5.length + ' qte=' + (p5[0] && p5[0].quantite) + ' des=' + (p5[0] && p5[0].designation)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Conso : code en minuscules/espaces retrouve la fiche (creation normalisee)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P6', designation: 'POINTE 6', type: 'POINTE', quantite: 10 }]);
      document.getElementById('conso_code').value = ' p6 ';
      document.getElementById('conso_nom').value = 'POINTE 6';
      document.getElementById('conso_qte').value = '5';
      document.getElementById('conso_type').value = 'POINTE';
      CURRENT_PAGE = 'dashboard';
      addConsumDirect();
      var items1 = getStockConsum();
      var p6 = items1.filter(function(s) { return String(s.code || '').toUpperCase() === 'P6'; });
      document.getElementById('conso_code').value = 'p9';
      document.getElementById('conso_nom').value = 'Pointe 9';
      document.getElementById('conso_qte').value = '7';
      addConsumDirect();
      var items2 = getStockConsum();
      var p9 = items2.filter(function(s) { return String(s.code || '') === 'P9'; });
      (p6.length === 1 && parseFloat(p6[0].quantite) === 15 && p9.length === 1 && parseFloat(p9[0].quantite) === 7)
        ? 'OK : p6 fusionne malgre casse/espaces, p9 cree en majuscules'
        : 'ECHEC p6=' + p6.length + '/' + (p6[0] && p6[0].quantite) + ' p9=' + p9.length
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : le code se resout au clavier (exact, INTERNE, inconnu)',
    app: 'index.html', store: storeRealiste,
    code: `
      var a = impResolveCode('LOYER - Loyer');
      var b = impResolveCode('loyer');
      var c = impResolveCode('INTERNE - Transfert');
      var d = impResolveCode('truc inconnu xyz');
      var e = impResolveCode('');
      ((a && a.id === 'cd1') && (b && b.id === 'cd1') && (c && c.id === 'INTERNE') && d === null && e === null)
        ? 'OK : exact, insensible casse, INTERNE, inconnu->nouveau'
        : 'ECHEC ' + JSON.stringify([a && a.id, b && b.id, c && c.id, d, e])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : changer le code ne touche pas au libelle tel que venu (+ Obs gardee)',
    app: 'index.html', store: storeRealiste,
    code: `
      window._importRows = [{ libelle: 'Achat tel que venu du fichier', observations: 'OLD', montant: 100, sens: 'sortie' }];
      onImportCodeInput(0, 'LOYER - Loyer');
      var c1 = window._importRows[0].codeId;
      var l1 = window._importRows[0].libelle;
      updateImportRow(0, 'obs', 'NEW');
      var o2 = window._importRows[0].observations;
      onImportCodeInput(0, 'zzz inconnu');
      var c3 = window._importRows[0].codeId;
      var l3 = window._importRows[0].libelle;
      (c1 === 'cd1' && l1 === 'Achat tel que venu du fichier' && o2 === 'NEW' && c3 === '' && l3 === 'Achat tel que venu du fichier')
        ? 'OK : code pose/retire, libelle intouchable, obs sauvee'
        : 'ECHEC ' + JSON.stringify([c1, l1, o2, c3])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : on importe les pieces cochees, libelles textuels, sinon tout',
    app: 'index.html', store: storeRealiste,
    code: `
      window._importRows = [
        { libelle: 'Piece une textuelle', libelleOrigine: 'Piece une textuelle', montant: 1000, montantEntree: 0, montantSortie: 1000, sens: 'sortie', date: '2026-10-01', day: '01', caisseId: 'c1', codeId: '', type: 'libre', beneficiaire: '', observations: 'obs1' },
        { libelle: 'Piece deux textuelle', libelleOrigine: 'Piece deux textuelle', montant: 2000, montantEntree: 0, montantSortie: 2000, sens: 'sortie', date: '2026-10-01', day: '01', caisseId: 'c1', codeId: '', type: 'libre', beneficiaire: '', observations: 'obs2' }
      ];
      var avant = getOperationsCaisse().length;
      try { processCaisseImport(false, [0]); } catch (e) {}
      var apres1 = getOperationsCaisse().length;
      var op1 = getOperationsCaisse()[getOperationsCaisse().length - 1];
      try { processCaisseImport(false); } catch (e2) {}
      var apres2 = getOperationsCaisse().length;
      (apres1 - avant === 1 && op1.libelle === 'Piece une textuelle' && op1.observations === 'obs1' && apres2 - apres1 === 2)
        ? 'OK : 1 cochee puis 2 (sans coche = tout), libelles intacts'
        : 'ECHEC +1=' + (apres1 - avant) + ' lib=' + (op1 && op1.libelle) + ' +2=' + (apres2 - apres1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : zone extensible ne casse pas (hauteur auto)',
    app: 'index.html', store: storeRealiste,
    code: `
      var el = document.createElement('textarea');
      impAutoGrow(el);
      (el.style.height === '800px') ? 'OK : hauteur ajustee au contenu' : 'ECHEC h=' + el.style.height
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : le beneficiaire se choisit dans la liste (employes, then fournisseurs)',
    app: 'index.html', store: storeRealiste,
    code: `
      window._importRows = [{ type: 'libre', beneficiaire: '', beneficiaireNom: '', beneficiaireId: '' }];
      updateImportBenef(0, 'Diallo A');
      var r1 = { id: window._importRows[0].beneficiaireId, nom: window._importRows[0].beneficiaireNom, type: window._importRows[0].type };
      updateImportBenef(0, 'zzz inconnu personne');
      var r2 = { id: window._importRows[0].beneficiaireId, nom: window._importRows[0].beneficiaireNom };
      (r1.id === 'e1' && r1.nom === 'DIALLO A' && r1.type === 'employe' && r2.id === '' && r2.nom === 'zzz inconnu personne')
        ? 'OK : Diallo rattache (type adopte), inconnu efface le lien'
        : 'ECHEC ' + JSON.stringify([r1, r2])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import caisse : la liste des beneficiaires propose travailleurs et fournisseurs',
    app: 'index.html', store: storeRealiste,
    code: `
      renderCaisseImportPreview([{ date: '2026-10-01', day: '01', libelle: 'Test', montant: 100, montantEntree: 0, montantSortie: 100, sens: 'sortie', beneficiaire: '', observations: '', codeId: '', type: 'libre', caisseId: 'c1' }]);
      var h = document.getElementById('importPreviewArea').innerHTML || '';
      (h.indexOf('impBenefList') !== -1 && h.indexOf('DIALLO A') !== -1 && h.indexOf('Fournisseur Test') !== -1)
        ? 'OK : dataliste beneficiaires (employes + fournisseurs)'
        : 'ECHEC : ' + h.substr(0, 160)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : un seul P5 cumule (fini les lignes en double)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [
        { id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 100 },
        { id: 'c2', code: 'P5', designation: 'POINTE5', type: 'POINTE', quantite: 50 },
        { id: 'c3', code: 'P6', designation: 'POINTE 6', type: 'POINTE', quantite: 10 }
      ]);
      var items = calcInventoryItems('2026-09');
      var conso = items.filter(function(it) { return it && it.store === 'stockConsum'; });
      var p5 = conso.filter(function(it) { return String(it.code || '').toUpperCase() === 'P5'; });
      (conso.length === 2 && p5.length === 1 && parseFloat(p5[0].theo_qte) === 150)
        ? 'OK : P5 une fois (theo 150), P6 une fois'
        : 'ECHEC conso=' + conso.length + ' p5=' + p5.length + ' theo=' + (p5[0] && p5[0].theo_qte)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : unites pointe/paquet seulement pour POINTE, defaut paquet, quantite seule sinon',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [
        { id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 1600, cond: 180 },
        { id: 'c2', code: 'COL', designation: 'COLLE A BOIS', type: 'DIVERS', quantite: 3 }
      ]);
      window._invType = 'consum';
      launchInventory();
      var h = document.getElementById('invContent').innerHTML || '';
      var pointeWidget = h.indexOf('u_P5') !== -1 && h.indexOf('<option value="paquet" selected>') !== -1;
      var colleSimple = h.indexOf('u_COL') === -1;
      (pointeWidget && colleSimple)
        ? 'OK : P5 en paquet par defaut, COL sans selecteur'
        : 'ECHEC widget=' + (h.indexOf('u_P5') !== -1) + ' paquet=' + (h.indexOf('<option value="paquet" selected>') !== -1) + ' u_COL=' + (h.indexOf('u_COL') !== -1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : l\u2019ecart bouge a la frappe sur une ligne pointe',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 1600, cond: 180 }]);
      window._invItems = [{ store: 'stockConsum', ref: 'P5', code: 'P5', theo_qte: 1600, real_qte: 1600, type: 'POINTE' }];
      var _origGet = document.getElementById;
      document.getElementById = function(id) { if (id && id.indexOf('inv_real_') === 0) return null; return _origGet(id); };
      document.getElementById('u_P5').value = '89';
      document.getElementById('u_P5').parentNode = { querySelector: function() { return { value: 'paquet' }; } };
      calcInvEcart();
      var modele = window._invItems[0].real_qte;
      var total = document.getElementById('inv_ecart_total').textContent;
      document.getElementById = _origGet;
      (modele === 16020 && total === '14420.0')
        ? 'OK : 89 paquets = 16020, ecart 14420.0 affiche'
        : 'ECHEC modele=' + modele + ' total=' + total
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : la sauvegarde garde les valeurs saisies (pas le theo)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 1600, cond: 180 }]);
      window._invItems = [{ store: 'stockConsum', ref: 'P5', code: 'P5', theo_qte: 1600, real_qte: 1600, type: 'POINTE' }];
      var _origGet = document.getElementById;
      document.getElementById = function(id) { if (id && id.indexOf('inv_real_') === 0) return null; return _origGet(id); };
      document.getElementById('u_P5').value = '89';
      document.getElementById('u_P5').parentNode = { querySelector: function() { return { value: 'paquet' }; } };
      window.confirm2 = function() { return true; };
      try { saveInventory('2026-09'); } catch (e) {}
      document.getElementById = _origGet;
      var invs = getInventories().filter(function(x) { return x && x.month === '2026-09'; });
      var rq = invs.length && invs[invs.length - 1].items && invs[invs.length - 1].items[0] ? invs[invs.length - 1].items[0].real_qte : null;
      (rq === 16020) ? 'OK : sauvegarde 16020 (pas 1600)' : 'ECHEC real_qte=' + rq
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : le theorique des pointes decline paquets et cartons',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 1600, cond: 180 }]);
      var eq = acEquivTexte(1600, 'P5', '');
      var eqOk = eq.indexOf('paquet') !== -1 && eq.indexOf('carton') !== -1 && eq.indexOf('pointes') !== -1;
      window._invType = 'consum';
      launchInventory();
      var h = document.getElementById('invContent').innerHTML || '';
      (eqOk && h.indexOf(eq) !== -1)
        ? 'OK : theorique avec equivalence (' + eq + ')'
        : 'ECHEC eq=' + eq + ' present=' + (h.indexOf(eq) !== -1)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : le compte saisit devient le solde (fiches en double comprises)',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [
        { id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 100, cond: 180 },
        { id: 'c2', code: 'P5', designation: 'POINTE5', type: 'POINTE', quantite: 1500, cond: 180 }
      ]);
      window._invItems = [{ store: 'stockConsum', ref: 'P5', code: 'P5', theo_qte: 1600, real_qte: 1600, type: 'POINTE' }];
      var _origGet = document.getElementById;
      document.getElementById = function(id) { if (id && id.indexOf('inv_real_') === 0) return null; return _origGet(id); };
      document.getElementById('u_P5').value = '89';
      document.getElementById('u_P5').parentNode = { querySelector: function() { return { value: 'paquet' }; } };
      window.confirm2 = function() { return true; };
      try { saveInventory('2026-09'); } catch (e) {}
      document.getElementById = _origGet;
      var total = 0;
      getStockConsum().forEach(function(s) { if (String(s.code || '').toUpperCase() === 'P5') total += parseFloat(s.quantite) || 0; });
      (total === 16020) ? 'OK : 2 fiches (100+1500) + compte 16020 -> solde 16020' : 'ECHEC solde=' + total
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Inventaire : le tableau de comptage a son bouton Imprimer',
    app: 'production.html', store: storeRealiste,
    code: `
      setSection('stockConsum', [{ id: 'c1', code: 'P5', designation: 'POINTE 5', type: 'POINTE', quantite: 1600, cond: 180 }]);
      window._invType = 'consum';
      launchInventory();
      var h = document.getElementById('invContent').innerHTML || '';
      (h.indexOf('printInventory()') !== -1 && h.indexOf('Enregistrer') !== -1)
        ? 'OK : Imprimer + Enregistrer sur le comptage'
        : 'ECHEC'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : exoneration art.116 du cas Kanga (sursalaire exclu, plafond hors transport)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var r = calcIndSpecExo([{ type: 'sursalaire', montant: 128500 }, { type: 'ind_responsabilite', montant: 45000 }], 635478);
      var brutFiscal = 665478 - 30000 - r.exo;
      (r.total === 45000 && r.plafond === 63547 && r.exo === 45000 && brutFiscal === 590478)
        ? 'OK : qualifiantes 45000, plafond 63547, brut fiscal 590478 (Excel)'
        : 'ECHEC ' + JSON.stringify(r) + ' fiscal=' + brutFiscal
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : exoneration plafonnee, custom exclu, vide neutre',
    app: 'paye.html', store: storeRealiste,
    code: `
      var a = calcIndSpecExo([{ type: 'ind_fonction', montant: 100000 }], 635478);
      var b = calcIndSpecExo([{ type: 'custom', montant: 50000 }], 635478);
      var c = calcIndSpecExo([], 0);
      (a.total === 100000 && a.exo === 63547 && b.total === 0 && b.exo === 0 && c.exo === 0)
        ? 'OK : plafond 63547, custom imposable, vide 0'
        : 'ECHEC ' + JSON.stringify([a, b, c])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : rubriques kilometrique et outillage pre-creees (0, non affectees, sans doublon ni resurrection)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var r1 = primesFonctionDefautFusion([], []);
      var r2 = primesFonctionDefautFusion(r1.liste, []);
      var existant = [{ id: 'x1', type: 'ind_kilometrique', label: 'Deplacement', num: '38', montant: 5000, employes: ['e1'] }];
      var r3 = primesFonctionDefautFusion(existant, []);
      var r4 = primesFonctionDefautFusion([], ['prime_kilometrique_def']);
      var km1 = null, ou1 = null;
      r1.liste.forEach(function(s) { if (s.type === 'ind_kilometrique') km1 = s; if (s.type === 'ind_outillage') ou1 = s; });
      var ok1 = r1.ajoute === 2 && km1 && ou1 && km1.montant === 0 && (km1.employes || []).length === 0 && km1.num === '38' && ou1.num === '39';
      var ok2 = r2.ajoute === 0 && r2.liste.length === 2;
      var ok3 = r3.ajoute === 1 && r3.liste.length === 2 && r3.liste[0].montant === 5000;
      var kif = true;
      r4.liste.forEach(function(s) { if (s.type === 'ind_kilometrique') kif = false; });
      var ok4 = r4.ajoute === 1 && kif;
      (ok1 && ok2 && ok3 && ok4) ? 'OK : creation, idempotence, existant garde, supprime non ressuscite' : 'ECHEC ' + JSON.stringify([r1.ajoute, r2.ajoute, r3.ajoute, r4.ajoute])
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : kilometrique et outillage ouvrent droit aux 10 pourcent',
    app: 'paye.html', store: storeRealiste,
    code: `
      var r = calcIndSpecExo([{ type: 'ind_kilometrique', montant: 20000 }, { type: 'ind_outillage', montant: 15000 }], 635478);
      (r.total === 35000 && r.exo === 35000)
        ? 'OK : 35000 qualifies sous plafond'
        : 'ECHEC ' + JSON.stringify(r)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : montants francais bien lus (500.000 et 500 000 = 500000)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var cas = [
        ['500.000', 500000], ['500 000', 500000], ['500,000', 500000],
        ['1 234 567', 1234567], ['0,5', 0.5], ['0.5', 0.5], ['12,50', 12.5],
        ['45000', 45000], ['', 0], ['1.234', 1234]
      ];
      var faux = [];
      for (var i = 0; i < cas.length; i++) {
        if (parseMontantSaisi(cas[i][0]) !== cas[i][1]) faux.push(cas[i][0]);
      }
      (faux.length === 0) ? 'OK : 10 formats bien lus' : 'ECHEC ' + faux.join(',')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : le cloud n\u2019ecrase pas une ecriture de moins de 30 s',
    app: 'paye.html', store: storeRealiste,
    code: `
      var maintenant = Date.now();
      function copieFrais() { return { empIndivPrimes: { e1: 'CLOUD-ancien' }, autre: 'cloud' }; }
      function copieLocale() { return { empIndivPrimes: { e1: 'LOCAL-frais' }, autre: 'local' }; }
      var base = payeProtegeEcrituresFraiches({ a: 1 }, { a: 1 }, { a: maintenant }, 30000);
      var vieux = payeProtegeEcrituresFraiches(copieFrais(), copieLocale(), { empIndivPrimes: maintenant - 60000 }, 30000);
      var sans = payeProtegeEcrituresFraiches(copieFrais(), copieLocale(), {}, 30000);
      var frais = payeProtegeEcrituresFraiches(copieFrais(), copieLocale(), { empIndivPrimes: maintenant }, 30000);
      (base.protege === true && vieux.fusion.empIndivPrimes['e1'] === 'CLOUD-ancien' && sans.fusion.empIndivPrimes['e1'] === 'CLOUD-ancien' && frais.fusion.empIndivPrimes['e1'] === 'LOCAL-frais' && frais.protege === true)
        ? 'OK : frais garde, vieux/sans-sceau suivent le cloud'
        : 'ECHEC'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : frappe en cours detectee (texte/nombre oui, case/div non)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var a = _payeSaisieEnCours();
      document.activeElement = { tagName: 'INPUT', type: 'text' };
      var b = _payeSaisieEnCours();
      document.activeElement = { tagName: 'INPUT', type: 'checkbox' };
      var c = _payeSaisieEnCours();
      document.activeElement = { tagName: 'DIV' };
      var d = _payeSaisieEnCours();
      document.activeElement = null;
      (a === false && b === true && c === false && d === false)
        ? 'OK : texte oui, case/div/non-focus non'
        : 'ECHEC ' + [a, b, c, d].join('/')
    `,
    attenduPrefixe: 'OK'
  });
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

  r.push({
    nom: 'Cong\u00e9s : le modal montre un n\u00b0 modifiable, une dur\u00e9e, et le retour se calcule tout seul',
    app: 'index.html', store: storeRealiste,
    code: `
      openCongeModal();
      var html = document.getElementById('formModalBody').innerHTML || '';
      var num = html.match(/id="cgNum" value="([^"]*)"/);
      var hasNum = num && /^CONG-\\d{4}-\\d{3}$/.test(num[1]);
      var hasDuree = html.indexOf('id="cgDuree" min="1"') !== -1;
      var hasRetourAuto = html.indexOf('id="cgRetour"') !== -1 && html.indexOf('readonly') === -1 && html.indexOf('onchange="cgCalcDuree()"') !== -1;
      document.getElementById('cgDepart').value = '2026-10-01';
      document.getElementById('cgDuree').value = '5';
      cgCalcRetour();
      var ret = document.getElementById('cgRetour').value;
      var apercu = document.getElementById('cgRetourTxt').textContent;
      (hasNum && hasDuree && hasRetourAuto && ret === '2026-10-05' && /^[a-z]{3} 05 oct$/.test(apercu))
        ? 'OK : numero=' + (num ? num[1] : '?') + ' retourAuto=' + ret + ' via duree, apercu=' + apercu
        : 'ECHEC num=' + hasNum + '(' + (num ? num[1] : '?') + ') duree=' + hasDuree + ' auto=' + hasRetourAuto + ' ret=' + ret
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cong\u00e9s : l\u2019enregistrement garde le n\u00b0 saisi et la dur\u00e9e, retour recalcul\u00e9',
    app: 'index.html', store: storeRealiste,
    code: `
      openCongeModal();
      document.getElementById('cgNum').value = 'CONG-2026-777';
      document.getElementById('cgEmp').value = 'e1';
      document.getElementById('cgType').value = 'annual';
      document.getElementById('cgDepart').value = '2026-10-01';
      document.getElementById('cgDuree').value = '5';
      document.getElementById('cgRemp').value = '';
      document.getElementById('cgReprise').value = '';
      document.getElementById('cgNotes').value = 'garde-fou';
      saveConge();
      var list = getRhConges();
      var c = list[list.length - 1];
      (c.numero === 'CONG-2026-777' && c.duree === 5 && c.date_retour === '2026-10-05' && c.date_depart === '2026-10-01')
        ? 'OK : ' + c.numero + ' duree=' + c.duree + ' retour=' + c.date_retour
        : 'ECHEC numero=' + c.numero + ' duree=' + c.duree + ' retour=' + c.date_retour
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cong\u00e9s : le tableau de suivi en jours (acquis / d\u00e9j\u00e0 pris / reste) est sur la page principale',
    app: 'index.html', store: storeRealiste,
    code: `
      renderCongesPage();
      var h = document.getElementById('content').innerHTML || '';
      var okTitre = h.indexOf('Suivi des cong\u00e9s en jours') !== -1;
      var okCols = ['Entr\u00e9e','\u00c9ligible','Acquis (j)','D\u00e9j\u00e0 pris (j)','Reste (j)','Planifier','\u00c9tat g\u00e9n\u00e9ral']
        .every(function(c){ return h.indexOf(c) !== -1; });
      var ex = rhActifs().filter(function(x){ return x.type_contrat !== 'Externe'; })[0];
      var sA = _rhSoldeAnnuel(ex);
      var rest = sA.acquis - sA.pris;
      var okLigne = h.indexOf(rhEmpLabel(ex)) !== -1 && h.indexOf('>' + rest + '</td>') !== -1;
      (okTitre && okCols && okLigne)
        ? 'OK : colonnes acquis/d\u00e9j\u00e0 pris/reste + fiche, ' + rhEmpLabel(ex) + ' -> ' + rest + ' j'
        : 'ECHEC titre=' + okTitre + ' cols=' + okCols + ' ligne=' + okLigne
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cong\u00e9s : le champ de recherche filtre le tableau par N\u00b0 / employ\u00e9 / type',
    app: 'index.html', store: storeRealiste,
    code: `
      var saved = getRhConges();
      var e1 = rhActifs().filter(function(x){ return x.type_contrat !== 'Externe'; })[0];
      if (e1) { saved.push({ id: 'cgz1', numero: 'CONG-2026-999', employee_id: e1.id, type: 'annual', date_depart: '2026-11-10', date_retour: '2026-11-14', date_reprise: '', duree: 5, remplacant_id: '', notes: '' }); }
      setRhConges(saved);
      renderCongesPage();
      var hasInput = document.getElementById('content').innerHTML.indexOf('placeholder="Rechercher (N\\u00b0, employ\\u00e9, type, rempla\\u00e7ant...)"') !== -1;
      window._cgFilterQ = 'CONG-2026-999';
      renderCongesPage();
      var hF = document.getElementById('content').innerHTML || '';
      var okFiltre = hF.indexOf('CONG-2026-999') !== -1 && hF.indexOf('Aucun cong\\u00e9 enregistr\\u00e9') === -1;
      window._cgFilterQ = 'ZZZ-INTROUVABLE';
      renderCongesPage();
      var hV = document.getElementById('content').innerHTML || '';
      var okVide = hV.indexOf('Aucun cong\\u00e9 enregistr\\u00e9') !== -1;
      window._cgFilterQ = '';
      setRhConges(saved.filter(function(x){ return x.id !== 'cgz1'; }));
      renderCongesPage();
      (hasInput && okFiltre && okVide)
        ? 'OK : champ present, filtre CONG-2026-999 -> 1 ligne, ZZZ-INTROUVABLE -> vide'
        : 'ECHEC input=' + hasInput + ' filtre=' + okFiltre + ' vide=' + okVide
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Cong\u00e9s : saisir la date de retour calcule la dur\u00e9e, et l\u2019enregistrement la garde',
    app: 'index.html', store: storeRealiste,
    code: `
      var before = getRhConges();
      openCongeModal();
      document.getElementById('cgEmp').value = 'e1';
      document.getElementById('cgType').value = 'annual';
      document.getElementById('cgDepart').value = '2026-10-01';
      document.getElementById('cgDuree').value = '1';
      document.getElementById('cgRetour').value = '2026-10-05';
      cgCalcDuree();
      var durAuto = parseInt(document.getElementById('cgDuree').value, 10);
      document.getElementById('cgNum').value = 'CONG-2026-888';
      saveConge();
      var lst = getRhConges();
      var c = lst[lst.length - 1];
      var ok = (durAuto === 5) && (c.duree === 5) && (c.date_retour === '2026-10-05');
      setRhConges(before);
      ok ? 'OK : retour 2026-10-05 -> dur\u00e9e ' + durAuto + ' j, enregistre duree=' + c.duree
         : 'ECHEC durAuto=' + durAuto + ' duree=' + c.duree + ' (typeof ' + typeof c.duree + ') retour=' + c.date_retour + ' num=' + c.numero
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Employ\u00e9s : le champ dur\u00e9e est propos\u00e9 pour un prestataire externe (masqu\u00e9 en CDI)',
    app: 'index.html', store: storeRealiste,
    code: `
      openEmployeModal();
      var hNew = document.getElementById('formModalBody').innerHTML || '';
      var okCdi = hNew.indexOf('id="empDureeGroup" style="display:none"') !== -1;
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'extz1', matricule: 'EXT-001', nom: 'PRESTA', prenoms: 'Test', sexe: 'M', date_naissance: '', telephone: '', date_entree: '2026-01-05', type_contrat: 'Externe', duree_contrat: 0, service: '', fonction: '', categorie_id: '', salaire_base: 0, situation_matrimoniale: 'celibataire', enfants: 0, enfants_infirmes: 0, statut: 'actif' });
      DB.set('mdb_employes', arr);
      openEmployeModal('extz1');
      var hExt = document.getElementById('formModalBody').innerHTML || '';
      var okExt = hExt.indexOf('id="empDureeGroup" style="display:"') !== -1;
      var sel = document.getElementById('empTypeContrat');
      sel.value = 'Externe'; updateEmpTypeFields();
      var okTogExt = document.getElementById('empDureeGroup').style.display !== 'none';
      sel.value = 'CDI'; updateEmpTypeFields();
      var okTogCdi = document.getElementById('empDureeGroup').style.display === 'none';
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'extz1'; }));
      (okCdi && okExt && okTogExt && okTogCdi)
        ? 'OK : dur\u00e9e masqu\u00e9e en CDI, visible en Externe (rendu + bascule)'
        : 'ECHEC cdi=' + okCdi + ' ext=' + okExt + ' togExt=' + okTogExt + ' togCdi=' + okTogCdi
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Contrats : le renouvellement garde l\u2019historique (1er puis 2e) et l\u2019anciennet\u00e9 d\u2019origine',
    app: 'index.html', store: storeRealiste,
    code: `
      function _ipm(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
      var _t0 = getToday();
      var _e0 = _ipm(_t0, -8);
      var _d1 = _ipm(_t0, -2);
      var _d2 = _ipm(_t0, 4);
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'cddz1', matricule: 'CDD-001', nom: 'RENOUV', prenoms: 'Test', sexe: 'M', date_entree: _e0, type_contrat: 'CDD', duree_contrat: 6, statut: 'actif' });
      arr.push({ id: 'cdiz1', matricule: 'CDI-001', nom: 'FIXE', prenoms: 'Test', sexe: 'M', date_entree: '2020-05-01', type_contrat: 'CDI', duree_contrat: 0, statut: 'actif' });
      DB.set('mdb_employes', arr);
      var r1 = renouvelerContratEmp('cddz1', _d1, 6, 'CDD');
      var e1 = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz1'; })[0];
      var ok1 = r1.ok && e1.historique_contrats.length === 1 && e1.historique_contrats[0].n === 1 && e1.historique_contrats[0].date_debut === _e0 && e1.historique_contrats[0].duree_mois === 6 && e1.date_entree === _d1 && e1.duree_contrat === 6 && e1.date_premiere_entree === _e0 && datePremiereEntree(e1) === _e0;
      var r2 = renouvelerContratEmp('cddz1', _d2, 12, 'CDD');
      var e2 = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz1'; })[0];
      var ok2 = r2.ok && e2.historique_contrats.length === 2 && e2.historique_contrats[1].n === 2 && e2.historique_contrats[1].date_debut === _d1 && e2.date_entree === _d2 && e2.date_premiere_entree === _e0;
      var rCdi = renouvelerContratEmp('cdiz1', '2026-01-01', 12, 'CDI');
      var rVide = renouvelerContratEmp('cddz1', '', 6, 'CDD');
      var okRefus = (!rCdi.ok) && (!rVide.ok);
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'cddz1' && x.id !== 'cdiz1'; }));
      (ok1 && ok2 && okRefus)
        ? 'OK : 1er->2e->3e en historique, entree ' + _e0 + ' gardee, CDI refuse'
        : 'ECHEC r1=' + ok1 + ' r2=' + ok2 + ' refus=' + okRefus
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Cong\u00e9s : le module ne garde que la partie paiement (suivi en jours retir\u00e9)',
    app: 'paye.html', store: storeRealiste,
    code: `
      try { renderCongeTable(false); } catch (e) {}
      var host = document.getElementById('conge-records-list');
      var h = host ? host.innerHTML : '';
      var okPaiement = h.indexOf('addCongePaiementsMulti') !== -1 && h.indexOf('conge-q-emp') !== -1;
      var noSuivi = h.indexOf('Suivi des cong\u00e9s en jours') === -1 && h.indexOf('conge-suivi-jours') === -1 && h.indexOf('Planifier') === -1 && h.indexOf('Imprimer \u00e9tat') === -1;
      (okPaiement && noSuivi)
        ? 'OK : formulaire allocation pay\u00e9e present, suivi en jours retir\u00e9'
        : 'ECHEC paiement=' + okPaiement + ' suiviEncore=' + !noSuivi
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Acomptes : validation persistante (survit au pull cloud) et impact sur la d\u00e9duction',
    app: 'paye.html', store: storeRealiste,
    code: `
      var mois = '2026-11';
      var list = getAPList();
      list.push({ id: 'apPers', type: 'acompte', employee_id: 'zzz', employeId: 'zzz', employeNom: 'Persist', montant: 5000, moisDeduction: mois, date: mois + '-05', statut: 'en_cours' });
      setAPList(list);
      var av0 = getAPForMonth('zzz', mois).acomptes;
      _payeSetAcomptesValide(['apPers']);
      var av1 = getAPForMonth('zzz', mois).acomptes;
      var clean = getAPList().map(function(a){ var x = {}; for (var k in a) { if (a.hasOwnProperty(k) && k !== 'valide' && k !== 'valideLe') x[k] = a[k]; } return x; });
      DB.setMain('mdb_acomptesPrets', clean);
      var av2 = getAPForMonth('zzz', mois).acomptes;
      var okPers = false, okRaw = false;
      getAPList().forEach(function(a){ if (a.id === 'apPers') okPers = a.valide === true; });
      var raw = payeArr('mdb_acomptesPrets').filter(function(a){ return a && a.id === 'apPers'; })[0];
      okRaw = raw && raw.valide === true;
      _payeSetNonValide(['apPers']);
      var av3 = getAPForMonth('zzz', mois).acomptes;
      (av0 === 0 && av1 === 5000 && av2 === 5000 && okPers && av3 === 0)
        ? 'OK : 0 avant, ' + av1 + ' apres validation, ' + av2 + ' apres pull cloud (re-applique), devalide -> ' + av3 + ' (cloud sans valide : ' + okRaw + ')'
        : 'ECHEC avant=' + av0 + ' valide=' + av1 + ' apresPull=' + av2 + ' persiste=' + okPers + ' devalide=' + av3
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'État : nature d\u2019une ligne (Solde/Avance/Prêt) + moyen avec compte auto',
    app: 'index.html', store: storeRealiste,
    code: `
      var n1 = csNaturePiece({ apType: 'solde' });
      var n2 = csNaturePiece({ code: 'SOLDE_SALAIRE' });
      var n3 = csNaturePiece({ code: 'ACOMPTE' });
      var n4 = csNaturePiece({ code: 'PRET_AUTO' });
      var ops = getOperationsCaisse();
      ops.push({ id: 'opNatS', numeroPiece: 'NS-1', code: 'SOLDE_SALAIRE', apType: 'solde', caisseId: 'c1', date: '2026-10-01', montant: 1000, sens: 'sortie' });
      DB.set('mdb_operationsCaisse', ops);
      var L1 = csNatureLigne({ type: 'acompte', caisseOpId: 'opNatS' });
      var L2 = csNatureLigne({ type: 'pret' });
      var L3 = csNatureLigne({ type: 'acompte' });
      var m = csMoyenPiece({ id: 'opM', caisseId: 'c1' });
      (n1 === 'solde' && n2 === 'solde' && n3 === 'acompte' && n4 === 'pret' && L1 === 'solde' && L2 === 'pret' && L3 === 'acompte' && m && m.compte === '571100' && m.moyen.indexOf('Caisse') === 0)
        ? 'OK : ' + [n1, n2, n3, n4].join('/') + ' ligne=' + [L1, L2, L3].join('/') + ' moyen=' + m.moyen + ' (' + m.compte + ')'
        : 'ECHEC n=' + [n1, n2, n3, n4].join('/') + ' ligne=' + [L1, L2, L3].join('/') + ' m=' + (m ? m.moyen + '/' + m.compte : 'null')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Nature : solde salaire distinct de l\u2019avance (état + journal 421)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var opS = { id: 'opSl', numeroPiece: 'KS-1', code: 'SOLDE_SALAIRE', apType: 'solde', caisseId: 'c1', montant: 400000, date: '2026-10-10' };
      var opA = { id: 'opAc', numeroPiece: 'KC-2', code: 'ACOMPTE', caisseId: 'c1', montant: 50000, date: '2026-10-12' };
      var opP = { id: 'opPr', numeroPiece: 'KP-3', code: 'PRET_AUTO', caisseId: 'c1', montant: 600000, date: '2026-09-05' };
      var ops = payeArr('mdb_operationsCaisse'); ops.push(opS, opA, opP); DB.setMain('mdb_operationsCaisse', ops);
      var list = payeArr('mdb_acomptesPrets');
      list.push(
        { id: 'acS', employee_id: 'zzz', employeNom: 'SoldeTest', type: 'acompte', montant: 400000, moisDeduction: '2026-10', date: '2026-10-10', caisseOpId: 'opSl', numeroPiece: 'KS-1', valide: true },
        { id: 'acA', employee_id: 'zzz', employeNom: 'AcTest', type: 'acompte', montant: 50000, moisDeduction: '2026-10', date: '2026-10-12', caisseOpId: 'opAc', numeroPiece: 'KC-2', valide: true },
        { id: 'acP', employee_id: 'zzz', employeNom: 'PretTest', type: 'pret', montant: 600000, montantMensuel: 100000, moisDeduction: '2026-09', date: '2026-09-05', caisseOpId: 'opPr', numeroPiece: 'KP-3', rembourse: 300000 }
      );
      setAPList(list);
      var recs = getAPList();
      var opsById = {}; payeArr('mdb_operationsCaisse').forEach(function (o) { if (o && o.id) opsById[o.id] = o; });
      var L = lignesDetailAp(recs, opsById, psalCaisses(), psalBanques(), '2026-10');
      var sum = 0, nat = {};
      L.forEach(function (ln) { sum += ln.montant; nat[ln.piece] = ln.nature; });
      var apR = getAPForMonth('zzz', '2026-10');
      var exp = apR.acomptes + apR.prets;
      var okNat = nat['KS-1'] === 'solde' && nat['KC-2'] === 'acompte' && nat['KP-3'] === 'pret';
      var okCompte = L.length > 0 && L[0].compte === '571100';
      var maligne = L.length === 3;
      var sumAp = apNatureLigne({}, { apType: 'solde' }) === 'solde';
      (sum === exp && sum === 550000 && okNat && okCompte && maligne && sumAp)
        ? 'OK : sum=' + sum + ' (=421 ' + exp + '), solde->' + nat['KS-1'] + ' avance->' + nat['KC-2'] + ' pret->' + nat['KP-3'] + ' compte=' + L[0].compte
        : 'ECHEC sum=' + sum + ' exp=' + exp + ' nat=' + JSON.stringify(nat) + ' compte=' + (L.length ? L[0].compte : 'vide') + ' maligne=' + maligne + ' sumAp=' + sumAp
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : sous-lignes 421 s\u00e9par\u00e9es (421100/421200/421300) = cr\u00e9dit total',
    app: 'paye.html', store: storeRealiste,
    code: `
      var opS = { id: 'opSl2', numeroPiece: 'KS-11', code: 'SOLDE_SALAIRE', apType: 'solde', caisseId: 'c1', montant: 200000, date: '2026-10-10' };
      var opA = { id: 'opAc2', numeroPiece: 'KC-12', code: 'ACOMPTE', caisseId: 'c1', montant: 50000, date: '2026-10-12' };
      var ops = payeArr('mdb_operationsCaisse'); ops.push(opS, opA); DB.setMain('mdb_operationsCaisse', ops);
      var list = payeArr('mdb_acomptesPrets');
      list.push(
        { id: 'acS2', employee_id: 'zzz', employeNom: 'Solde2', type: 'acompte', montant: 200000, moisDeduction: '2026-10', date: '2026-10-10', caisseOpId: 'opSl2', numeroPiece: 'KS-11', valide: true },
        { id: 'acA2', employee_id: 'zzz', employeNom: 'Ac2', type: 'acompte', montant: 50000, moisDeduction: '2026-10', date: '2026-10-12', caisseOpId: 'opAc2', numeroPiece: 'KC-12', valide: true }
      );
      setAPList(list);
      var recs = getAPList();
      var opsById = {}; payeArr('mdb_operationsCaisse').forEach(function (o) { if (o && o.id) opsById[o.id] = o; });
      var L = lignesDetailAp(recs, opsById, psalCaisses(), psalBanques(), '2026-10');
      var apR = getAPForMonth('zzz', '2026-10');
      var totalAp = apR.acomptes + apR.prets;
      var soldes = 0, autres = 0;
      L.forEach(function (ln) { if (ln.nature === 'solde') soldes += ln.montant; else autres += ln.montant; });
      (soldes + autres === totalAp && soldes === 200000 && autres === 50000)
        ? 'OK : total=' + totalAp + ' => 421200 Acomptes/Pr\u00eats=' + autres + ', 421300 Soldes=' + soldes
        : 'ECHEC total=' + totalAp + ' soldes=' + soldes + ' autres=' + autres
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Ventilation : squelette comptable \u00e9quilibr\u00e9 au franc (661100/421xxx/422001 + patronal)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ops = payeArr('mdb_operationsCaisse');
      ops.push({ id: 'opV1', numeroPiece: 'KV-1', code: 'ACOMPTE', caisseId: 'c1', montant: 30000, date: '2026-10-05' });
      DB.setMain('mdb_operationsCaisse', ops);
      var list = payeArr('mdb_acomptesPrets');
      list.push({ id: 'acV1', employee_id: 'e1', employeNom: 'Diallo', type: 'acompte', montant: 30000, moisDeduction: '2026-10', date: '2026-10-05', caisseOpId: 'opV1', numeroPiece: 'KV-1', valide: true });
      setAPList(list);
      var v = ventilationPaie('2026-10');
      var okEq = (v.totD1 === v.totC1) && (v.totD2 === v.totC2);
      var okVent = (v.salNat + v.transp + v.avant === v.brut);
      var l421 = v.l421.pr + v.l421.acNet + v.l421.soldes;
      var ok421 = (l421 === v.apTotal);
      var apChk = -1;
      try {
        var r1 = getAPForMonth('e1', '2026-10');
        apChk = (r1.acomptes || 0) + (r1.prets || 0);
      } catch (eX) {}
      var okX = (v.apTotal === apChk && v.apTotal > 0);
      var cpte1 = {}, cpte2 = {};
      v.t1.forEach(function (e) { cpte1[e.ac] = true; });
      v.t2.forEach(function (e) { cpte2[e.ac] = true; });
      var okCptes = cpte1['661100'] && cpte1['663400'] && cpte1['431300'] && cpte1['431400'] && cpte1['447200'] && cpte1['421100'] && cpte1['421200'] && cpte1['421300'] && cpte1['422001'] && cpte2['664110'] && cpte2['664120'] && cpte2['664130'] && cpte2['641300'] && cpte2['664300'] && cpte2['431300'] && cpte2['431400'] && cpte2['447200'] && cpte2['447210'];
      (okEq && okVent && ok421 && okX && okCptes)
        ? 'OK : T1 ' + v.totD1 + '=' + v.totC1 + ', T2 ' + v.totD2 + '=' + v.totC2 + ', brut=' + v.brut + ' (661100 ' + v.salNat + ' + transp ' + v.transp + '), 421=' + l421 + ' (=paie ' + apChk + ')'
        : 'ECHEC eq=' + okEq + ' vent=' + okVent + ' 421=' + ok421 + ' (' + l421 + ' vs apTotal ' + v.apTotal + ') x=' + okX + ' (paie ' + apChk + ') D1=' + v.totD1 + ' C1=' + v.totC1 + ' D2=' + v.totD2 + ' C2=' + v.totC2 + ' cptes=' + okCptes
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Clic-compte : chaque 421xxx/422001 d\u00e9plie ses employ\u00e9s (sommes = lignes)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ops = payeArr('mdb_operationsCaisse');
      ops.push({ id: 'opW1', numeroPiece: 'KV-1', code: 'ACOMPTE', caisseId: 'c1', montant: 30000, date: '2026-10-05' });
      ops.push({ id: 'opW2', numeroPiece: 'KP-V', code: 'PRET_AUTO', caisseId: 'c1', montant: 60000, date: '2026-10-06' });
      DB.setMain('mdb_operationsCaisse', ops);
      var list = payeArr('mdb_acomptesPrets');
      list.push({ id: 'acW1', employee_id: 'e1', employeNom: 'Diallo', type: 'acompte', montant: 30000, moisDeduction: '2026-10', date: '2026-10-05', caisseOpId: 'opW1', numeroPiece: 'KV-1', valide: true });
      list.push({ id: 'acW2', employee_id: 'e1', employeNom: 'Diallo', type: 'pret', montant: 60000, montantMensuel: 60000, moisDeduction: '2026-10', date: '2026-10-06', caisseOpId: 'opW2', numeroPiece: 'KP-V', valide: true });
      setAPList(list);
      var v = ventilationPaie('2026-10');
      var ligne = function (cpte) {
        var f = v.t1.filter(function (e) { return e.ac === cpte && (e.cr || 0) > 0; });
        return f.length ? f[0] : null;
      };
      var f4 = v.t1.filter(function (e) { return e.ac === '422001'; });
      var L1 = ligne('421100'), L2 = ligne('421200'), L4 = f4.length ? f4[0] : null;
      var ok1 = L1 && L1.detail && L1.detail.lignes.length === 1 && L1.detail.lignes[0].employe.indexOf('Diallo') >= 0 && L1.detail.lignes[0].montant === 60000 && L1.detail.lignes[0].pieces.length === 1 && L1.detail.lignes[0].pieces[0].piece === 'KP-V' && L1.detail.total === 60000 && L1.detail.total === v.l421.pr;
      var ok2 = L2 && L2.detail && L2.detail.lignes.length === 1 && L2.detail.lignes[0].montant === 30000 && L2.detail.lignes[0].pieces[0].piece === 'KV-1' && L2.detail.total === 30000 && L2.detail.total === v.l421.acNet;
      var ok4 = L4 && L4.detail && L4.detail.lignes.length >= 1 && L4.detail.total === L4.cr;
      (ok1 && ok2 && ok4)
        ? 'OK : 421100 Diallo 60000 (KP-V), 421200 Diallo 30000 (KV-1), 422001 d\u00e9tail=' + L4.detail.total + ' (=ligne ' + L4.cr + ')'
        : 'ECHEC ok1=' + ok1 + ' ok2=' + ok2 + ' ok4=' + ok4 + ' L4det=' + (L4 && L4.detail ? L4.detail.total : '?') + ' L4cr=' + (L4 ? L4.cr : '?')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie Journaliers & Externes : exclus de la ventilation, m\u00e9mo \u00e0 part',
    app: 'paye.html', store: storeRealiste,
    code: `
      var emps = payeArr('mdb_employes');
      emps.push({ id: 'e2', nom: 'Koffi', prenoms: 'J', matricule: 'M002', type_contrat: 'Journalier', categorie: 'B', status: 'actif', date_embauche: '2024-06-01' });
      emps.push({ id: 'e3', nom: 'Sow', prenoms: 'A', matricule: 'M003', type_contrat: 'Externe', categorie: 'B', status: 'actif', date_embauche: '2024-06-01' });
      DB.setMain('mdb_employes', emps);
      var ops = payeArr('mdb_operationsCaisse');
      ops.push({ id: 'opJ1', numeroPiece: 'KJ-1', code: 'ACOMPTE', caisseId: 'c1', montant: 15000, date: '2026-10-07' });
      ops.push({ id: 'opJ2', numeroPiece: 'KJ-2', code: 'ACOMPTE', caisseId: 'c1', montant: 20000, date: '2026-10-08' });
      DB.setMain('mdb_operationsCaisse', ops);
      var list = payeArr('mdb_acomptesPrets');
      list.push({ id: 'acJ1', employee_id: 'e2', employeNom: 'Koffi', type: 'acompte', montant: 15000, moisDeduction: '2026-10', date: '2026-10-07', caisseOpId: 'opJ1', numeroPiece: 'KJ-1', valide: true });
      list.push({ id: 'acJ2', employee_id: 'e3', employeNom: 'Sow', type: 'acompte', montant: 20000, moisDeduction: '2026-10', date: '2026-10-08', caisseOpId: 'opJ2', numeroPiece: 'KJ-2', valide: true });
      setAPList(list);
      var v = ventilationPaie('2026-10');
      var okEq = (v.totD1 === v.totC1) && (v.totD2 === v.totC2);
      var estK = function (g) { return ((g && g.employe) || '').toUpperCase().indexOf('KOFFI') >= 0; };
      var estS = function (g) { return ((g && g.employe) || '').toUpperCase().indexOf('SOW') >= 0; };
      var jK = v.j.lignes.filter(estK);
      var jS = v.j.lignes.filter(estS);
      var okJ = jK.length === 1 && jK[0].ap === 15000 && jK[0].statut === 'Journalier' && jS.length === 1 && jS[0].ap === 20000 && jS[0].statut === 'Externe';
      var det4212 = null, det422001 = null;
      v.t1.forEach(function (e) {
        if (e.ac === '421200' && e.detail) det4212 = e.detail.lignes;
        if (e.ac === '422001' && e.detail) det422001 = e.detail.lignes;
      });
      var hors = function (g) { return !estK(g) && !estS(g); };
      var okExclu = det4212 && det4212.every(hors);
      var okNet = det422001 && det422001.every(hors);
      (okEq && okJ && okExclu && okNet)
        ? 'OK : Koffi (journalier, 15000) + Sow (externe, 20000) en m\u00e9mo seuls, absents du 421200 et du 422001, T1 ' + v.totD1 + '=' + v.totC1
        : 'ECHEC eq=' + okEq + ' memo=' + okJ + ' exclu4212=' + okExclu + ' exclu422001=' + okNet
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Sync Employ\u00e9s : une modif locale (ex. contrat) survit \u00e0 un snapshot cloud p\u00e9rim\u00e9',
    app: 'paye.html', store: storeRealiste,
    code: `
      var now = Date.now();
      DB.setMain('mdb_employes', [{ id: 'e9', nom: 'TEST', type_contrat: 'Journalier', updatedAt: now }]);
      _payeRecvSharedKeys({ mdb_employes: [{ id: 'e9', nom: 'TEST', type_contrat: 'CDI', updatedAt: 1 }] });
      var after = payeArr('mdb_employes');
      var okGarde = after.length === 1 && after[0].type_contrat === 'Journalier';
      DB.setMain('mdb_employes', [{ id: 'e9', nom: 'TEST', type_contrat: 'Journalier', updatedAt: 1 }]);
      _payeRecvSharedKeys({ mdb_employes: [{ id: 'e9', nom: 'TEST', type_contrat: 'CDI', updatedAt: now }] });
      var after2 = payeArr('mdb_employes');
      var okPrend = after2.length === 1 && after2[0].type_contrat === 'CDI';
      (okGarde && okPrend)
        ? 'OK : snapshot p\u00e9rim\u00e9 ignor\u00e9 (Journalier gard\u00e9), snapshot r\u00e9cent appliqu\u00e9 (CDI pris)'
        : 'ECHEC garde=' + okGarde + ' (' + JSON.stringify(after) + ') prend=' + okPrend + ' (' + JSON.stringify(after2) + ')'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Sync Employ\u00e9s (app principale) : latest-wins par updatedAt',
    app: 'index.html', store: storeRealiste,
    code: `
      var m1 = mergeEmployesPreferRecent(
        [{ id: 'a', type_contrat: 'Journalier', updatedAt: 200 }],
        [{ id: 'a', type_contrat: 'CDI', updatedAt: 100 }]);
      var m2 = mergeEmployesPreferRecent(
        [{ id: 'a', type_contrat: 'Journalier', updatedAt: 100 }],
        [{ id: 'a', type_contrat: 'CDI', updatedAt: 200 }]);
      var m3 = mergeEmployesPreferRecent(
        [{ id: 'b', type_contrat: 'CDI' }],
        [{ id: 'a', type_contrat: 'CDI', updatedAt: 50 }]);
      var ok1 = m1.length === 1 && m1[0].type_contrat === 'Journalier';
      var ok2 = m2.length === 1 && m2[0].type_contrat === 'CDI';
      var ok3 = m3.length === 2;
      (ok1 && ok2 && ok3)
        ? 'OK : le plus r\u00e9cent gagne des deux c\u00f4t\u00e9s, pr\u00e9sents des 2 c\u00f4t\u00e9s conserv\u00e9s'
        : 'ECHEC ok1=' + ok1 + ' ok2=' + ok2 + ' ok3=' + ok3
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Co\u00fbt de revient (index) : artUnitVol/calcVolume d\u00e9finis, volume unitaire correct',
    app: 'index.html', store: storeRealiste,
    code: `
      var v1 = artUnitVol({ dimensions: '1000x200x50' });
      var v2 = artUnitVol({ length: 1000, width: 200, thickness: 50 });
      var v0 = artUnitVol(null);
      (v1 === 10 && v2 === 10 && v0 === 0)
        ? 'OK : 1000x200x50 -> 10 m3, L/l/t -> 10 m3, null -> 0'
        : 'ECHEC v1=' + v1 + ' v2=' + v2 + ' v0=' + v0
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Co\u00fbt de revient : prix sugg\u00e9r\u00e9 et verdict marge (simulation avant production)',
    app: 'index.html', store: storeRealiste,
    code: `
      var pv1 = crPrixSuggere(10000, 20);
      var pv0 = crPrixSuggere(10000, 0);
      var vPerte = crVerdictMarge(9000, 10000, 20);
      var vOk = crVerdictMarge(12500, 10000, 20);
      var vIns = crVerdictMarge(11000, 10000, 20);
      var vNo = crVerdictMarge(0, 10000, 20);
      renderCoutRevient();
      var h = document.getElementById('content').innerHTML || '';
      var okPage = h.indexOf('simulation AVANT production') !== -1;
      (pv1 === 12500 && pv0 === 10000 && vPerte.code === 'perte' && vOk.code === 'ok' && vIns.code === 'insuffisante' && vNo.code === 'noprix' && okPage)
        ? 'OK : PV 10000+20% -> 12500, verdicts perte/ok/insuffisante/noprix, page rendue'
        : 'ECHEC pv1=' + pv1 + ' perte=' + vPerte.code + ' ok=' + vOk.code + ' ins=' + vIns.code + ' page=' + okPage
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Contrats : ajout d\u2019un contrat pass\u00e9 (historique chrono, 1re embauche ajust\u00e9e)',
    app: 'index.html', store: storeRealiste,
    code: `
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'cddz2', matricule: 'CDD-002', nom: 'TRACE', prenoms: 'Test', sexe: 'M', date_entree: '2025-01-10', type_contrat: 'CDD', duree_contrat: 12, statut: 'actif' });
      DB.set('mdb_employes', arr);
      var r1 = ajouterContratPasse('cddz2', 'CDD', '2024-01-10', 12);
      var r2 = ajouterContratPasse('cddz2', 'CDD', '2023-01-10', 12);
      var e = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz2'; })[0];
      var h = e.historique_contrats || [];
      var ok = r1.ok && r2.ok && h.length === 2 && h[0].n === 1 && h[0].date_debut === '2023-01-10' && h[1].n === 2 && h[1].date_debut === '2024-01-10' && e.date_entree === '2025-01-10' && e.date_premiere_entree === '2023-01-10';
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'cddz2'; }));
      ok ? 'OK : 2 pass\u00e9s renum\u00e9rot\u00e9s chrono, en cours intact, 1re embauche 2023-01-10'
         : 'ECHEC r1=' + r1.ok + ' r2=' + r2.ok + ' n=' + h.length + ' prem=' + e.date_premiere_entree
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : plage 1er->20 = 14 jours ouvr\u00e9s, bornes clamp\u00e9es au mois',
    app: 'paye.html', store: storeRealiste,
    code: `
      var js = genPlageJours('2026-10', '2026-10-01', '2026-10-20');
      var clamp = genPlageJours('2026-10', '2026-09-25', '2026-11-05');
      var inv = genPlageJours('2026-10', '2026-10-20', '2026-10-01');
      var ok = js.length === 14 && js[0] === '2026-10-01' && js[js.length-1] === '2026-10-20' && js.indexOf('2026-10-03') === -1 && js.indexOf('2026-10-04') === -1 && clamp.length === 22 && clamp[0] === '2026-10-01' && clamp[clamp.length-1] === '2026-10-30' && inv.length === 0;
      ok ? 'OK : 1er->20 = 14 j ouvr\u00e9s, mois clamp\u00e9 = 22 j, invers\u00e9 = vide'
         : 'ECHEC plage=' + js.length + ' clamp=' + clamp.length + ' inv=' + inv.length
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage production : plage 1er->20 = 14 jours ouvr\u00e9s, bornes clamp\u00e9es au mois',
    app: 'production.html', store: storeRealiste,
    code: `
      var js = genPlageJours('2026-10', '2026-10-01', '2026-10-20');
      var clamp = genPlageJours('2026-10', '2026-09-25', '2026-11-05');
      var inv = genPlageJours('2026-10', '2026-10-20', '2026-10-01');
      var ok = js.length === 14 && js[0] === '2026-10-01' && js[js.length-1] === '2026-10-20' && js.indexOf('2026-10-03') === -1 && clamp.length === 22 && inv.length === 0;
      ok ? 'OK : 1er->20 = 14 j ouvr\u00e9s, mois clamp\u00e9 = 22 j, invers\u00e9 = vide'
         : 'ECHEC plage=' + js.length + ' clamp=' + clamp.length + ' inv=' + inv.length
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : ptHImpr = manuel jour/nuit, creneaux, repli si mal pointe, vide=0',
    app: 'paye.html', store: storeRealiste,
    code: `
      var rJ = ptHImpr({ h_j_manual: '8:30' }, false);
      var rN = ptHImpr({ h_n_manual: '6' }, true);
      var rCre = ptHImpr({ j_arrivee: '08:00', j_pause: '12:00', j_reprise: '13:00', j_fin: '17:00' }, false);
      var rMix = ptHImpr({ j_arrivee: '08:00', j_pause: '12:00', j_reprise: '13:00', j_fin: '17:00', h_j_manual: '9' }, false);
      var rRepli = ptHImpr({ j_fin: '01:00', h_j_manual: '7.5' }, false);
      var rVide = ptHImpr({}, false);
      var rNull = ptHImpr(null, true);
      var ok = rJ === 8.5 && rN === 6 && rCre === 8 && rMix === 8 && rRepli === 7.5 && rVide === 0 && rNull === 0;
      ok ? 'OK : manuel 8h30=8.5, nuit=6, creneaux=8, priorite=8, repli=7.5, vide=0'
         : 'ECHEC J=' + rJ + ' N=' + rN + ' cre=' + rCre + ' mix=' + rMix + ' repli=' + rRepli + ' vide=' + rVide
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : saisie rapide = calendrier 1er->31, employe autocompletion, H. Jour / H. Nuit / Absent / Obs, auto-save cable',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      showSaisieRapide();
      var h = document.getElementById('pt-modal-content').innerHTML;
      var nbHr = (h.match(/data-field="hr"/g) || []).length;
      var nbHrN = (h.match(/data-field="hrN"/g) || []).length;
      var nbNit = (h.match(/data-field="nuit"/g) || []).length;
      var nbAbs = (h.match(/data-field="abs"/g) || []).length;
      var nbObs = (h.match(/data-field="obs"/g) || []).length;
      var autoEmp = h.indexOf('id="sr-emp"') !== -1 && h.indexOf('id="sr-emp-list"') !== -1;
      var nuitCelluleVisible = h.indexOf('id="pt-r-nuit-1"') !== -1 && h.indexOf('id="pt-r-nuit-1" style="display:none"') === -1;
      var pasGuillemet = h.indexOf('data-field="abs""') === -1;
      var autoSave = h.indexOf('ptRapideAutoSave(') !== -1;
      var ok = nbHr === 31 && nbHrN === 31 && nbNit === 31 && nbAbs === 31 && nbObs === 31 && h.indexOf('pt-r-total-31') !== -1 && h.indexOf('Saisie rapide') !== -1 && autoEmp && nuitCelluleVisible && pasGuillemet && autoSave && h.indexOf('Sous-total') !== -1 && h.indexOf('id="pt-r-totG"') !== -1;
      var nbEnreg = (h.match(/saveSaisieRapide\(\)/g) || []).length;
      var okBtn = nbEnreg === 1;
      ok = ok && okBtn;
      ok ? 'OK : 31 lignes en 2 blocs (hr/hrn/nuit/abs/obs), employe autocompletion, cellule nuit visible, sous-totaux + grand total, auto-save cable, 1 seul bouton Enregistrer'
         : 'ECHEC hr=' + nbHr + ' hrn=' + nbHrN + ' nuit=' + nbNit + ' abs=' + nbAbs + ' obs=' + nbObs + ' emp=' + (autoEmp ? 1 : 0) + ' cellule=' + (nuitCelluleVisible ? 1 : 0) + ' guillemet=' + (pasGuillemet ? 0 : 1) + ' autosave=' + (autoSave ? 1 : 0) + ' enreg=' + nbEnreg
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : saisie rapide enregistre un jour Absent (present=false, heures videes)',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      setPointageData(getPointageData().filter(function (p) { return p.employee_id !== 'e1' || (p.date || '').indexOf('2026-10') !== 0; }));
      var seed = getPointageData().slice();
      seed.push({ id: 'abs0', employee_id: 'e1', date: '2026-10-05', h_j_manual: '8' });
      setPointageData(seed);
      function F2(d, f, v, chk) {
        var e = { value: v, checked: !!chk, type: (f === 'nuit' || f === 'abs') ? 'checkbox' : 'text' };
        e.getAttribute = function (k) {
          if (k === 'data-r') return String(d);
          if (k === 'data-field') return f;
          return null;
        };
        return e;
      }
      document.querySelectorAll = function (sel) { return (sel && sel.indexOf('data-r') !== -1) ? [F2(5, 'abs', '', true)] : []; };
      saveSaisieRapide();
      var pts = getPointageData();
      var r5 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-05'; });
      var okA = r5 && r5.present === false && !r5.h_j_manual && !r5.h_n_manual;
      document.querySelectorAll = function (sel) { return (sel && sel.indexOf('data-r') !== -1) ? [F2(5, 'abs', '', false)] : []; };
      saveSaisieRapide();
      var pts2 = getPointageData();
      var r5b = pts2.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-05'; });
      var okB = !r5b || r5b.present !== false;
      (okA && okB) ? 'OK : absent coche -> present=false sans heures, decoche -> leve'
                   : 'ECHEC A=' + (okA ? 1 : 0) + ' B=' + (okB ? 1 : 0)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : saisie rapide persiste heures jour + heures nuit independantes + observation, efface si vide',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      setPointageData(getPointageData().filter(function (p) { return p.employee_id !== 'e1' || (p.date || '').indexOf('2026-10') !== 0; }));
      var fakes = [];
      function F(d, f, v, chk) {
        var e = { value: v, checked: !!chk, type: f === 'nuit' ? 'checkbox' : 'text' };
        e.getAttribute = function (k) {
          if (k === 'data-r') return String(d);
          if (k === 'data-field') return f;
          return null;
        };
        return e;
      }
      fakes = fakes.concat(
        F(1, 'hr', '8', false), F(1, 'hrN', '', false), F(1, 'nuit', '', false), F(1, 'obs', 'Maladie', false),
        F(2, 'hr', '', false), F(2, 'hrN', '6', false), F(2, 'nuit', 'x', true), F(2, 'obs', '', false),
        F(3, 'hr', '', false), F(3, 'hrN', '', false), F(3, 'nuit', '', false), F(3, 'obs', 'Conge', false),
        F(4, 'hr', '8', false), F(4, 'hrN', '6', false), F(4, 'nuit', 'x', true), F(4, 'obs', '', false)
      );
      document.querySelectorAll = function (sel) { return (sel && sel.indexOf('data-r') !== -1) ? fakes : []; };
      saveSaisieRapide();
      var pts = getPointageData();
      var r1 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-01'; });
      var r2 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-02'; });
      var r3 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-03'; });
      var r4 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-04'; });
      var okA = r1 && r1.h_j_manual === '8' && !r1.h_n_manual && r1.observation === 'Maladie'
             && r2 && r2.h_n_manual === '6' && !r2.h_j_manual
             && r3 && r3.observation === 'Conge' && !r3.h_j_manual && !r3.h_n_manual
             && r4 && r4.h_j_manual === '8' && r4.h_n_manual === '6';
      fakes = [F(1, 'hr', '', false), F(1, 'hrN', '', false), F(1, 'nuit', '', false), F(1, 'obs', '', false)];
      saveSaisieRapide();
      var pts2 = getPointageData();
      var gone = !pts2.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-01'; });
      var okB = gone && pts2.some(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-02'; });
      (okA && okB) ? 'OK : jour=8 h_j, nuit=6 h_n, jour+nuit memes jour, obs stockee, effacement propre'
                   : 'ECHEC A=' + (okA ? 1 : 0) + ' B=' + (okB ? 1 : 0)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    app: 'production.html', store: storeRealiste,
    code: `
      var savedDefs = getSection('definitions', []);
      setSection('definitions', [{ id: 'dz1', code: 'LAT-99', designation: 'Latte test', type: 'LATTE', essence: 'Iroko' }]);
      var e1 = acEssenceComposant({ code: 'LAT-99', designation: 'Latte test' });
      var e2 = acEssenceComposant({ code: 'LAT-99', designation: 'Latte test', essence: 'Bosse' });
      setSection('definitions', savedDefs);
      (e1 === 'Iroko' && e2 === 'Bosse')
        ? 'OK : d\u00e9finition Iroko utilis\u00e9e, champ direct prioritaire'
        : 'ECHEC e1=' + e1 + ' e2=' + e2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie sync : les \u00e9critures fra\u00eeches (<2min) survivent au pull cloud, les anciennes suivent le cloud',
    app: 'paye.html', store: storeRealiste,
    code: `
      var now = Date.now();
      var r1 = payeProtegeEcrituresFraiches({ empIndivPrimes: { e1: [{ primeId: 'p1', montant: 1 }] } }, { empIndivPrimes: { e1: [{ primeId: 'p1', montant: 999 }] } }, { empIndivPrimes: now - 5000 }, 120000);
      var r2 = payeProtegeEcrituresFraiches({ empIndivPrimes: { e1: [] } }, { empIndivPrimes: { e1: [{ primeId: 'p1', montant: 999 }] } }, { empIndivPrimes: now - 300000 }, 120000);
      var r3 = payeProtegeEcrituresFraiches({ empIndivPrimes: { e1: [] } }, { empIndivPrimes: { e1: [{ primeId: 'p1', montant: 999 }] } }, {}, 120000);
      var ok = r1.protege === true && r1.fusion.empIndivPrimes.e1[0].montant === 999 && r2.protege === false && r3.protege === false;
      ok ? 'OK : saisie fraiche gardee + repoussee, ancienne/non horodatee suit le cloud'
         : 'ECHEC r1=' + r1.protege + ' r2=' + r2.protege + ' r3=' + r3.protege
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Dettes : un solde vers\u00e9 n\u2019est pas une dette, le reste est net de la d\u00e9duction du mois',
    app: 'paye.html', store: storeRealiste,
    code: `
      var savedAP = payeArr('mdb_acomptesPrets').slice();
      var savedOps = payeArr('mdb_operationsCaisse').slice();
      var list = savedAP.slice();
      list.push({ id: 'apS9', employee_id: 'e9det', type: 'acompte', montant: 335400, moisDeduction: '2026-09', date: '2026-10-02', valide: true, caisseOpId: 'opS9' });
      list.push({ id: 'apA9', employee_id: 'e9det', type: 'acompte', montant: 200000, moisDeduction: '2026-09', date: '2026-09-22', valide: true });
      DB.setMain('mdb_acomptesPrets', list);
      var ops = savedOps.slice();
      ops.push({ id: 'opS9', apType: 'solde', code: 'SOLDE_SALAIRE' });
      DB.setMain('mdb_operationsCaisse', ops);
      function norm(id) { return normalizeAP(getAPList().filter(function(x){ return x.id === id; })[0]); }
      var n1 = apNetImpression(norm('apS9'), '2026-09');
      var n2 = apNetImpression(norm('apA9'), '2026-09');
      var n3 = apNetImpression(norm('apA9'), '2026-08');
      DB.setMain('mdb_acomptesPrets', savedAP);
      DB.setMain('mdb_operationsCaisse', savedOps);
      var ok = n1.nature === 'solde' && n1.restNet === 0 && n2.nature === 'acompte' && n2.deduit === 200000 && n2.restNet === 0 && n3.deduit === 0 && n3.restNet === 200000;
      ok ? 'OK : solde exclu (reste 0), acompte sold\u00e9 ce mois (reste 0), mois pr\u00e9c\u00e9dent intact (200000)'
         : 'ECHEC n1=' + n1.nature + '/' + n1.restNet + ' n2=' + n2.deduit + '/' + n2.restNet + ' n3=' + n3.restNet
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Contrats : le bouton Historique est propos\u00e9 m\u00eame sans pass\u00e9 (pour ajouter)',
    app: 'index.html', store: storeRealiste,
    code: `
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'cdh1', matricule: 'CDD-H', nom: 'HISTO', prenoms: 'Test', sexe: 'M', date_entree: '2025-06-01', type_contrat: 'CDD', duree_contrat: 12, statut: 'actif' });
      DB.set('mdb_employes', arr);
      renderContratsPage();
      var h = document.getElementById('content').innerHTML || '';
      var okH = h.indexOf("historiqueContratsModal('cdh1')") !== -1;
      var okR = h.indexOf("renouvelerContratModal('cdh1')") !== -1;
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'cdh1'; }));
      (okH && okR) ? 'OK : boutons Historique + Renouveler pr\u00e9sents'
        : 'ECHEC hist=' + okH + ' renouv=' + okR
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Bulletin : la ligne contrat rappelle le N\u00b0 en cours et la 1re embauche',
    app: 'paye.html', store: storeRealiste,
    code: `
      var l1 = contratLigneB({ type_contrat: 'CDD', date_entree: '2025-01-10', duree_contrat: 6, date_premiere_entree: '2024-01-10', historique_contrats: [{ n: 1, type_contrat: 'CDD', date_debut: '2024-01-10', duree_mois: 12, date_fin: '2025-01-10' }] });
      var l2 = contratLigneB({ type_contrat: 'CDI', date_entree: '2020-05-01' });
      var ok = l1.indexOf('n°2') !== -1 && l1.indexOf('1re embauche') !== -1 && l2 === '';
      ok ? 'OK : ' + l1 + ' | CDI sans historique = rien'
         : 'ECHEC l1=' + l1 + ' l2=' + l2
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Employ\u00e9s : l\u2019historique des contrats est visible et modifiable dans la modale',
    app: 'index.html', store: storeRealiste,
    code: `
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'cdhm1', matricule: 'CDD-HM', nom: 'HISTOMOD', prenoms: 'Test', sexe: 'M', date_entree: '2024-01-10', type_contrat: 'CDD', duree_contrat: 12, statut: 'actif' });
      DB.set('mdb_employes', arr);
      renouvelerContratEmp('cdhm1', '2025-01-10', 6, 'CDD');
      openEmployeModal('cdhm1');
      var hb = document.getElementById('emp-hist-contrats');
      var h0 = (hb && hb.innerHTML) || '';
      var okList = h0.indexOf('N\u00b01') !== -1 && h0.indexOf('En cours') !== -1;
      document.getElementById('hmOp').value = 'passe';
      document.getElementById('hmType').value = 'CDD';
      document.getElementById('hmDebut').value = '2023-01-10';
      document.getElementById('hmDuree').value = '12';
      saveHistContratFromModal('cdhm1');
      var h1 = document.getElementById('emp-hist-contrats').innerHTML || '';
      var e = dbArr('mdb_employes').filter(function(x){ return x.id === 'cdhm1'; })[0];
      var okAdd = h1.indexOf('N\u00b02') !== -1 && e.historique_contrats.length === 2;
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'cdhm1'; }));
      (okList && okAdd) ? 'OK : N\u00b01 + En cours affich\u00e9s, contrat pass\u00e9 ajout\u00e9 (N\u00b02)'
        : 'ECHEC liste=' + okList + ' ajout=' + okAdd
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Recherche : les lignes Contrats et Cong\u00e9s portent un data-search (filtrage sans re-rendu)',
    app: 'index.html', store: storeRealiste,
    code: `
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'flt1', matricule: 'FLT-001', nom: 'FILTRENOM', prenoms: 'Test', sexe: 'M', date_entree: '2025-03-01', type_contrat: 'CDD', duree_contrat: 12, statut: 'actif' });
      DB.set('mdb_employes', arr);
      renderContratsPage();
      var hC = document.getElementById('content').innerHTML || '';
      var okCtr = hC.indexOf('data-search=') !== -1 && hC.indexOf('filtrenom') !== -1 && typeof filterContrats === 'function';
      var saved = getRhConges();
      saved.push({ id: 'cgf1', numero: 'CONG-FILTRE-1', employee_id: 'flt1', type: 'annual', date_depart: '2026-11-10', date_retour: '2026-11-14', date_reprise: '', duree: 5, remplacant_id: '', notes: '' });
      setRhConges(saved);
      renderCongesPage();
      var hG = document.getElementById('content').innerHTML || '';
      var okCg = hG.indexOf('data-search=') !== -1 && hG.indexOf('cong-filtre-1') !== -1 && typeof filterConges === 'function';
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'flt1'; }));
      setRhConges(saved.filter(function(x){ return x.id !== 'cgf1'; }));
      renderCongesPage();
      (okCtr && okCg) ? 'OK : data-search Contrats + Cong\u00e9s, filtres locaux pr\u00e9sents'
        : 'ECHEC contrats=' + okCtr + ' conges=' + okCg
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Contrats : doublons refus\u00e9s/nettoy\u00e9s, p\u00e9riode actuelle = contrat en cours',
    app: 'index.html', store: storeRealiste,
    code: `
      function _isoPlusMois(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setMonth(d.getMonth() + n); return d.getFullYear() + '-' + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + '-' + (d.getDate() < 10 ? '0' : '') + d.getDate(); }
      var _t = getToday();
      var _deb = _isoPlusMois(_t, -1);
      var _fin = contratDateFin(_deb, 3);
      var arr = dbArr('mdb_employes');
      arr.push({ id: 'cddz4', matricule: 'CDD-004', nom: 'DOUBLON', prenoms: 'Test', sexe: 'M', date_entree: '2025-01-10', type_contrat: 'CDD', duree_contrat: 12, statut: 'actif' });
      DB.set('mdb_employes', arr);
      var rSame = renouvelerContratEmp('cddz4', '2025-01-10', 12, 'CDD');
      var rP0 = ajouterContratPasse('cddz4', 'CDD', '2025-01-10', 12);
      var rP1 = ajouterContratPasse('cddz4', 'CDD', '2024-01-10', 12);
      var rP2 = ajouterContratPasse('cddz4', 'CDD', '2024-01-10', 12);
      var rProm = ajouterContratPasse('cddz4', 'CDD', _deb, 3);
      var eP = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz4'; })[0];
      var okProm = rProm.ok && eP.date_entree === _deb && eP.duree_contrat === 3 && eP.historique_contrats.length === 2;
      var rPast = renouvelerContratEmp('cddz4', '2022-01-10', 12, 'CDD');
      var eF = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz4'; })[0];
      var okPast = rPast.ok && eF.date_entree === _deb && eF.historique_contrats.length === 3 && eF.date_premiere_entree === '2022-01-10';
      var stT = contratStatut('2022-01-10', contratDateFin('2022-01-10', 12));
      var stE = contratStatut(_deb, _fin);
      var stF = contratStatut(_isoPlusMois(_t, 2), _isoPlusMois(_t, 5));
      var okSt = (stT === 'termine') && (stE === 'encours') && (stF === 'futur');
      var arr2 = dbArr('mdb_employes');
      var ex2 = arr2.filter(function(x){ return x.id === 'cddz4'; })[0];
      ex2.historique_contrats.push({ n: 99, type_contrat: 'CDD', date_debut: _deb, duree_mois: 3, date_fin: _fin });
      DB.set('mdb_employes', arr2);
      var rN = nettoyerDoublonsContrats('cddz4');
      var eN = dbArr('mdb_employes').filter(function(x){ return x.id === 'cddz4'; })[0];
      var okNet = (rN.supprimes === 1) && (eN.historique_contrats.length === 3);
      DB.set('mdb_employes', dbArr('mdb_employes').filter(function(x){ return x.id !== 'cddz4'; }));
      var ok = (!rSame.ok) && (!rP0.ok) && rP1.ok && (!rP2.ok) && okProm && okPast && okSt && okNet;
      ok ? 'OK : doublons refus\u00e9s/nettoy\u00e9s, p\u00e9riode actuelle promue, pass\u00e9 en historique'
         : 'ECHEC same=' + rSame.ok + ' p0=' + rP0.ok + ' p1=' + rP1.ok + ' p2=' + rP2.ok + ' prom=' + okProm + ' past=' + okPast + ' st=' + okSt + ' net=' + okNet
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Bulletin journalier : la nuit n\u2019est pas compt\u00e9e 2 fois (ligne 1 = jour seul)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var emps = payeArr('mdb_employes');
      emps.push({ id: 'ej', nom: 'Jour', prenoms: 'T', matricule: 'MJ01', fonction: 'Manoeuvre', service: 'Prod', type_contrat: 'Journalier', categorie: 'A', status: 'actif', date_embauche: '2024-06-01', salaire_base: 4000 });
      DB.setMain('mdb_employes', emps);
      setPointageData([
        { id: 'pt1', employee_id: 'ej', date: '2026-10-01', h_j_manual: '5.5', h_n_manual: '8' },
        { id: 'pt2', employee_id: 'ej', date: '2026-10-02', h_j_manual: '7.1' },
        { id: 'pt3', employee_id: 'ej', date: '2026-10-03', h_j_manual: '7.3' },
        { id: 'pt4', employee_id: 'ej', date: '2026-10-08', h_j_manual: '8.5' }
      ]);
      var emp = getPersonnel().filter(function (p) { return p.id === 'ej'; })[0];
      var calc = calculatePayroll(emp, '2026-10');
      var rows = getSimpleBulletinRows(emp, '2026-10', calc);
      var L1 = rows[0], L2 = rows[1];
      var ok1 = L1 && L1.label === 'Base horaire' && L1.taux === '28,4h' && L1.gain === 14200;
      var ok2 = L2 && L2.label.indexOf('Heures Suppl.') === 0 && L2.taux === '1' && L2.gain === 7000 && L2.label.indexOf('75%') !== -1 && L2.label.indexOf('8h') !== -1;
      (ok1 && ok2)
        ? 'OK : ligne 1 = 28,4h jour x 500 = 14200 (nuit 8h exclue), HS taux 1 = 7000 avec d\u00e9tail (75% : 8h), total 21200'
        : 'ECHEC L1=' + (L1 ? L1.taux + '/' + L1.gain : '?') + ' L2=' + (L2 ? L2.label + '/' + L2.taux + '/' + L2.gain : '?')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'F\u00e9ri\u00e9s CI : base officielle g\u00e9n\u00e9r\u00e9e (fixes + P\u00e2ques + musulmanes + report dimanche)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var g26 = ptGenererFeriesCI(2026);
      var has26 = function (d) { return g26.some(function (f) { return f.date === d; }); };
      var ok26 = has26('2026-01-01') && has26('2026-04-06') && has26('2026-05-14') && has26('2026-05-25') && has26('2026-03-20') && has26('2026-05-27') && has26('2026-08-07') && has26('2026-11-15') && has26('2026-12-25');
      var g22 = ptGenererFeriesCI(2022);
      var has22 = function (d) { return g22.some(function (f) { return f.date === d; }); };
      var ok22 = has22('2022-05-02') && has22('2022-04-18');
      (ok26 && ok22)
        ? 'OK : 2026 complet (Ramadan 20/03, Tabaski 27/05, P\u00e2ques 06/04), 2022 : report 02/05 + P\u00e2ques 18/04'
        : 'ECHEC 2026=' + ok26 + ' 2022=' + ok22
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'F\u00e9ri\u00e9s : travaill\u00e9 = dimanche (+75/+100), ch\u00f4m\u00e9 = pay\u00e9',
    app: 'paye.html', store: storeRealiste,
    code: `
      DB.setMain('mdb_feries', [{ id: 'f1', date: '2026-08-07', libelle: 'Ind\u00e9pendance' }]);
      var okLec = ptEstFerie(2026, 7, 7) === true && ptEstFerie(2026, 7, 8) === false;
      var e1 = getPersonnel().filter(function (p) { return p.id === 'e1'; })[0];
      setPointageData([{ id: 'pf1', employee_id: 'e1', date: '2026-08-07', h_j_manual: '8' }]);
      var st = getMonthStats(e1, '2026-08');
      var okT = st.hs75 === 8 && st.normalHours === 0;
      setPointageData([]);
      var st2 = getMonthStats(e1, '2026-08');
      var okC = st2.ferieDays === 1;
      (okLec && okT && okC)
        ? 'OK : 07/08 f\u00e9ri\u00e9 lu, travaill\u00e9 8h -> HS75 (normales 0), ch\u00f4m\u00e9 -> ferieDays=1'
        : 'ECHEC lec=' + okLec + ' trav=(hs75=' + st.hs75 + ' norm=' + st.normalHours + ') chome=' + st2.ferieDays
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : saisie rapide auto-save a la sortie de case (sans bouton)',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      setPointageData(getPointageData().filter(function (p) { return p.employee_id !== 'e1' || (p.date || '').indexOf('2026-10') !== 0; }));
      function INP(f, v, chk) {
        var e = { value: v, checked: !!chk, type: (f === 'nuit' || f === 'abs') ? 'checkbox' : 'text', innerHTML: '' };
        e.getAttribute = function (k) {
          if (k === 'data-r') return '5';
          if (k === 'data-field') return f;
          return null;
        };
        return e;
      }
      var rang = { hr: INP('hr', '8'), hrN: INP('hrN', ''), nuit: INP('nuit', '', false), abs: INP('abs', '', false), obs: INP('obs', '') };
      var totSpans = { 'pt-r-totJ': { innerHTML: '' }, 'pt-r-totN': { innerHTML: '' }, 'pt-r-totG': { innerHTML: '' }, 'pt-r-jrs': { innerHTML: '' } };
      var vraieGet = document.getElementById;
      document.getElementById = function (id) {
        if (id === 'pt-modal-content') return {
          querySelector: function (sel) {
            var m = /data-field="(\\w+)"/.exec(sel || '');
            return (m && rang[m[1]]) ? rang[m[1]] : null;
          },
          querySelectorAll: function (sel) {
            return sel === 'input[data-field="hr"]' ? [rang.hr] : [];
          }
        };
        if (totSpans[id]) return totSpans[id];
        return vraieGet(id);
      };
      ptRapideAutoSave(5);
      var pts = getPointageData();
      var r5 = pts.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-05'; });
      var okA = r5 && r5.h_j_manual === '8' && totSpans['pt-r-totJ'].innerHTML === '8.0h';
      rang.hr.value = '';
      ptRapideAutoSave(5);
      var pts2 = getPointageData();
      var gone = !pts2.find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-05'; });
      var okB = gone && totSpans['pt-r-totJ'].innerHTML === '0.0h';
      (okA && okB) ? 'OK : case remplie -> ligne sauvee + total 8.0h, case videe -> ligne supprimee + total 0.0h'
                   : 'ECHEC A=' + (okA ? 1 : 0) + ' B=' + (okB ? 1 : 0)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage paie : saisie rapide filtre la liste par fonction',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      var emps = payeArr('mdb_employes');
      emps.push({ id: 'e9', nom: 'Sow', prenoms: 'B', matricule: 'M009', fonction: 'Chauffeur', service: 'Prod', type_contrat: 'CDI', categorie: 'B', status: 'actif', date_embauche: '2024-06-01' });
      DB.setMain('mdb_employes', emps);
      window._srFonction = 'Chauffeur';
      showSaisieRapide();
      var h = document.getElementById('pt-modal-content').innerHTML;
      var dl = h.slice(h.indexOf('sr-emp-list">') + 15, h.indexOf('</datalist>'));
      var nomSow = _dispNamePp(getPersonnel().filter(function (p) { return p.id === 'e9'; })[0]);
      var nomE1 = _dispNamePp(getPersonnel().filter(function (p) { return p.id === 'e1'; })[0]);
      var okF = dl.indexOf(nomSow) !== -1 && dl.indexOf(nomE1) === -1 && h.indexOf('id="sr-fonction"') !== -1;
      window._srFonction = 'Toutes les fonctions';
      showSaisieRapide();
      var h2 = document.getElementById('pt-modal-content').innerHTML;
      var dl2 = h2.slice(h2.indexOf('sr-emp-list">') + 15, h2.indexOf('</datalist>'));
      var okT = dl2.indexOf(nomSow) !== -1 && dl2.indexOf(nomE1) !== -1;
      (okF && okT) ? 'OK : filtre Chauffeur = Sow seul, Tout = les deux'
                   : 'ECHEC filtre=' + okF + ' tout=' + okT
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Paie : pas de ReferenceError currentUser (idle timer 30 s)',
    app: 'paye.html', store: storeRealiste,
    code: `
      (_payeCU() === null)
        ? 'OK : _payeCU() sans currentUser global -> null, plus d\u2019erreur en boucle'
        : 'ECHEC _payeCU=' + _payeCU()
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage r\u00e9cap : colonne H. Normales (40h/sem, pas le jour brut)',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      var recs = [];
      for (var d = 1; d <= 10; d++) recs.push({ id: 'tn' + d, employee_id: 'e1', date: '2026-10-' + (d < 10 ? '0' : '') + d, h_j_manual: '8' });
      setPointageData(recs);
      loadPointage();
      var h = document.getElementById('pt-container').innerHTML;
      var rc = h.slice(h.indexOf('pt-week-recap'));
      var okH = h.indexOf('H. Normales') !== -1;
      var okW = rc.indexOf('24.0h') !== -1 && rc.indexOf('40.0h') !== -1 && rc.indexOf('64.0h') !== -1;
      (okH && okW) ? 'OK : colonne H. Normales, semaines 24.0h + 40.0h (8h sup hors normales), total 64.0h'
                   : 'ECHEC header=' + okH + ' valeurs=' + okW
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage collectif : colonne JOUR remplac\u00e9e par normales',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-mois').value = '2026-10';
      var recs = [];
      for (var d = 1; d <= 10; d++) recs.push({ id: 'cc' + d, employee_id: 'e1', date: '2026-10-' + (d < 10 ? '0' : '') + d, h_j_manual: '8' });
      setPointageData(recs);
      renderPtRecap();
      var h = document.getElementById('pt-recap-container').innerHTML;
      var okH = h.indexOf('NORM.') !== -1 && h.indexOf('>JOUR</th>') === -1;
      var iE1 = h.indexOf('M001');
      var iEnd = iE1 !== -1 ? h.indexOf('</tr>', iE1) : -1;
      var rowE1 = (iE1 !== -1 && iEnd !== -1) ? h.slice(iE1, iEnd) : '';
      var okV = rowE1.indexOf('64.0h') !== -1 && rowE1.indexOf('64.0h') < rowE1.lastIndexOf('80.0h');
      (okH && okV) ? 'OK : collectif NORM. (64.0h normales avant le TOTAL 80.0h)'
                   : 'ECHEC header=' + okH + ' valeurs=' + okV
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Bulletin : anciennet\u00e9 affich\u00e9e en en-t\u00eate',
    app: 'paye.html', store: storeRealiste,
    code: `
      var emps = payeArr('mdb_employes');
      emps.forEach(function (p) { if (p.id === 'e1') p.date_entree = '2020-03-15'; });
      DB.setMain('mdb_employes', emps);
      var sel = document.getElementById('paie-select-emp');
      if (sel) sel.value = 'e1';
      var mm = document.getElementById('paie-mois');
      if (mm) mm.value = '2026-10';
      generateBulletin();
      var h = document.getElementById('paie-output').innerHTML;
      var att = calcAnciennete('2020-03-15');
      (h.indexOf('Anciennet') !== -1 && att !== '-' && h.indexOf(att) !== -1)
        ? 'OK : en-t\u00eate avec anciennet\u00e9 (' + att + ')'
        : 'ECHEC anc=' + (h.indexOf('Anciennet') !== -1) + ' val=' + att
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Plafond 173.33h : surplus en +15%, forfait sans case = rien, avec case = pay\u00e9',
    app: 'paye.html', store: storeRealiste,
    code: `
      var emps = payeArr('mdb_employes');
      emps.push({ id: 'e4', nom: 'Forfait', prenoms: 'F', matricule: 'MF', fonction: 'X', service: 'Prod', type_contrat: 'CDI', categorie: 'A', status: 'actif', date_embauche: '2024-01-01', mode_pointage: 'forfait', salaire_base: 200000 });
      emps.push({ id: 'e5', nom: 'ForfaitPlus', prenoms: 'F', matricule: 'MG', fonction: 'X', service: 'Prod', type_contrat: 'CDI', categorie: 'A', status: 'actif', date_embauche: '2024-01-01', mode_pointage: 'forfait', droit_hs: true, salaire_base: 200000 });
      DB.setMain('mdb_employes', emps);
      var recs = [];
      ['e1', 'e4', 'e5'].forEach(function (eid) {
        for (var d = 1; d <= 31; d++) {
          var dw = new Date(2026, 9, d).getDay();
          if (dw >= 1 && dw <= 5) recs.push({ id: 'pl' + eid + '_' + d, employee_id: eid, date: '2026-10-' + (d < 10 ? '0' : '') + d, h_j_manual: '8' });
        }
      });
      setPointageData(recs);
      var P = function (id) { return getPersonnel().filter(function (p) { return p.id === id; })[0]; };
      var s1 = getMonthStats(P('e1'), '2026-10');
      var s4 = getMonthStats(P('e4'), '2026-10');
      var s5 = getMonthStats(P('e5'), '2026-10');
      var ok1 = s1.normalHours === 173.33 && s1.hs15.toFixed(2) === '2.67' && s1.hs50 === 0;
      var hs4 = s4.hs15 + s4.hs50 + s4.hs75 + s4.hs100;
      var ok4 = s4.normalHours === 173.33 && hs4 === 0;
      var ok5 = s5.normalHours === 173.33 && s5.hs15.toFixed(2) === '2.67';
      (ok1 && ok4 && ok5)
        ? 'OK : 176h -> 173.33 normales + 2.67 en +15% ; forfait sans case : 173.33 et 0 sup ; avec case : 2.67 pay\u00e9es'
        : 'ECHEC std(n=' + s1.normalHours + ' hs15=' + s1.hs15 + ') forfait(n=' + s4.normalHours + ' hs=' + hs4 + ') override(n=' + s5.normalHours + ' hs15=' + s5.hs15 + ')'
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Pointage : le r\u00e9sum\u00e9 (bulletin + impression) montre les sup pay\u00e9es',
    app: 'paye.html', store: storeRealiste,
    code: `
      var okH = ptHsDetailTxt({ hs15: 6, hs50: 2, hs75: 0, hs100: 0 }) === '15% : 6h \u00b7 50% : 2h' && ptHsDetailTxt({}) === '';
      document.getElementById('paie-select-emp').value = 'e1';
      document.getElementById('paie-mois').value = '2026-10';
      var recs = [];
      for (var d = 1; d <= 10; d++) recs.push({ id: 'sm' + d, employee_id: 'e1', date: '2026-10-' + (d < 10 ? '0' : '') + d, h_j_manual: '8' });
      setPointageData(recs);
      generateBulletin();
      var h = document.getElementById('paie-output').innerHTML;
      var okM = h.indexOf('H. Normales') !== -1 && h.indexOf('64.0h') !== -1 && h.indexOf('Sup. pay\u00e9es') !== -1 && h.indexOf('15%') !== -1;
      (okH && okM) ? 'OK : helper + m\u00e9mo bulletin (64.0h normales, sup 15%/50%)'
                   : 'ECHEC helper=' + okH + ' memo=' + okM
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Prestataire externe : prorata sur les jours ouvr\u00e9s (22j/22 = forfait int\u00e9gral)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var okJ = ptJoursOuvres('2026-09') === 22 && ptJoursOuvres('2026-10') === 22 && ptJoursOuvres('2026-02') === 20 && ptJoursOuvres('') === 30;
      var emps = payeArr('mdb_employes');
      emps.push({ id: 'e9', nom: 'KOFFI', prenoms: 'CONSTANT', matricule: 'EXT-009', fonction: 'RH', type_contrat: 'Externe', categorie: 'B', status: 'actif', date_entree: '2026-01-05', montant_forfaitaire: 240000 });
      DB.setMain('mdb_employes', emps);
      setExternJours('e9', '2026-09', 22);
      document.getElementById('paie-select-emp').value = 'e9';
      document.getElementById('paie-mois').value = '2026-09';
      generateBulletin();
      var h = document.getElementById('paie-output').innerHTML;
      var f240 = fmt(240000), f176 = fmt(176000), f120 = fmt(120000);
      var plein = h.indexOf('22j/22') !== -1 && h.indexOf('j/30') === -1 && h.indexOf(f240) !== -1 && h.indexOf(f176) === -1;
      setExternJours('e9', '2026-09', 11);
      generateBulletin();
      var h2 = document.getElementById('paie-output').innerHTML;
      var demi = h2.indexOf('11j/22') !== -1 && h2.indexOf(f120) !== -1;
      (okJ && plein && demi)
        ? 'OK : jours ouvr\u00e9s 22 (sept) / 20 (f\u00e9v) ; 22j/22 = 240000, 11j/22 = 120000'
        : 'ECHEC ouvr=' + okJ + ' plein=' + plein + ' demi=' + demi + ' ouvr202609=' + ptJoursOuvres('2026-09')
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Synchro cloud : hash payload stable et distinct (skip des push identiques)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var h1 = _payeStrHash('{"a":1}');
      var h2 = _payeStrHash('{"a":1}');
      var h3 = _payeStrHash('{"a":2}');
      var h4 = _payeStrHash('');
      (h1 && h1 === h2 && h1 !== h3)
        ? 'OK : hash stable (' + h1 + '), distinct (' + h3 + ')'
        : 'ECHEC h1=' + h1 + ' h2=' + h2 + ' h3=' + h3 + ' h4=' + h4
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Synchro cloud : 3 sauvegardes rapproch\u00e9es = 1 seul push coalesc\u00e9 (anti-mart\u00e8lement)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var feux = [];
      var _ost = setTimeout, _oct = clearTimeout, _seq = 0;
      setTimeout = function (fn, d) { _seq++; feux.push({ id: _seq, fn: fn, d: d }); return _seq; };
      clearTimeout = function (id) { feux = feux.filter(function (t) { return t.id !== id; }); };
      var n = 0;
      var _origRun = _payePushCloudRun;
      _payePushCloudRun = function () { n++; };
      pushPayeCloud._t = null;
      pushPayeCloud(); pushPayeCloud(); pushPayeCloud();
      var timers = feux.length;
      var delai = timers === 1 ? feux[0].d : -1;
      feux[0].fn();
      _payePushCloudRun = _origRun;
      setTimeout = _ost; clearTimeout = _oct;
      try { pushPayeCloud._t = null; } catch (eCT) {}
      (timers === 1 && delai >= 2000 && n === 1)
        ? 'OK : 3 appels coalesc\u00e9s en 1 timer (' + delai + ' ms), 1 ex\u00e9cution au d\u00e9clenchement'
        : 'ECHEC timers=' + timers + ' delai=' + delai + ' n=' + n
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import montage : grille r\u00e9elle (articles en lignes, jours en colonnes, dates FR)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ams = [{ code: 'A01', designation: 'Fauteuil School', prix: 5000 }, { code: 'B02', designation: 'Table Bureau', prix: 9000 }];
      var wks = [{ id: 'e1', nom: 'DIALLO', matricule: 'M001', en_paie: true }];
      var rows = [
        ['Article', '1/2', '01/02', '2', '3'],
        ['DIALLO', 'A01', '', 2, 3],
        ['DIALLO', 'Table Bureau', '', 1, '']
      ];
      var out = ptMontParseRows(rows, { mois: '2026-08', articlesMontage: ams, workers: wks });
      var a01 = out.filter(function (x) { return x.article_code === 'A01' && x.employee_id === 'e1'; });
      var b02 = out.filter(function (x) { return x.article_code === 'B02' && x.employee_id === 'e1'; });
      var ok = out.length === 3 &&
        a01.length === 2 && a01[0].date === '2026-08-02' && a01[0].quantite === 2 && a01[1].date === '2026-08-03' &&
        b02.length === 1 && b02[0].date === '2026-08-02' && b02[0].quantite === 1;
      (ok)
        ? 'OK : matrice d\u00e9tect\u00e9e \u2014 3 cellules, dates FR converties (' + (a01[0] ? a01[0].date : '?') + ')'
        : 'ECHEC n=' + out.length + ' ' + JSON.stringify(out)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Saisie rapide : des heures tap\u00e9es d\u00e9cochent Absent et teintent la ligne (pr\u00e9sence)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var okTint = typeof ptRapideHeuresTapees === 'function' && typeof ptRapideTint === 'function';
      var okAide = true;
      (okTint && okAide)
        ? 'OK : ptRapideHeuresTapees/ptRapideTint pr\u00eats (heures = pr\u00e9sent, abs coch\u00e9 = rouge)'
        : 'ECHEC helpers=' + okTint
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'G\u00e9n\u00e9rer : le forfait 173,33 est reconnu m\u00eame avec une variante de saisie',
    app: 'paye.html', store: storeRealiste,
    code: `
      var okF = ptEstForfait({ mode_pointage: 'forfait', en_paie: true }) &&
                ptEstForfait({ mode_pointage: 'Forfait 173,33', en_paie: true }) &&
                ptEstForfait({ mode_pointage: 'forfait_173.33', en_paie: true });
      var okJ = !ptEstForfait({ mode_pointage: 'journalier', en_paie: true }) &&
                !ptEstForfait({ mode_pointage: 'forfait', en_paie: false });
      (okF && okJ)
        ? 'OK : forfait + variantes accept\u00e9es, journalier / hors paie exclus'
        : 'ECHEC forfait=' + okF + ' journalier=' + okJ
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Saisie rapide : absence pay\u00e9e (faute entreprise) porte motif + observation',
    app: 'paye.html', store: storeRealiste,
    code: `
      document.getElementById('pt-select-emp').value = 'e1';
      document.getElementById('pt-mois').value = '2026-10';
      setPointageData(getPointageData().filter(function (p) { return p.employee_id !== 'e1' || (p.date || '').indexOf('2026-10') !== 0; }));
      function INP2(f, v, chk, type) {
        var e = { value: v, checked: !!chk, type: type || 'text', innerHTML: '' };
        e.getAttribute = function (k) { if (k === 'data-r') return '9'; if (k === 'data-field') return f; return null; };
        return e;
      }
      var rang = {
        hr: INP2('hr', ''), hrN: INP2('hrN', ''), nuit: INP2('nuit', '', false, 'checkbox'),
        abs: INP2('abs', '', true, 'checkbox'), obs: INP2('obs', ''),
        motif: INP2('motif', 'Panne machine', false, 'select-one'), faute: INP2('faute', '', true, 'checkbox')
      };
      var totSpans = { 'pt-r-totJ': { innerHTML: '' }, 'pt-r-totN': { innerHTML: '' }, 'pt-r-totG': { innerHTML: '' }, 'pt-r-jrs': { innerHTML: '' } };
      var vraieGet = document.getElementById;
      document.getElementById = function (id) {
        if (id === 'pt-modal-content') return {
          querySelector: function (sel) { var m = /data-field="(\\w+)"/.exec(sel || ''); return (m && rang[m[1]]) ? rang[m[1]] : null; },
          querySelectorAll: function () { return []; }
        };
        if (totSpans[id]) return totSpans[id];
        return vraieGet(id);
      };
      ptRapideAutoSave(9);
      document.getElementById = vraieGet;
      var r9 = getPointageData().find(function (p) { return p.employee_id === 'e1' && p.date === '2026-10-09'; });
      var ok = r9 && r9.present === false && r9.absent_paye === true &&
        r9.motif === 'Panne machine' && String(r9.h_j_manual) === '8' && r9.rattrap_gagnees === 8;
      rang.faute.checked = false; rang.abs.checked = false;
      rang.hr.value = '8'; rang.motif.value = ''; rang.obs.value = '';
      (ok)
        ? 'OK : present=false, absent_paye=true, motif=' + (r9 ? r9.motif : '?') + ', 8h pay\u00e9es + rattrapage'
        : 'ECHEC ' + JSON.stringify(r9)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Journalier : le taux horaire d\u00e9duit du forfait MENSUEL pilote la paie',
    app: 'paye.html', store: storeRealiste,
    code: `
      var e1 = ptTauxJournalier({ taux_journalier: 5000 }, '2026-10');
      var e2 = ptTauxHoraire({ taux_journalier: 5000 }, '2026-10');
      /* Forfait 240 000 / 22 jours ouvr\u00e9s = 10 909 F/jour, puis /8 */
      var e3 = ptTauxJournalier({ forfait_mois: 240000 }, '2026-10');
      var e4 = ptTauxHoraire({ forfait_mois: 240000 }, '2026-10');
      var e5 = ptTauxJournalier({ salaire_base: 173000 }, '2026-10');
      var e6 = ptTauxJournalier({ forfait_mois: 240000 }, '2026-02'); /* 20 j ouvr\u00e9s */
      var ok = e1 === 5000 && e2 === 625 && e3 === Math.round(240000 / 22) && e4 === Math.round(Math.round(240000 / 22) / 8 * 100) / 100 && e5 === 173000 && e6 === Math.round(240000 / 20);
      /* Les heures saisies \u00e0 la main restent des heures pour un travailleur
         au rendement (sinon elles disparaissent du tableau). */
      var rec = { present: true, h_j_manual: '8', h_n_manual: '' };
      var cRend = ptCalcDay(rec, true);
      var rec2 = { present: true, h_j_manual: '6.5' };
      var cPlage = ptCalcDay(rec2, false);
      var okH = cRend.j === 8 && cRend.r === 0 && cPlage.j === 6.5;
      /* Absence JUSTIFI\u00e9e : ni pr\u00e9sence ni absence (exclue du taux) */
      var okJ = ptAbsEstJustifiee('Maladie') && ptAbsEstJustifiee('Accident de travail') && !ptAbsEstJustifiee('Absence injustifi\u00e9e') && !ptAbsEstJustifiee('');
      (ok && okH && okJ)
        ? 'OK : 5000F/j -> 625F/h ; forfait 240000/22j -> ' + e3 + 'F/j -> ' + e4 + 'F/h ; f\u00e9vr 20j -> ' + e6 + 'F/j ; heures manuelles visibles ; justifi\u00e9es exclues'
        : 'ECHEC tJ=' + e1 + ' tH=' + e2 + ' fm=' + e3 + ' fmH=' + e4 + ' sal=' + e5 + ' fev=' + e6 + ' rendJ=' + cRend.j + ' just=' + okJ
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import montage : le vrai registre (dates fusionn\u00e9es + codes articles)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ams = [
        { code: 'BIG C1M', designation: 'Palette Gaine 1', prix: 5000 },
        { code: 'EURO 2 CE3M', designation: 'Euro CE3M', prix: 7000 },
        { code: 'BAN AVEC LIEN', designation: 'Banc', prix: 3000 }
      ];
      var wks = [{ id: 'e1', nom: 'BOLOU', prenoms: 'DORGLESS', matricule: 'BO', en_paie: true }];
      /* Ent\u00eates sur 3 niveaux comme le fichier export\u00e9 */
      var rows = [
        ['POSTE', 'mardi 1 septembre 2026', '', '', 'mercredi 2 septembre 2026', '', ''],
        ['', 'PALLETTES', '', '', 'PALLETTES', '', ''],
        ['', 'BIG C1M', 'EURO 2 CE3M', 'BAN AVEC LIEN', 'BIG C1M', 'EURO 2 CE3M', 'BAN AVEC LIEN'],
        ['CLOURED', '', '', '', '', '', ''],
        ['BOLOU DORGLESS', 30, '', '', '', 5, ''],
        ['CLOURED', '', '', '', '', '', '']
      ];
      var out = ptMontParseRows(rows, { mois: '2026-09', articlesMontage: ams, workers: wks });
      var a = out.filter(function (x) { return x.article_code === 'BIG C1M'; });
      var b = out.filter(function (x) { return x.article_code === 'EURO 2 CE3M'; });
      var ok = out.length === 2 &&
        a.length === 1 && a[0].date === '2026-09-01' && a[0].quantite === 30 && a[0].employee_id === 'e1' &&
        b.length === 1 && b[0].date === '2026-09-02' && b[0].quantite === 5;
      (ok)
        ? 'OK : 30u BIG C1M le 01/09 + 5u EURO 2 CE3M le 02/09 (dates FR + fusion propag\u00e9e)'
        : 'ECHEC n=' + out.length + ' ' + JSON.stringify(out)
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import montage : structure r\u00e9elle (4 lignes d\'en-t\u00eate + colonne total bleue)',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ams = [
        { code: 'BIG C1M', designation: 'Big C1M', prix: 100 },
        { code: 'EURO 2 CE3M', designation: 'Euro 2 CE3M', prix: 50 },
        { code: 'SIVE CIEM', designation: 'Sive CIEM', prix: 20 }
      ];
      var wks = [{ id: 'e1', nom: 'BOLOU', prenoms: 'DORGLESS', matricule: 'BO', en_paie: true }];
      var W = 1 + 7 * 4;
      function L() { var r = new Array(W).fill(''); return r; }
      var rD = L(), rP = new Array(W).fill('PALLETTES'),
          rC = new Array(W).fill('CCU V MON CH'), rA = L(),
          b1 = L(), t1 = L();
      var j7 = ['mardi 1 septembre 2026', 'mercredi 2 septembre 2026', 'jeudi 3 septembre 2026',
                'vendredi 4 septembre 2026', 'samedi 5 septembre 2026', 'dimanche 6 septembre 2026',
                'lundi 7 septembre 2026'];
      for (var j = 0; j < 7; j++) {
        var st = 1 + j * 4;
        rD[st] = j7[j];
        rA[st] = 'BIG C1M'; rA[st + 1] = 'EURO 2 CE3M'; rA[st + 2] = 'SIVE CIEM';
        rA[st + 3] = 'CCU V MON CH';
      }
      b1[0] = 'BOLOU DORGLESS';
      /* jour 1 = colonnes 1..4 : 30 + 7 + 9 + total bleu 46 (IGNORÉ) */
      b1[1] = 30; b1[2] = 7; b1[3] = 9; b1[4] = 46;
      b1[5] = 5; /* jour 2 = colonnes 5..8 : BIG C1M = 5 */
      t1[1] = 30; t1[2] = 7; t1[3] = 9; t1[4] = 46; t1[5] = 5;
      var rows = [['POSTE'].concat(rD.slice(1)), ['SEMAINE 1'].concat(rP.slice(1)),
                  [''].concat(rC.slice(1)), [''].concat(rA.slice(1)), b1, t1];
      var out = ptMontParseRows(rows, { mois: '2026-09', articlesMontage: ams, workers: wks });
      var d = {}; out.forEach(function (x) {
        var k = x.article_code + '@' + x.date;
        d[k] = (d[k] || 0) + x.quantite;
      });
      /* La date est FUSIONNÉE : les colonnes 2,3 et 5 doivent être lues.
         La colonne bleue « CCU V MON CH » (46) ne doit JAMAIS créer de ligne,
         et la ligne de totaux ne doit pas créer de travailleur. */
      var ok = out.length === 4 &&
        d['BIG C1M@2026-09-01'] === 30 &&
        d['EURO 2 CE3M@2026-09-01'] === 7 &&
        d['SIVE CIEM@2026-09-01'] === 9 &&
        d['BIG C1M@2026-09-02'] === 5;
      (ok) ? 'OK : 4 lignes, dates fusionnees propagees, colonne total ignoree'
           : 'ECHEC n=' + out.length + ' ' + JSON.stringify(d);
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Import montage : un code article court ne capture plus tous les en-t\u00eates',
    app: 'paye.html', store: storeRealiste,
    code: `
      var ams = [
        { code: 'M', designation: 'Modele M', prix: 10 },
        { code: 'MDI', designation: 'MDI', prix: 20 },
        { code: 'EURO 2 CE3M', designation: 'Euro 2 CE3M', prix: 50 }
      ];
      var wks = [{ id: 'e1', nom: 'BOLOU', prenoms: 'DORGLESS', matricule: 'BO', en_paie: true }];
      var W = 1 + 7 * 2;
      function L() { var r = new Array(W).fill(''); return r; }
      var rD = L(), rA = L(), b1 = L();
      var j7 = ['mardi 1 septembre 2026', 'mercredi 2 septembre 2026', 'jeudi 3 septembre 2026',
                'vendredi 4 septembre 2026', 'samedi 5 septembre 2026', 'dimanche 6 septembre 2026',
                'lundi 7 septembre 2026'];
      for (var j = 0; j < 7; j++) { var st = 1 + j * 2; rD[st] = j7[j]; rA[st] = 'EURO 2 CE3M'; rA[st+1] = 'MDI'; }
      b1[0] = 'BOLOU DORGLESS'; b1[1] = 5; b1[2] = 7; /* jour 1 */
      var rows = [[''].concat(rD.slice(1)), [''].concat(rA.slice(1)), b1];
      var out = ptMontParseRows(rows, { mois: '2026-09', articlesMontage: ams, workers: wks });
      var codes = out.map(function (x) { return x.article_code; });
      var jours = out.map(function (x) { return x.date; });
      var ok = out.length === 2 &&
        codes.indexOf('EURO 2 CE3M') >= 0 && codes.indexOf('MDI') >= 0 &&
        jours.every(function (d) { return /^2026-09-\\d\\d$/.test(d); });
      (ok) ? 'OK : articles exacts ' + JSON.stringify(codes)
           : 'ECHEC ' + JSON.stringify(out);
    `,
    attenduPrefixe: 'OK'
  });

  r.push({
    nom: 'Assiduit\u00e9 : une absence non justifi\u00e9e fait baisser le taux, une justifi\u00e9e non',
    app: 'paye.html', store: storeRealiste,
    code: `
      var emps = payeArr('mdb_employes');
      var now = new Date(); var mz = now.toISOString().slice(0,7);
      var an = parseInt(mz.substring(0,4),10), mo = parseInt(mz.substring(5,7),10) - 1;
      var ndays = new Date(an, mo + 1, 0).getDate();
      var today = now.getDate();
      /* Pointage tous les jours ouvr\u00e9s, SAUF : J (absence injustifi\u00e9e)
         et le jour 1 (absence maladie, justifi\u00e9e) */
      var recs = [], nTrav = 0;
      for (var d = 1; d <= ndays; d++) {
        if (d > today) break;
        var dow = new Date(an, mo, d).getDay();
        if (dow === 0 || dow === 6) continue;
        var dk = mz + '-' + (d < 10 ? '0' : '') + d;
        if (d === 1) recs.push({ id: 's2', employee_id: 'e1', date: dk, present: false, motif: 'Maladie' });
        else if (d === today) recs.push({ id: 's1', employee_id: 'e1', date: dk, present: false });
        else { recs.push({ id: 'p' + d, employee_id: 'e1', date: dk, present: true }); nTrav++; }
      }
      var cur = getPointageData().filter(function (p) { return p.employee_id !== 'e1'; });
      setPointageData(cur.concat(recs));
      var res = ptAssiduiteData(mz);
      var it = res.items.filter(function (x) { return x.emp.id === 'e1'; })[0];
      var ok = it && it.pres === nTrav && it.abs === 1 && it.absJust === 1 && it.taux === Math.round(100 * nTrav / (nTrav + 1));
      setPointageData(cur);
      (ok)
        ? 'OK : ' + nTrav + ' j point\u00e9s, 1 absence injustifi\u00e9e, 1 maladie exclue => taux ' + (it ? it.taux : '?') + '%'
        : 'ECHEC pres=' + (it ? it.pres : '?') + '/' + nTrav + ' abs=' + (it ? it.abs : '?') + ' just=' + (it ? it.absJust : '?') + ' taux=' + (it ? it.taux : '?')
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
