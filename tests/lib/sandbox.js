'use strict';
/* =====================================================================
   tests/lib/sandbox.js
   Charge une application dans un DOM simule pourExecuter son code
   hors navigateur, et fournir trois jeux de donnees (vide, realiste,
   corrompu) afin de verifier que les pages resistent a des donnees
   abimees.
   ===================================================================== */
const vm = require('vm');
const { loadApp } = require('./extract.js');

/* ---------------- jeu de donnees ---------------- */
function storeVide() { return {}; }

function storeRealiste() {
  const j = new Date();
  const jour = j.toISOString().slice(0, 10);
  const mois = jour.slice(0, 7);
  return {
    mdb_entreprise: JSON.stringify({ nom: 'ACSER', formeJuridique: 'SARL', devise: 'FCFA', validationCode: '1234', prod_tauxPerteDefault: 10, signataire: 'DG' }),
    mdb_clients: JSON.stringify([{ id: 'cl1', nom: 'Client Test', tel: '77' }]),
    mdb_fournisseurs: JSON.stringify([{ id: 'fr1', nom: 'Fournisseur Test' }]),
    mdb_employes: JSON.stringify([{ id: 'e1', nom: 'Diallo', prenoms: 'A', matricule: 'M001', fonction: 'Chef', service: 'Prod', type_contrat: 'CDI', categorie: 'A', status: 'actif', date_embauche: '2024-01-01' }]),
    mdb_operationsCaisse: JSON.stringify([
      { id: 'o1', date: jour, sens: 'sortie', montant: 250000, libelle: 'Loyer', code: 'LOYER', caisseId: 'c1', beneficiaireType: 'libre', numeroPiece: 'KR001' },
      { id: 'o2', date: jour, sens: 'entree', montant: 500000, libelle: 'Vente', code: 'VENTE', caisseId: 'c1', beneficiaireType: 'client', numeroPiece: 'KR002' }
    ]),
    mdb_codesCaisse: JSON.stringify([{ id: 'cd1', code: 'LOYER', libelle: 'Loyer', sens: 'sortie', montantDefaut: 0 }]),
    mdb_caisses: JSON.stringify([{ id: 'c1', nom: 'Caisse generale', type: 'generale', soldeInitial: 500000, soldeInitialDate: '2026-01-01', agentId: 'e1', agentNom: 'Agent' }]),
    mdb_acomptesPrets: JSON.stringify([{ id: 'ap1', employeId: 'e1', matricule: 'M001', nom: 'Diallo', type: 'acompte', montant: 100000, moisDeduction: mois, statut: 'valide' }]),
    mdb_bc: JSON.stringify([{ id: 'bc1', numero: 'BC001', date: jour, clientId: 'cl1', fournisseurId: 'fr1', lignes: [], statut: 'valide' }]),
    mdb_bl: JSON.stringify([{ id: 'bl1', numero: 'BL001', dateLivraison: jour, clientId: 'cl1', statut: 'livree', lignes: [{ articleId: 'a1', designation: 'Palette', quantite: 10, prixUnitaire: 45000 }] }]),
    mdb_factures: JSON.stringify([{ id: 'fa1', numero: 'FA001', date: jour, clientId: 'cl1', statut: 'impayee', lignes: [{ articleId: 'a1', quantite: 1, prixUnitaire: 45000 }], total: 45000 }]),
    mdb_users: JSON.stringify([{ id: 'u1', login: 'admin', nom: 'Admin', password: 'x', isAdmin: true, sections: {} }]),
    mdb_prefinancement: JSON.stringify([{ id: 'pf1', clientId: 'cl1', montant: 1000000, statut: 'actif', echeances: [] }]),
    mdb_actif: JSON.stringify([{ id: 'ac1', libelle: 'Camion', valeur: 5000000, amortissements: [] }]),
    mdb_comptabilite: JSON.stringify([{ id: 'cp1', libelle: 'Loyer', montant: 250000, poste: '613' }]),
    mdb_taches: JSON.stringify([{ id: 't1', titre: 'Tache test', statut: 'a_faire', userId: 'u1' }]),
    mdb_notes: JSON.stringify([{ id: 'n1', titre: 'Note', contenu: 'x', date: jour }]),
    mdb_previsions: JSON.stringify([{ id: 'pr1', mois: mois, type: 'vente', montant: 1000000 }]),
    mdb_stocks: JSON.stringify([{ id: 's1', code: 'PAL', designation: 'Palette', article_id: 'a1', qte: 100, quantite: 100, prixUnitaire: 45000 }]),
    mdb_nomenclature: JSON.stringify([{ id: 'nm1', code: 'PAL', designation: 'Palette', unite: 'pcs', prix: 45000 }]),
    mdb_dettesFournisseurs: JSON.stringify([{ id: 'df1', fournisseurId: 'fr1', fournisseur: 'Fournisseur Test', montant: 500000, date: jour }]),
    mdb_creancesDouteuses: JSON.stringify([{ id: 'cd1', clientId: 'cl1', montant: 100000 }]),
    mdb_rh_demandes: JSON.stringify([{ id: 'rd1', employeId: 'e1', type: 'conge', dateDebut: jour, statut: 'en_attente' }]),
    mdb_rh_conges: JSON.stringify([{ id: 'rc1', employeId: 'e1', type: 'annuel', dateDepart: jour, dateRetour: jour, nbJours: 2, statut: 'accorde' }]),
    mdb_rh_sanctions: JSON.stringify([{ id: 'rs1', employeId: 'e1', motif: 'Retard', date: jour }]),
    mdb_paye: JSON.stringify({ employes: [{ id: 'e1', matricule: 'M001', nom: 'Diallo', fonction: 'Chef' }], pointage: [{ id: 'pt1', employee_id: 'e1', date: jour, j_arr: '08:00', j_pd: '17:00' }], services: [], fonctions: [] }),
    mdb_production: JSON.stringify({
      __prodUpdatedAt: 1,
      productions: [{ id: 'p1', numero: '2609001', date: jour, statut: 'validated', vol_sortie_bois: 5, vol_lattes: 2, vol_plots: 1, vol_cp: 0, vol_enc_entree: 0.5, vol_enc_reprise: 0, vol_total: 3.5, rendement: 70, chef: 'Chef', taux_perte: 10, sortie_bois: [{ code: 'K1', essence: 'Rouge', volume: 5 }], lattes: [], plots: [], cp: [], assemblage: [], encours: [] }],
      articles: [{ id: 'a1', code: 'PAL', designation: 'Palette', categorie: 'finished', prix_vente: 45000, prix_revient: 0, length: 120, width: 80, thickness: 15, dimensions: '120x80x15', unite: 'pcs', weight: 25, statut: 'active' }],
      composants: [{ article_id: 'a1', type: 'LATTE', code: 'L1', designation: 'Latte', quantity: 5, volume: 0.0018 }, { article_id: 'a1', type: 'POINTE', code: 'P1', designation: 'Pointes', quantity: 90 }],
      definitions: [{ id: 'd1', code: 'P1', designation: 'Pointes', type: 'POINTE', unit_cost: 15 }],
      achats: [{ id: 1758000000001, category: 'raw-materials', date: jour, reference: 'BL-001', fournisseur: 'Fournisseur Test', items: [{ colis_number: 'K1', quantity: 10, volume: 5, essence: 'Rouge', unit_price: 45000, total_price: 225000 }], item_count: 1, total_volume: 5, montant_total: 225000 }],
      stockRaw: [{ id: 'sr1', code: 'K1', essence: 'Rouge', type: 'Bois rouge', volume: 5, quantite: 10, zone: 'A' }],
      stockConsum: [{ id: 'sc1', code: 'P1', designation: 'Pointes', quantite: 100, prix_unitaire: 500 }],
      stockFinished: [], stockSemi: [], stockMerch: [],
      losses: [], epiCatalogue: [], epiPurchases: [], epiAttributions: [],
      inventories: [], presence: [], positions: [], departments: [], species: [],
      espees: [], thermalTypes: [], thermalTreatments: [], maintenance: [],
      commandes: [], costFees: [], costLabor: {}, costAutoExcl: {},
      num: {}, journals: [], cards: []
    })
  };
}

