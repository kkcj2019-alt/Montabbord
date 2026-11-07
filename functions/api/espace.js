/* Cloudflare Pages Function: /api/espace
   Espaces CLIENT et FOURNISSEUR, côté serveur.

   Avant : la page du client téléchargeait les comptes (avec empreintes de
   mot de passe), devis, commandes et messages de TOUS les clients, vérifiait
   le mot de passe dans le navigateur et réécrivait les listes complètes.
   Un e-mail tapé dans la mémoire du navigateur suffisait pour entrer dans
   le compte d'un autre ; un fournisseur voyait les dettes des autres.

   Maintenant :
   - le mot de passe est vérifié ICI (même format sha256(sel|mdp) : les
     comptes existants marchent sans rien changer) ;
   - session aléatoire côté serveur (12 h), blocage après 5 essais ratés ;
   - chacun ne reçoit QUE ses propres données ;
   - chaque écriture touche UNE pièce, vérifie qu'elle lui appartient, et
     ne peut pas changer ce que l'entreprise décide (statut, prix, réponses) ;
   - écriture protégée contre les envois simultanés (relecture + réessai). */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}
function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: corsHeaders() });
}
async function sha256Hex(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(msg)));
  return Array.from(new Uint8Array(buf)).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function rnd(n) {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a).map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
}
function parseVal(v, def) {
  if (v == null) return def;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return def; } }
  return v;
}
function lc(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function str(v, max) { return String(v == null ? '' : v).slice(0, max || 2000); }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }

const AUTO_CLIENT = 'Bonjour, nous ne sommes pas disponibles pour le moment. Votre message a bien été reçu : nous vous répondrons le plus tôt possible.';
const CFG = {
  client: {
    accounts: 'mdb_clientAccounts', owner: 'clientId', auteur: 'client',
    threads: 'mdb_clientThreads', presence: 'mdb_clientPresence', pub: 'mdb_clientPublic'
  },
  fournisseur: {
    accounts: 'mdb_fournisseurAccounts', owner: 'fournisseurId', auteur: 'fournisseur',
    threads: 'mdb_fournisseurThreads', presence: 'mdb_fournisseurPresence', pub: 'mdb_fournisseurPublic'
  }
};

/* ---------- Lecture / écriture D1 ---------- */
async function lire(db, uid, cle) {
  const r = await db.prepare('SELECT enterprise_id, valeur, updated_at FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1')
    .bind(uid, '"' + uid + '"', cle).first();
  if (!r) return { val: null, at: null };
  return { val: parseVal(r.valeur, null), at: r.enterprise_id === uid ? r.updated_at : null };
}
async function lireVal(db, uid, cle, def) { const r = await lire(db, uid, cle); return r.val == null ? def : r.val; }
async function ecrire(db, uid, cle, val) {
  await db.prepare(`INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`)
    .bind(uid, cle, JSON.stringify(val), Date.now().toString()).run();
}
/* Lire → modifier → écrire, seulement si personne n'a écrit entre-temps. */
async function modifier(db, uid, cle, def, fn) {
  for (let essai = 0; essai < 6; essai++) {
    const r = await lire(db, uid, cle);
    let val = r.val == null ? def() : r.val;
    const res = fn(val);
    if (res === false) return { ok: false };
    if (res && res.val !== undefined) val = res.val;
    if (r.at == null) { await ecrire(db, uid, cle, val); return { ok: true, val }; }
    const stamp = Math.max(Date.now(), (parseInt(r.at, 10) || 0) + 1).toString();
    const u = await db.prepare('UPDATE enterprise_data SET valeur = ?, updated_at = ? WHERE enterprise_id = ? AND cle = ? AND updated_at = ?')
      .bind(JSON.stringify(val), stamp, uid, cle, r.at).run();
    if (u && u.meta && u.meta.changes > 0) return { ok: true, val };
  }
  return { ok: false, code: 'occupe' };
}

