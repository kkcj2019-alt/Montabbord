// Cloudflare Pages Function: /api/enterprise
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

    // GET /api/enterprise?identifiant=... OR ?id=... OR ?list=1
    if (request.method === 'GET') {
      const list = url.searchParams.get('list');
      if (list === '1' || list === 'true') {
        /* Liste de TOUTES les entreprises : Super Admin uniquement (même en transition). */
        const sL = await mdbSession(request, db, url, null);
        if (!sL || sL.role !== 'superadmin') return mdbRefus(corsHeaders, 403);
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
      /* Sans badge de CETTE entreprise : seulement ce qu'il faut pour se connecter. */
      const auE = await mdbAutorise(request, db, url, ent.id, null, false);
      if (!auE.ok) {
        return new Response(JSON.stringify({ found: true, enterprise: { id: ent.id, identifiant: ent.identifiant, nom: ent.nom, data: {}, updated_at: ent.updated_at } }), { headers: corsHeaders });
      }

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
      /* Création libre d'une NOUVELLE entreprise ; modifier une entreprise
         existante demande un administrateur connecté de celle-ci. Un
         identifiant déjà pris par une autre entreprise ne peut pas être volé
         (sinon on détournait les connexions vers un autre dossier). */
      const exist = await db.prepare('SELECT id FROM enterprises WHERE id = ? LIMIT 1').bind(id).first();
      const sP = await mdbSession(request, db, url, body);
      const adminP = sP && (sP.role === 'superadmin' || (sP.role === 'admin' && String(sP.enterprise_id) === String(id)));
      if (exist && !adminP && mdbSecuActive()) return mdbRefus(corsHeaders, 403);
      const prisPar = await db.prepare('SELECT enterprise_id FROM enterprise_index WHERE identifiant = ? COLLATE NOCASE').bind(identifiant).first();
      if (prisPar && prisPar.enterprise_id && String(prisPar.enterprise_id) !== String(id) && !(sP && sP.role === 'superadmin')) {
        return new Response(JSON.stringify({ ok: false, code: 'identifiant_pris', error: 'Identifiant déjà utilisé' }), { status: 409, headers: corsHeaders });
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
      /* Supprimer une entreprise ENTIÈRE : Super Admin, ou admin connecté de cette entreprise. Toujours. */
      const sD = await mdbSession(request, db, url, null);
      if (!sD || !(sD.role === 'superadmin' || (sD.role === 'admin' && String(sD.enterprise_id) === String(id)))) return mdbRefus(corsHeaders, 403);
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
