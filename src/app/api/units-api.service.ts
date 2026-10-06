import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateUnitRequest, Unit, UnitImportResult } from './models';

@Injectable({ providedIn: 'root' })
export class UnitsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Unit[]> {
    return this.http.get<Unit[]>(`${API_BASE_URL}/units`);
  }

  getById(id: string): Observable<Unit> {
    return this.http.get<Unit>(`${API_BASE_URL}/units/${id}`);
  }

  create(request: CreateUnitRequest): Observable<Unit> {
    return this.http.post<Unit>(`${API_BASE_URL}/units`, request);
  }

  update(id: string, request: CreateUnitRequest): Observable<Unit> {
    return this.http.put<Unit>(`${API_BASE_URL}/units/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/units/${id}`);
  }

  // Carga masiva desde Excel (solo SuperAdmin): plantilla con una columna por dato de la unidad.
  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/units/import-template`, { responseType: 'blob' });
  }

  // Sin confirm solo valida y devuelve la vista previa; con confirm guarda todo (solo si no hay errores).
  importUnits(file: File, confirm: boolean): Observable<UnitImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('confirm', String(confirm));
    return this.http.post<UnitImportResult>(`${API_BASE_URL}/units/import`, body);
  }
}
