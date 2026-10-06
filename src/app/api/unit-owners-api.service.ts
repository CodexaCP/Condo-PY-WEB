import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { UnitOwnerAssignment, UnitOwnerRemoval, UnitOwnerRemovalPreview, CreateUnitOwnerRequest } from './models';

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

  // Qué pasaría al quitar al propietario (deuda pendiente de la unidad y saldo a favor), sin hacerlo.
  removalPreview(id: string): Observable<UnitOwnerRemovalPreview> {
    return this.http.get<UnitOwnerRemovalPreview>(`${API_BASE_URL}/unit-owners/${id}/removal-preview`);
  }

  // El motivo (opcional) queda en el historial de titularidad de la unidad.
  delete(id: string, reason?: string): Observable<UnitOwnerRemoval> {
    const params = reason?.trim() ? new HttpParams().set('reason', reason.trim()) : undefined;
    return this.http.delete<UnitOwnerRemoval>(`${API_BASE_URL}/unit-owners/${id}`, { params });
  }

  // Porcentaje de titularidad de un propietario de la unidad (null = sin informar).
  updateOwnership(id: string, ownershipPercentage: number | null): Observable<UnitOwnerAssignment> {
    return this.http.put<UnitOwnerAssignment>(`${API_BASE_URL}/unit-owners/${id}/ownership`, { ownershipPercentage });
  }
}
