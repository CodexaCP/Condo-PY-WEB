import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  AccountingEntries, AccountingRoles, Journal, JournalDifferences, JournalFilters, JournalPreview, PostJournalResult, UpdateAccountingRolesRequest
} from './building-config.models';

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

  // ── Libro Diario (asientos asentados, con número correlativo; api/finance/journal) ──

  private get journalBase(): string { return `${API_BASE_URL}/finance/journal`; }

  getJournal(buildingId: string, filters: JournalFilters = {}): Observable<Journal> {
    let params = new HttpParams().set('buildingId', buildingId);
    if (filters.fiscalYear) params = params.set('fiscalYear', filters.fiscalYear);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.number) params = params.set('number', filters.number);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<Journal>(this.journalBase, { params });
  }

  // Asientos ya asentados que cambiaron desde entonces (se corrigen con contraasiento al asentar).
  getJournalDifferences(buildingId: string): Observable<JournalDifferences> {
    return this.http.get<JournalDifferences>(`${this.journalBase}/differences`, { params: new HttpParams().set('buildingId', buildingId) });
  }

  // Lo que se asentaría hasta ese día, sin asentar nada.
  previewJournal(buildingId: string, through: string): Observable<JournalPreview> {
    return this.http.get<JournalPreview>(`${this.journalBase}/preview`, { params: new HttpParams().set('buildingId', buildingId).set('through', through) });
  }

  postJournal(buildingId: string, through: string): Observable<PostJournalResult> {
    return this.http.post<PostJournalResult>(`${this.journalBase}/post`, { through }, { params: new HttpParams().set('buildingId', buildingId) });
  }

  // Excel de los asientos (hojas «Asientos» y «Sumas por cuenta»).
  downloadEntries(buildingId: string, from?: string, to?: string): Observable<Blob> {
    return this.http.get(`${this.base}/entries/export`, { params: this.params(buildingId, from, to), responseType: 'blob' });
  }
}
