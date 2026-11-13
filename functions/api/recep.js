/* Cloudflare Pages Function: /api/recep
   Accusé de réception d'un bulletin par QR + PIN.

   Le PIN n'est jamais renvoyé au navigateur : il est vérifié ici, côté serveur,
   contre l'empreinte SHA-256 stockée dans mdb_paye.employePins.
   Une réception réussie est enregistrée dans la clé séparée
   mdb_receptionsBulletins (pas de réécriture du gros document mdb_paye). */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: corsHeaders() });
}

async function sha256Hex(msg) {
  const data = new TextEncoder().encode(String(msg));
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
  return out;
}

async function verifierPin(hash, pin) {
  try {
    if (!hash || String(pin || '') === '') return false;
    const parts = String(hash).split(':');
    if (parts.length !== 3 || parts[0] !== 'sha256' || !parts[1]) return false;
    const calc = 'sha256:' + parts[1] + ':' + await sha256Hex(parts[1] + '|' + String(pin));
    return calc === String(hash);
  } catch (e) { return false; }
}

function trouverPin(pins, rec) {
  if (!pins || typeof pins !== 'object') return null;
  const essais = [rec && rec.empId, rec && rec.matricule];
  for (let i = 0; i < essais.length; i++) {
    const k = essais[i];
    if (k && pins[k]) return pins[k];
  }
  for (const k in pins) {
    if (!pins.hasOwnProperty(k)) continue;
    const p = pins[k];
    if (!p) continue;
    if (rec && rec.empId && String(p.empId || '') === String(rec.empId)) return p;
    if (rec && rec.matricule && String(p.matricule || '') === String(rec.matricule)) return p;
  }
  return null;
}

async function lireSection(db, uid, cle) {
  const row = await db.prepare(
    'SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(uid, '"' + uid + '"', cle).first();
  if (!row || row.valeur == null) return null;
  let v = row.valeur;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
/* Anti-essais au hasard du PIN (5 erreurs -> 15 min de blocage), même table
   que la connexion. Sans table disponible, on ne bloque pas. */
async function _tbl(db) { try { await db.prepare('CREATE TABLE IF NOT EXISTS auth_echecs (k TEXT PRIMARY KEY, n INTEGER, until INTEGER, last INTEGER)').run(); return true; } catch (e) { return false; } }
async function estBloque(db, k) { try { if (!(await _tbl(db))) return false; const r = await db.prepare('SELECT until FROM auth_echecs WHERE k = ?').bind(k).first(); return !!(r && r.until && r.until > Date.now()); } catch (e) { return false; } }
async function noterEchec(db, k) {
  try {
    if (!(await _tbl(db))) return;
    const now = Date.now();
    const r = await db.prepare('SELECT n FROM auth_echecs WHERE k = ?').bind(k).first();
    let n = (r && r.n ? r.n : 0) + 1, until = 0;
    if (n >= 5) { until = now + 15 * 60 * 1000; n = 0; }
    await db.prepare('INSERT INTO auth_echecs (k, n, until, last) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, until = excluded.until, last = excluded.last').bind(k, n, until, now).run();
  } catch (e) {}
}
async function effacerEchecs(db, k) { try { if (await _tbl(db)) await db.prepare('DELETE FROM auth_echecs WHERE k = ?').bind(k).run(); } catch (e) {} }

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  if (!db) return json({ ok: false, code: 'db' }, 500);

  try {
    const body = await request.json();
    const uid = String(body.uid || '').replace(/^["']+|["']+$/g, '').trim();
    const token = String(body.token || '').trim();
    const pin = String(body.pin || '').trim();
    if (!uid || !token) return json({ ok: false, code: 'params' }, 400);
    if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, code: 'bad_format' }, 400);

    const row = await db.prepare(
      'SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(uid, '"' + uid + '"', 'mdb_paye').first();
    if (!row || row.valeur == null) return json({ ok: false, code: 'not_found' }, 404);

    let paye = row.valeur;
    if (typeof paye === 'string') {
      try { paye = JSON.parse(paye); } catch (e) { paye = null; }
    }
    if (!paye || typeof paye !== 'object') return json({ ok: false, code: 'not_found' }, 404);

    const verifsSec = await lireSection(db, uid, 'mdb_paye.bulletinVerifs');
    const verifs = Array.isArray(verifsSec) && verifsSec.length ? verifsSec : (Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : []);
    let rec = null;
    for (let i = 0; i < verifs.length; i++) {
      if (verifs[i] && String(verifs[i].token) === token) { rec = verifs[i]; break; }
    }
    if (!rec) return json({ ok: false, code: 'not_found' }, 404);

    let pins = (paye.employePins && typeof paye.employePins === 'object') ? paye.employePins : {};
    const pinsSec = await lireSection(db, uid, 'mdb_paye.employePins');
    if (pinsSec && typeof pinsSec === 'object') pins = Object.assign({}, pins, pinsSec);
    const comptesPortail = await lireSection(db, uid, 'mdb_portailComptes');
    if (comptesPortail && typeof comptesPortail === 'object') pins = Object.assign({}, pins, comptesPortail);
    const pinRec = trouverPin(pins, rec);
    if (!pinRec || !pinRec.hash) return json({ ok: false, code: 'no_pin' }, 403);

    const kRec = 'pin|' + uid + '|' + String(rec.empId || rec.matricule || token);
    if (await estBloque(db, kRec)) return json({ ok: false, code: 'bloque' }, 429);
    if (!(await verifierPin(pinRec.hash, pin))) { await noterEchec(db, kRec); return json({ ok: false, code: 'bad_pin' }, 403); }
    await effacerEchecs(db, kRec);

    /* Déjà reçu ? On renvoie la réception existante (idempotent). */
    const now = Date.now().toString();
    const recRow = await db.prepare(
      'SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(uid, '"' + uid + '"', 'mdb_receptionsBulletins').first();
    let receptions = [];
    if (recRow && recRow.valeur != null) {
      let v = recRow.valeur;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } }
      if (Array.isArray(v)) receptions = v;
    }
    let deja = null;
    for (let j = 0; j < receptions.length; j++) {
      if (receptions[j] && String(receptions[j].token) === token) { deja = receptions[j]; break; }
    }
    if (deja) return json({ ok: true, already: true, reception: deja });

    const reception = {
      id: 'REC' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
      uid: uid,
      token: token,
      empId: rec.empId || '',
      matricule: rec.matricule || '',
      nom: rec.nom || '',
      mois: rec.mois || '',
      net: (rec.netAvantSolde != null ? rec.netAvantSolde : rec.net) || 0,
      dateReception: new Date().toISOString(),
      moyen: 'qr+pin'
    };
    receptions.push(reception);
    if (receptions.length > 5000) receptions = receptions.slice(receptions.length - 5000);

    await db.prepare(
      `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
    ).bind(uid, 'mdb_receptionsBulletins', JSON.stringify(receptions), now).run();

    return json({ ok: true, already: false, reception: reception });
  } catch (e) {
    return json({ ok: false, code: 'error', message: e && e.message ? e.message : String(e) }, 500);
  }
}
