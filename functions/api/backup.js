// Cloudflare Pages Function: /api/backup
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

    // GET /api/backup?enterprise_id=...[&ts=...]
    if (request.method === 'GET') {
      const enterpriseId = url.searchParams.get('enterprise_id');
      const ts = url.searchParams.get('ts');

      if (!enterpriseId) {
        return new Response(JSON.stringify({ error: 'Missing enterprise_id' }), { status: 400, headers: corsHeaders });
      }

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

      const stmt = db.prepare(`
        INSERT INTO backups (id, enterprise_id, ts, date, data, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, date = excluded.date
      `);
      await stmt.bind(id, enterpriseId, ts, date, dataStr, createdAt).run();

      return new Response(JSON.stringify({ ok: true, id, ts }), { headers: corsHeaders });
    }

    // DELETE /api/backup?id=... OR ?enterprise_id=...&ts=...
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      const enterpriseId = url.searchParams.get('enterprise_id');
      const ts = url.searchParams.get('ts');

      if (id) {
        await db.prepare('DELETE FROM backups WHERE id = ?').bind(id).run();
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
