import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AppNotification, UnreadCountDto } from './models';

export interface NotificationRoute {
  path: string[];
}

// Destino de una notificación según la entidad a la que apunta. Lo usan la página de Notificaciones y el aviso en
// pantalla (NotificationAlertService). Los avisos sin pantalla propia devuelven null (el aviso abre la lista).
// Mantener alineado con la tabla de rutas de public/firebase-messaging-sw.js (push con la pestaña cerrada).
export function resolveNotificationRoute(
  n: { entityType?: string | null; entityId?: string | null },
  role?: string | null
): NotificationRoute | null {
  switch (n.entityType) {
    case 'OwnerPayment':
      return n.entityId ? { path: ['/owner-payments', n.entityId] } : { path: ['/owner-payments'] };
    case 'Claim':
      return { path: ['/claims'] };
    case 'AmenityReservation':
      return { path: ['/amenities'] };
    case 'Announcement':
      return { path: ['/comunicados'] };
    case 'Vote':
      return { path: ['/votaciones'] };
    case 'Building':
      return n.entityId ? { path: ['/buildings', n.entityId] } : null;
    case 'ExpensePeriod':
      return { path: ['/expense-periods'] };
    // Aviso de plan: el SuperAdmin administra las asignaciones; el resto ve su propio plan.
    case 'BuildingPlan':
      return { path: [role === 'SuperAdmin' ? '/building-plans' : '/my-plan'] };
    case 'MarketplacePayment':
      return { path: ['/marketplace-payments'] };
    case 'MarketplaceRefund':
    case 'MarketplaceClaim':
    case 'MarketplaceHandoverNote':
      return { path: ['/marketplace-followup'] };
    default:
      return null;
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

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
