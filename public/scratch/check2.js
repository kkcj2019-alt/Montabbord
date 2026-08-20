var fs = require('fs');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
while ((m = re.exec(c)) !== null) {
  idx++;
  var js = m[1];
  if (js.trim().length < 50) continue;
  try {
    new Function(js);
  } catch(e) {
    console.log('Script#' + idx + ' ERROR: ' + e.message.substring(0, 200));
  }
}
console.log('Checked ' + idx + ' scripts');
