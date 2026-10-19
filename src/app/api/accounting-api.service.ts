import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  AccountingEntries, AccountingRoles, FiscalYearClosing, FiscalYearClosingResult, Journal, JournalDifferences, JournalFilters, JournalImpact,
  JournalLedger, JournalPreview, JournalStatements, JournalTrialBalance, PostJournalResult, UpdateAccountingRolesRequest
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

  // ── Libros oficiales (de lo asentado): Libro Diario imprimible, Libro Mayor y balance de sumas y saldos ──

  private bookParams(buildingId: string, fiscalYear?: number | null, extra: Record<string, string | number | undefined> = {}): HttpParams {
    let params = new HttpParams().set('buildingId', buildingId);
    if (fiscalYear) params = params.set('fiscalYear', fiscalYear);
    for (const [key, value] of Object.entries(extra)) if (value !== undefined && value !== '') params = params.set(key, value);
    return params;
  }

  getLedger(buildingId: string, fiscalYear?: number | null, account?: string): Observable<JournalLedger> {
    return this.http.get<JournalLedger>(`${this.journalBase}/ledger`, { params: this.bookParams(buildingId, fiscalYear, { account }) });
  }

  downloadLedger(buildingId: string, fiscalYear?: number | null): Observable<Blob> {
    return this.http.get(`${this.journalBase}/ledger/export`, { params: this.bookParams(buildingId, fiscalYear), responseType: 'blob' });
  }

  getTrialBalance(buildingId: string, fiscalYear?: number | null): Observable<JournalTrialBalance> {
    return this.http.get<JournalTrialBalance>(`${this.journalBase}/trial-balance`, { params: this.bookParams(buildingId, fiscalYear) });
  }

  downloadTrialBalance(buildingId: string, fiscalYear?: number | null): Observable<Blob> {
    return this.http.get(`${this.journalBase}/trial-balance/export`, { params: this.bookParams(buildingId, fiscalYear), responseType: 'blob' });
  }

  // Balance general (situación patrimonial) a una fecha y estado de resultados del ejercicio.
  getStatements(buildingId: string, fiscalYear?: number | null, asOf?: string): Observable<JournalStatements> {
    return this.http.get<JournalStatements>(`${this.journalBase}/statements`, { params: this.bookParams(buildingId, fiscalYear, { asOf }) });
  }

  downloadStatements(buildingId: string, fiscalYear?: number | null, asOf?: string): Observable<Blob> {
    return this.http.get(`${this.journalBase}/statements/export`, { params: this.bookParams(buildingId, fiscalYear, { asOf }), responseType: 'blob' });
  }

  // ── Cierre del ejercicio ──

  getClosing(buildingId: string, fiscalYear?: number | null): Observable<FiscalYearClosing> {
    return this.http.get<FiscalYearClosing>(`${this.journalBase}/closing`, { params: this.bookParams(buildingId, fiscalYear) });
  }

  closeFiscalYear(buildingId: string, fiscalYear: number): Observable<FiscalYearClosingResult> {
    return this.http.post<FiscalYearClosingResult>(`${this.journalBase}/closing/close`, { fiscalYear }, { params: this.bookParams(buildingId) });
  }

  reopenFiscalYear(buildingId: string, fiscalYear: number, reason: string): Observable<FiscalYearClosingResult> {
    return this.http.post<FiscalYearClosingResult>(`${this.journalBase}/closing/reopen`, { fiscalYear, reason }, { params: this.bookParams(buildingId) });
  }

  // Libro Diario del ejercicio en hojas con folio correlativo (PDF para imprimir y rubricar) o en Excel.
  downloadBook(buildingId: string, format: 'pdf' | 'excel', fiscalYear?: number | null, startFolio?: number | null): Observable<Blob> {
    const path = format === 'pdf' ? 'book/pdf' : 'book/export';
    return this.http.get(`${this.journalBase}/${path}`, {
      params: this.bookParams(buildingId, fiscalYear, { startFolio: startFolio ?? undefined }), responseType: 'blob'
    });
  }

  // Aviso previo a revertir un pago, deshacer la publicación de un período o deshacer el pago de un gasto: cuántos asientos vigentes del Libro
  // diario salen de eso. Nunca falla: sin Finanzas, sin permiso o sin asientos responde «nada asentado».
  getJournalImpact(source: { ownerPaymentId?: string; periodId?: string; expenseId?: string }): Observable<JournalImpact> {
    let params = new HttpParams();
    if (source.ownerPaymentId) params = params.set('ownerPaymentId', source.ownerPaymentId);
    if (source.periodId) params = params.set('periodId', source.periodId);
    if (source.expenseId) params = params.set('expenseId', source.expenseId);
    return this.http.get<JournalImpact>(`${this.journalBase}/impact`, { params });
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
