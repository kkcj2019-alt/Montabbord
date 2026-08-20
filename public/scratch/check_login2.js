var fs = require('fs');
var vm = require('vm');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
while ((m = re.exec(c)) !== null) {
  idx++;
  var js = m[1];
  if (js.trim().length < 50) continue;
  try {
    vm.compileFunction(js);
    console.log('Script#' + idx + ': OK (' + js.length + ' chars)');
  } catch(e) {
    console.log('Script#' + idx + ' ERROR at position ' + (e.stack.match(/<anonymous>:(\d+):(\d+)/)?.[0] || 'unknown'));
    console.log('  Message: ' + e.message.substring(0, 300));
    // Try to find position in the original script
    var pos = parseInt((e.stack.match(/<anonymous>:(\d+):(\d+)/) || [])[1]);
    if (pos) {
      var before = js.substring(0, pos);
      var after = js.substring(pos, pos + 50);
      var lineNum = before.split('\n').length;
      console.log('  Approx line in script: ' + lineNum);
      console.log('  Context: ...' + js.substring(Math.max(0, pos - 100), pos) + '>>>' + js.substring(pos, pos + 50) + '...');
    }
  }
}
