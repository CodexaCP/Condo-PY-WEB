import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { UnitOwnerAssignment, CreateUnitOwnerRequest } from './models';

@Injectable({ providedIn: 'root' })
export class UnitOwnersApiService {
  private readonly http = inject(HttpClient);

  getAll(buildingId?: string): Observable<UnitOwnerAssignment[]> {
    const params = buildingId ? new HttpParams().set('buildingId', buildingId) : undefined;
    return this.http.get<UnitOwnerAssignment[]>(`${API_BASE_URL}/unit-owners`, { params });
  }

  create(request: CreateUnitOwnerRequest): Observable<UnitOwnerAssignment> {
    return this.http.post<UnitOwnerAssignment>(`${API_BASE_URL}/unit-owners`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/unit-owners/${id}`);
  }
}
