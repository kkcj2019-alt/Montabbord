const fs = require('fs');
const NL = '\r\n';
let f = fs.readFileSync('public/index.html', 'utf8');

function rep(oldS, newS, label, all) {
  const cnt = f.split(oldS).length - 1;
  if (cnt < 1 || (!all && cnt !== 1)) { console.error('ANCRE ' + cnt + 'x: ' + label); process.exit(1); }
  f = all ? f.split(oldS).join(newS) : f.replace(oldS, newS);
}

/* ===== 1) Correctifs recherche globale ===== */
rep("function globalGoOpCaisse(id) { closeGlobalSearch(); navigateTo('caisse'); setTimeout(function(){ openCaisseModal(id); }, 300); }",
    "function globalGoOpCaisse(id) { closeGlobalSearch(); navigateTo('tresorerie:caisse'); setTimeout(function(){ openCaisseModal(id); }, 300); }",
    'go caisse');
rep("function globalGoClient(id) { closeGlobalSearch(); navigateTo('clients'); setTimeout(function(){ openClientModal(id); }, 300); }",
    "function globalGoClient(id) { closeGlobalSearch(); navigateTo('tiers'); setTimeout(function(){ openClientModal(id); }, 300); }",
    'go client');
rep("function globalGoArticle(id) { closeGlobalSearch(); navigateTo('articles'); }",
    "function globalGoArticle(id) { closeGlobalSearch(); navigateTo('stock'); }",
    'go article');

/* ===== 2) Fond application : gris ardoise discret ===== */
rep("body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--gray-100);",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#eef0f4;",
    'fond appli');

/* Cartes : fin liseré pour se détacher du gris */
rep(".section{background:#fff;border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:28px;overflow:hidden}",
    ".section{background:#fff;border:1px solid #e7eaf0;border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:28px;overflow:hidden}",
    'cartes section');

/* Recherche header : champ grisé au repos */
rep("#globalSearch{width:100%;box-sizing:border-box;padding:8px 14px 8px 34px;border:1px solid var(--gray-300);",
    "#globalSearch{width:100%;box-sizing:border-box;padding:8px 14px 8px 34px;background:#f2f4f8;border:1px solid transparent;",
    'champ recherche');

/* ===== 3) Sidebar : pastilles arrondies, actif orange doux ===== */
rep(".sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#f97316;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}\r\n.sidebar-brand svg{flex-shrink:0}",
    ".sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#111827;border-bottom:1px solid #f1f3f6;display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}\r\n.sidebar-brand svg{flex-shrink:0;color:#f97316}",
    'brand');
rep(".nav-group-title{padding:10px 24px 4px;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;font-weight:600;white-space:nowrap;overflow:hidden}",
    ".nav-group-title{padding:12px 26px 6px;font-size:10.5px;text-transform:uppercase;color:#98a1b0;letter-spacing:.08em;font-weight:700;white-space:nowrap;overflow:hidden}",
    'titre groupe');
rep(".nav-item{display:flex;align-items:center;gap:12px;padding:10px 24px;color:#64748b;cursor:pointer;transition:all .15s;text-decoration:none;font-size:14px;border-left:3px solid transparent;white-space:nowrap;overflow:hidden}\r\n.nav-item:hover{background:rgba(249,115,22,.05);color:#1e293b}\r\n.nav-item.active{background:linear-gradient(to right,rgba(249,115,22,.1),transparent);color:#f97316;border-left-color:#f97316;font-weight:600}",
    ".nav-item{display:flex;align-items:center;gap:12px;margin:2px 12px;padding:9px 14px;border-radius:9px;color:#5b6472;cursor:pointer;transition:all .15s;text-decoration:none;font-size:13.5px;white-space:nowrap;overflow:hidden}\r\n.nav-item:hover{background:#f3f5f8;color:#1f2937}\r\n.nav-item.active,.nav-item:hover.active{background:#fff1e7;color:#ea580c;font-weight:600}",
    'nav pills');
rep(".sidebar-footer{padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;overflow:hidden;white-space:nowrap}",
    ".sidebar-footer{padding:14px 20px;border-top:1px solid #f1f3f6;display:flex;align-items:center;justify-content:space-between;overflow:hidden;white-space:nowrap}",
    'footer bordure');
/* Variantes réduites */
rep("#sidebar.collapsed .nav-item.active{background:linear-gradient(to right,rgba(249,115,22,.1),transparent)}\r\n#sidebar.collapsed .nav-item:hover{background:rgba(249,115,22,.05)}",
    "#sidebar.collapsed .nav-item.active,#sidebar.collapsed .nav-item:hover.active{background:#fff1e7}\r\n#sidebar.collapsed .nav-item:hover{background:#f3f5f8}",
    'collapse variants');

fs.writeFileSync('public/index.html', f);
console.log('Design + correctifs recherche OK');
