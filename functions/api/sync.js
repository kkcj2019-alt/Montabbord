// Cloudflare Pages Function: /api/sync
/* Index pour la synchro : sans lui, CHAQUE petite verification « quoi de
   neuf depuis X ? » relisait toutes les lignes de l'entreprise (~200),
   toutes les 1,5 s, sur chaque onglet ouvert : des millions de lignes lues
   par jour, d'ou le blocage « D1 free tier exceeded ». Avec l'index, une
   verification sans changement ne lit (presque) rien. Cree une seule fois. */
let _indexPrets = false;
async function assurerIndex(db) {
  if (_indexPrets) return;
  try {
    await db.batch([
      db.prepare('CREATE INDEX IF NOT EXISTS idx_ed_ent_upd ON enterprise_data(enterprise_id, updated_at)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_backups_ent_ts ON backups(enterprise_id, ts)')
    ]);
    _indexPrets = true;
  } catch (e) {}
}
/* ===== SÉCURITÉ : badge de connexion (remis par /api/auth à la connexion) =====
   Jeton lu dans l'en-tête « Authorization: Bearer … » ou le paramètre « _tk ».
   Jusqu'à MDB_SECU_DES on laisse encore passer sans badge (le temps que tous
   les appareils se reconnectent) ; ensuite, sans badge valide : refus (401). */
const MDB_SECU_DES = Date.parse('2026-11-09T06:00:00Z');
let _mdbTableAuth = false;
async function mdbSession(request, db, url, body) {
  let t = '';
  try { const h = request.headers.get('Authorization') || ''; if (h.indexOf('Bearer ') === 0) t = h.slice(7).trim(); } catch (e) {}
  if (!t && url) t = url.searchParams.get('_tk') || '';
  if (!t && body && body._tk) t = String(body._tk);
  if (!t) return null;
  if (!_mdbTableAuth) {
    try { await db.prepare('CREATE TABLE IF NOT EXISTS auth_sessions (token TEXT PRIMARY KEY, enterprise_id TEXT, user_id TEXT, login TEXT, role TEXT, created_at INTEGER, expires_at INTEGER, last_seen INTEGER)').run(); } catch (e) {}
    _mdbTableAuth = true;
  }
  const s = await db.prepare('SELECT * FROM auth_sessions WHERE token = ?').bind(t).first();
  if (!s || !(s.expires_at > Date.now())) return null;
  return s;
}
function mdbSecuActive() { return Date.now() >= MDB_SECU_DES; }
/* { ok, s } : ok = autorisé pour cette entreprise (ou période de transition). */
async function mdbAutorise(request, db, url, uid, body, adminSeulement) {
  const s = await mdbSession(request, db, url, body);
  const bonne = s && (s.role === 'superadmin' || String(s.enterprise_id) === String(uid));
  if (bonne && (!adminSeulement || s.role === 'admin' || s.role === 'superadmin')) return { ok: true, s };
  return { ok: !mdbSecuActive(), s: bonne ? s : null };
}
function mdbRefus(cors, status) {
  return new Response(JSON.stringify({ ok: false, code: 'auth', error: 'Connexion requise' }), { status: status || 401, headers: cors });
}

/* Clés gérées UNIQUEMENT par le serveur : jamais renvoyées ni écrites par /api/sync. */
const CLES_SERVEUR = ['mdb_espaceSessions', 'mdb_espaceEchecs'];
const CLES_SERVEUR_ECRITURE = ['mdb_espaceSessions', 'mdb_espaceEchecs', 'mdb_portailSessions'];
function parseV(v) { if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch (e) { return null; } }

/* ===== DROITS À L'INTÉRIEUR D'UNE ENTREPRISE (comptes « utilisateur ») =====
   Un utilisateur non administrateur :
   - ne reçoit PAS les empreintes de mot de passe des AUTRES comptes
     (sinon on pouvait les casser hors ligne) ;
   - ne peut PAS modifier les comptes : ni se donner les droits administrateur,
     ni changer ses pages autorisées, ni toucher aux autres comptes, ni en créer.
     Il peut seulement mettre à jour SA fiche (mot de passe, photo, préférences). */
