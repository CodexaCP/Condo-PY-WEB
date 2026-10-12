import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PeopleImportKind, PeopleImportResult } from './models';

// Carga masiva de propietarios y de residentes: dos importaciones independientes con la misma mecánica.
@Injectable({ providedIn: 'root' })
export class PeopleImportApiService {
  private readonly http = inject(HttpClient);

  private path(kind: PeopleImportKind): string {
    return kind === 'owners' ? 'owners' : 'residents';
  }

  // companyId solo lo usa el SuperAdmin (el administrador de empresa importa siempre en su empresa).
  downloadTemplate(kind: PeopleImportKind, companyId?: string): Observable<Blob> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get(`${API_BASE_URL}/${this.path(kind)}/import-template`, { params, responseType: 'blob' });
  }

  // Sin confirm solo valida y devuelve la vista previa; con confirm guarda todo (solo si no hay errores).
  import(kind: PeopleImportKind, file: File, confirm: boolean, companyId?: string): Observable<PeopleImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('confirm', String(confirm));
    if (companyId) body.append('companyId', companyId);
    return this.http.post<PeopleImportResult>(`${API_BASE_URL}/${this.path(kind)}/import`, body);
  }
}
