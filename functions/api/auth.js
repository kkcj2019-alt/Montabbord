/* Cloudflare Pages Function : /api/auth
   CONNEXION VÉRIFIÉE PAR LE SERVEUR.

   Avant : l'application téléchargeait la liste des utilisateurs (avec les
   empreintes de mot de passe) et vérifiait le mot de passe sur l'appareil.
   Le serveur ne savait donc jamais qui était connecté.

   Maintenant : le serveur vérifie l'identifiant et le mot de passe, puis
   remet un jeton aléatoire (« badge numérique ») gardé dans la table
   auth_sessions. Chaque page l'envoie ensuite avec ses demandes.
   - 5 essais ratés → blocage 15 minutes (par entreprise + identifiant) ;
   - jeton valable 30 jours, prolongé à l'usage, révocable (déconnexion) ;
   - le jeton n'est jamais dérivé du mot de passe. */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
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
function nettoyerUid(u) { return String(u || '').replace(/^["']+|["']+$/g, '').trim(); }

const DUREE = 30 * 24 * 3600 * 1000;
const SA_UID = '__SUPER_ADMIN__';
/* Entreprise propriétaire de la plateforme : ses administrateurs peuvent
   configurer le mot de passe du Super Admin (la configuration par défaut
   « admin / admin123 » n'existe plus). */
const ENT_PROPRIETAIRE = '1aWBeqTjy3Q1glGMFtxOT1o2vwq2';

let _tablesPretes = false;
async function tables(db) {
  if (_tablesPretes) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, enterprise_id TEXT, user_id TEXT, login TEXT, role TEXT, created_at INTEGER, expires_at INTEGER, last_seen INTEGER)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_auth_ent ON auth_sessions(enterprise_id)'),
    db.prepare('CREATE TABLE IF NOT EXISTS auth_echecs (k TEXT PRIMARY KEY, n INTEGER, until INTEGER, last INTEGER)')
  ]);
  _tablesPretes = true;
}
async function lireCle(db, uid, cle) {
  const r = await db.prepare('SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1')
    .bind(uid, '"' + uid + '"', cle).first();
  return r ? parseVal(r.valeur, null) : null;
}
async function verifierHash(rec, pass) {
  if (!rec || pass == null || pass === '') return false;
  const p = String(pass);
  const h = rec.passwordHash;
  if (h && typeof h === 'string' && h.indexOf('sha256:') === 0) {
    const parts = h.split(':');
    if (parts.length === 3 && parts[1] && ('sha256:' + parts[1] + ':' + await sha256Hex(parts[1] + '|' + p)) === h) return true;
  }
  /* Ancien champ en clair (comptes pas encore migrés). */
  if (rec.password && String(rec.password) === p) return true;
  return false;
}
async function bloque(db, k) {
  const r = await db.prepare('SELECT until FROM auth_echecs WHERE k = ?').bind(k).first();
  return !!(r && r.until && r.until > Date.now());
}
async function echec(db, k) {
  const now = Date.now();
  const r = await db.prepare('SELECT n FROM auth_echecs WHERE k = ?').bind(k).first();
  let n = (r && r.n ? r.n : 0) + 1, until = 0;
  if (n >= 5) { until = now + 15 * 60 * 1000; n = 0; }
  await db.prepare('INSERT INTO auth_echecs (k, n, until, last) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, until = excluded.until, last = excluded.last')
    .bind(k, n, until, now).run();
}
async function reussite(db, k) { await db.prepare('DELETE FROM auth_echecs WHERE k = ?').bind(k).run(); }

