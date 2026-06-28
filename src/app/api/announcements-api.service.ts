import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Announcement, AnnouncementUpsertRequest, AnnouncementBroadcastRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AnnouncementsApiService {
  private readonly http = inject(HttpClient);

  getAll(buildingId?: string): Observable<Announcement[]> {
    let params = new HttpParams();
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<Announcement[]>(`${API_BASE_URL}/announcements`, { params });
  }

  getById(id: string): Observable<Announcement> {
    return this.http.get<Announcement>(`${API_BASE_URL}/announcements/${id}`);
  }

  create(request: AnnouncementUpsertRequest): Observable<Announcement> {
    return this.http.post<Announcement>(`${API_BASE_URL}/announcements`, request);
  }

  update(id: string, request: AnnouncementUpsertRequest): Observable<Announcement> {
    return this.http.put<Announcement>(`${API_BASE_URL}/announcements/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/announcements/${id}`);
  }

  broadcast(request: AnnouncementBroadcastRequest): Observable<Announcement[]> {
    return this.http.post<Announcement[]>(`${API_BASE_URL}/announcements/broadcast`, request);
  }
}
