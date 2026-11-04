/* Service worker minimal : notifications (logo Montabbord) et clic.
   Aucune mise en cache : l'application reste servie par le reseau. */
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('notificationclick', function (e) {
  try {
    e.notification.close();
    e.waitUntil((async function () {
      var all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.url && c.url.indexOf(self.location.origin) === 0) {
          try { await c.focus(); return; } catch (err) {}
        }
      }
      try { await clients.openWindow('/'); } catch (err2) {}
    })());
  } catch (err) {}
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { try { d = { body: e.data.text() }; } catch (err2) {} }
  var titre = d.title || 'Montabbord';
  var opts = {
    body: d.body || '',
    icon: '/notif-icon-192.png',
    badge: '/notif-badge.png',
    image: '/notif-icon.png',
    tag: d.tag || 'montabbord',
    renotify: true,
    data: d.data || {}
  };
  e.waitUntil(self.registration.showNotification(titre, opts));
});
