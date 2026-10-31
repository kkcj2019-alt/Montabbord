/* AUTO-DEPLOY MONTABBORD
   Surveille les modifications de fichiers du projet :
   ~90 secondes apres la derniere sauvegarde ->
   1) commit + push GitHub   2) tests de securite  3) mise en ligne Cloudflare Pages
   Journal : auto-deploy.log */
var http = require('http');
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = __dirname;
var LOG = path.join(ROOT, 'auto-deploy.log');

/* Git et Node doivent etre accessibles ; sinon on ajoute les chemins standards d'installation */
try { cp.execSync('git --version', { stdio: 'pipe', windowsHide: true }); }
catch (e) {
  var GITCMD = 'C:\\Program Files\\Git\\cmd';
  if (fs.existsSync(path.join(GITCMD, 'git.exe'))) process.env.PATH = GITCMD + ';' + process.env.PATH;
}
try { cp.execSync('node --version', { stdio: 'pipe', windowsHide: true }); }
catch (e2) {
  var NODEJS = 'C:\\Program Files\\nodejs';
  if (fs.existsSync(path.join(NODEJS, 'node.exe'))) process.env.PATH = NODEJS + ';' + process.env.PATH;
}
var DEBOUNCE_MS = 90 * 1000;
var IGNORE = ['node_modules', '.git', '.firebase', 'supabase-migration', 'firestore-export-fresh.json', 'backups'];
var timer = null;
var deploying = false;
var lastDeployEnd = Date.now();

function log(msg) {
  var line = '[' + new Date().toLocaleString('fr-FR') + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (e) {}
}

function sh(cmd, opts) {
  return cp.execSync(cmd, Object.assign({ cwd: ROOT, stdio: 'pipe', windowsHide: true }, opts || {})).toString().trim();
}

function watched(p) {
  var rel = path.relative(ROOT, p);
  if (!rel || rel === '') return false;
  for (var i = 0; i < IGNORE.length; i++) {
    if (rel.indexOf(IGNORE[i]) === 0 || rel.indexOf(path.sep + IGNORE[i]) !== -1 || rel === IGNORE[i]) return false;
  }
  return true;
}

/* Miroir Git : recupere la derniere sauvegarde cloud (Supabase) dans backups/latest.json */
var SB_URL = 'pywacfwhwsvidkhqsjqv.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5d2FjZndod3N2aWRraHFzanF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMDMyMTksImV4cCI6MjEwMjg3OTIxOX0.wmt5vKo189wxQ9loIYprj8PE-Xd3y0Xs_-n61UJjbls';
function fetchLatestBackupToRepo(done) {
  try {
    var https = require('https');
    var opts = { hostname: SB_URL, path: '/rest/v1/backups?select=ts,data&order=ts.desc&limit=1', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, timeout: 15000 };
    var req = https.get(opts, function(res) {
      var buf = '';
      res.on('data', function(ch) { buf += ch; });
      res.on('end', function() {
        try {
          var rows = JSON.parse(buf);
          if (Array.isArray(rows) && rows.length && rows[0].data) {
            var dir = path.join(ROOT, 'backups');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
            var f = path.join(dir, 'latest.json');
            var out = JSON.stringify({ ts: rows[0].ts, savedAt: new Date().toISOString(), data: rows[0].data });
            if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) { fs.writeFileSync(f, out); console.log('[backup] latest.json mis a jour'); }
          }
        } catch (eP) {}
        done();
      });
    });
    req.on('error', function() { done(); });
    req.setTimeout(16000, function() { req.destroy(); done(); });
  } catch (eFB) { done(); }
}

