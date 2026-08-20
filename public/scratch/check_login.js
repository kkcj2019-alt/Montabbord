var fs = require('fs');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
while ((m = re.exec(c)) !== null) {
  idx++;
  var js = m[1];
  if (js.trim().length < 50) continue;
  // Try module syntax
  try {
    require('vm').compileFunction(js);
    console.log('Script#' + idx + ': OK (' + js.length + ' chars)');
  } catch(e) {
    console.log('Script#' + idx + ' ERROR: ' + e.message.substring(0, 300));
    // Find the line number in the script
    var lineMatch = e.message.match(/:(\d+):/);
    if (lineMatch) {
      var lineNum = parseInt(lineMatch[1]);
      var lines = js.split('\n');
      var start = Math.max(0, lineNum - 5);
      var end = Math.min(lines.length, lineNum + 5);
      console.log('\n--- Context around error (lines ' + (start+1) + '-' + (end+1) + ') ---');
      for (var i = start; i < end; i++) {
        console.log((i+1) + (i === lineNum - 1 ? ' >>> ' : '     ') + lines[i]);
      }
    }
  }
}
