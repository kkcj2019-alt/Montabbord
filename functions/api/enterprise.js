// Cloudflare Pages Function: /api/enterprise
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

    // GET /api/enterprise?identifiant=... OR ?id=... OR ?list=1
    if (request.method === 'GET') {
      const list = url.searchParams.get('list');
      if (list === '1' || list === 'true') {
        const stmt = db.prepare('SELECT id, identifiant, email, nom, updated_at FROM enterprises ORDER BY nom ASC');
        const res = await stmt.all();
        return new Response(JSON.stringify({
          data: res.results || [],
          count: (res.results || []).length
        }), { headers: corsHeaders });
      }

      const identifiant = url.searchParams.get('identifiant');
      const id = url.searchParams.get('id');

      let ent = null;
      if (id) {
        const stmt = db.prepare('SELECT * FROM enterprises WHERE id = ? LIMIT 1');
        ent = await stmt.bind(id).first();
      } else if (identifiant) {
        /* Plusieurs dossiers peuvent porter le meme identifiant (ex. faux
           dossier vide cree pendant une panne) : on garde celui qui contient
           les comptes utilisateurs (mdb_users), sinon le premier. */
        const ids = [];
        const r1 = await db.prepare('SELECT id FROM enterprises WHERE identifiant = ? COLLATE NOCASE').bind(identifiant).all();
        (r1.results || []).forEach(r => { if (r.id && ids.indexOf(r.id) < 0) ids.push(r.id); });
        try {
          const r2 = await db.prepare('SELECT enterprise_id FROM enterprise_index WHERE identifiant = ? COLLATE NOCASE').bind(identifiant).all();
          (r2.results || []).forEach(r => { if (r.enterprise_id && ids.indexOf(r.enterprise_id) < 0) ids.push(r.enterprise_id); });
        } catch (eIdx) {}
        let best = null, bestLen = -1;
        for (const cid of ids) {
          const u = await db.prepare("SELECT length(valeur) AS l FROM enterprise_data WHERE (enterprise_id = ? OR enterprise_id = ?) AND cle = 'mdb_users' ORDER BY l DESC LIMIT 1").bind(cid, '"' + cid + '"').first();
          const l = (u && u.l) || 0;
          if (l > bestLen) { bestLen = l; best = cid; }
        }
        if (best) ent = await db.prepare('SELECT * FROM enterprises WHERE id = ? LIMIT 1').bind(best).first();
        if (!ent && best) ent = { id: best, identifiant: identifiant, email: '', nom: '', data: '{}', updated_at: '' };
      }

      if (!ent) {
        return new Response(JSON.stringify({ found: false }), { headers: corsHeaders });
      }

      let parsedData = {};
      try { parsedData = JSON.parse(ent.data || '{}'); } catch (e) {}

      return new Response(JSON.stringify({
        found: true,
        enterprise: {
          id: ent.id,
          identifiant: ent.identifiant,
          email: ent.email,
          nom: ent.nom,
          data: parsedData,
          updated_at: ent.updated_at
        }
      }), { headers: corsHeaders });
    }

    // POST /api/enterprise (create or update enterprise record)
    if (request.method === 'POST') {
      const body = await request.json();
      const id = body.id;
      const identifiant = body.identifiant || id;
      const email = body.email || '';
      const nom = body.nom || '';
      const dataStr = typeof body.data === 'string' ? body.data : JSON.stringify(body.data || {});
      const now = new Date().toISOString();

      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
      }

      const stmt = db.prepare(`
        INSERT INTO enterprises (id, identifiant, email, nom, data, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          identifiant = excluded.identifiant,
          email = excluded.email,
          nom = excluded.nom,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      await stmt.bind(id, identifiant, email, nom, dataStr, now).run();

      const stmtIdx = db.prepare(`
        INSERT INTO enterprise_index (identifiant, enterprise_id, nom, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(identifiant) DO UPDATE SET
          enterprise_id = excluded.enterprise_id,
          nom = excluded.nom,
          updated_at = excluded.updated_at
      `);
      await stmtIdx.bind(identifiant, id, nom, now).run();

      return new Response(JSON.stringify({ ok: true, id, identifiant }), { headers: corsHeaders });
    }

    // DELETE /api/enterprise?id=...
    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
      }
      await db.batch([
        db.prepare('DELETE FROM enterprises WHERE id = ?').bind(id),
        db.prepare('DELETE FROM enterprise_index WHERE enterprise_id = ?').bind(id),
        db.prepare('DELETE FROM enterprise_data WHERE enterprise_id = ?').bind(id)
      ]);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), { status: 500, headers: corsHeaders });
  }
}
