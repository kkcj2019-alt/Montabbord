export async function onRequest(context) {
  const { env } = context;
  const db = env.DB;
  let dbOk = false;
  let count = 0;
  try {
    if (db) {
      const res = await db.prepare('SELECT count(*) as cnt FROM enterprise_data').first();
      count = res ? res.cnt : 0;
      dbOk = true;
    }
  } catch (e) {
    dbOk = false;
  }

  return new Response(JSON.stringify({
    status: 'ok',
    provider: 'cloudflare-d1',
    db_connected: dbOk,
    rows: count,
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
