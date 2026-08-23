/* AUTO-DEPLOY MONTABBORD
   Surveille les modifications de fichiers du projet :
   ~90 secondes apres la derniere sauvegarde ->
   1) commit + push GitHub   2) mise en ligne Firebase Hosting
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
var IGNORE = ['node_modules', '.git', '.firebase', 'supabase-migration', 'firestore-export-fresh.json'];
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

function run() {
  if (deploying) { schedule(); return; }
  var status = '';
  try { status = sh('git status --porcelain'); } catch (e) { log('ERREUR git status: ' + e.message); schedule(); return; }
  if (!status) { log('Rien a sauvegarder.'); schedule(); return; }
  deploying = true;
  log('Changements detectes, deploiement en cours...');
  try {
    sh('git add -A');
    sh('git commit -m "auto: ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + '" --quiet');
    log('Commit OK');
    try {
      sh('git pull --rebase --autostash --quiet');
      log('Pull rebase OK');
    } catch (e) { log('Pull ignore: ' + e.message.split('\n')[0]); }
    sh('git push --quiet');
    log('Push GitHub OK');
    var out = sh('"node_modules\\.bin\\firebase.cmd" deploy --only hosting');
    var m = out.match(/Hosting URL:\s*(\S+)/);
    log('Mise en ligne OK' + (m ? ' -> ' + m[1] : ''));
  } catch (e) {
    log('ERREUR deploiement: ' + String(e.message).split('\n').slice(0, 4).join(' | '));
  }
  deploying = false;
  lastDeployEnd = Date.now();
  schedule();
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

/* Mini heartbeat HTTP pour verifier que le service tourne */
http.createServer(function(req, res) { res.writeHead(200); res.end('auto-deploy actif'); }).listen(8790);
