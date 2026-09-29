// Service Worker de Firebase Cloud Messaging — necesario para recibir push con la pestaña
// cerrada o en background. Se sirve desde la raíz del sitio (requisito de Firebase Messaging).
//
// IMPORTANTE: estos valores deben coincidir EXACTO con src/app/core/firebase.config.ts
// (no se pueden compartir automáticamente porque este archivo es un asset estático, no pasa
// por el build de Angular/TypeScript).
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
