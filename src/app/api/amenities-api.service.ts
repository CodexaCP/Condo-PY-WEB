import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Amenity, AmenityReservation, AmenityReservationComprobanteRequest, AmenityUpsertRequest } from './models';

@Injectable({ providedIn: 'root' })
export class AmenitiesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/amenities`;

  getAll(buildingId?: string): Observable<Amenity[]> {
    const params = buildingId ? { params: { buildingId } } : {};
    return this.http.get<Amenity[]>(this.baseUrl, params);
  }

  create(request: AmenityUpsertRequest): Observable<Amenity> {
    return this.http.post<Amenity>(this.baseUrl, request);
  }

  update(id: string, request: AmenityUpsertRequest): Observable<Amenity> {
    return this.http.put<Amenity>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  getReservations(buildingId?: string, status?: string): Observable<AmenityReservation[]> {
    const params: Record<string, string> = {};
    if (buildingId) params['buildingId'] = buildingId;
    if (status) params['status'] = status;
    return this.http.get<AmenityReservation[]>(`${this.baseUrl}/reservations`, { params });
  }

  submitComprobante(id: string, request: AmenityReservationComprobanteRequest): Observable<AmenityReservation> {
    return this.http.post<AmenityReservation>(`${this.baseUrl}/reservations/${id}/comprobante`, request);
  }

  review(id: string, approve: boolean, rejectionReason?: string): Observable<AmenityReservation> {
    return this.http.post<AmenityReservation>(`${this.baseUrl}/reservations/${id}/review`, { approve, rejectionReason: rejectionReason ?? null });
  }
}
