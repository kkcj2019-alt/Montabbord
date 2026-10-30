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

  /* Outils ajoutés à chaque document : vrai fichier PDF (html2canvas + jsPDF)
     et, sur iPhone / iPad, « Imprimer » produit ce PDF (la commande
     d'impression du navigateur ne répond pas dans l'aperçu ouvert depuis
     l'appli). Le PDF s'ouvre alors dans la visionneuse : Partager > Imprimer. */
  function outilsDocument() {
    var origine = '';
    try { origine = location.origin || ''; } catch (e) {}
    return '<script>(function(){' +
      'var O=' + JSON.stringify(origine) + ';' +
      'var iOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);' +
      'function charger(src){return new Promise(function(ok,ko){if(src.indexOf("html2canvas")>=0&&window.html2canvas)return ok();if(src.indexOf("jspdf")>=0&&window.jspdf)return ok();var s=document.createElement("script");s.src=O+src;s.onload=ok;s.onerror=ko;document.head.appendChild(s);});}' +
      'function msg(t){var m=document.getElementById("mdbPdfMsg");if(!m){m=document.createElement("div");m.id="mdbPdfMsg";m.setAttribute("data-mdb-outil","1");m.style.cssText="position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;background:#0f172a;color:#fff;padding:10px 16px;border-radius:999px;font:600 13px Arial,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.25)";document.body.appendChild(m);}m.textContent=t;m.style.display=t?"block":"none";}' +
      'var enCours=false;' +
      'window.__mdbPdf=function(){if(enCours)return;enCours=true;msg("Préparation du PDF…");' +
        'var cach=[].slice.call(document.querySelectorAll(".dp-toolbar,#mdbBackBtn,.no-print,[data-mdb-outil]"));var av=cach.map(function(e){return e.style.display;});' +
        'Promise.resolve().then(function(){return charger("/vendor/html2canvas.min.js");}).then(function(){return charger("/vendor/jspdf.umd.min.js");}).then(function(){' +
          'cach.forEach(function(e){e.style.display="none";});' +
          'var cible=document.getElementById("dp-doc")||document.body;' +
          'return window.html2canvas(cible,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:Math.max(cible.scrollWidth,800)});' +
        '}).then(function(cv){' +
          'cach.forEach(function(e,i){e.style.display=av[i];});' +
          'var J=window.jspdf.jsPDF;var pdf=new J({unit:"mm",format:"a4",orientation:(cv.width>cv.height*1.1?"landscape":"portrait")});' +
          'var pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();var ih=cv.height*pw/cv.width;var img=cv.toDataURL("image/jpeg",0.92);' +
          'var y=0;pdf.addImage(img,"JPEG",0,0,pw,ih);var reste=ih-ph;while(reste>1){y-=ph;pdf.addPage();pdf.addImage(img,"JPEG",0,y,pw,ih);reste-=ph;}' +
          'var nom=(document.title||"document").replace(/[^\\w\\-]+/g,"_").replace(/_+/g,"_")+".pdf";' +
          'msg("");enCours=false;' +
          'if(iOS){var u=URL.createObjectURL(pdf.output("blob"));location.href=u;}else{pdf.save(nom);}' +
        '}).catch(function(e){cach.forEach(function(el,i){el.style.display=av[i];});enCours=false;msg("PDF impossible : "+(e&&e.message?e.message:e));setTimeout(function(){msg("");},4000);});' +
      '};' +
      'if(iOS){window.print=function(){window.__mdbPdf();};}' +
      '})();<\/script>';
  }

  function ouvrirIndependant(html, imprimer, titre) {
    try {
      var h = String(html || '');
      if (/<\/body>/i.test(h)) h = h.replace(/<\/body>/i, outilsDocument() + '</body>'); else h += outilsDocument();
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
