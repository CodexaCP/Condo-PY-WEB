// Service Worker de Firebase Cloud Messaging — necesario para recibir push con la pestaña
// cerrada o en background. Se sirve desde la raíz del sitio (requisito de Firebase Messaging).
//
// IMPORTANTE: estos valores deben coincidir EXACTO con src/app/core/firebase.config.ts
// (no se pueden compartir automáticamente porque este archivo es un asset estático, no pasa
// por el build de Angular/TypeScript).

// Al tocar la notificación del sistema se abre la pantalla de lo que avisa. Se registra ANTES de cargar Firebase para
// ejecutarse primero: el manejador de Firebase solo sabe abrir un link y abriría la pantalla de inicio.
//
// Con el panel abierto se avisa a la pestaña (la navega Angular, sin recargar y con el rol del usuario); con el panel
// cerrado se abre una pestaña nueva en la ruta de esta tabla. Mantenerla alineada con resolveNotificationRoute()
// de src/app/api/notifications-api.service.ts.
function routeForEntity(entityType, entityId) {
  switch (entityType) {
    case 'OwnerPayment': return entityId ? '/owner-payments/' + entityId : '/owner-payments';
    case 'Claim': return '/claims';
    case 'AmenityReservation': return '/amenities';
    case 'Announcement': return '/comunicados';
    case 'Vote': return '/votaciones';
    case 'Building': return entityId ? '/buildings/' + entityId : '/notificaciones';
    case 'ExpensePeriod': return '/expense-periods';
    case 'BuildingPlan': return '/my-plan';
    case 'MarketplacePayment': return '/marketplace-payments';
    case 'MarketplaceRefund':
    case 'MarketplaceClaim':
    case 'MarketplaceHandoverNote': return '/marketplace-followup';
    default: return '/notificaciones';
  }
}

self.addEventListener('notificationclick', function (event) {
  var fcm = event.notification && event.notification.data && event.notification.data.FCM_MSG;
  if (!fcm || event.action) return;

  var data = fcm.data || {};
  event.stopImmediatePropagation();
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      var open = clients.find(function (c) { return new URL(c.url).origin === self.location.origin; });
      if (open) {
        return open.focus().then(function () {
          open.postMessage({ condopyNotificationClick: { entityType: data.entityType || null, entityId: data.entityId || null } });
        });
      }
      return self.clients.openWindow(routeForEntity(data.entityType, data.entityId));
    })
  );
});

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBJBCFJSACJfUSDLDHRPxLP0oZ_m3S_niw',
  authDomain: 'conddopy.firebaseapp.com',
  projectId: 'conddopy',
  storageBucket: 'conddopy.firebasestorage.app',
  messagingSenderId: '945122513238',
  appId: '1:945122513238:web:d3fcd525dd178b2b0746f7'
});

firebase.messaging();
