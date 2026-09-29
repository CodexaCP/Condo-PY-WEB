import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AppNotification, UnreadCountDto } from './models';

export interface NotificationRoute {
  path: string[];
}

// Misma logica que NotificacionesPageComponent.handleClick(), compartida para poder navegar
// tambien al tocar el toast de una push notification recibida en foreground (PushService).
export function resolveNotificationRoute(n: { entityType?: string | null; entityId?: string | null }): NotificationRoute | null {
  if (n.entityType === 'OwnerPayment' && n.entityId) {
    return { path: ['/owner-payments', n.entityId] };
  }
  return null;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  // PushService.onMessage() emite aca cuando llega un push en foreground, para que el badge
  // del topbar se refresque al instante en vez de esperar el proximo tick del polling de 30s.
  readonly refreshRequested$ = new Subject<void>();

  getAll(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${API_BASE_URL}/notifications`);
  }

  getUnreadCount(): Observable<UnreadCountDto> {
    return this.http.get<UnreadCountDto>(`${API_BASE_URL}/notifications/unread-count`);
  }

  markRead(id: string): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/notifications/${id}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/notifications/read-all`, {});
  }

  registerDeviceToken(token: string, platform = 'web'): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/devices/register`, { token, platform });
  }

  unregisterDeviceToken(token: string): Observable<void> {
    return this.http.post<void>(`${API_BASE_URL}/devices/unregister`, { token });
  }
}
