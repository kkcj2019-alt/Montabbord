/* =====================================================================
   Impression SANS BLOCAGE de l'application.
   Avant : chaque impression ouvrait une fenetre vide (window.open('')) puis
   appelait print() dedans. Cette fenetre partage le meme fil d'execution
   que l'application : tant que la boite d'impression etait ouverte, TOUTE
   l'application (et les autres modules) etait figee.
   Maintenant : le document a imprimer est capture, puis ouvert dans un
   onglet INDEPENDANT (noopener, son propre processus). L'impression se
   lance dans cet onglet ; l'application reste utilisable.
   Les fenetres nommees (montabbord_main...) et les vraies adresses ne
   sont pas touchees.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__mdbImpressionSansBlocage) return;
  window.__mdbImpressionSansBlocage = true;
  var origOpen = window.open;
  if (typeof origOpen !== 'function') return;

  function ouvrirIndependant(html, imprimer, titre) {
    try {
      var h = String(html || '');
      if (titre && !/<title>/i.test(h)) {
        h = h.replace(/<head[^>]*>/i, function (m) { return m + '<title>' + String(titre).replace(/</g, '&lt;') + '</title>'; });
      }
      if (imprimer && !/\.print\s*\(/.test(h)) {
        var auto = '<script>window.addEventListener("load",function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},350);});<\/script>';
        if (/<\/body>/i.test(h)) h = h.replace(/<\/body>/i, auto + '</body>'); else h += auto;
      }
      if (!/<meta[^>]+charset/i.test(h)) h = '<meta charset="utf-8">' + h;
      var url = URL.createObjectURL(new Blob([h], { type: 'text/html;charset=utf-8' }));
      var w = origOpen.call(window, url, '_blank', 'noopener');
      /* noopener renvoie toujours null : impossible de savoir si le
         navigateur a bloque. On garde l'URL 2 minutes puis on libere. */
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 120000);
      return w;
    } catch (e) {
      return null;
    }
  }

  function fenetreCapture() {
    var buf = '', ferme = false, veutImprimer = false, envoye = false, minuterie = null;
    var proxy;
    function envoyer() {
      if (envoye) return;
      envoye = true;
      if (minuterie) { clearTimeout(minuterie); minuterie = null; }
      if (typeof proxy.onload === 'function') veutImprimer = true;
      ouvrirIndependant(buf, veutImprimer, proxy.document.title);
      proxy.closed = true;
    }
    function planifier(ms) {
      if (envoye) return;
      if (minuterie) clearTimeout(minuterie);
      minuterie = setTimeout(envoyer, ms);
    }
    var doc = {
      title: '',
      open: function () { buf = ''; return doc; },
      write: function () { for (var i = 0; i < arguments.length; i++) buf += String(arguments[i]); },
      writeln: function () { for (var i = 0; i < arguments.length; i++) buf += String(arguments[i]); buf += '\n'; },
      close: function () { ferme = true; planifier(700); },
      getElementById: function () { return null; },
      querySelector: function () { return null; },
      createElement: function (t) { try { return document.createElement(t); } catch (e) { return {}; } },
      body: { innerHTML: '', appendChild: function () {}, style: {} },
      head: { appendChild: function () {} }
    };
    proxy = {
      document: doc,
      closed: false,
      opener: null,
      location: { href: 'about:blank' },
      focus: function () {},
      blur: function () {},
      moveTo: function () {}, resizeTo: function () {},
      addEventListener: function (ev, fn) { if (ev === 'load' && typeof fn === 'function') proxy.onload = fn; },
      removeEventListener: function () {},
      onload: null,
      print: function () { veutImprimer = true; if (ferme) envoyer(); else planifier(700); },
      close: function () { if (ferme && !envoye) envoyer(); }
    };
    return proxy;
  }

  window.open = function (url, nom, options) {
    var u = (url === undefined || url === null) ? '' : String(url);
    var n = (nom === undefined || nom === null) ? '_blank' : String(nom);
    if ((u === '' || u === 'about:blank') && (n === '_blank' || n === '')) {
      return fenetreCapture();
    }
    return origOpen.apply(window, arguments);
  };
  window.mdbOuvrirDocumentIndependant = ouvrirIndependant;
})();
