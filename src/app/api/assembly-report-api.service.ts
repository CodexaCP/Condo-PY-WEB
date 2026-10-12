import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AssemblyReport, AssemblyReportRequest } from './building-config.models';

// Informe para la asamblea de propietarios (api/finance/assembly-report). Se pide por POST porque lleva las notas del administrador.
// Lo generan los cuatro roles administrativos con acceso al edificio.
@Injectable({ providedIn: 'root' })
export class AssemblyReportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/finance/assembly-report`;

  // Los datos del informe (los mismos que van al PDF), para verlos en pantalla antes de descargar.
  preview(request: AssemblyReportRequest): Observable<AssemblyReport> {
    return this.http.post<AssemblyReport>(this.base, request);
  }

  downloadPdf(request: AssemblyReportRequest): Observable<Blob> {
    return this.http.post(`${this.base}/pdf`, request, { responseType: 'blob' });
  }
}
