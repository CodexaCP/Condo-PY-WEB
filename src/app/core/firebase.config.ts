// Valores de Firebase Console → Configuración del proyecto → General → "Tus apps" → app Web (CondoPY Web).
// No son secretos (se exponen igual en cualquier cliente). Son del mismo proyecto Firebase (conddopy)
// que ya usa la app Android, y deben coincidir EXACTO con public/firebase-messaging-sw.js.
export const firebaseConfig = {
  apiKey: 'AIzaSyBJBCFJSACJfUSDLDHRPxLP0oZ_m3S_niw',
  authDomain: 'conddopy.firebaseapp.com',
  projectId: 'conddopy',
  storageBucket: 'conddopy.firebasestorage.app',
  messagingSenderId: '945122513238',
  appId: '1:945122513238:web:d3fcd525dd178b2b0746f7'
};

// Cloud Messaging → "Certificados push web" (Web Push certificates). Clave pública, no es secreta.
export const firebaseVapidKey =
  'BCRxrSGL--Pb-5Q_p7iDqlNm7VD0QyTykTt1kSnX-yKsDB3XS4aeTxtjL1DRtqo1wex7R4N2yfXKGw7pVvMLTpA';
