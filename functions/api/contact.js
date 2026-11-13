// Cloudflare Pages Function: /api/contact
// Permet à un visiteur ou un client de l'espace client d'envoyer un message direct
// qui notifie immédiatement les administrateurs et collaborateurs sur Montabbord (index.html).

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Méthode non autorisée' }), { status: 405, headers: corsHeaders });
  }

  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Base de données D1 indisponible' }), { status: 500, headers: corsHeaders });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const uid = String(body.uid || '').trim();
    const nom = String(body.nom || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().slice(0, 120);
    const tel = String(body.tel || '').trim().slice(0, 40);
    const message = String(body.message || body.texte || '').trim().slice(0, 4000);
    const sujet = String(body.sujet || 'Message direct depuis le site web').trim().slice(0, 150);
    let clientId = body.clientId ? String(body.clientId).slice(0, 80) : null;

    if (!uid) {
      return new Response(JSON.stringify({ ok: false, error: 'Identifiant entreprise manquant' }), { status: 400, headers: corsHeaders });
    }
    if (!message) {
      return new Response(JSON.stringify({ ok: false, error: 'Le contenu du message est obligatoire' }), { status: 400, headers: corsHeaders });
    }

    /* Sécurité : l'entreprise doit exister (sinon n'importe qui créait des
       lignes pour des identifiants inventés). */
    const entOk = await db.prepare("SELECT 1 AS x FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = 'mdb_entreprise' LIMIT 1").bind(uid, '"' + uid + '"').first();
    if (!entOk) return new Response(JSON.stringify({ ok: false, error: 'Entreprise inconnue' }), { status: 404, headers: corsHeaders });

    /* Un message « au nom d'un client » n'est accepté qu'avec la session de ce
       client (espace client). Sans session : message de visiteur. */
    if (clientId) {
      let valide = false;
      try {
        const tok = String(body.token || '');
        if (tok) {
          const lire = async (cle) => { const r = await db.prepare('SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1').bind(uid, '"' + uid + '"', cle).first(); let v = r ? r.valeur : null; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } return v; };
          const sessions = await lire('mdb_espaceSessions');
          const s0 = (Array.isArray(sessions) ? sessions : []).filter(x => x && x.token === tok && x.type === 'client' && x.exp > Date.now())[0];
          if (s0) { const accs = await lire('mdb_clientAccounts') || {}; const acc = accs[s0.email]; valide = !!(acc && String(acc.id) === String(clientId)); }
        }
      } catch (eS) { valide = false; }
      if (!valide) clientId = null;
    }

    /* Anti-inondation : 8 messages / 10 min par adresse et par entreprise. */
    try {
      await db.prepare('CREATE TABLE IF NOT EXISTS auth_echecs (k TEXT PRIMARY KEY, n INTEGER, until INTEGER, last INTEGER)').run();
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'ip?';
      const kRl = 'contact|' + uid + '|' + ip;
      const t = Date.now();
      const r = await db.prepare('SELECT n, last FROM auth_echecs WHERE k = ?').bind(kRl).first();
      let n = (r && r.last && t - r.last < 10 * 60 * 1000) ? (r.n || 0) + 1 : 1;
      if (n > 8) return new Response(JSON.stringify({ ok: false, error: 'Trop de messages, réessayez dans quelques minutes' }), { status: 429, headers: corsHeaders });
      await db.prepare('INSERT INTO auth_echecs (k, n, until, last) VALUES (?, ?, 0, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, last = excluded.last').bind(kRl, n, (r && r.last && t - r.last < 10 * 60 * 1000) ? r.last : t).run();
    } catch (eRl) {}

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const msgId = 'MSG_' + now + '_' + Math.random().toString(36).slice(2, 7);

    // 1. Lire les échanges actuels dans enterprise_data
    const echRow = await db.prepare(
      'SELECT valeur FROM enterprise_data WHERE enterprise_id = ? AND cle = ?'
    ).bind(uid, 'mdb_echanges').first();

    let echanges = [];
    if (echRow && echRow.valeur) {
      try {
        const parsed = JSON.parse(echRow.valeur);
        if (Array.isArray(parsed)) echanges = parsed;
      } catch (eP) {}
    }

    // Filtrer les messages de plus de 7 jours
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    echanges = echanges.filter(m => {
      const t = m && m.createdAt ? new Date(m.createdAt).getTime() : 0;
      return t > cutoff;
    });

    const expNom = nom || (email ? email.split('@')[0] : 'Visiteur Site');
    const fullText = '💬 [Message direct depuis le site web]\n'
      + (nom ? '👤 Nom : ' + nom + '\n' : '')
      + (email ? '📧 Email : ' + email + '\n' : '')
      + (tel ? '📞 Tél : ' + tel + '\n' : '')
      + (sujet ? '📌 Sujet : ' + sujet + '\n' : '')
      + '\n« ' + message + ' »';

    const newEchange = {
      id: msgId,
      fromId: clientId ? ('CLIENT_' + clientId) : 'CLIENT_SITE',
      fromName: '🌐 Client: ' + expNom,
      toId: 'GROUP_ALL',
      toName: 'Tous',
      text: fullText,
      createdAt: nowIso,
      read: false,
      source: 'espace-client',
      meta: {
        nom: nom,
        email: email,
        tel: tel,
        clientId: clientId,
        sujet: sujet
      }
    };

    echanges.push(newEchange);

    // 2. Lire les threads client (mdb_clientThreads) pour consigner l'échange
    const thRow = await db.prepare(
      'SELECT valeur FROM enterprise_data WHERE enterprise_id = ? AND cle = ?'
    ).bind(uid, 'mdb_clientThreads').first();

    let threads = [];
    if (thRow && thRow.valeur) {
      try {
        const parsedTh = JSON.parse(thRow.valeur);
        if (Array.isArray(parsedTh)) threads = parsedTh;
      } catch (eTh) {}
    }

    const threadId = clientId ? ('TH_' + clientId) : ('TH_PROSPECT_' + (email ? email.replace(/[^a-z0-9]/gi, '_') : now.toString(36)));
    let thread = threads.find(t => t && ((clientId && String(t.clientId) === String(clientId)) || (t.id === threadId)));

    if (!thread) {
      thread = {
        id: threadId,
        clientId: clientId || ('GUEST_' + now.toString(36)),
        clientNom: nom || email || 'Prospect Web',
        email: email,
        tel: tel,
        sujet: sujet,
        type: 'message',
        statut: 'nouveau',
        createdAt: now,
        updatedAt: now,
        messages: []
      };
      threads.unshift(thread);
    } else {
      thread.updatedAt = now;
      if (nom && !thread.clientNom) thread.clientNom = nom;
      if (email && !thread.email) thread.email = email;
      if (tel && !thread.tel) thread.tel = tel;
    }

    thread.messages = thread.messages || [];
    thread.messages.push({
      id: 'M_' + now + '_' + Math.random().toString(36).slice(2, 6),
      from: 'client',
      auteur: expNom,
      texte: message + (email ? ('\nEmail : ' + email + (tel ? ' · Tél : ' + tel : '')) : ''),
      createdAt: now
    });

    // 3. Sauvegarder dans D1 via batch
    const stmts = [
      db.prepare(
        `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
      ).bind(uid, 'mdb_echanges', JSON.stringify(echanges), now),

      db.prepare(
        `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
      ).bind(uid, 'mdb_clientThreads', JSON.stringify(threads), now)
    ];

    await db.batch(stmts);

    return new Response(JSON.stringify({
      ok: true,
      success: true,
      msgId: msgId,
      threadId: thread.id,
      timestamp: now
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Erreur lors de l\'enregistrement du message: ' + (err.message || String(err))
    }), { status: 500, headers: corsHeaders });
  }
}
