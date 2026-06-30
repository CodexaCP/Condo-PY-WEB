import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AppNotification, UnreadCountDto } from './models';

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
}
