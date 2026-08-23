const fs = require('fs');
let f = fs.readFileSync('public/index.html', 'utf8');

const start = '#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:#f6f1e7;color:#3f3625;border-right:1px solid #e6dcc4;display:flex;flex-direction:column;z-index:100;overflow:hidden;transition:width .25s ease}';
const end = '#sidebar.collapsed .nav-item:hover{background:#ece3cd}';

const i0 = f.indexOf(start);
const i1 = f.indexOf(end);
if (i0 < 0 || i1 < 0 || i1 < i0) { console.error('Bloc sidebar introuvable'); process.exit(1); }
const oldBlock = f.slice(i0, i1 + end.length);

/* Style calque sur le module Paye : fond blanc, item actif orange (liseré 3px + halo dégradé) */
const newBlock = [
  '#sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar-w);background:#ffffff;color:#1e293b;border-right:1px solid #e2e8f0;display:flex;flex-direction:column;z-index:100;overflow:hidden;transition:width .25s ease}',
  '.sidebar-brand{padding:20px 24px;font-size:17px;font-weight:700;color:#f97316;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;white-space:nowrap;overflow:hidden}',
  '.sidebar-brand svg{flex-shrink:0}',
  '.sidebar-toggle{background:none;border:none;color:#94a3b8;cursor:pointer;padding:4px;border-radius:4px;margin-left:auto;flex-shrink:0;transition:color .15s}',
  '.sidebar-toggle:hover{color:#f97316}',
  '#sidebarNav{flex:1;overflow-y:auto;padding:8px 0}',
  '.nav-group{margin-bottom:4px}',
  '.nav-group-title{padding:10px 24px 4px;font-size:11px;text-transform:uppercase;color:#94a3b8;letter-spacing:.06em;font-weight:600;white-space:nowrap;overflow:hidden}',
  '.nav-item{display:flex;align-items:center;gap:12px;padding:10px 24px;color:#64748b;cursor:pointer;transition:all .15s;text-decoration:none;font-size:14px;border-left:3px solid transparent;white-space:nowrap;overflow:hidden}',
  '.nav-item:hover{background:rgba(249,115,22,.05);color:#1e293b}',
  '.nav-item.active{background:linear-gradient(to right,rgba(249,115,22,.1),transparent);color:#f97316;border-left-color:#f97316;font-weight:600}',
  '.nav-item svg{width:20px;height:20px;flex-shrink:0}',
  '.nav-badge{margin-left:auto;background:var(--danger);color:#fff;font-size:11px;padding:2px 7px;border-radius:10px;font-weight:600;min-width:20px;text-align:center}',
  '.sidebar-footer{padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;overflow:hidden;white-space:nowrap}',
  '.sidebar-footer .user-info{font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis}',
  '#sidebar.collapsed{width:var(--sidebar-collapsed-w)}',
  '#sidebar.collapsed .sidebar-brand span,#sidebar.collapsed .sidebar-brand .sidebar-toggle{display:none}',
  '#sidebar.collapsed .sidebar-brand{justify-content:center;padding:20px 8px}',
  '#sidebar.collapsed .nav-group-title{display:none}',
  '#sidebar.collapsed .nav-item{justify-content:center;padding:12px 0;gap:0;border-left:none;border-radius:var(--radius);margin:2px 8px}',
  '#sidebar.collapsed .nav-item span,#sidebar.collapsed .nav-item .nav-badge{display:none}',
  '#sidebar.collapsed .nav-item.active{background:linear-gradient(to right,rgba(249,115,22,.1),transparent)}',
  '#sidebar.collapsed .nav-item:hover{background:rgba(249,115,22,.05)}'
].join('\r\n');

f = f.slice(0, i0) + newBlock + f.slice(i1 + end.length);
fs.writeFileSync('public/index.html', f);
console.log('Sidebar blanc/orange OK');