async function ouvrir(db, uid, user, role) {
  const token = 'MDB' + rnd(28);
  const now = Date.now();
  await db.prepare('INSERT INTO auth_sessions (token, enterprise_id, user_id, login, role, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(token, uid, String(user.id || ''), String(user.login || ''), role, now, now + DUREE, now).run();
  /* Ménage : sessions expirées (rapide grâce à la clé primaire / index). */
  try { await db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').bind(now).run(); } catch (e) {}
  return { token, expiresAt: now + DUREE };
}
export async function lireSession(db, token) {
  if (!token) return null;
  await tables(db);
  const s = await db.prepare('SELECT * FROM auth_sessions WHERE token = ?').bind(String(token)).first();
  if (!s || !(s.expires_at > Date.now())) return null;
  return s;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (!db) return json({ ok: false, code: 'db' }, 500);
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  try {
    await tables(db);
    const body = await request.json();
    const action = lc(body.action);
    const hdr = request.headers.get('Authorization') || '';
    const token = String(body.token || (hdr.indexOf('Bearer ') === 0 ? hdr.slice(7) : '')).trim();

    /* ---------- Connexion d'un utilisateur d'entreprise ---------- */
    if (action === 'login') {
      const uid = nettoyerUid(body.uid);
      const login = String(body.login || '').trim();
      const pass = String(body.pass || '');
      if (!uid || !login || !pass) return json({ ok: false, code: 'champs' }, 400);
      const k = uid === 'SUPER-ADMIN' ? 'sa|' : 'u|' + uid + '|' + lc(login);
      if (await bloque(db, k)) return json({ ok: false, code: 'bloque' }, 429);

      if (uid === 'SUPER-ADMIN') {
        const cfg = await lireCle(db, SA_UID, 'config');
        if (!cfg || !cfg.passwordHash) return json({ ok: false, code: 'sa_non_configure' }, 403);
        /* Accès rapide (« by kkcj ») : seul le mot de passe compte, l'identifiant est facultatif. */
        if (!(await verifierHash(cfg, pass))) { await echec(db, k); return json({ ok: false, code: 'mdp' }, 403); }
        await reussite(db, k);
        const o = await ouvrir(db, 'SUPER-ADMIN', { id: 'SUPER-ADMIN', login: cfg.login }, 'superadmin');
        return json({ ok: true, token: o.token, expiresAt: o.expiresAt, user: { id: 'SUPER-ADMIN', login: cfg.login, nom: cfg.nom || 'Super Admin', role: 'superadmin' } });
      }

      const users = await lireCle(db, uid, 'mdb_users');
      const list = Array.isArray(users) ? users : [];
      const ll = lc(login);
      const u = list.filter(function (x) { return x && (lc(x.login) === ll || (x.email && lc(x.email) === ll)); })[0];
      if (!u || !(await verifierHash(u, pass))) { await echec(db, k); return json({ ok: false, code: 'mdp' }, 403); }
      if (u.actif === false || u.status === 'inactif' || u.desactive === true) return json({ ok: false, code: 'desactive' }, 403);
      await reussite(db, k);
      const role = u.isAdmin ? 'admin' : 'user';
      const o = await ouvrir(db, uid, u, role);
      return json({ ok: true, token: o.token, expiresAt: o.expiresAt, user: { id: u.id, login: u.login, nom: u.nom || '', role: role } });
    }

    /* ---------- Vérifier son jeton ---------- */
    if (action === 'check') {
      const s = await lireSession(db, token);
      if (!s) return json({ ok: false, code: 'session' }, 401);
      const now = Date.now();
      /* Prolongé à l'usage (au plus une écriture par heure). */
      if (now - (s.last_seen || 0) > 3600 * 1000) {
        await db.prepare('UPDATE auth_sessions SET last_seen = ?, expires_at = ? WHERE token = ?').bind(now, now + DUREE, s.token).run();
      }
      return json({ ok: true, uid: s.enterprise_id, user: { id: s.user_id, login: s.login, role: s.role }, expiresAt: Math.max(s.expires_at, now + DUREE) });
    }

    /* ---------- Déconnexion ---------- */
    if (action === 'logout') {
      if (token) await db.prepare('DELETE FROM auth_sessions WHERE token = ?').bind(token).run();
      return json({ ok: true });
    }

    /* ---------- Déconnecter tous les appareils d'un utilisateur (admin) ---------- */
    if (action === 'revoquer') {
      const s = await lireSession(db, token);
      if (!s || (s.role !== 'admin' && s.role !== 'superadmin')) return json({ ok: false, code: 'interdit' }, 403);
      const cible = String(body.userId || '');
      if (!cible) return json({ ok: false, code: 'champs' }, 400);
      await db.prepare('DELETE FROM auth_sessions WHERE enterprise_id = ? AND user_id = ?').bind(s.enterprise_id, cible).run();
      return json({ ok: true });
    }

    /* ---------- Mot de passe du Super Admin (par un admin de l'entreprise propriétaire) ---------- */
    if (action === 'sa_config') {
      const s = await lireSession(db, token);
      let autorise = s && ((s.role === 'admin' && s.enterprise_id === ENT_PROPRIETAIRE) || s.role === 'superadmin');
      if (!autorise && body.adminLogin && body.adminPass) {
        /* Ou : identifiants d'un ADMINISTRATEUR de l'entreprise propriétaire, vérifiés ici. */
        const k = 'u|' + ENT_PROPRIETAIRE + '|' + lc(body.adminLogin);
        if (await bloque(db, k)) return json({ ok: false, code: 'bloque' }, 429);
        const us = await lireCle(db, ENT_PROPRIETAIRE, 'mdb_users');
        const u = (Array.isArray(us) ? us : []).filter(function (x) { return x && x.isAdmin && (lc(x.login) === lc(body.adminLogin) || (x.email && lc(x.email) === lc(body.adminLogin))); })[0];
        if (!u || !(await verifierHash(u, body.adminPass))) { await echec(db, k); return json({ ok: false, code: 'mdp' }, 403); }
        await reussite(db, k);
        autorise = true;
      }
      if (!autorise) return json({ ok: false, code: 'interdit' }, 403);
      const login = String(body.login || '').trim(), pass = String(body.pass || '');
      if (!login || pass.length < 10) return json({ ok: false, code: 'mdp_court' }, 400);
      const salt = rnd(8);
      const cfg = { login: login, nom: String(body.nom || 'Super Admin').slice(0, 80), passwordHash: 'sha256:' + salt + ':' + await sha256Hex(salt + '|' + pass), updatedAt: Date.now() };
      await db.prepare(`INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`)
        .bind(SA_UID, 'config', JSON.stringify(cfg), Date.now().toString()).run();
      return json({ ok: true });
    }

    return json({ ok: false, code: 'action' }, 400);
  } catch (e) {
    return json({ ok: false, code: 'erreur', message: String(e && e.message || e) }, 500);
  }
}
