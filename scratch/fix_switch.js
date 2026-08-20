const fs = require('fs');
let html = fs.readFileSync('public/paye.html', 'utf8');

// Replace the broken switchCatTab section
const searchStr = `function switchCatTab(tab) {
  var primeTabBtn = document.getElementById('cat-tab-primes');
  if (primeTabBtn) primeTabBtn.classList.toggle('active', tab === 'primes');
  var primeTabDiv = document.getElementById('tab-primes');
  if (primeTabDiv) { primeTabDiv.style.display = tab === 'primes' ? '' : 'none'; if (tab === 'primes') loadPrimesSpec(); }
  if (tab === 'primes') {
    document.querySelectorAll('#categories .tab-pills button').forEach(function(b){ if (!b.id || b.id !== 'cat-tab-primes') b.classList.remove('active'); });
    return;
  }
  _switchCatTab_orig(tab);
}
  if (tab === 'montage') loadArticlesMontage();
}
}
function loadCategories() {`;

const cleanStr = `function switchCatTab(tab) {
  var primeTabBtn = document.getElementById('cat-tab-primes');
  if (primeTabBtn) primeTabBtn.classList.toggle('active', tab === 'primes');
  var primeTabDiv = document.getElementById('tab-primes');
  if (primeTabDiv) { primeTabDiv.style.display = tab === 'primes' ? '' : 'none'; if (tab === 'primes') loadPrimesSpec(); }
  if (tab === 'primes') {
    document.querySelectorAll('#categories .tab-pills button').forEach(function(b){ if (!b.id || b.id !== 'cat-tab-primes') b.classList.remove('active'); });
    return;
  }
  document.querySelectorAll('#categories .tab-pills button').forEach(function(b){ b.classList.remove('active'); });
  document.querySelector('#categories .tab-pills button:nth-child(' + (tab==='grille'?1:tab==='taxes'?2:tab==='org'?3:4) + ')').classList.add('active');
  document.getElementById('tab-grille').style.display = tab==='grille' ? '' : 'none';
  document.getElementById('tab-taxes').style.display = tab==='taxes' ? '' : 'none';
  document.getElementById('tab-org').style.display = tab==='org' ? '' : 'none';
  document.getElementById('tab-montage').style.display = tab==='montage' ? '' : 'none';
  if (tab === 'grille') loadCategories();
  if (tab === 'taxes') loadItsScale();
  if (tab === 'org') loadOrg();
  if (tab === 'montage') loadArticlesMontage();
}
function loadCategories() {`;

if (html.indexOf(searchStr) !== -1) {
  html = html.replace(searchStr, cleanStr);
} else {
  // Regex fallback
  html = html.replace(
    /function switchCatTab\(tab\) \{[\s\S]*?function loadCategories\(\) \{/,
    cleanStr
  );
}

fs.writeFileSync('public/paye.html', html, 'utf8');
console.log('Fixed switchCatTab cleanly!');
