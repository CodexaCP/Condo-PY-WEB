import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AccountingEntries, AccountingRoles, UpdateAccountingRolesRequest } from './building-config.models';

// Asientos contables sugeridos (partida doble, criterio de caja) y asignación de las cuentas del plan que hacen de contrapartida
// (api/finance/accounting). Son sugeridos: no asientan nada ni cambian saldos. La asignación la editan solo SuperAdmin y Administrador.
@Injectable({ providedIn: 'root' })
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/finance/accounting`;

  private params(buildingId: string, from?: string, to?: string): HttpParams {
    let params = new HttpParams().set('buildingId', buildingId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }

  getRoles(buildingId: string): Observable<AccountingRoles> {
    return this.http.get<AccountingRoles>(`${this.base}/roles`, { params: this.params(buildingId) });
  }

  updateRoles(buildingId: string, request: UpdateAccountingRolesRequest): Observable<AccountingRoles> {
    return this.http.put<AccountingRoles>(`${this.base}/roles`, request, { params: this.params(buildingId) });
  }

  getEntries(buildingId: string, from?: string, to?: string): Observable<AccountingEntries> {
    return this.http.get<AccountingEntries>(`${this.base}/entries`, { params: this.params(buildingId, from, to) });
  }

  // Excel de los asientos (hojas «Asientos» y «Sumas por cuenta»).
  downloadEntries(buildingId: string, from?: string, to?: string): Observable<Blob> {
    return this.http.get(`${this.base}/entries/export`, { params: this.params(buildingId, from, to), responseType: 'blob' });
  }
}