/* Donnees volontairement abimees : chaque section devient un objet, une chaine
   ou un nombre la ou l'application attend un tableau. C'est ce qui faisait
   tomber les pages avant la protection des lectures. */
function storeCorrompu() {
  const s = storeRealiste();
  ['mdb_clients', 'mdb_fournisseurs', 'mdb_employes', 'mdb_operationsCaisse',
    'mdb_acomptesPrets', 'mdb_bc', 'mdb_bl', 'mdb_factures', 'mdb_prefinancement',
    'mdb_actif', 'mdb_comptabilite', 'mdb_taches', 'mdb_notes', 'mdb_previsions',
    'mdb_stocks', 'mdb_nomenclature', 'mdb_rh_demandes', 'mdb_rh_conges',
    'mdb_rh_sanctions', 'mdb_creancesDouteuses', 'mdb_entreprise', 'mdb_users'
  ].forEach(function (k) { s[k] = JSON.stringify({ a1: { id: 1, nom: 'X' } }); });

  const prod = JSON.parse(s.mdb_production);
  ['productions', 'articles', 'composants', 'definitions', 'achats', 'stockRaw',
    'stockConsum', 'losses', 'stockFinished', 'stockSemi', 'stockMerch', 'inventories',
    'presence', 'positions', 'departments', 'species', 'thermalTypes',
    'thermalTreatments', 'epiCatalogue', 'costFees'
  ].forEach(function (k) { prod[k] = { x: { id: 1 } }; });
  prod.articles = 'pas un tableau';
  prod.achats = { ach1: { id: 1, category: 'raw-materials', date: new Date().toISOString().slice(0, 10), items: [{ volume: 5, unit_price: 100, total_price: 500 }], montant_total: 500 } };
  s.mdb_production = JSON.stringify(prod);
  s.mdb_paye = 'corrompu';
  s.mdb_dettesFournisseurs = '42';
  return s;
}

