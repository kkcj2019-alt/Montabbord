var fs = require('fs');
var c = fs.readFileSync('public/index.html', 'utf8');
var re = /<script[^>]*>([\s\S]*?)<\/script>/g;
var m;
var idx = 0;
while ((m = re.exec(c)) !== null) {
  idx++;
  if (idx === 6) {
    var lines = m[1].split('\n');
    // Binary search in first quarter
    var lo = 0, hi = Math.floor(lines.length / 4);
    while (hi - lo > 1) {
      var mid = Math.floor((lo + hi) / 2);
      try { new Function(lines.slice(0, mid + 1).join('\n')); lo = mid; } catch(e) { hi = mid; }
    }
    console.log('Error around script line ' + hi + ': ' + lines[hi].trim());
    console.log('Context:');
    for (var i = Math.max(0, hi-5); i < Math.min(lines.length, hi+5); i++) {
      console.log((i+1) + (i===hi ? ' >>> ' : '     ') + lines[i]);
    }
  }
}
