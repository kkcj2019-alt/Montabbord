Promise.all([
  fetch('https://montabbord.web.app/').then(r => r.text()),
  fetch('https://montabbord.web.app/paye.html').then(r => r.text())
]).then(([idx, paye]) => {
  console.log('index : splash Bienvenue      =', idx.includes('Bienvenue sur le tableau de bord') ? 'OK' : 'ABSENT');
  console.log('index : nom utilisateur anime =', idx.includes('userHtml') ? 'OK' : 'ABSENT');
  console.log('index : police Cinzel         =', idx.includes('Cinzel') ? 'OK' : 'ABSENT');
  console.log('index : iframe v=0823         =', idx.includes('paye.html?v=0823') ? 'OK' : 'ABSENT');
  console.log('paye  : grille persistee auto =', paye.includes('persistee automatiquement la premiere fois') ? 'OK' : 'ABSENT');
  console.log('paye  : bande secours Autre   =', paye.includes("groups['Autre']") ? 'OK' : 'ABSENT');
}).catch(e => console.error('ERREUR:', e.message));
