import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig, firebaseVapidKey } from './firebase.config';
import { NotificationAlertService } from './notification-alert.service';
import { NotificationsApiService, resolveNotificationRoute } from '../api/notifications-api.service';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly notifSvc = inject(NotificationsApiService);
  private readonly alerts = inject(NotificationAlertService);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  private messaging: Messaging | null = null;
  private initStarted = false;
  private lastToken: string | null = null;
  private clickListenerAdded = false;

  async init(): Promise<void> {
    if (this.initStarted) return;
    this.initStarted = true;

    if (!(await isSupported()) || !('serviceWorker' in navigator)) return;
    if (!this.auth.isAuthenticated()) return;

    // Tocar una notificación del sistema con el panel abierto: el service worker avisa y se navega sin recargar.
    if (!this.clickListenerAdded) {
      this.clickListenerAdded = true;
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const click = event.data?.condopyNotificationClick as { entityType?: string | null; entityId?: string | null } | undefined;
        if (!click) return;
        const route = resolveNotificationRoute(click, this.auth.currentUser()?.role);
        this.zone.run(() => void this.router.navigate(route ? route.path : ['/notificaciones']));
        this.alerts.markEntityRead(click.entityType, click.entityId);
      });
    }

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

      // Push con la pestaña abierta: el navegador no muestra nada por su cuenta. La push solo adelanta la consulta de la
      // bandeja; el toast sale con los datos reales de la notificación (NotificationAlertService).
      onMessage(this.messaging, (payload) => {
        this.zone.run(() => {
          void this.alerts.refresh({
            title: payload.notification?.title ?? '',
            body: payload.notification?.body ?? '',
            data: (payload.data ?? {}) as Record<string, string>
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
