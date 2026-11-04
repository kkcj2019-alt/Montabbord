import { onRequest as syncApi } from "../functions/api/sync.js";
import { onRequest as statusApi } from "../functions/api/status.js";
import { onRequest as sessionApi } from "../functions/api/session.js";
import { onRequest as enterpriseApi } from "../functions/api/enterprise.js";
import { onRequest as backupApi } from "../functions/api/backup.js";
import { onRequest as recepApi } from "../functions/api/recep.js";
import { onRequest as portailApi } from "../functions/api/portail.js";

const ROUTES = {
  "/api/sync": syncApi,
  "/api/status": statusApi,
  "/api/session": sessionApi,
  "/api/enterprise": enterpriseApi,
  "/api/backup": backupApi,
  "/api/recep": recepApi,
  "/api/portail": portailApi,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const fn = ROUTES[path];
    if (fn) return fn({ request, env, ctx });
    return new Response(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
