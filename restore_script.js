// ========================================
// SCRIPT DE RESTAURATION DES DONNEES
// ========================================
// 1. Ouvrez https://montabbord.web.app
// 2. Ouvrez les outils developpement (F12)
// 3. Allez dans l'onglet "Console"
// 4. Copiez-collez ce script et appuyez sur Entree
// 5. Attendez le message "Restauration terminee"
// 6. Rechargez la page (F5) et connectez-vous
// ========================================

(async function(){
  try {
    var r = await fetch("https://firestore.googleapis.com/v1/projects/montabbord/databases/(default)/documents/enterprises/1aWBeqTjy3Q1glGMFtxOT1o2vwq2?key=AIzaSyBayjllPQ199Ve_hiERosXY5qxgCewVCMg");
    var d = await r.json();
    
    function cv(v) {
      if (!v) return null;
      if (v.stringValue !== undefined) return v.stringValue;
      if (v.integerValue !== undefined) return parseInt(v.integerValue);
      if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
      if (v.booleanValue !== undefined) return v.booleanValue;
      if (v.arrayValue) return (v.arrayValue.values || []).map(cv);
      if (v.mapValue) {
        var o = {};
        for (var k of Object.keys(v.mapValue.fields || {})) o[k] = cv(v.mapValue.fields[k]);
        return o;
      }
      return null;
    }
    
    var keys = ["mdb_operationsCaisse","mdb_nomenclature","mdb_elementsAchats","mdb_codesCaisse","mdb_clients","mdb_prefinancement","mdb_actif","mdb_creancesDouteuses","mdb_dettesFournisseurs","mdb_typeElementsAchats","mdb_caisses","mdb_stocks","mdb_bc","mdb_banques","mdb_enterpriseUid","mdb_fournisseurs","mdb_users","mdb_bonsCommandeFournisseurs","mdb_previsions","mdb_employes","mdb_entreprise","mdb_comptabilite","mdb_factures","mdb_taches","mdb_reglements","mdb_modelesCaisse","mdb_actif_pin","mdb_bl","mdb_acomptesPrets","mdb_grilleTarifaire","mdb_pinnedClients","mdb_currentPage"];
    
    for (var k of keys) {
      var val = cv(d.fields[k]);
      if (val !== null && val !== undefined) {
        localStorage.setItem(k, JSON.stringify(val));
        console.log("Restore: " + k + (Array.isArray(val) ? " (" + val.length + " elements)" : ""));
      }
    }
    console.log("========================================");
    console.log("RESTAURATION TERMINEE !");
    console.log("Rechargez la page (F5) puis connectez-vous.");
    console.log("========================================");
  } catch(e) {
    console.error("ERREUR:", e);
  }
})();
