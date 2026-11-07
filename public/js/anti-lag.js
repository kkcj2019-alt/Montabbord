/* ============================================================================
   ANTI-LAG.JS — application plus légère sur les petits téléphones.
   Les animations décoratives qui tournent SANS FIN (respiration du logo,
   halo, cloche qui clignote, fond qui bouge…) obligeaient le téléphone à
   redessiner l'écran en permanence : jusqu'à la moitié du processeur, même
   quand on ne touchait à rien. On les laisse jouer quelques secondes, puis
   on les met en pause. Les animations utiles (chargement, rotation) restent.
   ============================================================================ */
(function () {
  'use strict';
  if (window.__mdbAntiLag) return;
  window.__mdbAntiLag = true;
  var GARDER = /spin|load|rotat|tourne|progress|chargement/i;
  var DUREE = 4000;
  function calmer() {
    try {
      if (!document.getAnimations) return;
      var list = document.getAnimations();
      for (var i = 0; i < list.length; i++) {
        var a = list[i];
        try {
          if (a.playState !== 'running') continue;
          var t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
          if (!t || t.iterations !== Infinity) continue;
          if (GARDER.test(a.animationName || '')) continue;
          if ((a.currentTime || 0) < DUREE) continue;
          a.pause();
        } catch (e1) {}
      }
    } catch (e) {}
  }
  setInterval(function () { if (!document.hidden) calmer(); }, 2500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(calmer, 300); });
})();
