// Cloudflare Pages Function: /api/sync
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

    // GET /api/sync?uid=...[&since=...]
    if (request.method === 'GET') {
      const uid = url.searchParams.get('uid');
      if (!uid) {
        return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders });
      }

      const since = url.searchParams.get('since') || '0';
      let rows;
      if (since && since !== '0') {
        const stmt = db.prepare('SELECT cle, valeur, updated_at FROM enterprise_data WHERE enterprise_id = ? AND updated_at > ?');
        const res = await stmt.bind(uid, since).all();
        rows = res.results || [];
      } else {
        const stmt = db.prepare('SELECT cle, valeur, updated_at FROM enterprise_data WHERE enterprise_id = ?');
        const res = await stmt.bind(uid).all();
        rows = res.results || [];
      }

      const data = {};
      const tsMap = {};
      let maxUpdatedAt = since;
      for (const r of rows) {
        try {
          data[r.cle] = JSON.parse(r.valeur);
        } catch (e) {
          data[r.cle] = r.valeur;
        }
        tsMap[r.cle] = r.updated_at;
        if (r.updated_at && r.updated_at > maxUpdatedAt) {
          maxUpdatedAt = r.updated_at;
        }
      }

      return new Response(JSON.stringify({
        ok: true,
        uid: uid,
        data: data,
        ts: tsMap,
        maxTs: maxUpdatedAt,
        count: rows.length,
        serverTime: Date.now().toString()
      }), { headers: corsHeaders });
    }

    // POST /api/sync { uid: '...', updates: { [cle]: val } } OR { uid: '...', rows: [ { cle, data, updated_at } ] }
    if (request.method === 'POST') {
      const body = await request.json();
      const uid = body.uid;
      let updates = body.updates || {};

      if (Array.isArray(body.rows)) {
        for (const row of body.rows) {
          if (row && row.cle) updates[row.cle] = row.data;
        }
      }

      if (!uid) {
        return new Response(JSON.stringify({ error: 'Missing uid' }), { status: 400, headers: corsHeaders });
      }

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
