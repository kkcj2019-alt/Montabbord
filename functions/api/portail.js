/* Cloudflare Pages Function: /api/portail
   Espace employé : connexion (nom / matricule / téléphone + PIN), données
   personnelles filtrées, requêtes et discussion avec Paye / RH.

   Sécurité : le PIN n'est jamais renvoyé. Le jeton de session est aléatoire,
   stocké côté D1 et expire après 12 h. Aucune inscription libre : seuls les
   employés présents dans mdb_employes peuvent recevoir un accès. */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
function newSalt() {
  try {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    let s = '';
    for (let i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s;
  } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}
async function verifierPin(hash, pin) {
  try {
    if (!hash || String(pin || '') === '') return false;
    const parts = String(hash).split(':');
    if (parts.length !== 3 || parts[0] !== 'sha256' || !parts[1]) return false;
    return ('sha256:' + parts[1] + ':' + await sha256Hex(parts[1] + '|' + String(pin))) === String(hash);
  } catch (e) { return false; }
}
function newToken() {
  try {
    const a = new Uint8Array(24);
    crypto.getRandomValues(a);
    let s = '';
    for (let i = 0; i < a.length; i++) s += ('0' + a[i].toString(16)).slice(-2);
    return s.toUpperCase();
  } catch (e) {
    return ('T' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).toUpperCase();
  }
}
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
function parseVal(v, def) {
  if (v == null) return def;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return def; } }
  return v;
}
/* Un seul bulletin par employe et par mois dans l'espace employe.
   D'anciennes publications ou synchronisations peuvent laisser plusieurs
   copies du meme mois : on garde la plus recente (date la plus grande, et a
   defaut la derniere de la liste). */
