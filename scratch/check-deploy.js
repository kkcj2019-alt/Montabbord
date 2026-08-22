const https = require('https');
https.get('https://montabbord.web.app/index.html', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('statut:', res.statusCode, '| taille:', d.length);
    console.log('_sysBucketD present:', d.includes('_sysBucketD'));
    console.log('ancien _sysNamesD present:', d.includes('_sysNamesD'));
    console.log('(solde externe) suffixe present:', d.includes("' (solde externe)'"));
    console.log('Solde initial (il me doit) present:', d.includes('Solde initial (il me doit)'));
  });
}).on('error', e => console.error('ERREUR:', e.message));
