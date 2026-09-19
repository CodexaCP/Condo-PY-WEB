import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateInvoiceSeriesRequest, InvoiceSeries } from './models';

@Injectable({ providedIn: 'root' })
export class InvoiceSeriesApiService {
  private readonly http = inject(HttpClient);

  getAll(buildingId?: string): Observable<InvoiceSeries[]> {
    let params = new HttpParams();
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<InvoiceSeries[]>(`${API_BASE_URL}/invoice-series`, { params });
  }

  create(request: CreateInvoiceSeriesRequest): Observable<InvoiceSeries> {
    return this.http.post<InvoiceSeries>(`${API_BASE_URL}/invoice-series`, request);
  }

  deactivate(id: string): Observable<void> {
    return this.http.put<void>(`${API_BASE_URL}/invoice-series/${id}/desactivar`, {});
  }
}
