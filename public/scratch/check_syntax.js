var fs = require('fs');
var c = fs.readFileSync('C:\\Users\\CHRISTIAN\\Desktop\\ok\\public\\index.html', 'utf8');
var re = /<script>([\s\S]*?)<\/script>/g;
var match;
var idx = 0;
while ((match = re.exec(c)) !== null) {
  idx++;
  var js = match[1];
  if (js.trim().length < 100) continue;
  try {
    new Function(js);
  } catch(e) {
    console.log('Script #' + idx + ' (len=' + js.length + ') ERROR: ' + e.message);
    // Find approximate line
    var lines = js.split('\n');
    var m2 = e.message.match(/position (\d+)/);
    if (m2) {
      var pos = parseInt(m2[1]);
      var cnt = 0;
      for (var li = 0; li < lines.length; li++) {
        cnt += lines[li].length + 1;
        if (cnt >= pos) { console.log('  Near line ' + (li+1) + ': ' + lines[li].substring(0, 120)); break; }
      }
    } else {
      // try to find the token
      var token = e.message.replace(/.*Unexpected token /, '').replace(/['"]/g, '');
      for (var li2 = 0; li2 < lines.length; li2++) {
        if (lines[li2].indexOf(token) !== -1 && li2 > 10) {
          console.log('  Line ~' + (li2+1) + ': ' + lines[li2].substring(0, 120));
        }
      }
    }
  }
}
console.log('Done. Checked ' + idx + ' scripts.');
