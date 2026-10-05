import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AdBuilding, AdCampaign, AdCampaignCreateRequest, AdCampaignUpdateRequest } from './models';

// Publicidad: todo es del SuperAdmin. Interruptor por edificio (como Finanzas y Marketplace) y campañas de banners.
@Injectable({ providedIn: 'root' })
export class AdCampaignsApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/ad-campaigns`;

  getBuildings(): Observable<AdBuilding[]> {
    return this.http.get<AdBuilding[]>(`${this.url}/buildings`);
  }

  setBuildingEnabled(buildingId: string, enabled: boolean): Observable<AdBuilding> {
    return this.http.put<AdBuilding>(`${this.url}/buildings/${buildingId}`, { enabled });
  }

  getAll(): Observable<AdCampaign[]> {
    return this.http.get<AdCampaign[]>(this.url);
  }

  create(request: AdCampaignCreateRequest): Observable<AdCampaign> {
    return this.http.post<AdCampaign>(this.url, request);
  }

  // La empresa de la campaña no se cambia al editar: el PUT no recibe companyId.
  update(id: string, request: AdCampaignUpdateRequest): Observable<AdCampaign> {
    return this.http.put<AdCampaign>(`${this.url}/${id}`, request);
  }

  toggle(id: string): Observable<AdCampaign> {
    return this.http.patch<AdCampaign>(`${this.url}/${id}/toggle`, {});
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  uploadImage(file: File): Observable<{ imageUrl: string }> {
    const body = new FormData();
    body.append('file', file);
    return this.http.post<{ imageUrl: string }>(`${this.url}/upload-image`, body);
  }
}
