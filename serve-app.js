/* Mini serveur local pour MONTABBORD - double-cliquer serve.cmd pour lancer */
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = 8788;
var ROOT = path.join(__dirname, 'public');
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

http.createServer(function(req, res) {
  var urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.normalize(path.join(ROOT, urlPath));
  if (filePath.indexOf(ROOT) !== 0) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, function(err, data) {
    if (err) { res.writeHead(404); res.end('Fichier introuvable'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, function() {
  console.log('');
  console.log('  ========================================');
  console.log('   MONTABBORD tourne sur :');
  console.log('   http://localhost:' + PORT);
  console.log('  ========================================');
  console.log('');
  console.log('   Laissez cette fenetre ouverte.');
  console.log('   Pour arreter : fermez cette fenetre ou Ctrl+C');
  console.log('');
});
