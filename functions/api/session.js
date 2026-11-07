// Cloudflare Pages Function: /api/session
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

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    /* SÉCURITÉ : sessions d'appareils d'une entreprise = badge de cette entreprise. */
    {
      let entS = url.searchParams.get('enterprise_id');
      let bodyS = null;
      if (!entS && request.method === 'POST') { try { bodyS = await request.clone().json(); entS = bodyS && bodyS.enterprise_id; } catch (eB) {} }
      if (entS && !(await mdbAutorise(request, db, url, entS, bodyS, false)).ok) return mdbRefus(corsHeaders);
    }

    // GET /api/session?enterprise_id=...&user_id=...
    if (request.method === 'GET') {
      const enterpriseId = url.searchParams.get('enterprise_id');
      const userId = url.searchParams.get('user_id');

      if (!enterpriseId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id' }), { status: 400, headers: corsHeaders });
      }

      if (userId) {
        const stmt = db.prepare('SELECT * FROM sessions WHERE enterprise_id = ? AND user_id = ? LIMIT 1');
        const sess = await stmt.bind(enterpriseId, userId).first();
        if (!sess) return new Response(JSON.stringify({ found: false }), { headers: corsHeaders });
        let data = {};
        try { data = JSON.parse(sess.data || '{}'); } catch (e) {}
        return new Response(JSON.stringify({ found: true, session: { enterprise_id: sess.enterprise_id, user_id: sess.user_id, token: data.token || '', data, updated_at: sess.updated_at } }), { headers: corsHeaders });
      }

      const stmt = db.prepare('SELECT * FROM sessions WHERE enterprise_id = ?');
      const res = await stmt.bind(enterpriseId).all();
      const list = (res.results || []).map(r => {
        let d = {};
        try { d = JSON.parse(r.data || '{}'); } catch (e) {}
        return { enterprise_id: r.enterprise_id, user_id: r.user_id, token: d.token || '', data: d, updated_at: r.updated_at };
      });
      return new Response(JSON.stringify({ sessions: list }), { headers: corsHeaders });
    }

    // POST /api/session
    if (request.method === 'POST') {
      const body = await request.json();
      const enterpriseId = body.enterprise_id;
      const userId = body.user_id;
      const data = body.data || {};
      const now = new Date().toISOString();

      if (!enterpriseId || !userId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id or user_id' }), { status: 400, headers: corsHeaders });
      }

      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const stmt = db.prepare(`
        INSERT INTO sessions (enterprise_id, user_id, data, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(enterprise_id, user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `);
      await stmt.bind(enterpriseId, userId, dataStr, now).run();

      return new Response(JSON.stringify({ ok: true, enterprise_id: enterpriseId, user_id: userId }), { headers: corsHeaders });
    }

    // DELETE /api/session?enterprise_id=...&user_id=...
    if (request.method === 'DELETE') {
      const enterpriseId = url.searchParams.get('enterprise_id');
      const userId = url.searchParams.get('user_id');
      if (!enterpriseId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id' }), { status: 400, headers: corsHeaders });
      }
      if (userId) {
        await db.prepare('DELETE FROM sessions WHERE enterprise_id = ? AND user_id = ?').bind(enterpriseId, userId).run();
      } else {
        await db.prepare('DELETE FROM sessions WHERE enterprise_id = ?').bind(enterpriseId).run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: corsHeaders });
  }
}