/* ---------- Comptes / sessions ---------- */
function compteSur(acc, email) {
  if (!acc) return null;
  const o = {};
  for (const k in acc) if (k !== 'hash' && k !== 'salt' && k !== 'passwordHash') o[k] = acc[k];
  o.email = acc.email || email;
  return o;
}
async function verifierMdp(acc, pass) {
  if (!acc || !acc.hash) return false;
  return (await sha256Hex((acc.salt || '') + '|' + String(pass || ''))) === acc.hash;
}
async function session(db, uid, token, type) {
  if (!token) return null;
  const list = await lireVal(db, uid, 'mdb_espaceSessions', []);
  const now = Date.now();
  const s = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.token === token && x.type === type && x.exp > now; })[0];
  if (!s) return null;
  const accounts = await lireVal(db, uid, CFG[type].accounts, {});
  const acc = accounts && accounts[s.email];
  if (!acc || acc.actif === false) return null;
  return { email: s.email, acc: acc, accounts: accounts };
}
async function ouvrirSession(db, uid, type, email) {
  const token = rnd(24).toUpperCase();
  const now = Date.now();
  await modifier(db, uid, 'mdb_espaceSessions', function () { return []; }, function (list) {
    const l = (Array.isArray(list) ? list : []).filter(function (x) { return x && x.exp > now; }).slice(-600);
    l.push({ token, type, email, exp: now + 12 * 3600 * 1000, at: now });
    return { val: l };
  });
  return token;
}
async function echecsBloque(db, uid, cle) {
  const m = await lireVal(db, uid, 'mdb_espaceEchecs', {});
  const e = m && m[cle];
  return !!(e && e.until && e.until > Date.now());
}
async function noterEchec(db, uid, cle, reussi) {
  await modifier(db, uid, 'mdb_espaceEchecs', function () { return {}; }, function (m) {
    m = (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
    const now = Date.now();
    for (const k in m) if (m[k] && m[k].last && now - m[k].last > 24 * 3600 * 1000) delete m[k];
    if (reussi) { delete m[cle]; return { val: m }; }
    const e = m[cle] || { n: 0 };
    e.n = (e.n || 0) + 1; e.last = now;
    if (e.n >= 5) { e.until = now + 15 * 60 * 1000; e.n = 0; }
    m[cle] = e;
    return { val: m };
  });
}

/* ---------- Messages : on ne garde que ce que la personne a le droit d'écrire ---------- */
function cleMsg(m) { return String(m && (m.id || ((m.at || '') + '|' + (m.auteur || '') + '|' + String(m.texte || '').slice(0, 40))) || ''); }
function fusionThread(srv, inc, ctx) {
  const auteur = ctx.auteur;
  const out = srv ? Object.assign({}, srv) : {
    id: str(inc.id, 80), sujet: str(inc.sujet, 200), type: str(inc.type, 30), refId: str(inc.refId, 80),
    statut: 'ouvert', createdAt: Date.now(), messages: []
  };
  out[ctx.owner] = ctx.ownerId;
  if (ctx.nom) { if (ctx.type === 'client') out.clientNom = ctx.nom; else out.fournisseurNom = ctx.nom; }
  if (ctx.type === 'fournisseur' && ctx.email) out.email = ctx.email;
  const deja = {};
  const msgs = Array.isArray(out.messages) ? out.messages.slice() : [];
  msgs.forEach(function (m) { deja[cleMsg(m)] = m; });
  let ajout = 0;
  (Array.isArray(inc.messages) ? inc.messages : []).forEach(function (m) {
    if (!m) return;
    const k = cleMsg(m);
    const ex = deja[k];
    if (ex) {
      /* Message de l'entreprise : le client peut seulement le marquer « lu ». */
      if (ex.auteur === 'admin') {
        if (m.readAt && !ex.readAt) ex.readAt = num(m.readAt) || Date.now();
        if (m.deliveredAt && !ex.deliveredAt) ex.deliveredAt = num(m.deliveredAt) || Date.now();
      }
      return;
    }
    if (m.auteur === 'admin') {
      /* Seul le message automatique « absent » peut être posé par la page, texte imposé. */
      if (m.auto === true && !srv && ctx.type === 'client') {
        const a = { auteur: 'admin', nom: 'Service commercial', texte: AUTO_CLIENT, at: num(m.at) || Date.now(), auto: true };
        msgs.push(a); deja[k] = a;
      }
      return;
    }
    const nm = { auteur: auteur, nom: str(m.nom || ctx.nom, 120), texte: str(m.texte, 4000), at: num(m.at) || Date.now() };
    if (m.id) nm.id = str(m.id, 80);
    msgs.push(nm); deja[k] = nm; ajout++;
  });
  out.messages = msgs;
  if (ajout || !srv) out.updatedAt = Date.now();
  else if (inc.updatedAt && num(inc.updatedAt) > num(out.updatedAt)) out.updatedAt = num(inc.updatedAt);
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (!db) return json({ ok: false, code: 'db' }, 500);
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  try {
    const body = await request.json();
    const uid = String(body.uid || '').replace(/^["']+|["']+$/g, '').trim();
    const type = body.type === 'fournisseur' ? 'fournisseur' : 'client';
    const C = CFG[type];
    const action = String(body.action || '').toLowerCase();
    if (!uid) return json({ ok: false, code: 'uid' }, 400);

    /* ---------- Vitrine publique (sans compte) ---------- */
    if (action === 'public') {
      let ent = await lireVal(db, uid, C.pub, null);
      if (!ent || typeof ent !== 'object') {
        const e = await lireVal(db, uid, 'mdb_entreprise', {}) || {};
        ent = { nom: e.nom || '', logo: e.logo || '', telephone: e.telephone || e.tel || '', email: e.email || '', adresse: e.adresse || '' };
      }
      const out = { ok: true, ent: ent, presence: await lireVal(db, uid, C.presence, null) };
      if (type === 'client') {
        out.gallery = await lireVal(db, uid, 'mdb_clientGallery', []);
        out.content = await lireVal(db, uid, 'mdb_clientContent', {});
        out.partners = await lireVal(db, uid, 'mdb_clientPartners', []);
        const rv = await lireVal(db, uid, 'mdb_clientReviews', []);
        /* Avis : on publie la note, le nom affiché et le texte, rien d'autre. */
        out.reviews = (Array.isArray(rv) ? rv : []).filter(function (r) { return r && r.note && r.masque !== true; })
          .map(function (r) { return { id: r.id, nom: r.nom || '', note: r.note, texte: r.texte || '', createdAt: r.createdAt || 0, reponse: r.reponse || '' }; });
      }
      return json(out);
    }

    /* ---------- Connexion ---------- */
    if (action === 'login') {
      const email = lc(body.email);
      if (!email || !body.pass) return json({ ok: false, code: 'champs' }, 400);
      const cle = type + '|' + email;
      if (await echecsBloque(db, uid, cle)) return json({ ok: false, code: 'bloque' }, 429);
      const accounts = await lireVal(db, uid, C.accounts, {}) || {};
      const acc = accounts[email];
      if (!acc) { await noterEchec(db, uid, cle, false); return json({ ok: false, code: 'inconnu' }, 403); }
      if (acc.actif === false) return json({ ok: false, code: 'desactive' }, 403);
      if (!(await verifierMdp(acc, body.pass))) { await noterEchec(db, uid, cle, false); return json({ ok: false, code: 'mdp' }, 403); }
      await noterEchec(db, uid, cle, true);
      const token = await ouvrirSession(db, uid, type, email);
      return json({ ok: true, token, acc: compteSur(acc, email) });
    }

    /* ---------- Inscription (clients seulement ; les fournisseurs sont créés par l'entreprise) ---------- */
    if (action === 'register') {
      if (type !== 'client') return json({ ok: false, code: 'interdit' }, 403);
      const email = lc(body.email), pass = String(body.pass || ''), soc = str(body.societe, 160).trim();
      if (!soc || !email || !pass) return json({ ok: false, code: 'champs' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, code: 'email' }, 400);
      if (pass.length < 6) return json({ ok: false, code: 'mdp_court' }, 400);
      const salt = rnd(12);
      const hash = await sha256Hex(salt + '|' + pass);
      let acc = null;
      const r = await modifier(db, uid, C.accounts, function () { return {}; }, function (accounts) {
        accounts = (accounts && typeof accounts === 'object' && !Array.isArray(accounts)) ? accounts : {};
        if (accounts[email]) return false;
        acc = { id: 'CX' + Date.now().toString(36).toUpperCase() + rnd(3).toUpperCase(), nom: str(body.nom, 120) || soc, societe: soc, contact: str(body.nom, 120), email: email, tel: str(body.tel, 40), salt: salt, hash: hash, actif: true, createdAt: Date.now() };
        accounts[email] = acc;
        return { val: accounts };
      });
      if (!r.ok) return json({ ok: false, code: r.code || 'existe' }, 409);
      const token = await ouvrirSession(db, uid, type, email);
      return json({ ok: true, token, acc: compteSur(acc, email) });
    }

    /* ---------- Tout le reste : session obligatoire ---------- */
    const S = await session(db, uid, String(body.token || ''), type);
    if (!S) return json({ ok: false, code: 'session' }, 401);
    const acc = S.acc, email = S.email;

    if (action === 'logout') {
      await modifier(db, uid, 'mdb_espaceSessions', function () { return []; }, function (list) {
        return { val: (Array.isArray(list) ? list : []).filter(function (x) { return x && x.token !== body.token; }) };
      });
      return json({ ok: true });
    }

    /* ---------- Mes données (uniquement les miennes) ---------- */
    if (action === 'me') {
      const out = { ok: true, acc: compteSur(acc, email), presence: await lireVal(db, uid, C.presence, null) };
      const th = await lireVal(db, uid, C.threads, []);
      if (type === 'client') {
        const mien = function (x) { return x && String(x.clientId) === String(acc.id); };
        out.quotes = (await lireVal(db, uid, 'mdb_clientQuotes', []) || []).filter(mien);
        out.orders = (await lireVal(db, uid, 'mdb_clientOrders', []) || []).filter(mien);
        out.threads = (Array.isArray(th) ? th : []).filter(mien);
      } else {
        const fid = String(acc.fournisseurId || '');
        const fours = await lireVal(db, uid, 'mdb_fournisseurs', []) || [];
        const f = (Array.isArray(fours) ? fours : []).filter(function (x) { return x && String(x.id) === fid; })[0] || null;
        out.four = f ? { id: f.id, nom: f.nom || '', telephone: f.telephone || f.tel || '', email: f.email || '', adresse: f.adresse || '' } : null;
        const bcs = await lireVal(db, uid, 'mdb_bonsCommandeFournisseurs', []) || [];
        out.bcs = (Array.isArray(bcs) ? bcs : []).filter(function (b) { return b && fid && String(b.fournisseurId) === fid && String(b.statut || '') !== 'brouillon'; });
        const n = f ? lc(f.nom) : '';
        const dettes = await lireVal(db, uid, 'mdb_dettesFournisseurs', []) || [];
        out.dettes = n ? (Array.isArray(dettes) ? dettes : []).filter(function (d) { return d && lc(d.fournisseur) === n; }) : [];
        out.threads = (Array.isArray(th) ? th : []).filter(function (t) { return t && ((fid && String(t.fournisseurId) === fid) || lc(t.email) === email); });
      }
      return json(out);
    }

    const nomAff = type === 'client' ? (acc.societe || acc.nom || email) : (acc.nom || email);
    const ctxThread = { type, owner: C.owner, ownerId: type === 'client' ? acc.id : acc.fournisseurId, auteur: C.auteur, nom: nomAff, email };
    if (type === 'fournisseur' && !acc.fournisseurId) return json({ ok: false, code: 'non_rattache' }, 403);

    /* ---------- Messages (client et fournisseur) ---------- */
    if (action === 'thread') {
      const inc = body.thread || {};
      if (!inc.id) return json({ ok: false, code: 'id' }, 400);
      let res = null, refus = false;
      const r = await modifier(db, uid, C.threads, function () { return []; }, function (list) {
        list = Array.isArray(list) ? list : [];
        const i = list.findIndex(function (t) { return t && String(t.id) === String(inc.id); });
        if (i >= 0) {
          const t = list[i];
          const mien = String(t[C.owner] || '') === String(ctxThread.ownerId) || (type === 'fournisseur' && lc(t.email) === email);
          if (!mien) { refus = true; return false; }
          res = fusionThread(t, inc, ctxThread); list[i] = res;
        } else {
          res = fusionThread(null, inc, ctxThread); list.unshift(res);
        }
        return { val: list };
      });
      if (refus) return json({ ok: false, code: 'interdit' }, 403);
      if (!r.ok) return json({ ok: false, code: r.code || 'occupe' }, 409);
      return json({ ok: true, thread: res });
    }

    /* ---------- CLIENT : devis et commandes ---------- */
    if (type === 'client' && (action === 'quote' || action === 'order')) {
      const cle = action === 'quote' ? 'mdb_clientQuotes' : 'mdb_clientOrders';
      const inc = body.item || {};
      if (!inc.id) return json({ ok: false, code: 'id' }, 400);
      let prixCat = {};
      if (action === 'order') {
        const g = await lireVal(db, uid, 'mdb_clientGallery', []) || [];
        (Array.isArray(g) ? g : []).forEach(function (x) { if (x && x.id != null) prixCat[String(x.id)] = num(x.prix); });
      }
      const lignes = (Array.isArray(inc.items) ? inc.items : []).slice(0, 50).map(function (it) {
        const l = { titre: str(it && it.titre, 200), qte: Math.max(0, num(it && it.qte)), prix: 0 };
        if (action === 'order') {
          l.id = str(it && it.id, 80); l.code = str(it && it.code, 60);
          /* Le prix vient du catalogue de l'entreprise, pas de la page. */
          l.prix = prixCat[l.id] != null ? prixCat[l.id] : 0;
        }
        return l;
      });
      const champsClient = action === 'quote'
        ? { tech: 'obj', besoin: 4000, composants: 2000, dateBesoin: 20 }
        : { tel: 40, adresse: 400, bcNumero: 80, notes: 4000, bcName: 200, bcType: 100, bcData: 4200000 };
      let res = null, refus = '';
      const r = await modifier(db, uid, cle, function () { return []; }, function (list) {
        list = Array.isArray(list) ? list : [];
        const i = list.findIndex(function (x) { return x && String(x.id) === String(inc.id); });
        const cur = i >= 0 ? list[i] : null;
        if (cur && String(cur.clientId) !== String(acc.id)) { refus = 'interdit'; return false; }
        if (cur) {
          const st = lc(cur.statut);
          if (st !== 'nouvelle' && st !== 'en_cours') { refus = 'valide'; return false; }
        }
        const o = cur ? Object.assign({}, cur) : {
          id: str(inc.id, 80),
          numero: str(inc.numero, 40) || ((action === 'quote' ? 'DEV-' : 'CMD-') + Date.now().toString(36).toUpperCase()),
          statut: 'nouvelle', createdAt: Date.now()
        };
        o.clientId = acc.id; o.clientNom = nomAff; o.email = email;
        if (action === 'quote') o.tel = acc.tel || '';
        o.items = lignes;
        for (const k in champsClient) {
          if (inc[k] === undefined) continue;
          if (champsClient[k] === 'obj') { o[k] = (inc[k] && typeof inc[k] === 'object') ? JSON.parse(JSON.stringify(inc[k]).slice(0, 4000)) : {}; }
          else if (k === 'bcData') { const d = String(inc[k] || ''); if (!d || /^data:[a-z0-9.+\/-]+;base64,/i.test(d)) o[k] = d.slice(0, champsClient[k]); }
          else o[k] = str(inc[k], champsClient[k]);
        }
        if (action === 'order') o.total = lignes.reduce(function (s, l) { return s + l.qte * l.prix; }, 0);
        o.updatedAt = Date.now();
        res = o;
        if (i >= 0) list[i] = o; else list.unshift(o);
        return { val: list };
      });
      if (refus) return json({ ok: false, code: refus }, 403);
      if (!r.ok) return json({ ok: false, code: r.code || 'occupe' }, 409);
      return json({ ok: true, item: res });
    }

    /* ---------- CLIENT : avis ---------- */
    if (type === 'client' && action === 'review') {
      const note = Math.max(1, Math.min(5, parseInt(body.note, 10) || 0));
      const rv = { id: 'RV' + Date.now().toString(36).toUpperCase() + rnd(2), clientId: acc.id, nom: nomAff, note, texte: str(body.texte, 1500), createdAt: Date.now() };
      const r = await modifier(db, uid, 'mdb_clientReviews', function () { return []; }, function (list) {
        list = Array.isArray(list) ? list : [];
        list.unshift(rv);
        return { val: list.slice(0, 1000) };
      });
      if (!r.ok) return json({ ok: false, code: 'occupe' }, 409);
      return json({ ok: true, review: { id: rv.id, nom: rv.nom, note: rv.note, texte: rv.texte, createdAt: rv.createdAt } });
    }

    /* ---------- CLIENT : profil, mot de passe, logo ---------- */
    if (type === 'client' && action === 'profil') {
      const soc = str(body.societe, 160).trim(), contact = str(body.contact, 120).trim();
      const nEmail = lc(body.email);
      if (!soc || !contact || !nEmail) return json({ ok: false, code: 'champs' }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nEmail)) return json({ ok: false, code: 'email' }, 400);
      let cur = null, refus = '';
      const r = await modifier(db, uid, C.accounts, function () { return {}; }, function (accounts) {
        cur = accounts[email];
        if (!cur) { refus = 'session'; return false; }
        if (nEmail !== email) {
          if (accounts[nEmail]) { refus = 'email_pris'; return false; }
          cur.email = nEmail; accounts[nEmail] = cur; delete accounts[email];
        }
        cur.societe = soc; cur.nom = contact; cur.contact = contact; cur.tel = str(body.tel, 40); cur.adresse = str(body.adresse, 400); cur.updatedAt = Date.now();
        return { val: accounts };
      });
      if (refus) return json({ ok: false, code: refus }, refus === 'email_pris' ? 409 : 401);
      if (!r.ok) return json({ ok: false, code: 'occupe' }, 409);
      if (nEmail !== email) {
        await modifier(db, uid, 'mdb_espaceSessions', function () { return []; }, function (list) {
          (Array.isArray(list) ? list : []).forEach(function (x) { if (x && x.type === 'client' && x.email === email) x.email = nEmail; });
          return { val: list };
        });
      }
      /* Garder devis / commandes / messages alignés sur le nom de la société. */
      const maj = function (list) { (Array.isArray(list) ? list : []).forEach(function (x) { if (x && String(x.clientId) === String(cur.id)) { x.clientNom = soc; if (x.email !== undefined) x.email = nEmail; } }); return { val: list }; };
      await modifier(db, uid, 'mdb_clientOrders', function () { return []; }, maj);
      await modifier(db, uid, 'mdb_clientQuotes', function () { return []; }, maj);
      await modifier(db, uid, C.threads, function () { return []; }, function (list) { (Array.isArray(list) ? list : []).forEach(function (t) { if (t && String(t.clientId) === String(cur.id)) t.clientNom = soc; }); return { val: list }; });
      return json({ ok: true, acc: compteSur(cur, nEmail) });
    }
    if (action === 'motdepasse') {
      const nouveau = String(body.nouveau || '');
      if (!(await verifierMdp(acc, body.ancien))) return json({ ok: false, code: 'mdp' }, 403);
      if (nouveau.length < 6) return json({ ok: false, code: 'mdp_court' }, 400);
      const salt = rnd(12), hash = await sha256Hex(salt + '|' + nouveau);
      const r = await modifier(db, uid, C.accounts, function () { return {}; }, function (accounts) {
        if (!accounts[email]) return false;
        accounts[email].salt = salt; accounts[email].hash = hash; accounts[email].updatedAt = Date.now();
        return { val: accounts };
      });
      if (!r.ok) return json({ ok: false, code: 'occupe' }, 409);
      return json({ ok: true });
    }
    if (type === 'client' && action === 'logo') {
      const data = String(body.logo || '');
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(data) || data.length > 600000) return json({ ok: false, code: 'image' }, 400);
      const r = await modifier(db, uid, C.accounts, function () { return {}; }, function (accounts) {
        if (!accounts[email]) return false;
        accounts[email].logo = data; accounts[email].updatedAt = Date.now();
        return { val: accounts };
      });
      if (!r.ok) return json({ ok: false, code: 'occupe' }, 409);
      return json({ ok: true });
    }

    /* ---------- FOURNISSEUR : confirmer une commande / déclarer une livraison ---------- */
    if (type === 'fournisseur' && action === 'bc') {
      const id = String(body.id || ''), op = String(body.op || '');
      let res = null, refus = '';
      const r = await modifier(db, uid, 'mdb_bonsCommandeFournisseurs', function () { return []; }, function (list) {
        list = Array.isArray(list) ? list : [];
        const bc = list.filter(function (b) { return b && String(b.id) === id; })[0];
        if (!bc || String(bc.fournisseurId) !== String(acc.fournisseurId) || String(bc.statut || '') === 'brouillon') { refus = 'interdit'; return false; }
        if (op === 'confirm') {
          if (String(bc.statut) !== 'envoye') { refus = 'statut'; return false; }
          bc.statut = 'confirme'; bc.confirmedAt = Date.now();
        } else if (op === 'deliver') {
          if (['confirme', 'envoye'].indexOf(String(bc.statut)) === -1) { refus = 'statut'; return false; }
          bc.livraisonsDeclarees = Array.isArray(bc.livraisonsDeclarees) ? bc.livraisonsDeclarees : [];
          bc.livraisonsDeclarees.push({ at: Date.now(), note: str(body.note, 1000), par: acc.nom || email });
        } else { refus = 'op'; return false; }
        bc.updatedAt = Date.now();
        res = bc;
        return { val: list };
      });
      if (refus) return json({ ok: false, code: refus }, 403);
      if (!r.ok) return json({ ok: false, code: r.code || 'occupe' }, 409);
      return json({ ok: true, bc: res });
    }

    return json({ ok: false, code: 'action' }, 400);
  } catch (e) {
    return json({ ok: false, code: 'erreur', message: String(e && e.message || e) }, 500);
  }
}