function run() {
  if (deploying) { schedule(); return; }
  deploying = true;
  fetchLatestBackupToRepo(function() {
    deploying = false;
    runInner();
  });
}
function runInner() {
  if (deploying) { schedule(); return; }
  var status = '';
  try { status = sh('git status --porcelain'); } catch (e) { log('ERREUR git status: ' + e.message); schedule(); return; }
  if (!status) {
    /* Une mise en ligne a echoue (reseau) : on la retente, meme sans nouveau changement. */
    if (deployEnAttente) { deploying = true; deployerCloudflare(); deploying = false; lastDeployEnd = Date.now(); schedule(); return; }
    log('Rien a sauvegarder.'); schedule(); return;
  }
  deploying = true;
  log('Changements detectes, deploiement en cours...');
  try {
    /* Garde-fou : un fichier de sauvegarde dans public/ serait publie sur Internet. */
    var _bak = [];
    try { _bak = fs.readdirSync(path.join(ROOT, 'public')).filter(function(f) { return /\.(bak|orig|old)(_|\.|$)/i.test(f); }); } catch (eB) {}
    if (_bak.length) { log('ARRET : fichier(s) de sauvegarde dans public/ : ' + _bak.join(', ') + ' -> deplacez-les hors de public/'); deploying = false; schedule(); return; }
    /* Garde-fou : on ne publie rien si les tests echouent. */
    try { sh('node tests/run.js', { timeout: 280000, maxBuffer: 50 * 1024 * 1024 }); log('Tests OK'); }
    catch (eT) { log('ARRET : tests en echec, rien n\'est publie. Lancez "npm test" pour le detail.'); deploying = false; lastDeployEnd = Date.now(); schedule(); return; }
    sh('git add -A');
    sh('git commit -m "auto: ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + '" --quiet');
    log('Commit OK');
    try {
      sh('git pull --rebase --autostash --quiet');
      log('Pull rebase OK');
    } catch (e) { log('Pull ignore: ' + e.message.split('\n')[0]); }
    sh('git push --quiet');
    log('Push GitHub OK');
    deployerCloudflare();
  } catch (e) {
    log('ERREUR deploiement: ' + String(e.message).split('\n').slice(0, 4).join(' | '));
  }
  deploying = false;
  lastDeployEnd = Date.now();
  schedule();
}

/* Mise en ligne Cloudflare avec 3 essais : une coupure reseau pendant l'envoi
   ne doit plus laisser l'ancienne version en ligne sans qu'on le sache. */
var deployEnAttente = false;
/* GARDE DE VERSION : on ne met JAMAIS en ligne une version plus ancienne que
   celle deja en ligne (cas du 31/10 : une ancienne copie du projet a ecrase le
   site avec une version cassee). Comparaison des numeros __APP_VERSION. */
function _versionDe(txt) { var m = String(txt || '').match(/__APP_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2}-\d+)'/); return m ? m[1] : ''; }
function _plusAncienne(a, b) {
  var A = String(a).split('-').map(Number), B = String(b).split('-').map(Number);
  if (A.length !== 4 || B.length !== 4) return false;
  for (var i = 0; i < 4; i++) { if (A[i] !== B[i]) return A[i] < B[i]; }
  return false;
}
function versionLocaleOk() {
  var fichiers = ['index.html', 'paye.html'];
  for (var i = 0; i < fichiers.length; i++) {
    var f = fichiers[i], loc = '', enLigne = '';
    try { loc = _versionDe(fs.readFileSync(path.join(ROOT, 'public', f), 'utf8')); } catch (e) {}
    try { enLigne = _versionDe(cp.execSync('curl -s -m 20 "https://montabbord.pages.dev/' + f + '?x=' + Date.now() + '"', { stdio: 'pipe', windowsHide: true, maxBuffer: 50 * 1024 * 1024 }).toString()); } catch (e2) {}
    if (loc && enLigne && _plusAncienne(loc, enLigne)) {
      log('ARRET : ' + f + ' local (' + loc + ') est PLUS ANCIEN que la version en ligne (' + enLigne + '). Rien n\'est publie. Mettez ce dossier a jour (git pull) avant.');
      return false;
    }
  }
  return true;
}
function deployerCloudflare() {
  if (!versionLocaleOk()) { deployEnAttente = false; return false; }
  for (var essai = 1; essai <= 3; essai++) {
    try {
      var out = sh('npx.cmd --yes wrangler@4 pages deploy public --project-name montabbord --branch main --commit-dirty=true', { timeout: 600000, maxBuffer: 50 * 1024 * 1024 });
      var m = out.match(/https:\/\/[^\s]+\.pages\.dev/);
      log('Mise en ligne Cloudflare OK' + (m ? ' -> ' + m[0] : '') + (essai > 1 ? ' (essai ' + essai + ')' : ''));
      deployEnAttente = false;
      return true;
    } catch (e) {
      log('ERREUR deploiement (essai ' + essai + '/3): ' + String(e.message).split('\n').slice(0, 4).join(' | '));
      if (essai < 3) { var t0 = Date.now(); while (Date.now() - t0 < 20000) {} }
    }
  }
  deployEnAttente = true;
  log('Mise en ligne en attente : nouvel essai automatique dans quelques minutes.');
  return false;
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, DEBOUNCE_MS);
}

fs.watch(ROOT, { recursive: true }, function(ev, filename) {
  if (!filename) return;
  var full = path.join(ROOT, filename);
  if (!watched(full)) return;
  if (filename.indexOf('auto-deploy.log') === 0) return;
  if (Date.now() - lastDeployEnd < 5000 && !timer) return;
  clearTimeout(timer);
  timer = setTimeout(run, DEBOUNCE_MS);
});

log('=== Auto-deploy demarre (delai ' + (DEBOUNCE_MS / 1000) + 's apres derniere modification) ===');
schedule();
/* Miroir periodique des sauvegardes cloud vers Git (toutes les 11 min) */
setInterval(run, 11 * 60 * 1000);

/* Mini heartbeat HTTP pour verifier que le service tourne */
http.createServer(function(req, res) { res.writeHead(200); res.end('auto-deploy actif'); }).listen(8790);
