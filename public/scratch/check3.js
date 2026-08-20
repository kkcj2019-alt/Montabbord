var fs = require('fs');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
var scriptStarts = [];
while ((m = re.exec(c)) !== null) {
  idx++;
  if (idx === 6) {
    var js = m[1];
    var startOffset = m.index;
    var beforeScript = c.substring(0, startOffset);
    var startLine = beforeScript.split('\n').length;
    console.log('Script #6 starts at HTML line: ' + startLine);
    console.log('Script #6 length: ' + js.length);
    
    // Try to find the error location
    try {
      new Function(js);
    } catch(e) {
      console.log('Error: ' + e.message);
      // Try to find the ] token
      var lines = js.split('\n');
      // Find unbalanced brackets
      var depth = 0;
      for (var i = 0; i < lines.length; i++) {
        for (var j = 0; j < lines[i].length; j++) {
          var ch = lines[i][j];
          if (ch === '[') depth++;
          if (ch === ']') {
            depth--;
            if (depth < 0) {
              console.log('Extra ] at script line ' + (i+1) + ': ' + lines[i].substring(0, 150));
              console.log('Context:');
              for (var k = Math.max(0, i-3); k <= Math.min(lines.length-1, i+3); k++) {
                console.log('  ' + (k+1) + ': ' + lines[k].substring(0, 150));
              }
              process.exit();
            }
          }
        }
      }
    }
    break;
  }
}
