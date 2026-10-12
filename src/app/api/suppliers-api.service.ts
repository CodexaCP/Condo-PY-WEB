import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Supplier, SupplierFilters, SupplierPage, SupplierUpsertRequest } from './building-config.models';

// Proveedores de la empresa (compartidos entre sus edificios). Un proveedor ajeno responde 404; el SuperAdmin indica la empresa.
@Injectable({ providedIn: 'root' })
export class SuppliersApiService {
  private readonly http = inject(HttpClient);

  getAll(filters: SupplierFilters = {}): Observable<SupplierPage> {
    let params = new HttpParams();
    if (filters.companyId) params = params.set('companyId', filters.companyId);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.isActive !== undefined) params = params.set('isActive', filters.isActive);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<SupplierPage>(`${API_BASE_URL}/suppliers`, { params });
  }

  getById(id: string): Observable<Supplier> {
    return this.http.get<Supplier>(`${API_BASE_URL}/suppliers/${id}`);
  }

  create(request: SupplierUpsertRequest): Observable<Supplier> {
    return this.http.post<Supplier>(`${API_BASE_URL}/suppliers`, request);
  }

  update(id: string, request: SupplierUpsertRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${API_BASE_URL}/suppliers/${id}`, request);
  }
}
