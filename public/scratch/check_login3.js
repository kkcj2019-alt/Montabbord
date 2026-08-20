var fs = require('fs');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
while ((m = re.exec(c)) !== null) {
  idx++;
  var js = m[1];
  if (js.trim().length < 50) continue;
  if (idx === 6) {
    // Binary search for the syntax error location
    // Split script into chunks and test each
    var lines = js.split('\n');
    console.log('Script#6: ' + lines.length + ' lines, ' + js.length + ' chars');
    
    // Try each half
    var half = Math.floor(lines.length / 2);
    try { new Function(lines.slice(0, half).join('\n')); console.log('  First half: OK'); } catch(e) { console.log('  First half: ERROR ' + e.message); }
    try { new Function(lines.slice(half).join('\n')); console.log('  Second half: OK'); } catch(e) { console.log('  Second half: ERROR ' + e.message); }
    
    // Try quartering
    for (var q = 0; q < 4; q++) {
      var start = Math.floor(q * lines.length / 4);
      var end = Math.floor((q+1) * lines.length / 4);
      try { new Function(lines.slice(start, end).join('\n')); } catch(e) { console.log('  Quarter ' + q + ' (lines ' + (start+1) + '-' + end + '): ERROR ' + e.message); }
    }
    
    // Find standalone ] that's not in a string or comment
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      if (trimmed === ']' || trimmed === '];') {
        console.log('  Found standalone "] " at line ' + (i+1) + ': ' + lines[i]);
      }
    }
  }
}
