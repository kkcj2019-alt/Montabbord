var fs = require('fs');
var d = JSON.parse(fs.readFileSync('D:/mon-tableau-de-bord/firestore_backup.json', 'utf8'));
var uid = d.mdb_enterpriseUid;
var keys = Object.keys(d).filter(function(k) { return k.indexOf('mdb_') === 0; });
var kstr = JSON.stringify(keys);

var script = '(async function(){try{' +
  'var r=await fetch("https://firestore.googleapis.com/v1/projects/montabbord/databases/(default)/documents/enterprises/' + uid + '?key=AIzaSyBayjllPQ199Ve_hiERosXY5qxgCewVCMg");' +
  'var d=await r.json();' +
  'function cv(v){if(!v)return null;if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return parseInt(v.integerValue);if(v.doubleValue!==undefined)return parseFloat(v.doubleValue);if(v.booleanValue!==undefined)return v.booleanValue;if(v.arrayValue)return(v.arrayValue.values||[]).map(cv);if(v.mapValue){var o={};for(var k of Object.keys(v.mapValue.fields||{}))o[k]=cv(v.mapValue.fields[k]);return o}return null}' +
  'var keys=' + kstr + ';' +
  'for(var k of keys){var val=cv(d.fields[k]);if(val!==null&&val!==undefined){localStorage.setItem(k,JSON.stringify(val));console.log("Restored",k,Array.isArray(val)?"("+val.length+" items)":"")}}' +
  'console.log("Restauration terminee! Rechargez la page (F5).")' +
  '}catch(e){console.error("Erreur:",e)}})();';

fs.writeFileSync('D:/mon-tableau-de-bord/restore_script.txt', script, 'utf8');
console.log('Script written: ' + script.length + ' chars');
