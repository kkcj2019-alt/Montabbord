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

      const since = url.searchParams.get('since') || '0';
      const cle = url.searchParams.get('cle');
      const cles = url.searchParams.get('cles');
      const prefix = url.searchParams.get('prefix');
      const limitParam = url.searchParams.get('limit');

      // Normaliser l'uid pour matcher les enregistrements existants (avec ou sans guillemets)
      let sql = 'SELECT cle, valeur, updated_at FROM enterprise_data WHERE (enterprise_id = ? OR enterprise_id = ?)';
      const params = [uid, '"' + uid + '"'];

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
        limited: rows.length >= limit,
        serverTime: Date.now().toString()
      }), { headers: corsHeaders });
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
