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
async function lireCle(db, uid, cle) {
  const row = await db.prepare(
    'SELECT valeur FROM enterprise_data WHERE enterprise_id IN (?, ?) AND cle = ? ORDER BY updated_at DESC LIMIT 1'
  ).bind(uid, '"' + uid + '"', cle).first();
  return row ? row.valeur : null;
}
async function ecrireCle(db, uid, cle, valeur) {
  const now = Date.now().toString();
  await db.prepare(
    `INSERT INTO enterprise_data (enterprise_id, cle, valeur, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(enterprise_id, cle) DO UPDATE SET valeur = excluded.valeur, updated_at = excluded.updated_at`
  ).bind(uid, cle, JSON.stringify(valeur), now).run();
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
    if (noms.indexOf(q) !== -1) exact.push(e);
    else if (noms.some(x => x && x.indexOf(q) !== -1)) partiels.push(e);
  });
  return { list: exact.length ? exact : partiels.slice(0, 10) };
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
function validerSession(sessions, token) {
  const now = Date.now();
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s && s.token === token && s.expiresAt > now) return s;
  }
  return null;
}

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

    /* ---------- Suggestions de noms ---------- */
    if (action === 'suggest') {
      const q = String(body.q || '').trim();
      if (q.length < 2) return json({ ok: true, choices: [] });
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const found = trouverEmploye(employes, q).list.slice(0, 10);
      return json({ ok: true, choices: found.map(employePublic) });
    }

    /* ---------- Connexion ---------- */
    if (action === 'login') {
      const employes = parseVal(await lireCle(db, uid, 'mdb_employes'), []);
      const paye = parseVal(await lireCle(db, uid, 'mdb_paye'), {});
      const found = trouverEmploye(employes, body.login).list;
      if (!found.length) return json({ ok: false, code: 'not_personnel' }, 404);
      if (found.length > 1) {
        return json({ ok: false, code: 'ambiguous', choices: found.slice(0, 8).map(employePublic) }, 409);
      }
      const emp = found[0];
      if (emp.status && emp.status !== 'actif') return json({ ok: false, code: 'inactive' }, 403);
      const pinRec = trouverPin(paye.employePins, emp);
      if (!pinRec || !pinRec.hash) return json({ ok: false, code: 'no_access' }, 403);
      const ok = await verifierPin(pinRec.hash, body.pin);
      if (!ok) return json({ ok: false, code: 'bad_pin' }, 403);

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

    /* ---------- Côté administration (Paye / RH) ---------- */
    if (action === 'adminlist') {
      const list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      const arr = Array.isArray(list) ? list.slice() : [];
      arr.sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); });
      return json({ ok: true, requetes: arr });
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
        try {
          const paye = parseVal(await lireCle(db, uid, 'mdb_paye'), {});
          const pts = Array.isArray(paye.pointage) ? paye.pointage : [];
          const byKey = {};
          pts.forEach(p => { if (p && p.employee_id && p.date) byKey[String(p.employee_id) + '|' + String(p.date).slice(0, 10)] = p; });
          const start = String(req.dateDebut || '').slice(0, 10);
          const end = String(req.dateFin || req.dateDebut || '').slice(0, 10) || start;
          let n = 0;
          if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
            let d = new Date(start + 'T00:00:00Z');
            const fin = new Date((/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : start) + 'T00:00:00Z');
            let guard = 0;
            while (d <= fin && guard < 370) {
              guard++;
              const ds = d.toISOString().slice(0, 10);
              const k = String(req.empId) + '|' + ds;
              const motif = (req.type === 'conge' ? 'Congé approuvé' : 'Permission approuvée') + (req.motif ? ' — ' + req.motif : '');
              if (byKey[k]) {
                byKey[k].present = false;
                byKey[k].motif = motif;
                byKey[k].source = 'requete';
                byKey[k].requeteId = req.id;
              } else {
                const row = {
                  id: 'PT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5),
                  employee_id: req.empId, date: ds, present: false,
                  h_j_manual: 0, h_n_manual: 0, motif, source: 'requete', requeteId: req.id
                };
                pts.push(row); byKey[k] = row;
              }
              n++;
              d = new Date(d.getTime() + 86400000);
            }
          }
          paye.pointage = pts;
          await ecrireCle(db, uid, 'mdb_paye', paye);
          req.traitement = Object.assign({}, req.traitement || {}, { pointage: true, jours: n });
        } catch (eP) {}
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
        const montant = Math.round(parseFloat(req.montant) || 0);
        if (montant <= 0) return json({ ok: false, code: 'montant' }, 400);
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
    const paye = parseVal(await lireCle(db, uid, 'mdb_paye'), {});
    const allowed = moisAutorises(emp.id, paye);

    /* ---------- Données personnelles ---------- */
    if (action === 'data') {
      const pointage = (Array.isArray(paye.pointage) ? paye.pointage : []).filter(p => p && String(p.employee_id) === String(emp.id) && allowed.indexOf(String(p.date || '').slice(0, 7)) !== -1);
      const montage = (Array.isArray(paye.pointageMontage) ? paye.pointageMontage : []).filter(p => p && String(p.employee_id) === String(emp.id) && allowed.indexOf(String(p.date || '').slice(0, 7)) !== -1);
      const bulletins = (Array.isArray(paye.bulletinVerifs) ? paye.bulletinVerifs : []).filter(b => b && String(b.empId) === String(emp.id) && allowed.indexOf(String(b.mois || '')) !== -1);
      const acomptes = parseVal(await lireCle(db, uid, 'mdb_acomptesPrets'), []);
      const mesAcomptes = (Array.isArray(acomptes) ? acomptes : []).filter(a => {
        if (!a) return false;
        const eid = a.employeId || a.employee_id || '';
        return String(eid) === String(emp.id);
      });
      const reqs = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      const mesReq = (Array.isArray(reqs) ? reqs : []).filter(r => r && String(r.empId) === String(emp.id));
      const cfg = (paye.portailEmployes && paye.portailEmployes[emp.id]) || {};
      return json({
        ok: true,
        employe: employePublic(emp),
        moiAutorises: allowed,
        portail: { actif: cfg.actif !== false, moisSupplementaires: cfg.mois || [] },
        pointage, montage, bulletins,
        acomptes: mesAcomptes,
        requetes: mesReq,
        unread: mesReq.reduce((n, r) => n + ((r.messages || []).filter(m => m && m.auteur !== 'employe' && !m.luParEmploye).length), 0)
      });
    }

    /* ---------- Créer une requête ---------- */
    if (action === 'request') {
      const type = String(body.type || 'reclamation').toLowerCase();
      const texte = String(body.message || '').trim();
      if (!texte) return json({ ok: false, code: 'message' }, 400);
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
        statut: 'ouverte', createdAt: now, updatedAt: now,
        messages: [{ id: 'M' + Date.now(), auteur: 'employe', nom: ((emp.nom || '') + ' ' + (emp.prenoms || '')).trim(), texte, at: now }]
      };
      let list = parseVal(await lireCle(db, uid, 'mdb_requetesEmploye'), []);
      if (!Array.isArray(list)) list = [];
      list.push(req);
      if (list.length > 4000) list = list.slice(list.length - 4000);
      await ecrireCle(db, uid, 'mdb_requetesEmploye', list);
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

    return json({ ok: false, code: 'action' }, 400);
  } catch (e) {
    return json({ ok: false, code: 'error', message: e && e.message ? e.message : String(e) }, 500);
  }
}
