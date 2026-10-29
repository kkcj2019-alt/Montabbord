// Cloudflare Pages Function: /api/session
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
