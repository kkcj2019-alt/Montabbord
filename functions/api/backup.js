// Cloudflare Pages Function: /api/backup
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

    // GET /api/backup?enterprise_id=...[&ts=...]
    if (request.method === 'GET') {
      const enterpriseId = url.searchParams.get('enterprise_id');
      const ts = url.searchParams.get('ts');

      if (!enterpriseId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id' }), { status: 400, headers: corsHeaders });
      }
      if (!(await mdbAutorise(request, db, url, enterpriseId, null, true)).ok) return mdbRefus(corsHeaders);

      if (ts) {
        const stmt = db.prepare('SELECT * FROM backups WHERE enterprise_id = ? AND ts = ? LIMIT 1');
        const bkp = await stmt.bind(enterpriseId, parseInt(ts, 10)).first();
        if (!bkp) return new Response(JSON.stringify({ found: false }), { headers: corsHeaders });
        let data = {};
        try { data = JSON.parse(bkp.data || '{}'); } catch (e) {}
        return new Response(JSON.stringify({ found: true, backup: { id: bkp.id, enterprise_id: bkp.enterprise_id, ts: bkp.ts, date: bkp.date, data, created_at: bkp.created_at } }), { headers: corsHeaders });
      }

      const stmt = db.prepare('SELECT id, enterprise_id, ts, date, created_at FROM backups WHERE enterprise_id = ? ORDER BY ts DESC LIMIT 20');
      const res = await stmt.bind(enterpriseId).all();
      return new Response(JSON.stringify({ backups: res.results || [] }), { headers: corsHeaders });
    }

    // POST /api/backup
    if (request.method === 'POST') {
      const body = await request.json();
      const enterpriseId = body.enterprise_id;
      const ts = body.ts || Date.now();
      const date = body.date || new Date().toISOString();
      const dataStr = typeof body.data === 'string' ? body.data : JSON.stringify(body.data || {});
      const id = body.id || (enterpriseId + '_' + ts);
      const createdAt = new Date().toISOString();

      if (!enterpriseId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id' }), { status: 400, headers: corsHeaders });
      }
      if (!(await mdbAutorise(request, db, url, enterpriseId, body, false)).ok) return mdbRefus(corsHeaders);

      const stmt = db.prepare(`
        INSERT INTO backups (id, enterprise_id, ts, date, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, date = excluded.date
      `);
      await stmt.bind(id, enterpriseId, ts, date, dataStr, createdAt).run();
      /* On ne garde que les 10 sauvegardes cloud les plus recentes : avant,
         la purge cote appli ne voyait que 20 lignes et n'effacait jamais
         rien (5 Mo de plus a chaque sauvegarde, sans fin). */
      try {
        await db.prepare('DELETE FROM backups WHERE enterprise_id = ? AND id NOT IN (SELECT id FROM backups WHERE enterprise_id = ? ORDER BY ts DESC LIMIT 10)').bind(enterpriseId, enterpriseId).run();
      } catch (ePr) {}

      return new Response(JSON.stringify({ ok: true, id, ts }), { headers: corsHeaders });
    }

    // DELETE /api/backup?id=... OR ?enterprise_id=...&ts=...
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      const enterpriseId = url.searchParams.get('enterprise_id');
      const ts = url.searchParams.get('ts');

      /* Supprimer une sauvegarde : administrateur connecté de CETTE entreprise. */
      const entDel = enterpriseId || String(id || '').split('_')[0];
      const auDel = await mdbAutorise(request, db, url, entDel, null, true);
      if (!auDel.ok || !auDel.s) return mdbRefus(corsHeaders, 403);
      if (id) {
        await db.prepare('DELETE FROM backups WHERE id = ? AND enterprise_id = ?').bind(id, entDel).run();
      } else if (enterpriseId && ts) {
        await db.prepare('DELETE FROM backups WHERE enterprise_id = ? AND ts = ?').bind(enterpriseId, parseInt(ts, 10)).run();
      } else {
        return new Response(JSON.stringify({ error: 'Missing id or enterprise_id + ts' }), { status: 400, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: corsHeaders });
  }
}
