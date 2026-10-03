import { Injectable, NgZone, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig, firebaseVapidKey } from './firebase.config';
import { NotificationsApiService } from '../api/notifications-api.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly notifSvc = inject(NotificationsApiService);
  private readonly auth = inject(AuthService);
  private readonly messageSvc = inject(MessageService);
  private readonly zone = inject(NgZone);

  private messaging: Messaging | null = null;
  private initStarted = false;
  private lastToken: string | null = null;

  async init(): Promise<void> {
    if (this.initStarted) return;
    this.initStarted = true;

    if (!(await isSupported()) || !('serviceWorker' in navigator)) return;
    if (!this.auth.isAuthenticated()) return;

    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const app = initializeApp(firebaseConfig);
      this.messaging = getMessaging(app);

      const token = await getToken(this.messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration
      });

      if (token) {
        this.lastToken = token;
        this.notifSvc.registerDeviceToken(token).subscribe();
      }

      onMessage(this.messaging, (payload) => {
        this.zone.run(() => {
          this.notifSvc.refreshRequested$.next();
          this.messageSvc.add({
            severity: 'info',
            summary: payload.notification?.title ?? 'Nueva notificación',
            detail: payload.notification?.body ?? '',
            life: 6000
          });
        });
      });
    } catch (error) {
      console.error('Error inicializando push notifications', error);
    }
  }

  unregister(): void {
    if (this.lastToken) {
      this.notifSvc.unregisterDeviceToken(this.lastToken).subscribe();
    }
    // Tras cerrar sesión el próximo login (sin recargar la página) debe volver a registrar el token.
    this.lastToken = null;
    this.initStarted = false;
  }
}