function estUtilisateurSimple(s) { return !!(s && s.role && s.role !== 'admin' && s.role !== 'superadmin'); }
const SECRETS_COMPTE = ['passwordHash', 'password', 'pointageCode'];
function comptesPourUtilisateur(arr, moiId) {
  if (!Array.isArray(arr)) return arr;
  return arr.map(u => {
    if (!u || typeof u !== 'object' || String(u.id) === String(moiId)) return u;
    const c = Object.assign({}, u);
    SECRETS_COMPTE.forEach(k => { delete c[k]; });
    return c;
  });
}
const CHAMPS_PROTEGES = ['id', 'login', 'email', 'isAdmin', 'adminType', 'isSuperAdmin', 'role', 'sections', 'deniedPages', 'caisseId', 'caisseCentralisee', 'caissesAutorisees', 'actif', 'status', 'desactive', 'employeeId', 'dashSpecial', 'permissions', 'modules'];
function fusionComptesUtilisateur(serveur, client, moiId) {
  const srv = Array.isArray(serveur) ? serveur : [];
  const cli = Array.isArray(client) ? client : [];
  const moiCli = cli.filter(u => u && String(u.id) === String(moiId))[0];
  return srv.map(u => {
    if (!u || String(u.id) !== String(moiId) || !moiCli) return u;
    const out = Object.assign({}, u);
    Object.keys(moiCli).forEach(k => { if (CHAMPS_PROTEGES.indexOf(k) === -1) out[k] = moiCli[k]; });
    return out;
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!db) {
      return new Response(JSON.stringify({ error: 'Database D1 binding not found' }), {
        status: 500,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    await assurerIndex(db);

    // GET /api/sync?uid=...[&since=...][&cle=...][&cles=...][&prefix=...][&ping=1]
    if (request.method === 'GET') {
      const rawUid = url.searchParams.get('uid');
      if (!rawUid) {
        return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders });
      }
      const uid = rawUid.replace(/^["']+|["']+$/g, '').trim();

      // Mode ping ultra-rapide : utilisé pour vérifier que le cloud est joignable
      if (url.searchParams.get('ping') === '1') {
        try {
          // Requête minimaliste pour valider le binding D1 sans charger toutes les données
          await db.prepare('SELECT 1 as ok').first();
          return new Response(JSON.stringify({ ok: true, ping: true, uid: uid, serverTime: Date.now().toString() }), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, ping: false, error: e.message || String(e) }), { status: 503, headers: corsHeaders });
        }
      }

      /* Vérification publique d'un document (QR imprimé) : on renvoie SEULEMENT
         la fiche de ce jeton, plus jamais le registre complet ni la paie. */
      const verifTok = url.searchParams.get('verif');
      if (verifTok) {
        const lireK = async (k) => { const r = await db.prepare('SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1').bind(uid, '"' + uid + '"', k).first(); return r ? parseV(r.valeur) : null; };
        const trouve = (l) => (Array.isArray(l) ? l : []).filter(x => x && String(x.token) === String(verifTok))[0] || null;
        let rec = trouve(await lireK('mdb_qr_verifs')), bulletin = false;
        if (!rec) {
          let bv = await lireK('mdb_paye.bulletinVerifs');
          if (!Array.isArray(bv)) { const p = await lireK('mdb_paye'); bv = p && Array.isArray(p.bulletinVerifs) ? p.bulletinVerifs : []; }
          rec = trouve(bv); bulletin = !!rec;
        }
        let reception = null;
        if (rec && bulletin) reception = trouve(await lireK('mdb_receptionsBulletins'));
        const garder = bulletin ? ['token', 'nom', 'matricule', 'mois', 'brut', 'net', 'netAvantSolde', 'date', 'hash'] : ['token', 'type', 'ref', 'tiers', 'libelle', 'date', 'montant', 'dateCreation', 'hash'];
        const out = rec ? {} : null;
        if (rec) garder.forEach(k => { if (rec[k] !== undefined) out[k] = rec[k]; });
        return new Response(JSON.stringify({ ok: true, rec: out, bulletin, reception: reception ? { dateReception: reception.dateReception || '' } : null }), { headers: corsHeaders });
      }

      /* SÉCURITÉ : badge obligatoire (après la période de transition). */
      const _au = await mdbAutorise(request, db, url, uid, null, false);
      const CLES_PUBLIQUES = ['mdb_clientLogos'];
      const cleDemandee = url.searchParams.get('cle');
      if (!_au.ok && !(cleDemandee && CLES_PUBLIQUES.indexOf(cleDemandee) !== -1)) return mdbRefus(corsHeaders);
      if (uid === '__SUPER_ADMIN__' && !(_au.s && _au.s.role === 'superadmin')) return mdbRefus(corsHeaders, 403);

      const since = url.searchParams.get('since') || '0';
      const cle = url.searchParams.get('cle');
      const cles = url.searchParams.get('cles');
      const prefix = url.searchParams.get('prefix');
      const limitParam = url.searchParams.get('limit');

      // Normaliser l'uid pour matcher les enregistrements existants (avec ou sans guillemets)
      let sql = "SELECT cle, valeur, updated_at FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle NOT IN ('mdb_espaceSessions', 'mdb_espaceEchecs')";
      const params = [uid, '"' + uid + '"'];

      // Mode meta : ne renvoie que les clés + tailles (réponse minuscule, quasi aucun CPU)
      // Utile pour diagnostiquer quelle rubrique gonfle le payload complet.
      if (url.searchParams.get('meta') === '1') {
        const metaSql = 'SELECT cle, length(valeur) as len, updated_at FROM enterprise_data WHERE (enterprise_id = ? OR enterprise_id = ?) ORDER BY len DESC LIMIT 300';
        const metaRes = await db.prepare(metaSql).bind(...params).all();
        const mrows = metaRes.results || [];
        return new Response(JSON.stringify({
          ok: true,
          uid: uid,
          total: mrows.length,
          bytes: mrows.reduce((s, r) => s + (r.len || 0), 0),
          keys: mrows.map(r => ({ cle: r.cle, len: r.len, at: r.updated_at }))
        }), { headers: corsHeaders });
      }

      if (cle) {
        sql += ' AND cle = ?';
        params.push(cle);
      } else if (cles) {
        const keyList = cles.split(',').map(k => k.trim()).filter(Boolean);
        if (keyList.length > 0) {
          const placeholders = keyList.map(() => '?').join(',');
          sql += ` AND cle IN (${placeholders})`;
          params.push(...keyList);
        }
      } else if (prefix) {
        sql += ' AND cle LIKE ?';
        params.push(prefix + '%');
      }
      /* Copies de bulletins (espace employé) : jamais dans la synchro générale,
         sinon chaque appareil téléchargerait tous les bulletins. */
      if (!cle && !cles && !prefix) sql += " AND cle NOT LIKE 'mdb_bulSnap:%' AND cle NOT IN ('paye', 'operationsCaisse', 'production', 'factures')";
      /* ('paye', 'operationsCaisse'… sans « mdb_ ») : vieilles copies (≈ 3 Mo)
         que plus aucun écran ne lit ; elles alourdissaient chaque connexion. */

      if (since && since !== '0') {
        sql += ' AND updated_at > ?';
        params.push(since);
      }

      // Éviter de charger TOUT d'un coup : limiter pour rester sous les limites CPU de Cloudflare
      sql += ' ORDER BY updated_at DESC';
      const fullSync = url.searchParams.get('all') === '1' || url.searchParams.get('full') === '1';
      let limit = 500;
      if (cle || cles || prefix) {
        limit = 1500;
      } else if (fullSync) {
        limit = 1000;
      }
      if (limitParam) {
        const lp = parseInt(limitParam, 10);
        if (!isNaN(lp) && lp > 0 && lp <= 2000) limit = lp;
      }
      sql += ' LIMIT ' + limit;

      const stmt = db.prepare(sql);
      const res = await stmt.bind(...params).all();
      const rows = res.results || [];

      /* Assemblage SANS JSON.parse / JSON.stringify des grosses valeurs.
         Parser puis re-sérialiser ~9 Mo de JSON dépassait le budget CPU de
         Cloudflare (Error 1102). On recolle les valeurs brutes (déjà du JSON
         valide à l'écriture) dans la réponse, en dédupliquant par clé la plus
         récente (rows ordonnées updated_at DESC). */
      const seen = new Set();
      const dataParts = [];
      const tsParts = [];
      let maxUpdatedAt = since;
      let uniq = 0;
      const _simple = estUtilisateurSimple(_au.s);
      for (const r of rows) {
        if (seen.has(r.cle)) continue;
        seen.add(r.cle);
        uniq++;
        let raw = typeof r.valeur === 'string' ? r.valeur : JSON.stringify(r.valeur);
        if (_simple && r.cle === 'mdb_users') {
          try { raw = JSON.stringify(comptesPourUtilisateur(parseV(raw), _au.s.user_id)); } catch (eCU) {}
        }
        const s = raw.trim();
        const c0 = s.charAt(0);
        const cl = s.charAt(s.length - 1);
        let js;
        if (s.length < 4096) {
          /* Petite valeur : on garde la sémantique d'origine (parse propre),
             le coût CPU est négligeable. */
          try { js = JSON.stringify(JSON.parse(s)); } catch (e) { js = JSON.stringify(raw); }
        } else if ((c0 === '{' && cl === '}') || (c0 === '[' && cl === ']') || (c0 === '"' && cl === '"')) {
          js = s;                       /* JSON produit par JSON.stringify : valide */
        } else {
          js = JSON.stringify(raw);     /* scalaire stocké brut (string) : on l'échappe */
        }
        dataParts.push(JSON.stringify(r.cle) + ':' + js);
        tsParts.push(JSON.stringify(r.cle) + ':' + JSON.stringify(r.updated_at));
        if (r.updated_at && r.updated_at > maxUpdatedAt) {
          maxUpdatedAt = r.updated_at;
        }
      }

      const body = '{"ok":true,"uid":' + JSON.stringify(uid) +
        ',"data":{' + dataParts.join(',') + '}' +
        ',"ts":{' + tsParts.join(',') + '}' +
        ',"maxTs":' + JSON.stringify(maxUpdatedAt) +
        ',"count":' + uniq +
        ',"limited":' + (rows.length >= limit) +
        ',"serverTime":' + JSON.stringify(Date.now().toString()) + '}';

      return new Response(body, { headers: corsHeaders });
    }

    // POST /api/sync { uid: '...', updates: { [cle]: val } } OR { uid: '...', rows: [ { cle, data, updated_at } ] }
    if (request.method === 'POST') {
      const body = await request.json();
      const rawUid = body.uid;
      const uid = (rawUid || '').replace(/^["']+|["']+$/g, '').trim();
      let updates = body.updates || {};

      if (Array.isArray(body.rows)) {
        for (const row of body.rows) {
          if (row && row.cle) updates[row.cle] = row.data;
        }
      }

      if (!uid) {
        return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders });
      }
      const _auP = await mdbAutorise(request, db, url, uid, body, false);
      if (!_auP.ok) {
        /* Seule exception : une entreprise TOUTE NEUVE (aucun compte utilisateur
           encore enregistré) peut recevoir ses premières données, sinon on ne
           pourrait jamais créer de nouvelle entreprise. */
        const dejaComptes = await db.prepare("SELECT 1 AS x FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = 'mdb_users' LIMIT 1").bind(uid, '"' + uid + '"').first();
        if (dejaComptes) return mdbRefus(corsHeaders);
      }
      if (uid === '__SUPER_ADMIN__' && !(_auP.s && _auP.s.role === 'superadmin')) return mdbRefus(corsHeaders, 403);
      CLES_SERVEUR_ECRITURE.forEach(k => { delete updates[k]; });
      if (estUtilisateurSimple(_auP.s) && updates.mdb_users !== undefined) {
        try {
          const rU = await db.prepare("SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = 'mdb_users' ORDER BY updated_at DESC LIMIT 1").bind(uid, '"' + uid + '"').first();
          const srvU = rU ? parseV(rU.valeur) : null;
          if (Array.isArray(srvU) && srvU.length) updates.mdb_users = fusionComptesUtilisateur(srvU, parseV(updates.mdb_users), _auP.s.user_id);
          else delete updates.mdb_users;
        } catch (eFU) { delete updates.mdb_users; }
      }
      /* Comptes utilisateurs : plus aucun mot de passe ni code de pointage en clair au cloud. */
      if (updates.mdb_users !== undefined) {
        try {
          let us = parseV(updates.mdb_users);
          if (Array.isArray(us)) {
            for (const u of us) {
              if (!u || typeof u !== 'object') continue;
              if (u.password && u.passwordHash) u.password = '';
              if (u.pointageCode) {
                if (!u.pointageCodeHash) {
                  const dg = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(u.pointageCode)));
                  u.pointageCodeHash = Array.from(new Uint8Array(dg)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
                }
                delete u.pointageCode;
              }
            }
            updates.mdb_users = us;
          }
        } catch (eU) {}
      }

      if (estUtilisateurSimple(_auP.s)) ['mdb_users', 'mdb_entreprise', 'mdb_portailComptes'].forEach(k => { const v = updates[k]; if (v === null || (v && v.__mdbFieldValueDelete)) delete updates[k]; });
      const keys = Object.keys(updates);
      if (keys.length === 0) {
        return new Response(JSON.stringify({ ok: true, updated: 0, ts: Date.now().toString() }), { headers: corsHeaders });
      }

      const now = Date.now().toString();
      const statements = [];

      for (const k of keys) {
        const val = updates[k];
        if (val === null || val === undefined || (val && val.__mdbFieldValueDelete)) {
          statements.push(
            db.prepare('DELETE FROM enterprise_data WHERE enterprise_id = ? AND cle = ?').bind(uid, k)
          );
        } else {
          const valStr = typeof val === 'string' ? val : JSON.stringify(val);
          statements.push(
            db.prepare(
              `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
            ).bind(uid, k, valStr, now)
          );
        }
      }

      // Execute in batch (max 100 per batch in D1)
      const batchSize = 50;
      for (let i = 0; i < statements.length; i += batchSize) {
        const chunk = statements.slice(i, i + batchSize);
        await db.batch(chunk);
      }

      return new Response(JSON.stringify({
        ok: true,
        updated: keys.length,
        ts: now
      }), { headers: corsHeaders });
    }

    // DELETE /api/sync?uid=...[&cle=...]
    if (request.method === 'DELETE') {
      const uid = url.searchParams.get('uid');
      const cle = url.searchParams.get('cle');
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders });
      }
      /* Effacer TOUTES les données : administrateur uniquement, même en transition. */
      const _auD = await mdbAutorise(request, db, url, uid, null, !cle);
      if (!_auD.ok || (!cle && !_auD.s)) return mdbRefus(corsHeaders, 403);
      /* Un simple utilisateur ne peut pas effacer les comptes ni la fiche entreprise. */
      if (cle && estUtilisateurSimple(_auD.s) && ['mdb_users', 'mdb_entreprise', 'mdb_portailComptes'].indexOf(cle) !== -1) return mdbRefus(corsHeaders, 403);
      if (cle) {
        await db.prepare('DELETE FROM enterprise_data WHERE enterprise_id = ? AND cle = ?').bind(uid, cle).run();
      } else {
        await db.prepare('DELETE FROM enterprise_data WHERE enterprise_id = ?').bind(uid).run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || String(err)
    }), { status: 500, headers: corsHeaders });
  }
}
