const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Cloudflare D1 adapter...');

// Mock browser environment
const mockWindow = {
  location: { origin: 'https://montabbord.pages.dev' },
  currentUser: { id: 'test_ent_123' },
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = String(v); },
    removeItem(k) { delete this.data[k]; },
    key(i) { return Object.keys(this.data)[i] || null; },
    get length() { return Object.keys(this.data).length; }
  },
  document: {
    hidden: false,
    createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {}
  },
  addEventListener() {},
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval
};
mockWindow.window = mockWindow;
mockWindow.top = mockWindow;

// Mock fetch
const serverStorage = {
  enterprise_data: {},
  enterprises: {},
  sessions: {},
  backups: {}
};

mockWindow.fetch = async function(url, opts) {
  opts = opts || {};
  const method = opts.method || 'GET';
  const u = new URL(url, 'https://montabbord.pages.dev');
  const pathname = u.pathname;

  if (pathname === '/api/sync') {
    if (method === 'GET') {
      const uid = u.searchParams.get('uid');
      const since = u.searchParams.get('since') || '0';
      const rows = serverStorage.enterprise_data[uid] || {};
      const data = {};
      const tsMap = {};
      let count = 0;
      let maxTs = since;
      for (const k in rows) {
        if (rows[k].updated_at > since) {
          data[k] = rows[k].data;
          tsMap[k] = rows[k].updated_at;
          count++;
          if (rows[k].updated_at > maxTs) maxTs = rows[k].updated_at;
        }
      }
      return {
        ok: true,
        json: async () => ({ ok: true, uid, data, ts: tsMap, maxTs, count, serverTime: Date.now().toString() })
      };
    }
    if (method === 'POST') {
      const body = JSON.parse(opts.body);
      const uid = body.uid;
      serverStorage.enterprise_data[uid] = serverStorage.enterprise_data[uid] || {};
      const now = Date.now().toString();
      if (body.rows) {
        for (const r of body.rows) {
          serverStorage.enterprise_data[uid][r.cle] = { data: r.data, updated_at: now };
        }
      }
      if (body.updates) {
        for (const k in body.updates) {
          serverStorage.enterprise_data[uid][k] = { data: body.updates[k], updated_at: now };
        }
      }
      return {
        ok: true,
        json: async () => ({ ok: true, updated: (body.rows ? body.rows.length : Object.keys(body.updates || {}).length), ts: now })
      };
    }
  }

  if (pathname === '/api/enterprise') {
    if (method === 'GET') {
      const id = u.searchParams.get('id');
      const ent = serverStorage.enterprises[id];
      return {
        ok: true,
        json: async () => (ent ? { found: true, enterprise: ent } : { found: false })
      };
    }
    if (method === 'POST') {
      const body = JSON.parse(opts.body);
      serverStorage.enterprises[body.id] = body;
      return {
        ok: true,
        json: async () => ({ ok: true, id: body.id })
      };
    }
  }

  return { ok: true, json: async () => ({}) };
};

// Load mdb-supabase.js into VM context
const adapterCode = fs.readFileSync(path.join(__dirname, '../public/supabase-sdk/mdb-supabase.js'), 'utf8');
const context = vm.createContext(mockWindow);
vm.runInContext(adapterCode, context);

assert.ok(mockWindow.__MDB_ADAPTER__, 'window.__MDB_ADAPTER__ must be defined');
assert.ok(mockWindow.SB_CLIENT, 'window.SB_CLIENT must be defined');

async function runTests() {
  const sb = mockWindow.SB_CLIENT;
  const uid = 'test_ent_123';

  // 1. Test upsert to enterprise_data
  console.log('1. Testing D1 upsert...');
  const upsertRes = await sb.from('enterprise_data').upsert([
    { enterprise_id: uid, cle: 'clients', data: [{ id: 1, nom: 'Client Test' }], updated_at: '100' },
    { enterprise_id: uid, cle: 'factures', data: [{ id: 'F001', total: 50000 }], updated_at: '100' }
  ]);
  assert.strictEqual(upsertRes.error, null);

  // 2. Test select from enterprise_data
  console.log('2. Testing D1 select...');
  const selectRes = await sb.from('enterprise_data').select('*').eq('enterprise_id', uid);
  assert.strictEqual(selectRes.error, null);
  assert.strictEqual(selectRes.data.length, 2);
  const clientsRow = selectRes.data.find(r => r.cle === 'clients');
  assert.ok(clientsRow);
  assert.strictEqual(clientsRow.data[0].nom, 'Client Test');

  // 3. Test filter by cle
  console.log('3. Testing D1 select with cle filter...');
  const singleCleRes = await sb.from('enterprise_data').select('*').eq('enterprise_id', uid).eq('cle', 'clients');
  assert.strictEqual(singleCleRes.data.length, 1);
  assert.strictEqual(singleCleRes.data[0].cle, 'clients');

  // 4. Test enterprises table
  console.log('4. Testing D1 enterprises table...');
  await sb.from('enterprises').upsert({ id: uid, nom: 'Mon Entreprise', identifiant: 'ENT001' });
  const entRes = await sb.from('enterprises').select('*').eq('id', uid);
  assert.strictEqual(entRes.data.length, 1);
  assert.strictEqual(entRes.data[0].nom, 'Mon Entreprise');

  // 5. Test real-time channel
  console.log('5. Testing D1 channel & polling...');
  let receivedUpdate = false;
  const ch = sb.channel('mdb-test-' + uid);
  ch.on('postgres_changes', { filter: 'enterprise_id=eq.' + uid }, function(payload) {
    if (payload.new && payload.new.cle === 'devis') {
      receivedUpdate = true;
    }
  });
  ch.subscribe();

  // Push an update from another workstation
  serverStorage.enterprise_data[uid]['devis'] = { data: [{ id: 'D01' }], updated_at: '200' };

  await new Promise(r => setTimeout(r, 1600));
  ch.unsubscribe();
  assert.ok(receivedUpdate, 'Channel must receive updates from poll');

  console.log('ALL D1 ADAPTER TESTS PASSED! ✅');
}

runTests().catch(err => {
  console.error('TEST FAILED ❌', err);
  process.exit(1);
});
