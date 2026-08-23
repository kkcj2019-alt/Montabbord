const fs = require('fs');
const f = fs.readFileSync('public/index.html', 'utf8');
function dump(marker, len) {
  const i = f.indexOf(marker);
  console.log('--- ' + marker + ' @' + i + ' ---');
  if (i >= 0) console.log(f.slice(i, i + len));
}
dump('body{', 300);
dump('#header{', 400);
dump('#content{', 300);
dump('.section{', 300);
dump('--gray-50:', 200);