function dedupeBulletinsParMois(list) {
  const arr = Array.isArray(list) ? list : [];
  const res = [];
  const pos = {};
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    if (!b) continue;
    const empId = String(b.empId || '');
    const mois = String(b.mois || '').slice(0, 7);
    if (!empId || !mois) { res.push({ b: b, i: i, t: 0 }); continue; }
    const k = empId + '|' + mois;
    const t = Date.parse(b.date || '') || 0;
    if (pos[k] === undefined) {
      pos[k] = res.length;
      res.push({ b: b, i: i, t: t });
    } else if (t >= res[pos[k]].t) {
      res[pos[k]] = { b: b, i: i, t: t };
    }
  }
  return res.sort((x, y) => x.i - y.i).map(x => x.b);
}
async function lireCle(db, uid, cle) {
  const row = await db.prepare(
    'SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(uid, '"' + uid + '"', cle).first();
  return row ? row.valeur : null;
}
/* La paie est stockée DÉCOUPÉE par section dans D1 : mdb_paye.pointage,
   mdb_paye.bulletinVerifs, mdb_paye.employePins, etc. On recompose ici
   l'objet complet, sinon pointage et bulletins arrivent vides. */
async function lirePaye(db, uid) {
  let out = {};
  try {
    const rows = await db.prepare(
      "SELECT cle, valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND (cle = 'mdb_paye' OR cle LIKE 'mdb_paye.%')"
    ).bind(uid, '"' + uid + '"').all();
    const list = (rows && rows.results) || [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || r.cle !== 'mdb_paye') continue;
      const v = parseVal(r.valeur, null);
      if (v && typeof v === 'object' && !Array.isArray(v)) out = Object.assign(out, v);
    }
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r || !r.cle || r.cle.indexOf('mdb_paye.') !== 0) continue;
      const sec = r.cle.slice('mdb_paye.'.length);
      if (!sec) continue;
      out[sec] = parseVal(r.valeur, null);
    }
  } catch (e) {}
  return out;
}
async function ecrireCle(db, uid, cle, valeur) {
  const now = Date.now().toString();
  await db.prepare(
    `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
  ).bind(uid, cle, JSON.stringify(valeur), now).run();
}
/* Comptes créés depuis l'espace employé : stockés à part pour ne jamais être
   écrasés par une synchronisation de la page Paye. */
async function lireComptesPortail(db, uid) {
  const v = parseVal(await lireCle(db, uid, 'mdb_portailComptes'), {});
  return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
}
function fusionComptes(payePins, portail) {
  const out = {};
  if (payePins && typeof payePins === 'object') {
    for (const k in payePins) if (Object.prototype.hasOwnProperty.call(payePins, k)) out[k] = payePins[k];
  }
  if (portail && typeof portail === 'object') {
    for (const k in portail) if (Object.prototype.hasOwnProperty.call(portail, k)) out[k] = portail[k];
  }
  return out;
}
/* Le PIN choisi à la création du compte employé devient aussi le PIN de
   validation des pièces de caisse (signature). */
async function assurerSignaturePin(db, uid, emp, pinHash, nom) {
  if (!emp || !pinHash) return;
  try {
    const sigs = parseVal(await lireCle(db, uid, 'mdb_signatures'), {});
    const arr = (sigs && typeof sigs === 'object' && !Array.isArray(sigs)) ? sigs : {};
    const key = 'employe:' + emp.id;
    if (arr[key] && arr[key].pinHash) return;
    arr[key] = Object.assign({}, arr[key] || {}, {
      employeId: emp.id,
      nom: nom || ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(),
      pinHash: pinHash,
      source: 'portail',
      createdAt: (arr[key] && arr[key].createdAt) || Date.now()
    });
    await ecrireCle(db, uid, 'mdb_signatures', arr);
  } catch (e) {}
}
function moisAutorises(empId, paye) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  try {
    const cfg = paye && paye.portailEmployes && paye.portailEmployes[empId];
    if (cfg && Array.isArray(cfg.mois)) cfg.mois.forEach(m => { if (/^\d{4}-\d{2}$/.test(m) && out.indexOf(m) === -1) out.push(m); });
  } catch (e) {}
  return out.sort().reverse();
}
function estInactif(emp) {
  if (!emp) return true;
  if (emp.status && emp.status !== 'actif') return true;
  const d = String(emp.date_sortie || emp.date_fin || emp.dateFin || emp.dateSortie || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const today = new Date().toISOString().slice(0, 10);
    if (d <= today) return true;
  }
  return false;
}
function employePublic(e) {
  return {
    id: e.id, nom: e.nom || '', prenoms: e.prenoms || '',
    matricule: e.matricule || '', telephone: e.telephone || '',
    fonction: e.fonction || '', service: e.service || '',
    type_contrat: e.type_contrat || '', date_entree: e.date_entree || '',
    salaire_base: parseFloat(e.salaire_base) || 0
  };
}
function trouverEmploye(employes, login) {
  const q = norm(login);
  if (!q) return { list: [] };
  const exact = [], partiels = [];
  employes.forEach(e => {
    if (!e || !e.id) return;
    const noms = [
      norm((e.nom || '') + ' ' + (e.prenoms || '')),
      norm((e.prenoms || '') + ' ' + (e.nom || '')),
      norm(e.nom),
      norm(e.matricule),
      norm(e.telephone),
      norm(e.id)
    ];
    const mots = String((e.nom || '') + ' ' + (e.prenoms || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
    if (noms.indexOf(q) !== -1 || mots.indexOf(q) !== -1) exact.push(e);
    else if (noms.some(x => x && x.indexOf(q) !== -1)) partiels.push(e);
  });
  return { list: exact.length ? exact : partiels.slice(0, 10) };
}
function masquerTel(t) {
  const s = String(t || '').replace(/[^0-9+]/g, '');
  if (!s) return '—';
  if (s.length <= 5) return s.slice(0, 2) + '••';
  return s.slice(0, 4) + '••••' + s.slice(-2);
}
function masquerDate(d) {
  const m = String(d || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '—';
  return m[3] + '/••/' + m[1];
}
function trouverPin(pins, emp) {
  if (!pins || typeof pins !== 'object') return null;
  if (pins[emp.id]) return pins[emp.id];
  for (const k in pins) {
    if (!pins.hasOwnProperty(k)) continue;
    const p = pins[k];
    if (!p) continue;
    if (emp.matricule && String(p.matricule || '') === String(emp.matricule)) return p;
    if (emp.id && String(p.empId || '') === String(emp.id)) return p;
  }
  return null;
}
function trouverCompteParLogin(pins, login) {
  if (!pins || typeof pins !== 'object') return null;
  const q = norm(login);
  if (!q) return null;
  for (const k in pins) {
    if (!pins.hasOwnProperty(k)) continue;
    const p = pins[k];
    if (p && p.login && norm(p.login) === q) return p;
  }
  return null;
}
function validerSession(sessions, token) {
  const now = Date.now();
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s && s.token === token && s.expiresAt > now) return s;
  }
  return null;
}

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

/* ---- Anti-essais au hasard sur le code PIN : 5 erreurs -> 15 min de blocage.
   Sans base disponible (tests), on laisse passer sans bloquer. ---- */
let _pinTablePrete = false;
async function _pinTable(db) {
  if (_pinTablePrete) return true;
  try { await db.prepare('CREATE TABLE IF NOT EXISTS auth_echecs (k TEXT PRIMARY KEY, n INTEGER, until INTEGER, last INTEGER)').run(); _pinTablePrete = true; return true; } catch (e) { return false; }
}
async function pinBloque(db, k) {
  try { if (!(await _pinTable(db))) return false; const r = await db.prepare('SELECT until FROM auth_echecs WHERE k = ?').bind(k).first(); return !!(r && r.until && r.until > Date.now()); } catch (e) { return false; }
}
async function pinEchec(db, k) {
  try {
    if (!(await _pinTable(db))) return;
    const now = Date.now();
    const r = await db.prepare('SELECT n FROM auth_echecs WHERE k = ?').bind(k).first();
    let n = (r && r.n ? r.n : 0) + 1, until = 0;
    if (n >= 5) { until = now + 15 * 60 * 1000; n = 0; }
    await db.prepare('INSERT INTO auth_echecs (k, n, until, last) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = excluded.n, until = excluded.until, last = excluded.last').bind(k, n, until, now).run();
  } catch (e) {}
}
async function pinReussite(db, k) { try { if (await _pinTable(db)) await db.prepare('DELETE FROM auth_echecs WHERE k = ?').bind(k).run(); } catch (e) {} }

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });
  if (!db) return json({ ok: false, code: 'db' }, 500);
  try {
    let body = {};
    if (request.method === 'POST') body = await request.json();
    const uid = String(body.uid || '').replace(/^["']+|["']+$/g, '').trim();
    if (!uid) return json({ ok: false, code: 'uid' }, 400);
    const action = String(body.action || '').toLowerCase();
    /* Actions de l'administration (Paie / RH) : badge de connexion de cette entreprise. */
    if (action.indexOf('admin') === 0) {
      const auA = await mdbAutorise(request, db, null, uid, body, false);
      if (!auA.ok) return json({ ok: false, code: 'auth' }, 401);
    }

    /* ---------- Suggestions de noms ---------- */
    if (action === 'suggest') {
      const q = String(body.q || '').trim();
      if (q.length < 2) return json({ ok: true, choices: [] });
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const found = trouverEmploye(employes, q).list.slice(0, 10);
      return json({ ok: true, choices: found.map(employePublic) });
    }

    /* ---------- Fiche trouvée (aperçu masqué, avant création de compte) ---------- */
    if (action === 'lookup') {
      const q = String(body.login || body.identite || '').trim();
      if (!q) return json({ ok: false, code: 'identity' }, 400);
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const found = trouverEmploye(employes, q).list;
      if (!found.length) return json({ ok: false, code: 'not_personnel' }, 404);
      if (found.length > 1) return json({ ok: false, code: 'ambiguous', choices: found.slice(0, 8).map(employePublic) }, 409);
      const emp = found[0];
      if (estInactif(emp)) return json({ ok: false, code: 'inactive' }, 403);
      const paye = await lirePaye(db, uid);
      const portail = await lireComptesPortail(db, uid);
      const compte = trouverPin(fusionComptes(paye.employePins, portail), emp);
      return json({
        ok: true,
        employe: { nom: emp.nom || '', prenoms: emp.prenoms || '', matricule: emp.matricule || '', fonction: emp.fonction || '' },
        dejaCompte: !!(compte && (compte.hash || compte.passwordHash)),
        masque: { telephone: masquerTel(emp.telephone), naissance: masquerDate(emp.date_naissance) },
        aTelephone: !!String(emp.telephone || '').trim(),
        aNaissance: !!String(emp.date_naissance || '').trim()
      });
    }

    /* ---------- Publication d'un bulletin (administration) ---------- */
    if (action === 'adminbulletin') {
      const paye = await lirePaye(db, uid);
      const arr = Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : [];
      const empId = String(body.empId || '');
      const mois = String(body.mois || '').slice(0, 7);
      const visible = !!body.visible;
      let n = 0;
      arr.forEach(b => {
        if (!b || String(b.empId) !== empId) return;
        if (mois && String(b.mois || '').slice(0, 7) !== mois) return;
        b.visible = visible;
        n++;
      });
      if (!n) return json({ ok: false, code: 'no_bulletin' }, 404);
      paye.bulletinVerifs = arr;
      await ecrireCle(db, uid, 'mdb_paye.bulletinVerifs', arr);
      return json({ ok: true, updated: n, visible });
    }

    /* ---------- Photo ajoutée par l'administration ---------- */
    /* Copie du bulletin imprimé (sans QR) pour l'espace employé. */
    if (action === 'adminbulsnap') {
      const empId = String(body.empId || '');
      const mois = String(body.mois || '').slice(0, 7);
      const html = String(body.html || '');
      if (!empId || !/^\d{4}-\d{2}$/.test(mois) || html.length < 200) return json({ ok: false, code: 'donnees' }, 400);
      if (html.length > 900000) return json({ ok: false, code: 'trop_gros' }, 413);
      await ecrireCle(db, uid, 'mdb_bulSnap:' + empId + '|' + mois, { html: html, vue: String(body.vue || ''), at: new Date().toISOString() });
      return json({ ok: true });
    }
    if (action === 'adminphoto') {
      const empId = String(body.empId || '');
      const photo = String(body.photo || '');
      if (!empId || !/^data:image\/(png|jpe?g|webp);base64,/i.test(photo)) return json({ ok: false, code: 'photo' }, 400);
      await ecrireCle(db, uid, 'mdb_portailPhoto:' + empId, photo);
      return json({ ok: true, photo });
    }
    /* ---------- Connexion ---------- */
    if (action === 'login') {
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const paye = await lirePaye(db, uid);
      const portail = await lireComptesPortail(db, uid);
      const comptes = fusionComptes(paye.employePins, portail);
      const compte = trouverCompteParLogin(comptes, body.login);
      let emp = null;
      if (compte && compte.empId) {
        emp = employes.find(e => e && String(e.id) === String(compte.empId)) || null;
      }
      if (!emp) {
        const found = trouverEmploye(employes, body.login).list;
        if (!found.length) return json({ ok: false, code: 'not_personnel' }, 404);
        if (found.length > 1) {
          return json({ ok: false, code: 'ambiguous', choices: found.slice(0, 8).map(employePublic) }, 409);
        }
        emp = found[0];
      }
      if (estInactif(emp)) return json({ ok: false, code: 'inactive' }, 403);
      const pinRec = compte || trouverPin(comptes, emp);
      if (!pinRec || (!pinRec.passwordHash && !pinRec.hash)) return json({ ok: false, code: 'no_access' }, 403);
      const _kPin = 'pin|' + uid + '|' + emp.id;
      if (await pinBloque(db, _kPin)) return json({ ok: false, code: 'bloque' }, 429);
      let ok = false;
      if (pinRec.passwordHash) ok = await verifierPin(pinRec.passwordHash, body.pin);
      if (!ok && pinRec.hash) ok = await verifierPin(pinRec.hash, body.pin);
      if (!ok) { await pinEchec(db, _kPin); return json({ ok: false, code: 'bad_pin' }, 403); }
      await pinReussite(db, _kPin);
      await assurerSignaturePin(db, uid, emp, pinRec.hash, pinRec.nom);

      let sessions = parseVal(await lireCle(db, uid, 'mdb_portailSessions'), []);
      if (!Array.isArray(sessions)) sessions = [];
      const now = Date.now();
      sessions = sessions.filter(s => s && s.expiresAt > now).slice(-800);
      const token = newToken();
      const sess = { token, uid, empId: emp.id, createdAt: now, expiresAt: now + 12 * 3600 * 1000 };
      sessions.push(sess);
      await ecrireCle(db, uid, 'mdb_portailSessions', sessions);
      return json({ ok: true, token, expiresAt: sess.expiresAt, employe: employePublic(emp), moiAutorises: moisAutorises(emp.id, paye) });
    }

    /* ---------- Création de compte employé (auto-inscription contrôlée) ---------- */
    if (action === 'register') {
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const paye = await lirePaye(db, uid);
      const portail = await lireComptesPortail(db, uid);
      const comptes = fusionComptes(paye.employePins, portail);
      const found = trouverEmploye(employes, body.login).list;
      if (!found.length) return json({ ok: false, code: 'not_personnel' }, 404);
      if (found.length > 1) {
        return json({ ok: false, code: 'ambiguous', choices: found.slice(0, 8).map(employePublic) }, 409);
      }
      const emp = found[0];
      if (estInactif(emp)) return json({ ok: false, code: 'inactive' }, 403);
      const loginChoisi = String(body.loginChoisi || '').trim();
      const password = String(body.password || '').trim();
      const pin = String(body.pin || '').trim();
      if (norm(loginChoisi).length < 3) return json({ ok: false, code: 'login_required' }, 400);
      if (password.length < 4) return json({ ok: false, code: 'password_short' }, 400);
      if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, code: 'bad_format' }, 400);
      const existing = trouverPin(comptes, emp);
      if (existing && (existing.hash || existing.passwordHash)) return json({ ok: false, code: 'already' }, 409);
      /* Un seul compte par personne : on refuse aussi si un compte existe déjà
         pour le même matricule ou le même nom (fiche employé en double). */
      const nq = norm((emp.nom || '') + ' ' + (emp.prenoms || ''));
      const mq = norm(emp.matricule);
      const pinsObj = comptes;
      for (const k in pinsObj) {
        if (!Object.prototype.hasOwnProperty.call(pinsObj, k)) continue;
        const p = pinsObj[k];
        if (!p || !(p.hash || p.passwordHash)) continue;
        if (String(p.empId || '') === String(emp.id)) return json({ ok: false, code: 'already' }, 409);
        if (mq && norm(p.matricule) === mq) return json({ ok: false, code: 'already' }, 409);
        if (nq && norm(p.nom) === nq) return json({ ok: false, code: 'already' }, 409);
      }
      const autre = trouverCompteParLogin(comptes, loginChoisi);
      if (autre && String(autre.empId || '') !== String(emp.id)) return json({ ok: false, code: 'login_taken' }, 409);
      const qLogin = norm(loginChoisi);
      const conflit = employes.find(function (e) {
        if (!e || String(e.id) === String(emp.id)) return false;
        return norm(e.matricule) === qLogin
          || norm(e.telephone || e.tel) === qLogin
          || norm((e.nom || '') + ' ' + (e.prenoms || '')) === qLogin
          || norm(e.nom) === qLogin;
      });
      if (conflit) return json({ ok: false, code: 'login_taken' }, 409);

      const tel = String(body.telephone || '').replace(/\D/g, '');
      const dob = String(body.dateNaissance || '').slice(0, 10);
      const empTel = String(emp.telephone || emp.tel || '').replace(/\D/g, '');
      const empDob = String(emp.date_naissance || '').slice(0, 10);
      const telOk = empTel && tel && empTel.slice(-8) === tel.slice(-8);
      const dobOk = empDob && dob && empDob === dob;
      const needTel = !!empTel;
      const needDob = !!empDob;
      if (!needTel && !needDob) return json({ ok: false, code: 'identity_missing' }, 403);
      const identityOk = (needTel && telOk) || (needDob && dobOk);
      if (!identityOk) return json({ ok: false, code: 'identity' }, 403);

      const passSalt = newSalt();
      const passHash = 'sha256:' + passSalt + ':' + await sha256Hex(passSalt + '|' + password);
      const pinSalt = newSalt();
      const pinHash = 'sha256:' + pinSalt + ':' + await sha256Hex(pinSalt + '|' + pin);
      paye.employePins = (paye.employePins && typeof paye.employePins === 'object') ? paye.employePins : {};
      const recCompte = {
        empId: emp.id, matricule: emp.matricule || '',
        nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(),
        login: loginChoisi,
        passwordHash: passHash,
        hash: pinHash,
        pinHash: pinHash,
        updatedAt: new Date().toISOString(), self: true
      };
      paye.employePins[emp.id] = recCompte;
      await ecrireCle(db, uid, 'mdb_paye.employePins', paye.employePins);
      /* Copie dans une clé dédiée : la page Paye ne peut pas l'écraser. */
      const portailComptes = await lireComptesPortail(db, uid);
      portailComptes[emp.id] = recCompte;
      await ecrireCle(db, uid, 'mdb_portailComptes', portailComptes);
      await assurerSignaturePin(db, uid, emp, pinHash, recCompte.nom);

      let sessions = parseVal(await lireCle(db, uid, 'mdb_portailSessions'), []);
      if (!Array.isArray(sessions)) sessions = [];
      const now = Date.now();
      sessions = sessions.filter(s => s && s.expiresAt > now).slice(-800);
      const token = newToken();
      const sess = { token, uid, empId: emp.id, createdAt: now, expiresAt: now + 12 * 3600 * 1000 };
      sessions.push(sess);
      await ecrireCle(db, uid, 'mdb_portailSessions', sessions);
      return json({ ok: true, token, expiresAt: sess.expiresAt, employe: employePublic(emp), moiAutorises: moisAutorises(emp.id, paye), created: true });
    }

    /* ---------- Premier accès depuis un bulletin (sans compte) ---------- */
    if (action === 'premieracces') {
      const tokenB = String(body.token || '').trim();
      const pin = String(body.pin || '').trim();
      const tel = String(body.telephone || '').replace(/\D/g, '');
      const dob = String(body.dateNaissance || '').slice(0, 10);
      if (!tokenB) return json({ ok: false, code: 'token' }, 400);
      if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, code: 'bad_format' }, 400);
      const paye = await lirePaye(db, uid);
      const buls = Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : [];
      let bul = null;
      for (let i = 0; i < buls.length; i++) { if (buls[i] && String(buls[i].token) === tokenB) { bul = buls[i]; break; } }
      if (!bul) return json({ ok: false, code: 'not_found' }, 404);
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const emp = (Array.isArray(employes) ? employes : []).find(e => e && String(e.id) === String(bul.empId));
      if (!emp) return json({ ok: false, code: 'not_personnel' }, 404);
      if (estInactif(emp)) return json({ ok: false, code: 'inactive' }, 403);
      const portail = await lireComptesPortail(db, uid);
      const comptes = fusionComptes(paye.employePins, portail);
      const existing = trouverPin(comptes, emp);
      if (existing && (existing.hash || existing.passwordHash)) return json({ ok: false, code: 'already' }, 409);
      const empTel = String(emp.telephone || emp.tel || '').replace(/\D/g, '');
      const empDob = String(emp.date_naissance || '').slice(0, 10);
      /* Le numéro saisi sert aussi à créer/renseigner la fiche employé :
         s'il n'y a encore aucun numéro, on l'accepte et on l'enregistre. */
      const telOk = empTel ? (!!tel && empTel.slice(-8) === tel.slice(-8)) : (tel.length >= 8);
      const dobOk = empDob && dob && empDob === dob;
      if (!(telOk || dobOk)) return json({ ok: false, code: 'identity' }, 403);
      /* Mise à jour de la fiche : 1er numéro manquant ou 2e numéro différent. */
      let empModifie = false;
      if (tel) {
        if (!empTel) {
          emp.telephone = tel; empModifie = true;
        } else if (empTel.slice(-8) !== tel.slice(-8)) {
          const tel2 = String(emp.telephone2 || '').replace(/\D/g, '');
          if (!tel2) { emp.telephone2 = tel; empModifie = true; }
          else if (tel2.slice(-8) !== tel.slice(-8)) { emp.telephone2 = String(emp.telephone2).trim() + ' / ' + tel; empModifie = true; }
        }
      }
      if (empModifie && Array.isArray(employes)) {
        const idxEmp = employes.findIndex(e => e && String(e.id) === String(emp.id));
        if (idxEmp !== -1) employes[idxEmp] = emp;
        try { await ecrireCle(db, uid, 'mdb_employes', employes); } catch (eEmpUp) {}
      }
      let loginChoisi = String(body.loginChoisi || '').trim();
      if (norm(loginChoisi).length < 3 && empTel) loginChoisi = String(emp.telephone || emp.tel || '').trim();
      if (norm(loginChoisi).length < 3) loginChoisi = String(emp.matricule || '').trim();
      if (norm(loginChoisi).length < 3) loginChoisi = 'emp' + String(emp.id || Date.now()).replace(/[^a-z0-9]/gi, '').slice(-6);
      if (norm(loginChoisi).length < 3) return json({ ok: false, code: 'login_required' }, 400);
      const autre = trouverCompteParLogin(comptes, loginChoisi);
      if (autre && String(autre.empId || '') !== String(emp.id)) return json({ ok: false, code: 'login_taken' }, 409);
      const qLogin = norm(loginChoisi);
      const conflit = (Array.isArray(employes) ? employes : []).find(function (e) {
        if (!e || String(e.id) === String(emp.id)) return false;
        return norm(e.matricule) === qLogin
          || norm(e.telephone || e.tel) === qLogin
          || norm((e.nom || '') + ' ' + (e.prenoms || '')) === qLogin
          || norm(e.nom) === qLogin;
      });
      if (conflit) return json({ ok: false, code: 'login_taken' }, 409);
      const password = String(body.password || '').trim() || pin;
      if (password.length < 4) return json({ ok: false, code: 'password_short' }, 400);
      const pinSalt = newSalt();
      const pinHash = 'sha256:' + pinSalt + ':' + await sha256Hex(pinSalt + '|' + pin);
      const passSalt = newSalt();
      const passHash = 'sha256:' + passSalt + ':' + await sha256Hex(passSalt + '|' + password);
      const recCompte = {
        empId: emp.id, matricule: emp.matricule || '',
        nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(),
        login: loginChoisi, passwordHash: passHash, hash: pinHash, pinHash: pinHash,
        updatedAt: new Date().toISOString(), self: true
      };
      paye.employePins = (paye.employePins && typeof paye.employePins === 'object') ? paye.employePins : {};
      paye.employePins[emp.id] = recCompte;
      await ecrireCle(db, uid, 'mdb_paye.employePins', paye.employePins);
      const portailComptes = await lireComptesPortail(db, uid);
      portailComptes[emp.id] = recCompte;
      await ecrireCle(db, uid, 'mdb_portailComptes', portailComptes);
      await assurerSignaturePin(db, uid, emp, pinHash, recCompte.nom);
      /* Accusé de réception du bulletin */
      let receptions = parseVal(await lireCle(db, uid, 'mdb_receptionsBulletins'), []);
      if (!Array.isArray(receptions)) receptions = [];
      let reception = null;
      for (let i = 0; i < receptions.length; i++) { if (receptions[i] && String(receptions[i].token) === tokenB) { reception = receptions[i]; break; } }
      if (!reception) {
        reception = {
          id: 'REC' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
          uid: uid, token: tokenB, empId: emp.id, matricule: emp.matricule || '',
          nom: recCompte.nom, mois: bul.mois || '', net: bul.net || 0,
          dateReception: new Date().toISOString(), moyen: 'qr+pin-premier-acces'
        };
        receptions.push(reception);
        if (receptions.length > 5000) receptions = receptions.slice(receptions.length - 5000);
        await ecrireCle(db, uid, 'mdb_receptionsBulletins', receptions);
      }
      let sessions = parseVal(await lireCle(db, uid, 'mdb_portailSessions'), []);
      if (!Array.isArray(sessions)) sessions = [];
      const now = Date.now();
      sessions = sessions.filter(s => s && s.expiresAt > now).slice(-800);
      const token = newToken();
      sessions.push({ token, uid, empId: emp.id, createdAt: now, expiresAt: now + 12 * 3600 * 1000 });
      await ecrireCle(db, uid, 'mdb_portailSessions', sessions);
      return json({ ok: true, token, employe: employePublic(emp), reception, created: true, login: loginChoisi });
    }

    /* ---------- Côté administration (Paye / RH) ---------- */
    if (action === 'adminlist') {
      const list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      let arr = Array.isArray(list) ? list.slice() : [];
      try {
        const tombs = parseVal(await lireCle(db, uid, 'mdb_requetesDeleted'), []);
        const ds = new Set((Array.isArray(tombs) ? tombs : []).map(String));
        const sigs2 = parseVal(await lireCle(db, uid, 'mdb_requetesDeletedSig'), []);
        const dSig2 = new Set((Array.isArray(sigs2) ? sigs2 : []).map(String));
        const sigOf = (r) => [String(r.empId || r.employee_id || ''), String(r.type || ''), String(r.dateDebut || r.date_debut || '').slice(0, 10), String(r.motif || r.sujet || '').trim().toLowerCase()].join('|');
        if (ds.size || dSig2.size) arr = arr.filter(r => r && !ds.has(String(r.id)) && !dSig2.has(sigOf(r)));
      } catch (eAdmDel) {}
      arr.sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); });
      return json({ ok: true, requetes: arr });
    }
    if (action === 'admindelete') {
      const id = String(body.requestId || body.id || '');
      if (!id) return json({ ok: false, code: 'id' }, 400);
      const list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      const arr = Array.isArray(list) ? list : [];
      const next = arr.filter(r => !(r && String(r.id) === id));
      if (next.length === arr.length) return json({ ok: false, code: 'not_found' }, 404);
      await ecrireCle(db, uid, 'mdb_requetesEmploye', next);
      return json({ ok: true, deleted: arr.length - next.length });
    }
    if (action === 'adminreply') {
      const id = String(body.requestId || '');
      const texte = String(body.texte || '').trim();
      if (!id || !texte) return json({ ok: false, code: 'params' }, 400);
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      let req = null;
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) { req = list[i]; break; }
      if (!req) return json({ ok: false, code: 'not_found' }, 404);
      const now = new Date().toISOString();
      req.messages = Array.isArray(req.messages) ? req.messages : [];
      req.messages.push({ id: 'M' + Date.now(), auteur: String(body.role || 'admin'), nom: String(body.nom || 'Administration'), texte, at: now });
      if (req.statut === 'ouverte') req.statut = 'en_cours';
      req.updatedAt = now;
      await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
      if (req.type === 'permission' || req.type === 'conge') {
        try {
          const perms = parseVal(await lireCle(db, uid, 'mdb_rh_permissions'), []);
          const arrP = Array.isArray(perms) ? perms : [];
          for (let ip = 0; ip < arrP.length; ip++) {
            const pp = arrP[ip];
            if (!pp) continue;
            if (String(pp.id) === String(req.id) || String(pp.requeteId) === String(req.id)) {
              pp.statut = statut === 'acceptee' ? 'valide' : (statut === 'refusee' ? 'refuse' : pp.statut);
              pp.payer = !!body.payer;
              pp.valide_par = String(body.nom || 'Administration');
              pp.date_validation = now;
              if (body.commentaire) pp.commentaire_admin = String(body.commentaire);
              await ecrireCle(db, uid, 'mdb_rh_permissions', arrP);
              break;
            }
          }
        } catch (eSyncPerm3) {}
      }
      return json({ ok: true, requete: req });
    }
    if (action === 'admindecision') {
      const id = String(body.requestId || '');
      if (!id) return json({ ok: false, code: 'params' }, 400);
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      let req = null;
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id) { req = list[i]; break; }
      if (!req) return json({ ok: false, code: 'not_found' }, 404);
      const now = new Date().toISOString();
      const statut = String(body.statut || 'en_cours');
      req.statut = statut;
      req.decision = {
        par: String(body.nom || 'Administration'),
        role: String(body.role || 'admin'),
        at: now,
        commentaire: String(body.commentaire || '')
      };
      /* Permission / congé accepté : on pose automatiquement les absences
         dans le pointage, du jour de début au jour de fin. */
      if (statut === 'acceptee' && (req.type === 'permission' || req.type === 'conge')) {
        const payer = body.payer === true;
        try {
          const paye = await lirePaye(db, uid);
          const pts = Array.isArray(paye.pointage) ? paye.pointage : [];
          const byKey = {};
          pts.forEach(p => { if (p && p.employee_id && p.date) byKey[String(p.employee_id) + '|' + String(p.date).slice(0, 10)] = p; });
          const start = String(req.dateDebut || '').slice(0, 10);
          const end = String(req.dateFin || req.dateDebut || '').slice(0, 10) || start;
          let n = 0;
          if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
            let d = new Date(start + 'T00:00:00Z');
            const _startD = new Date(start + 'T00:00:00Z');
            let fin = new Date((/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : start) + 'T00:00:00Z');
            if (!(fin > _startD)) fin = new Date(_startD.getTime() + 86400000);
            let guard = 0;
            while (d < fin && guard < 370) {
              guard++;
              const ds = d.toISOString().slice(0, 10);
              if (d.getUTCDay() === 0 || d.getUTCDay() === 6) { d = new Date(d.getTime() + 86400000); continue; }
              const k = String(req.empId) + '|' + ds;
              const motif = (req.type === 'conge' ? 'Congé approuvé' : 'Permission approuvée') + (req.motif ? ' — ' + req.motif : '');
              if (byKey[k]) {
                byKey[k].present = false;
                byKey[k].motif = motif;
                byKey[k].source = 'requete';
                byKey[k].requeteId = req.id;
                if (payer) { byKey[k].absent_paye = true; byKey[k].paye_sans_travail = true; byKey[k].h_j_manual = 8; byKey[k].h_n_manual = ''; byKey[k].rattrap_gagnees = 0; }
                else { byKey[k].absent_paye = false; byKey[k].paye_sans_travail = false; byKey[k].h_j_manual = 0; byKey[k].h_n_manual = 0; }
              } else {
                const row = {
                  id: 'PT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
                  employee_id: req.empId, date: ds, present: false,
                  h_j_manual: payer ? 8 : 0, h_n_manual: 0, motif, source: 'requete', requeteId: req.id,
                  absent_paye: payer, paye_sans_travail: payer, rattrap_gagnees: 0
                };
                pts.push(row); byKey[k] = row;
              }
              n++;
              d = new Date(d.getTime() + 86400000);
            }
          }
          paye.pointage = pts;
          await ecrireCle(db, uid, 'mdb_paye.pointage', paye.pointage);
          req.traitement = Object.assign({}, req.traitement || {}, { pointage: true, jours: n });
        } catch (eP) {}
      }
      /* Contestation de pointage acceptée : on corrige le jour concerné. */
      if (statut === 'acceptee' && req.type === 'pointage') {
        try {
          const paye = await lirePaye(db, uid);
          const pts = Array.isArray(paye.pointage) ? paye.pointage : [];
          const ds = String(req.datePointage || '').slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
            let row = null;
            for (let i = 0; i < pts.length; i++) {
              if (pts[i] && String(pts[i].employee_id) === String(req.empId) && String(pts[i].date || '').slice(0, 10) === ds) { row = pts[i]; break; }
            }
            if (!row) {
              row = {
                id: 'PT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
                employee_id: req.empId, date: ds, present: true, h_j_manual: 0, h_n_manual: 0
              };
              pts.push(row);
            }
            row.present = true;
            row.motif = 'Correction pointage — ' + (req.motif || req.sujet || 'requête employé');
            if (req.correction === 'heures') {
              row.h_j_manual = parseFloat(req.heuresJour) || 0;
              row.h_n_manual = parseFloat(req.heuresNuit) || 0;
            }
            row.source = 'requete';
            row.requeteId = req.id;
            paye.pointage = pts;
            await ecrireCle(db, uid, 'mdb_paye.pointage', paye.pointage);
            req.traitement = Object.assign({}, req.traitement || {}, { pointage: true, date: ds });
          }
        } catch (ePt) {}
      }
      /* Prêt / acompte accepté : l'admin choisit la caisse ou la banque et le
         mois de prélèvement. On crée la sortie et la ligne d'acompte/prêt. */
      if (statut === 'acceptee' && (req.type === 'pret' || req.type === 'acompte')) {
        const sourceType = String(body.sourceType || '').toLowerCase();
        const sourceId = String(body.sourceId || '');
        const moisDed = String(body.moisDeduction || req.moisDeduction || '').slice(0, 7);
        if ((sourceType !== 'caisse' && sourceType !== 'banque') || !sourceId || !/^\d{4}-\d{2}$/.test(moisDed)) {
          return json({ ok: false, code: 'need_source' }, 400);
        }
        const caisses = parseVal(await lireCle(db, uid, 'mdb_caisses'), []);
        const banques = parseVal(await lireCle(db, uid, 'mdb_banques'), []);
        const srcList = sourceType === 'banque' ? banques : caisses;
        const src = (Array.isArray(srcList) ? srcList : []).find(s => s && String(s.id) === sourceId);
        if (!src) return json({ ok: false, code: 'source_not_found' }, 404);
        const montantDemande = Math.round(parseFloat(req.montant) || 0);
        let montant = Math.round(parseFloat(body.montant) || montantDemande);
        if (montant <= 0) return json({ ok: false, code: 'montant' }, 400);
        if (montantDemande > 0 && montant > montantDemande) montant = montantDemande;
        req.montantDemande = montantDemande;
        req.montant = montant;
        const date = now.slice(0, 10);
        const heure = now.slice(11, 16);
        const opId = 'OP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        const apId = 'AP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        const num = 'REQ-' + req.id;
        const libelle = (req.type === 'pret' ? 'Prêt' : 'Acompte') + ' ' + req.nom + ' — ' + moisDed;
        if (sourceType === 'banque') {
          const bops = parseVal(await lireCle(db, uid, 'mdb_banqueOperations'), []);
          const arr = Array.isArray(bops) ? bops : [];
          arr.push({
            id: opId, banqueId: sourceId, date, heure, sens: 'sortie', montant,
            libelle, reference: num, beneficiaireType: 'employe', beneficiaireId: req.empId,
            beneficiaireNom: req.nom, moyenPaiement: 'virement', requeteId: req.id
          });
          await ecrireCle(db, uid, 'mdb_banqueOperations', arr);
        } else {
          const cops = parseVal(await lireCle(db, uid, 'mdb_operationsCaisse'), []);
          const arr = Array.isArray(cops) ? cops : [];
          arr.push({
            id: opId, caisseId: sourceId, date, heure, sens: 'sortie', montant,
            libelle, beneficiaireType: 'employe', beneficiaireId: req.empId,
            beneficiaireNom: req.nom, moyenPaiement: 'espece', numeroPiece: num,
            typeOp: req.type === 'pret' ? 'pret' : 'acompte',
            apMoisDeduction: moisDed, apDureeMois: 0, apMontantMensuel: montant,
            observations: 'Demande employé ' + req.id, requeteId: req.id
          });
          await ecrireCle(db, uid, 'mdb_operationsCaisse', arr);
        }
        const aps = parseVal(await lireCle(db, uid, 'mdb_acomptesPrets'), []);
        const arrAp = Array.isArray(aps) ? aps : [];
        arrAp.push({
          id: apId, type: req.type === 'pret' ? 'pret' : 'acompte',
          employeId: req.empId, employeNom: req.nom, montant,
          dureeMois: 0, montantMensuel: montant, moisDeduction: moisDed,
          date, statut: 'en_cours', montantRembourse: 0,
          caisseOpId: opId, numeroPiece: num,
          provenance: sourceType, moyen: sourceType === 'banque' ? 'virement' : 'espece',
          caisseId: sourceType === 'caisse' ? sourceId : '',
          valide: true, requeteId: req.id, updatedAt: Date.now()
        });
        await ecrireCle(db, uid, 'mdb_acomptesPrets', arrAp);
        req.traitement = Object.assign({}, req.traitement || {}, {
          paiement: true, sourceType, sourceId,
          sourceName: src.nom || src.libelle || '',
          montant, moisDeduction: moisDed,
          operationId: opId, acompteId: apId
        });
      }
      req.messages = Array.isArray(req.messages) ? req.messages : [];
      req.messages.push({
        id: 'M' + Date.now(), auteur: String(body.role || 'admin'), nom: String(body.nom || 'Administration'),
        texte: (statut === 'acceptee' ? '✅ Demande acceptée' : statut === 'refusee' ? '❌ Demande refusée' : 'Statut : ' + statut)
          + (body.commentaire ? '\n' + String(body.commentaire) : ''),
        at: now
      });
      req.updatedAt = now;
      await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
      return json({ ok: true, requete: req });
    }

    /* ---------- Vérification de session ---------- */
    const token = String(body.token || '');
    const sessions = parseVal(await lireCle(db, uid, 'mdb_portailSessions'), []);
    const sess = validerSession(Array.isArray(sessions) ? sessions : [], token);
    if (!sess) return json({ ok: false, code: 'session' }, 401);
    const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
    const emp = (employes || []).find(e => e && String(e.id) === String(sess.empId));
    if (!emp) return json({ ok: false, code: 'not_personnel' }, 404);
    if (estInactif(emp)) return json({ ok: false, code: 'inactive' }, 403);
    const paye = await lirePaye(db, uid);
    const allowed = moisAutorises(emp.id, paye);

    /* ---------- Bulletin tel qu'imprimé (seulement s'il est publié) ---------- */
    if (action === 'bulletinsnap') {
      const mois = String(body.mois || '').slice(0, 7);
      if (allowed.indexOf(mois) === -1) return json({ ok: false, code: 'mois' }, 403);
      const pub = (Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : []).some(b => b && b.visible === true && String(b.empId) === String(emp.id) && String(b.mois || '') === mois);
      if (!pub) return json({ ok: false, code: 'non_publie' }, 403);
      const snap = parseVal(await lireCle(db, uid, 'mdb_bulSnap:' + emp.id + '|' + mois), null);
      if (!snap || !snap.html) return json({ ok: false, code: 'absent' }, 404);
      let logo = '';
      try { const ent = parseVal(await lireCle(db, uid, 'mdb_entreprise'), {}) || {}; logo = String(ent.logo || ''); } catch (eL) {}
      return json({ ok: true, html: String(snap.html).split('__MDB_LOGO__').join(logo), at: snap.at || '' });
    }

    /* ---------- Demande de permission (espace employé) ---------- */
    if (action === 'permission') {
      const p = body.permission || {};
      const motif = String(p.motif || '').trim();
      const debut = String(p.dateDebut || '').slice(0, 10);
      if (!motif || !/^\d{4}-\d{2}-\d{2}$/.test(debut)) return json({ ok: false, code: 'champs' }, 400);
      try {
        const sigs = parseVal(await lireCle(db, uid, 'mdb_requetesDeletedSig'), []);
        const sg = [String(emp.id), String(p.type || 'permission'), debut, motif.toLowerCase()].join('|');
        if (Array.isArray(sigs) && sigs.map(String).indexOf(sg) !== -1) return json({ ok: true, deleted: true });
      } catch (eSigPerm) {}
      const list = parseVal(await lireCle(db, uid, 'mdb_rh_permissions'), []);
      const arr = Array.isArray(list) ? list : [];
      const rec = {
        id: 'PM' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
        employee_id: emp.id,
        matricule: emp.matricule || '',
        nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(),
        type: String(p.type || 'permission'),
        motif: motif,
        date_debut: debut,
        date_fin: String(p.dateFin || debut).slice(0, 10),
        heure_debut: String(p.heureDebut || ''),
        heure_fin: String(p.heureFin || ''),
        retour: String(p.retour || '').slice(0, 10),
        commentaire: String(p.commentaire || ''),
        nb_jours: parseFloat(p.nbJours) || 0,
        statut: 'en_attente',
        created_at: new Date().toISOString(),
        created_by: 'employe'
      };
      arr.push(rec);
      await ecrireCle(db, uid, 'mdb_rh_permissions', arr);
      try {
        const reqs = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
        const arrR = Array.isArray(reqs) ? reqs : [];
        if (!arrR.some(r => r && String(r.id) === String(rec.id))) {
          arrR.push({
            id: rec.id, uid, empId: emp.id, matricule: rec.matricule,
            nom: rec.nom, type: rec.type, sujet: rec.motif,
            message: rec.commentaire || rec.motif,
            dateDebut: rec.date_debut, dateFin: rec.date_fin,
            dureeJours: rec.nb_jours, motif: rec.motif,
            retourEstime: rec.retour, statut: 'ouverte',
            createdAt: rec.created_at, updatedAt: rec.created_at,
            messages: [{ id: 'M' + Date.now(), auteur: 'employe', nom: rec.nom, texte: rec.commentaire || rec.motif, at: rec.created_at }]
          });
          await ecrireCle(db, uid, 'mdb_requetesEmploye', arrR);
        }
      } catch (eSyncPerm) {}
      return json({ ok: true, permission: rec });
    }

    /* ---------- Changement du code PIN de l'employé ---------- */
    if (action === 'changepin') {
      const oldPin = String(body.oldPin || '').trim();
      const newPin = String(body.newPin || '').trim();
      if (!oldPin || !newPin) return json({ ok: false, code: 'params' }, 400);
      if (!/^\d{4,8}$/.test(newPin)) return json({ ok: false, code: 'format' }, 400);
      const payeCh = await lirePaye(db, uid);
      const portailCh = await lireComptesPortail(db, uid);
      const comptesCh = fusionComptes(payeCh.employePins, portailCh);
      const recCh = trouverPin(comptesCh, emp);
      if (!recCh) return json({ ok: false, code: 'no_pin' }, 403);
      let okOld = false;
      if (recCh.passwordHash) okOld = await verifierPin(recCh.passwordHash, oldPin);
      if (!okOld && recCh.hash) okOld = await verifierPin(recCh.hash, oldPin);
      if (!okOld) return json({ ok: false, code: 'bad_pin' }, 403);
      const salt = newSalt();
      const newHash = 'sha256:' + salt + ':' + (await sha256Hex(salt + '|' + newPin));
      let pKey = null;
      for (const k in portailCh) {
        const p = portailCh[k];
        if (p && (String(p.empId || '') === String(emp.id) || (emp.matricule && String(p.matricule || '') === String(emp.matricule)))) { pKey = k; break; }
      }
      if (!pKey) pKey = emp.id;
      const baseNom = ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim();
      portailCh[pKey] = Object.assign({}, portailCh[pKey] || {}, {
        empId: emp.id, matricule: emp.matricule || '', nom: baseNom,
        hash: newHash, passwordHash: newHash, self: true,
        updatedAt: new Date().toISOString()
      });
      await ecrireCle(db, uid, 'mdb_portailComptes', portailCh);
      try {
        if (payeCh.employePins && typeof payeCh.employePins === 'object') {
          for (const k2 in payeCh.employePins) {
            const p2 = payeCh.employePins[k2];
            if (p2 && (String(p2.empId || '') === String(emp.id) || (emp.matricule && String(p2.matricule || '') === String(emp.matricule)))) {
              p2.hash = newHash; p2.passwordHash = newHash; p2.updatedAt = new Date().toISOString();
            }
          }
          await ecrireCle(db, uid, 'mdb_paye.employePins', payeCh.employePins);
        }
      } catch (ePins) {}
      return json({ ok: true });
    }

    /* ---------- Validation de la fiche de pointage par l'employé ---------- */
    if (action === 'validatepointage') {
      /* Valider son pointage = le signer : le code PIN de l'employé est exigé. */
      {
        const pinV = String(body.pin || '').trim();
        if (!pinV) return json({ ok: false, code: 'pin_requis' }, 400);
        const payeV = await lirePaye(db, uid);
        const recV = trouverPin(fusionComptes(payeV.employePins, await lireComptesPortail(db, uid)), emp);
        if (!recV || !(recV.hash || recV.passwordHash)) return json({ ok: false, code: 'no_pin' }, 403);
        const kV = 'pin|' + uid + '|' + emp.id;
        if (await pinBloque(db, kV)) return json({ ok: false, code: 'bloque' }, 429);
        let okV = false;
        if (recV.passwordHash) okV = await verifierPin(recV.passwordHash, pinV);
        if (!okV && recV.hash) okV = await verifierPin(recV.hash, pinV);
        if (!okV) { await pinEchec(db, kV); return json({ ok: false, code: 'bad_pin' }, 403); }
        await pinReussite(db, kV);
      }
      let map = parseVal(await lireCle(db, uid, 'mdb_paye.pointageValidations'), {});
      if (!map || typeof map !== 'object' || Array.isArray(map)) map = {};
      const at = new Date().toISOString();
      const nom = ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim();
      const date = String(body.date || '').slice(0, 10);
      const semaine = String(body.semaine || '').trim();
      const mois = String(body.mois || '').slice(0, 7);
      let key = '', kind = '', extra = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        key = String(emp.id) + '|' + date;
        kind = 'jour';
        extra = { jour: date };
      } else if (/^\d{4}-W\d{2}$/.test(semaine)) {
        key = String(emp.id) + '|W' + semaine;
        kind = 'semaine';
        extra = { semaine: semaine, debut: String(body.debut || ''), fin: String(body.fin || '') };
      } else if (/^\d{4}-\d{2}$/.test(mois)) {
        key = String(emp.id) + '|' + mois;
        kind = 'mois';
        extra = { mois: mois };
      } else {
        return json({ ok: false, code: 'periode' }, 400);
      }
      map[key] = Object.assign({ at: at, nom: nom, type: kind }, extra);
      await ecrireCle(db, uid, 'mdb_paye.pointageValidations', map);
      return json({ ok: true, at: at, key: key, type: kind, jour: date, semaine: semaine, mois: mois });
    }

    /* ---------- Données personnelles ---------- */
    if (action === 'data') {
      const pointage = (Array.isArray(paye.pointage) ? paye.pointage : []).filter(p => p && String(p.employee_id) === String(emp.id) && allowed.indexOf(String(p.date || '').slice(0, 7)) !== -1);
      const montage = (Array.isArray(paye.pointageMontage) ? paye.pointageMontage : []).filter(p => p && String(p.employee_id) === String(emp.id) && allowed.indexOf(String(p.date || '').slice(0, 7)) !== -1);
      const bulletins = dedupeBulletinsParMois((Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : []).filter(b => b && b.visible === true && String(b.empId) === String(emp.id) && allowed.indexOf(String(b.mois || '').slice(0, 7)) !== -1));
      const acomptes = parseVal(await lireCle(db, uid, 'mdb_acomptesPrets'), []);
      const vusAp = {};
      const mesAcomptes = (Array.isArray(acomptes) ? acomptes : []).filter(a => {
        if (!a) return false;
        const eid = a.employeId || a.employee_id || '';
        if (String(eid) !== String(emp.id)) return false;
        const mt = Math.round(parseFloat(a.montant) || 0);
        const cle = a.requeteId
          ? 'R|' + String(a.requeteId)
          : ['C', a.date || '', mt, a.moisDeduction || '', a.type || '', eid].join('|');
        if (vusAp[cle]) return false;
        vusAp[cle] = 1;
        return true;
      });
      const photos = parseVal(await lireCle(db, uid, 'mdb_portailPhotos'), {});
      let maPhoto = '';
      try { maPhoto = parseVal(await lireCle(db, uid, 'mdb_portailPhoto:' + emp.id), ''); } catch (eP0) { maPhoto = ''; }
      if (!maPhoto) maPhoto = (photos && photos[emp.id]) || emp.photo || '';
      if (maPhoto) {
        try { await ecrireCle(db, uid, 'mdb_portailPhoto:' + emp.id, maPhoto); } catch (ePh) {}
      }
      const opsCaisse = parseVal(await lireCle(db, uid, 'mdb_operationsCaisse'), []);
      const opsList = Array.isArray(opsCaisse) ? opsCaisse : [];
      const natureDe = function (a) {
        const t = String(a.type || '').toLowerCase();
        let op = null;
        for (let i = 0; i < opsList.length; i++) {
          const o = opsList[i];
          if (!o) continue;
          if ((a.caisseOpId && String(o.id) === String(a.caisseOpId)) ||
              (a.operationId && String(o.id) === String(a.operationId)) ||
              (a.numeroPiece && String(o.numeroPiece || '') === String(a.numeroPiece))) { op = o; break; }
        }
        const code = String((op && (op.typeOp || op.code || op.apType)) || '').toUpperCase();
        const lib = String((op && (op.libelle || op.observations)) || a.motif || '').toUpperCase();
        const hasSolde = code.indexOf('SOLDE') >= 0 || lib.indexOf('SOLDE') >= 0;
        const hasPret = code.indexOf('PRET') >= 0 || code.indexOf('PRÊT') >= 0 || lib.indexOf('PRET') >= 0 || lib.indexOf('PRÊT') >= 0;
        if (t === 'solde' || (t !== 'pret' && hasSolde)) return 'solde';
        if (t === 'pret' || hasPret) return 'pret';
        return 'acompte';
      };
      const reqs = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      let _delSet = new Set();
      let _delSig = new Set();
      try {
        const _tombs = parseVal(await lireCle(db, uid, 'mdb_requetesDeleted'), []);
        _delSet = new Set((Array.isArray(_tombs) ? _tombs : []).map(String));
        const _sigs = parseVal(await lireCle(db, uid, 'mdb_requetesDeletedSig'), []);
        _delSig = new Set((Array.isArray(_sigs) ? _sigs : []).map(String));
      } catch (eDelSet) {}
      const _sigReq = (r) => [String(r.empId || r.employee_id || ''), String(r.type || ''), String(r.dateDebut || r.date_debut || '').slice(0, 10), String(r.motif || r.sujet || '').trim().toLowerCase()].join('|');
      const mesReq = (Array.isArray(reqs) ? reqs : []).filter(r => r && !_delSet.has(String(r.id)) && !_delSig.has(_sigReq(r)) && String(r.empId) === String(emp.id));
      const caisses = parseVal(await lireCle(db, uid, 'mdb_caisses'), []);
      const banques = parseVal(await lireCle(db, uid, 'mdb_banques'), []);
      const reqMap = {};
      (Array.isArray(reqs) ? reqs : []).forEach(r => { if (r && r.id) reqMap[r.id] = r; });
      const enrichDe = function (a) {
        let op = null;
        for (let i = 0; i < opsList.length; i++) {
          const o = opsList[i];
          if (!o) continue;
          if ((a.caisseOpId && String(o.id) === String(a.caisseOpId)) ||
              (a.operationId && String(o.id) === String(a.operationId)) ||
              (a.numeroPiece && String(o.numeroPiece || '') === String(a.numeroPiece))) { op = o; break; }
        }
        const srcList = (op && op.banqueId) ? (Array.isArray(banques) ? banques : []) : (Array.isArray(caisses) ? caisses : []);
        const sid = op ? (op.caisseId || op.banqueId || '') : (a.caisseId || '');
        const src = srcList.find(s => s && String(s.id) === String(sid));
        const req = a.requeteId ? reqMap[a.requeteId] : null;
        const isBanque = !!(op && op.banqueId) || String(a.provenance || '').toLowerCase() === 'banque';
        const ech = Array.isArray(a.echeances) ? a.echeances : [];
        let preleve = 0;
        ech.forEach(e => { if (e && e.preleve === true) preleve += parseFloat(e.montant) || 0; });
        const rembEffectif = Math.max(parseFloat(a.montantRembourse) || 0, parseFloat(a.rembourse) || 0, preleve);
        return {
          nature: natureDe(a),
          sourceNom: (src && (src.nom || src.libelle || src.code)) || (req && req.traitement && req.traitement.sourceName) || '',
          sourceType: isBanque ? 'banque' : 'caisse',
          moyen: (op && op.moyenPaiement) || a.moyen || (isBanque ? 'virement' : 'espece'),
          datePaiement: (op && op.date) || a.date || '',
          validePar: (req && req.decision && req.decision.par) || (op && (op.signatureNom || op.validatedBy)) || '',
          numeroPiece: (op && op.numeroPiece) || a.numeroPiece || '',
          montantRembourseEffectif: rembEffectif
        };
      };
      const cfg = (paye.portailEmployes && paye.portailEmployes[emp.id]) || {};
      const permsAll = parseVal(await lireCle(db, uid, 'mdb_rh_permissions'), []);
      const mesPermissions = (Array.isArray(permsAll) ? permsAll : []).filter(p => p && !_delSet.has(String(p.id)) && !_delSig.has(_sigReq(p)) && String(p.employee_id) === String(emp.id));
      let rhEvals = [], rhSanctions = [], rhDemandes = [], rhConges = [], rhPerms = [];
      try { rhEvals = parseVal(await lireCle(db, uid, 'mdb_rh_evaluations'), []) || []; } catch (eRh1) {}
      try { rhSanctions = parseVal(await lireCle(db, uid, 'mdb_rh_sanctions'), []) || []; } catch (eRh2) {}
      try { rhDemandes = parseVal(await lireCle(db, uid, 'mdb_rh_demandes'), []) || []; } catch (eRh3) {}
      try { rhConges = parseVal(await lireCle(db, uid, 'mdb_rh_conges'), []) || []; } catch (eRh4) {}
      try { rhPerms = parseVal(await lireCle(db, uid, 'mdb_rh_permissions'), []) || []; } catch (eRh5) {}
      const mineRh = (arr) => (Array.isArray(arr) ? arr : []).filter(x => x && String(x.employee_id) === String(emp.id));
      let pvAll = {};
      try { pvAll = parseVal(await lireCle(db, uid, 'mdb_paye.pointageValidations'), {}) || {}; } catch (ePV) {}
      const myValidations = {};
      for (const pvk in pvAll) {
        if (String(pvk).indexOf(String(emp.id) + '|') === 0) myValidations[pvk] = pvAll[pvk];
      }
      let pointageToken = '';
      try {
        /* Version du badge (Paie > Refaire un badge) : l'ancien QR devient invalide. */
        const bvs = (paye && paye.badgeVersions && typeof paye.badgeVersions === 'object') ? paye.badgeVersions : {};
        const bv = parseInt(bvs[emp.id], 10) || 0;
        pointageToken = (await sha256Hex(uid + '|' + emp.id + '|MDB-POINTAGE-V1' + (bv > 0 ? '|' + bv : ''))).slice(0, 32);
      } catch (ePT) {}
      return json({
        ok: true,
        pointageToken: pointageToken,
        pointageValidations: myValidations,
        evaluations: mineRh(rhEvals),
        sanctions: mineRh(rhSanctions),
        demandes: mineRh(rhDemandes),
        conges: mineRh(rhConges),
        permissionsValidees: mineRh(rhPerms).filter(p => p && p.statut === 'valide' && !_delSet.has(String(p.id)) && !_delSig.has(_sigReq(p))),
        employe: employePublic(emp),
        moiAutorises: allowed,
        portail: { actif: cfg.actif !== false, moisSupplementaires: cfg.mois || [] },
        pointage, montage, bulletins,
        acomptes: mesAcomptes.map(a => Object.assign({}, a, enrichDe(a))),
        photo: maPhoto,
        requetes: mesReq,
        mesPermissions,
        unread: mesReq.reduce((n, r) => n + ((r.messages || []).filter(m => m && m.auteur !== 'employe' && !m.luParEmploye).length), 0)
      });
    }

    /* ---------- Photo de profil ---------- */
    if (action === 'photo') {
      const photo = String(body.photo || '');
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(photo)) return json({ ok: false, code: 'photo_format' }, 400);
      if (photo.length > 900000) return json({ ok: false, code: 'photo_taille' }, 413);
      /* Une clé D1 par employé : pas de plafond lié à un gros objet unique. */
      await ecrireCle(db, uid, 'mdb_portailPhoto:' + emp.id, photo);
      return json({ ok: true, photo });
    }

    /* ---------- Créer une requête ---------- */
    if (action === 'request') {
      const type = String(body.type || 'reclamation').toLowerCase();
      const texte = String(body.message || '').trim();
      if (!texte) return json({ ok: false, code: 'message' }, 400);
      try {
        const sigs = parseVal(await lireCle(db, uid, 'mdb_requetesDeletedSig'), []);
        const _d0 = String(body.dateDebut || '').slice(0, 10);
        const _m0 = String(body.motif || body.sujet || '').trim().toLowerCase();
        const sg = [String(emp.id), type, _d0, _m0].join('|');
        if (Array.isArray(sigs) && sigs.map(String).indexOf(sg) !== -1) return json({ ok: true, deleted: true });
      } catch (eSigReq) {}
      const now = new Date().toISOString();
      const req = {
        id: 'RQ' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
        uid, empId: emp.id, matricule: emp.matricule || '',
        nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(),
        type, sujet: String(body.sujet || '').trim(),
        message: texte,
        dateDebut: body.dateDebut || '', dateFin: body.dateFin || '',
        dureeJours: parseFloat(body.dureeJours) || 0,
        motif: String(body.motif || '').trim(),
        retourEstime: body.retourEstime || '',
        montant: parseFloat(body.montant) || 0,
        moisDeduction: body.moisDeduction || '',
        datePointage: body.datePointage || '',
        correction: body.correction || '',
        heuresJour: parseFloat(body.heuresJour) || 0,
        heuresNuit: parseFloat(body.heuresNuit) || 0,
        statut: 'ouverte', createdAt: now, updatedAt: now,
        messages: [{ id: 'M' + Date.now(), auteur: 'employe', nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(), texte, at: now }]
      };
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      list.push(req);
      if (list.length > 4000) list = list.slice(list.length - 4000);
      await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
      if (type === 'permission' || type === 'conge') {
        try {
          const perms = parseVal(await lireCle(db, uid, 'mdb_rh_permissions'), []);
          const arrP = Array.isArray(perms) ? perms : [];
          if (!arrP.some(p => p && String(p.id) === String(req.id))) {
            arrP.push({
              id: req.id, employee_id: emp.id, matricule: req.matricule,
              nom: req.nom, type: type, motif: req.motif || req.sujet || texte,
              date_debut: req.dateDebut || '', date_fin: req.dateFin || req.dateDebut || '',
              heure_debut: '', heure_fin: '', retour: req.retourEstime || '',
              commentaire: req.message || '', nb_jours: req.dureeJours || 0,
              statut: 'en_attente', created_at: now, created_by: 'employe', requeteId: req.id
            });
            await ecrireCle(db, uid, 'mdb_rh_permissions', arrP);
          }
        } catch (eSyncPerm2) {}
      }
      return json({ ok: true, requete: req });
    }

    /* ---------- Répondre dans son fil ---------- */
    if (action === 'reply') {
      const id = String(body.requestId || '');
      const texte = String(body.texte || '').trim();
      if (!id || !texte) return json({ ok: false, code: 'params' }, 400);
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      let req = null;
      for (let i = 0; i < list.length; i++) if (list[i] && list[i].id === id && String(list[i].empId) === String(emp.id)) { req = list[i]; break; }
      if (!req) return json({ ok: false, code: 'not_found' }, 404);
      const now = new Date().toISOString();
      req.messages = Array.isArray(req.messages) ? req.messages : [];
      req.messages.push({ id: 'M' + Date.now(), auteur: 'employe', nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(), texte, at: now });
      req.updatedAt = now;
      if (req.statut === 'fermee') req.statut = 'ouverte';
      await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
      return json({ ok: true, requete: req });
    }

    /* ---------- Marquer les réponses comme lues ---------- */
    if (action === 'markread') {
      const id = String(body.requestId || '');
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      let changed = false;
      list.forEach(r => {
        if (!r || String(r.empId) !== String(emp.id)) return;
        if (id && r.id !== id) return;
        (r.messages || []).forEach(m => {
          if (m && m.auteur !== 'employe' && !m.luParEmploye) { m.luParEmploye = true; changed = true; }
        });
      });
      if (changed) await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
      return json({ ok: true });
    }

    /* ---------- Pointage par QR de session (espace employe) ----------
       L'employe, connecte a son espace, scanne le QR affiche par la
       personne autorisee (Paye > QR Pointage). Le QR contient
       MDBPOINT|v1|<uid>|<sessionId>|<token> : il ne transporte aucune
       donnee personnelle et ne peut etre rejoue hors de sa session.

       4 creneaux par shift (jour ou nuit) :
         1) arrivee, 2) pause, 3) reprise, 4) fin.
       Regle 3 h 30 : arrivee -> pause et reprise -> fin. En dessous, on
       refuse et on demande une confirmation explicite (body.confirm=true),
       car l'employe a peut-etre eu un malaise et quitte son poste. */
    if (action === 'pointageqr') {
      const qr = String(body.qr || '').trim();
      const parts = qr.split('|');
      if (parts.length < 5 || parts[0] !== 'MDBPOINT') return json({ ok: false, code: 'qr_invalide' }, 400);
      const qrVer = String(parts[1] || '');
      const qrUid = String(parts[2] || '').trim();
      const sid = String(parts[3] || '').trim();
      const stoken = String(parts[4] || '').trim();
      if (qrUid !== uid) return json({ ok: false, code: 'autre_entreprise' }, 403);
      /* QR v2 (tournant) : MDBPOINT|v2|uid|sid|minute|signature. La signature
         change chaque minute : une photo du QR envoyée à un absent expire. */
      const qrW = qrVer === 'v2' ? parseInt(parts[4], 10) : NaN;
      const qrSig = qrVer === 'v2' ? String(parts[5] || '') : '';
      const payeQr = await lirePaye(db, uid);
      let sessions = payeQr.pointageSessions;
      if (sessions && !Array.isArray(sessions) && typeof sessions === 'object') {
        sessions = Object.keys(sessions).map(function (k) { return sessions[k]; });
      }
      if (!Array.isArray(sessions)) sessions = [];
      let sess = null;
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        if (!s || String(s.id) !== sid) continue;
        if (qrVer === 'v2') { sess = s; break; }
        if (String(s.token) === stoken) { sess = s; break; }
      }
      if (!sess) return json({ ok: false, code: 'session_invalide' }, 403);
      if (qrVer === 'v2') {
        const wNow = Math.floor(Date.now() / 60000);
        /* 3 minutes de tolérance (temps de scanner / confirmer, petite avance d'horloge). */
        if (!isFinite(qrW) || qrW > wNow + 1 || qrW < wNow - 3) return json({ ok: false, code: 'qr_expire' }, 403);
        const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(sess.token) + '|' + qrW));
        const hex = Array.from(new Uint8Array(dig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
        if (hex.slice(0, 20) !== qrSig) return json({ ok: false, code: 'session_invalide' }, 403);
      } else if (sess.rot) {
        /* Session tournante : l'ancien QR fixe (v1) n'est plus accepté. */
        return json({ ok: false, code: 'qr_expire' }, 403);
      }
      if (sess.active === false) return json({ ok: false, code: 'session_fermee' }, 403);
      if (sess.expiresAt && Date.now() > Number(sess.expiresAt)) return json({ ok: false, code: 'session_expiree' }, 403);
      const now = new Date();
      const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const mois = date.slice(0, 7);
      const clot = (payeQr.clotures && payeQr.clotures[mois]) || null;
      if (clot && clot.clos) return json({ ok: false, code: 'clos' }, 403);
      const shift = sess.shift === 'nuit' ? 'nuit' : 'jour';
      const pre = shift === 'nuit' ? 'n_' : 'j_';
      const hField = shift === 'nuit' ? 'h_n_manual' : 'h_j_manual';
      const steps = ['arrivee', 'pause', 'reprise', 'fin'];
      const labels = { arrivee: 'Arrivée', pause: 'Pause', reprise: 'Reprise', fin: 'Fin' };
      const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const nom = ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim() || emp.matricule || 'Employe';
      const superviseur = String(sess.openedBy || '');
      const confirm = body.confirm === true;
      const MIN_GAP = 210;
      const toMin = function (t) {
        const m = String(t || '').match(/^(\d{1,2})[:hH](\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      };
      const dur = function (a, b) {
        const am = toMin(a), bm = toMin(b);
        if (am == null || bm == null) return 0;
        let d = bm - am;
        if (d < 0) d += 1440;
        return d;
      };
      /* Lecture AVEC sa date de mise à jour : l'écriture ne réussit que si
         personne n'a écrit entre-temps (sinon deux employés qui scannent à la
         même seconde : l'un des deux pointages était perdu). */
      const lirePts = async function () {
        const r0 = await db.prepare('SELECT enterprise_id, valeur, updated_at FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1').bind(uid, '"' + uid + '"', 'mdb_paye.pointage').first();
        if (r0) { const v = parseVal(r0.valeur, []); return { pts: Array.isArray(v) ? v : [], at: r0.enterprise_id === uid ? r0.updated_at : null }; }
        return { pts: Array.isArray(payeQr.pointage) ? payeQr.pointage : [], at: null };
      };
      const trouverLigne = function (pts) {
        const chercher = function (d) {
          for (let i = 0; i < pts.length; i++) {
            if (pts[i] && String(pts[i].employee_id) === String(emp.id) && String(pts[i].date || '').slice(0, 10) === d) return pts[i];
          }
          return null;
        };
        let r = chercher(date), d = date;
        /* NUIT après minuit : on continue la ligne de la veille (arrivée sans fin). */
        if (shift === 'nuit' && nowMin < 720 && !(r && r.n_arrivee)) {
          const v = new Date(date + 'T12:00:00Z'); v.setUTCDate(v.getUTCDate() - 1);
          const hier = v.toISOString().slice(0, 10);
          const rh = chercher(hier);
          if (rh && rh.n_arrivee && !rh.n_fin) { r = rh; d = hier; }
        }
        return { row: r, date: d };
      };
      let lu = await lirePts();
      let pts = lu.pts;
      let tl = trouverLigne(pts);
      let row = tl.row;
      const baseRep = { nom: nom, matricule: emp.matricule || '', shift: shift, date: tl.date, superviseur: superviseur };
      if (row && row.protege === true) return json(Object.assign({ ok: false, code: 'verrouille' }, baseRep));
      const ecrireLog = async function (step, hh) {
        try {
          const log = Array.isArray(payeQr.pointageQrLog) ? payeQr.pointageQrLog : [];
          log.push({ id: sid, employee_id: emp.id, nom: nom, matricule: emp.matricule || '', date: date, heure: heure, shift: shift, step: step, heures: hh, superviseur: superviseur, at: now.toISOString() });
          while (log.length > 800) log.shift();
          await ecrireCle(db, uid, 'mdb_paye.pointageQrLog', log);
        } catch (eLog) {}
      };

      let next = -1;
      for (let s = 0; s < steps.length; s++) {
        if (!row || !row[pre + steps[s]]) { next = s; break; }
      }
      let overwrite = false;
      if (next === -1) {
        if (!confirm) {
          return json(Object.assign({ ok: false, code: 'deja', step: 'fin', heure: row[pre + 'fin'], entree: row[pre + 'arrivee'], pause: row[pre + 'pause'], reprise: row[pre + 'reprise'], fin: row[pre + 'fin'] }, baseRep));
        }
        next = 3;
        overwrite = true;
      }
      const step = steps[next];

      /* Regle 3 h 30 : arrivee -> pause, reprise -> fin. */
      if (!confirm && (step === 'pause' || step === 'fin')) {
        const ref = step === 'pause' ? row[pre + 'arrivee'] : row[pre + 'reprise'];
        const gap = dur(ref, heure);
        if (gap < MIN_GAP) {
          return json(Object.assign({ ok: false, code: 'court', step: step, heure: ref, gapMin: gap, minGap: MIN_GAP }, baseRep));
        }
      }

      const appliquer = function (pts0) {
        const t = trouverLigne(pts0);
        let rw = t.row;
        if (!rw) {
          rw = {
            id: 'PT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
            employee_id: emp.id, date: t.date, present: true, h_j_manual: 0, h_n_manual: 0
          };
          pts0.push(rw);
        }
        rw[pre + step] = heure;
        rw.present = true;
        rw.source = 'qr';
        rw.shift = shift;
        rw.sessionId = sid;
        rw.superviseur = superviseur;
        rw.updatedAt = now.toISOString();
        if (step === 'arrivee') { rw.heure_entree = heure; if (shift === 'nuit') rw.heure_entree_nuit = heure; }
        if (step === 'fin') { rw.heure_sortie = heure; if (shift === 'nuit') rw.heure_sortie_nuit = heure; }
        const h1 = (rw[pre + 'arrivee'] && rw[pre + 'pause']) ? dur(rw[pre + 'arrivee'], rw[pre + 'pause']) : 0;
        const h2 = (rw[pre + 'reprise'] && rw[pre + 'fin']) ? dur(rw[pre + 'reprise'], rw[pre + 'fin']) : 0;
        rw[hField] = Math.max(0, Math.round(((h1 + h2) / 60) * 100) / 100);
        return rw;
      };
      let ecrit = false;
      for (let essai = 0; essai < 5 && !ecrit; essai++) {
        if (essai > 0) { lu = await lirePts(); pts = lu.pts; }
        row = appliquer(pts);
        const stamp = (Math.max(Date.now(), (parseInt(lu.at, 10) || 0) + 1)).toString();
        if (lu.at == null) {
          await ecrireCle(db, uid, 'mdb_paye.pointage', pts);
          ecrit = true;
        } else {
          const res = await db.prepare('UPDATE enterprise_data SET valeur = ?, updated_at = ? WHERE enterprise_id = ? AND cle = ? AND updated_at = ?')
            .bind(JSON.stringify(pts), stamp, uid, 'mdb_paye.pointage', lu.at).run();
          ecrit = !!(res && res.meta && res.meta.changes > 0);
        }
      }
      if (!ecrit) return json(Object.assign({ ok: false, code: 'occupe' }, baseRep), 409);
      payeQr.pointage = pts;
      await ecrireLog(step, row[hField]);
      return json(Object.assign({ ok: true, step: step, label: labels[step], heure: heure, heures: row[hField], overwrite: overwrite }, baseRep));
    }

    /* ---------- Pointage par code PIN (entrée / sortie) ---------- */
    if (action === 'pointer') {
      /* Pointage par code PIN depuis l'espace employé : SUPPRIMÉ (on pouvait se
         pointer depuis chez soi). Seuls restent le QR montré par l'administration
         (pointageqr) et le badge scanné par l'administration. */
      if (action === 'pointer') return json({ ok: false, code: 'desactive', message: 'Pointage sur place uniquement : QR de l’administration ou badge.' }, 403);
      const pin = String(body.pin || '').trim();
      const sens = String(body.sens || 'entree').toLowerCase();
      const paye = await lirePaye(db, uid);
      const now = new Date();
      const mois = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const clot = (paye.clotures && paye.clotures[mois]) || null;
      if (clot && clot.clos) return json({ ok: false, code: 'clos' }, 403);
      const portail = await lireComptesPortail(db, uid);
      const comptes = fusionComptes(paye.employePins, portail);
      const rec = trouverPin(comptes, emp);
      if (!rec || !(rec.hash || rec.passwordHash)) return json({ ok: false, code: 'no_pin' }, 403);
      let ok = false;
      if (rec.passwordHash) ok = await verifierPin(rec.passwordHash, pin);
      if (!ok && rec.hash) ok = await verifierPin(rec.hash, pin);
      if (!ok) return json({ ok: false, code: 'bad_pin' }, 403);
      const date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const heure = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const pts = Array.isArray(paye.pointage) ? paye.pointage : [];
      let row = null;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i] && String(pts[i].employee_id) === String(emp.id) && String(pts[i].date || '').slice(0, 10) === date) { row = pts[i]; break; }
      }
      if (!row) {
        row = {
          id: 'PT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
          employee_id: emp.id, empId: emp.id, date, present: true,
          h_j_manual: 0, h_n_manual: 0, source: 'portail'
        };
        pts.push(row);
      }
      row.present = true;
      row.source = 'portail';
      /* Memes champs que la Paye (j_arrivee / j_fin / n_arrivee / n_fin)
         pour que le pointage du portail apparaisse vraiment dans Paye. */
      row.empId = emp.id;
      row.employee_id = emp.id;
      const night = (now.getHours() >= 21 || now.getHours() < 5);
      if (sens === 'sortie') {
        row.heure_sortie = heure;
        const shiftNight = (row.portail_shift === 'nuit') || (row.portail_shift ? false : night);
        if (shiftNight) row.n_fin = heure; else row.j_fin = heure;
        const t0 = String(row.heure_entree || (shiftNight ? row.n_arrivee : row.j_arrivee) || '');
        if (t0) {
          const a = t0.split(':');
          const b = heure.split(':');
          let diff = (parseInt(b[0], 10) * 60 + parseInt(b[1], 10)) - (parseInt(a[0], 10) * 60 + parseInt(a[1], 10));
          if (diff < 0) diff += 24 * 60;
          let hh = Math.round((diff / 60) * 100) / 100;
          if (hh > 6) hh = Math.round((hh - 1) * 100) / 100;
          if (shiftNight) row.h_n_manual = Math.max(0, hh); else row.h_j_manual = Math.max(0, hh);
        }
      } else {
        row.heure_entree = heure;
        row.portail_shift = night ? 'nuit' : 'jour';
        if (night) row.n_arrivee = heure; else row.j_arrivee = heure;
      }
      row.updatedAt = now.toISOString();
      paye.pointage = pts;
      await ecrireCle(db, uid, 'mdb_paye.pointage', pts);
      return json({ ok: true, date, heure, sens, entree: row.heure_entree || '', sortie: row.heure_sortie || '', heures: row.h_j_manual || 0 });
    }

    return json({ ok: false, code: 'action' }, 400);
  } catch (e) {
    return json({ ok: false, code: 'error', message: e && e.message ? e.message : String(e) }, 500);
  }
}