const SCENARIOS = [
  { cle: 'vide', nom: 'donnees vides', store: storeVide },
  { cle: 'reel', nom: 'donnees reelles', store: storeRealiste },
  { cle: 'corrompu', nom: 'donnees corrompues', store: storeCorrompu }
];

/* ---------------- DOM simule ---------------- */
function noop() { return 0; }

function creerEnv(store, registre) {
  function el() {
    const e = {
      value: '', checked: false, className: '', id: '',
      style: {}, children: [], attrs: {},
      classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
      dataset: {},
      focus: noop, blur: noop, click: noop, remove: noop, reset: noop, submit: noop,
      appendChild(c) { this.children.push(c); return c; },
      insertBefore: noop, setSelectionRange: noop, select: noop, stepUp: noop, stepDown: noop,
      setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute: noop,
      getAttribute(k) { return this.attrs[k] !== undefined ? this.attrs[k] : null; },
      addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
      querySelector: () => null, querySelectorAll: () => [], closest: () => null,
      getElementsByClassName: () => [], getElementsByTagName: () => [],
      getElementsByName: () => [], elementsFromPoint: () => [],
      matches: () => false, contains: () => false,
      insertAdjacentHTML: noop, insertAdjacentElement: () => null, insertAdjacentText: noop,
      append: noop, prepend: noop, before: noop, after: noop,
      replaceWith: noop, replaceChildren: noop, cloneNode: () => el(), normalize: noop,
      scrollIntoView: noop,
      requestFullscreen: () => Promise.resolve(), exitFullscreen: () => Promise.resolve(),
      setPointerCapture: noop, releasePointerCapture: noop, hasPointerCapture: () => false,
      animate: () => ({ cancel: noop, finish: noop }), getAnimations: () => [],
      attachShadow: () => null, play: () => Promise.resolve(), pause: noop,
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 }),
      getClientRects: () => [], checkValidity: () => true, reportValidity: () => true,
      getContext: () => null, toDataURL: () => '', setSelectionRange: noop,
      offsetHeight: 800, offsetWidth: 1200, scrollHeight: 800,
      __inner: '', __tc: '', __st: 0
    };
    Object.defineProperty(e, 'textContent', { get() { return e.__tc; }, set(v) { e.__tc = String(v); e.__inner = String(v); } });
    Object.defineProperty(e, 'innerHTML', {
      get() { return e.__inner; },
      set(v) {
        e.__inner = String(v);
        const re = /<(\w+)([^>]*\sid="([^"]+)"[^>]*)>/g;
        let m;
        while ((m = re.exec(e.__inner)) !== null) {
          if (!registre[m[3]]) { const c = el(); c.id = m[3]; registre[m[3]] = c; }
        }
      }
    });
    Object.defineProperty(e, 'scrollTop', { get() { return e.__st; }, set(v) { e.__st = v; } });
    return e;
  }

  const body = el();
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    key: (i) => Object.keys(store)[i] || null,
    get length() { return Object.keys(store).length; },
    clear() { Object.keys(store).forEach(k => delete store[k]); }
  };
  const sessionStore = {};
  const sessionStorage = {
    getItem: (k) => (k in sessionStore ? sessionStore[k] : null),
    setItem: (k, v) => { sessionStore[k] = String(v); },
    removeItem: (k) => { delete sessionStore[k]; },
    key: (i) => Object.keys(sessionStore)[i] || null,
    get length() { return Object.keys(sessionStore).length; },
    clear() { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
  };

  const documentStub = {
    body, documentElement: el(), head: el(), cookie: '', title: '',
    hidden: false, visibilityState: 'visible', readyState: 'complete',
    createElement: () => el(), createTextNode: () => el(), createDocumentFragment: () => el(),
    getElementById(id) {
      if (!registre[id]) { const c = el(); c.id = id; c.__auto = true; registre[id] = c; }
      return registre[id];
    },
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    execCommand: () => false, elementFromPoint: () => null,
    fonts: { ready: Promise.resolve(), check: () => true, load: () => Promise.resolve() }
  };

  const env = {
    console, document: documentStub, localStorage, sessionStorage,
    navigator: {
      onLine: true, userAgent: 'mdb-test', language: 'fr-FR', vibrate: () => false,
      mediaDevices: { getUserMedia: () => Promise.resolve({}) },
      serviceWorker: { register: () => Promise.resolve(), addEventListener: noop },
      permissions: { query: () => Promise.resolve({ state: 'granted' }) },
      share: () => Promise.resolve()
    },
    location: { href: 'https://x/', pathname: '/index.html', protocol: 'https:', host: 'x', search: '', hash: '', origin: 'https://x', reload: noop, replace: noop },
    /* setTimeout est execute immediatement : plusieurs parties de
       l'application pre-remplissent un formulaire via setTimeout(..., 100).
       Sans cela le test verrait un formulaire vide. Un garde-fou evite
       toute recursion infinie. */
    setTimeout: (fn, delai) => {
      if (typeof fn !== 'function') return 0;
      env.__timeoutDepth = (env.__timeoutDepth || 0) + 1;
      if (env.__timeoutDepth > 12) { env.__timeoutDepth--; return 0; }
      try { fn(); } catch (e) { if (env.__verbose) console.log('  [setTimeout] ' + e.message); }
      env.__timeoutDepth--;
      return 0;
    },
    clearTimeout: noop, setInterval: noop, clearInterval: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    matchMedia: () => ({ matches: false, addListener: noop, removeListener: noop }),
    fetch: () => new Promise(() => {}),
    Intl, Date, Math, JSON, String, Number, Array, Object, Boolean, RegExp, Error,
    Map, Set, WeakMap, WeakSet, Symbol, Promise,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    btoa: (s) => String(s), atob: (s) => String(s),
    alert: noop, confirm: () => false, prompt: () => '',
    print: noop, scrollTo: noop, scroll: noop, scrollBy: noop, open: () => null, close: noop, focus: noop,
    Uint8Array, Uint16Array, Int8Array, Float64Array, DataView, ArrayBuffer,
    Blob: function () {}, FormData: function () {},
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL: noop },
    FileReader: function () { this.readAsDataURL = noop; this.readAsText = noop; this.onload = null; },
    MutationObserver: function () { this.observe = noop; this.disconnect = noop; },
    IntersectionObserver: function () { this.observe = noop; },
    ResizeObserver: function () { this.observe = noop; },
    PerformanceObserver: function () { this.observe = noop; },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getSelection: () => ({ removeAllRanges: noop, addRange: noop, rangeCount: 0, toString: () => '' }),
    firebase: undefined, Chart: undefined, XLSX: undefined, html2canvas: undefined,
    jspdf: { jsPDF: function () {} }, exceljs: undefined,
    BroadcastChannel: function () { this.postMessage = noop; },
    performance: { now: () => 0 },
    crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
    screen: { width: 1400, height: 900 }, innerWidth: 1400, innerHeight: 900,
    pageYOffset: 0, scrollY: 0,
    indexedDB: undefined, IDBKeyRange: undefined,
    speechSynthesis: { speak: noop, cancel: noop, getVoices: () => [] },
    Notification: function () { this.permission = 'default'; },
    AudioContext: function () { this.decodeAudioData = () => Promise.resolve({}); },
    Image: function () {},
    Worker: function () {}
  };
  env.XMLHttpRequest = function () { this.open = noop; this.send = noop; this.setRequestHeader = noop; };

  /* classes DOMCouramment utilisees */
  const classes = {};
  ['Storage', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement',
    'HTMLTextAreaElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLFormElement',
    'DocumentFragment', 'ShadowRoot', 'NodeList', 'DOMTokenList', 'DataTransfer',
    'Selection', 'Range', 'DOMParser', 'XMLSerializer', 'NodeFilter', 'File', 'FileList',
    'Worker', 'Geolocation', 'Permissions', 'Cache'
  ].forEach(n => { classes[n] = function () {}; });
  ['Event', 'CustomEvent', 'UIEvent', 'MouseEvent', 'PointerEvent', 'WheelEvent',
    'KeyboardEvent', 'TouchEvent', 'DragEvent', 'FocusEvent', 'InputEvent', 'SubmitEvent',
    'CompositionEvent', 'ClipboardEvent', 'MessageEvent', 'ProgressEvent', 'ErrorEvent',
    'Storage', 'DOMParser', 'XMLHttpRequest', 'FileReader', 'File', 'Blob',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver',
    'Notification', 'CSSStyleSheet', 'MediaQueryList', 'AbortController', 'Image', 'Audio', 'Worker'
  ].forEach(n => { env[n] = classes[n] || function () {}; });
  env.DOMException = function DOMException(msg) { this.message = msg; this.name = 'DOMException'; };
  env.EventTarget = function () {};
  ['TextEncoder', 'TextDecoder', 'queueMicrotask', 'structuredClone', 'reportError',
    'requestIdleCallback', 'cancelIdleCallback', 'postMessage'].forEach(n => { if (env[n] === undefined) env[n] = noop; });

  env.frames = env; env.opener = null;
  env.history = { pushState: noop, replaceState: noop, back: noop, forward: noop, go: noop, length: 1 };
  env.closed = false; env.name = ''; env.status = '';
  env.screenLeft = 0; env.screenTop = 0; env.devicePixelRatio = 1; env.isSecureContext = true;
  env.window = env; env.self = env; env.globalThis = env; env.top = env; env.parent = env;
  env.toast = function () { env.__toasts = (env.__toasts || 0) + 1; };
  return { env, documentStub, el, registre };
}

/* Charge une application dans le bac a sable. */
function chargerApp(nomFichier, store) {
  const app = loadApp(nomFichier);
  const registre = {};
  const { env, el } = creerEnv(store, registre);
  ['content', 'pageTitle', 'app', 'nav', 'sidebar', 'modalOverlay', 'pageActions',
    'globalSearch', 'dateDisplay', 'prodSyncStatus', 'menuSearch', 'globalSearchResults'
  ].forEach(id => { if (!registre[id]) registre[id] = el(); });

  const ctx = vm.createContext(env);
  vm.runInContext(app.js, ctx, { filename: nomFichier, timeout: 120000 });
  return { ctx, env, registre, app };
}

/* Un utilisateur connecte, pour ne pas tester les pages en mode invite. */
const UTILISATEUR = "window.currentUser = window.__currentUser = " +
  "{id:'u1',login:'admin',nom:'Admin',isAdmin:true,isSuperAdmin:true,sections:{}};";

module.exports = { SCENARIOS, storeVide, storeRealiste, storeCorrompu, chargerApp, creerEnv, UTILISATEUR };
