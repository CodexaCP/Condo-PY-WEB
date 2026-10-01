import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  FinanceAdminBuilding,
  FinanceBalances,
  FinanceBuildingAccess,
  FinanceCashFlow,
  FinanceDashboard,
  FinanceMovementFilters,
  FinanceMovementsPage,
  FinanceSettings,
  FinanceSettingsUpdateRequest,
  FinancialAccount,
  FinancialAccountUpsertRequest,
  LedgerCategory,
  LedgerCategoryUpsertRequest
} from './models';

// Módulo "Finanzas del edificio". Con el módulo apagado (o con un plan que no lo incluye) el backend responde 403 con
// { error: 'finance_module_disabled' | 'finance_plan_not_included', message }.
@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly http = inject(HttpClient);

  private params(buildingId: string): HttpParams {
    return new HttpParams().set('buildingId', buildingId);
  }

  // Edificios del usuario con el módulo disponible.
  getBuildings(): Observable<FinanceBuildingAccess[]> {
    return this.http.get<FinanceBuildingAccess[]>(`${API_BASE_URL}/finance/buildings`);
  }

  // SuperAdmin: todos los edificios con su plan y el interruptor.
  getAdminBuildings(): Observable<FinanceAdminBuilding[]> {
    return this.http.get<FinanceAdminBuilding[]>(`${API_BASE_URL}/finance/admin/buildings`);
  }

  enable(buildingId: string): Observable<FinanceAdminBuilding> {
    return this.http.post<FinanceAdminBuilding>(`${API_BASE_URL}/finance/settings/enable`, {}, { params: this.params(buildingId) });
  }

  disable(buildingId: string): Observable<FinanceAdminBuilding> {
    return this.http.post<FinanceAdminBuilding>(`${API_BASE_URL}/finance/settings/disable`, {}, { params: this.params(buildingId) });
  }

  getSettings(buildingId: string): Observable<FinanceSettings> {
    return this.http.get<FinanceSettings>(`${API_BASE_URL}/finance/settings`, { params: this.params(buildingId) });
  }

  updateSettings(buildingId: string, request: FinanceSettingsUpdateRequest): Observable<FinanceSettings> {
    return this.http.put<FinanceSettings>(`${API_BASE_URL}/finance/settings`, request, { params: this.params(buildingId) });
  }

  completeSetup(buildingId: string): Observable<FinanceSettings> {
    return this.http.post<FinanceSettings>(`${API_BASE_URL}/finance/settings/complete`, {}, { params: this.params(buildingId) });
  }

  getAccounts(buildingId: string): Observable<FinancialAccount[]> {
    return this.http.get<FinancialAccount[]>(`${API_BASE_URL}/finance/accounts`, { params: this.params(buildingId) });
  }

  createAccount(request: FinancialAccountUpsertRequest): Observable<FinancialAccount> {
    return this.http.post<FinancialAccount>(`${API_BASE_URL}/finance/accounts`, request);
  }

  updateAccount(id: string, request: FinancialAccountUpsertRequest): Observable<FinancialAccount> {
    return this.http.put<FinancialAccount>(`${API_BASE_URL}/finance/accounts/${id}`, request);
  }

  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/finance/accounts/${id}`);
  }

  setDefaultAccount(buildingId: string, accountId: string | null): Observable<FinanceSettings> {
    return this.http.put<FinanceSettings>(`${API_BASE_URL}/finance/settings/default-account`, { accountId }, { params: this.params(buildingId) });
  }

  // ── Libro: saldos, movimientos, flujo y tablero (hasta hoy y desde la fecha de arranque) ──

  getBalances(buildingId: string, asOf?: string): Observable<FinanceBalances> {
    let params = this.params(buildingId);
    if (asOf) params = params.set('asOf', asOf);
    return this.http.get<FinanceBalances>(`${API_BASE_URL}/finance/balances`, { params });
  }

  getMovements(buildingId: string, filters: FinanceMovementFilters = {}): Observable<FinanceMovementsPage> {
    let params = this.params(buildingId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.accountId) params = params.set('accountId', filters.accountId);
    if (filters.unassigned) params = params.set('unassigned', true);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.direction) params = params.set('direction', filters.direction);
    if (filters.newestFirst !== undefined) params = params.set('newestFirst', filters.newestFirst);
    if (filters.page) params = params.set('page', filters.page);
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize);
    return this.http.get<FinanceMovementsPage>(`${API_BASE_URL}/finance/movements`, { params });
  }

  getDashboard(buildingId: string, year?: number, month?: number): Observable<FinanceDashboard> {
    let params = this.params(buildingId);
    if (year) params = params.set('year', year);
    if (month) params = params.set('month', month);
    return this.http.get<FinanceDashboard>(`${API_BASE_URL}/finance/dashboard`, { params });
  }

  getCashFlow(buildingId: string, fiscalYear?: number): Observable<FinanceCashFlow> {
    let params = this.params(buildingId);
    if (fiscalYear) params = params.set('fiscalYear', fiscalYear);
    return this.http.get<FinanceCashFlow>(`${API_BASE_URL}/finance/cash-flow`, { params });
  }

  getCategories(buildingId: string): Observable<LedgerCategory[]> {
    return this.http.get<LedgerCategory[]>(`${API_BASE_URL}/finance/categories`, { params: this.params(buildingId) });
  }

  createCategory(request: LedgerCategoryUpsertRequest): Observable<LedgerCategory> {
    return this.http.post<LedgerCategory>(`${API_BASE_URL}/finance/categories`, request);
  }

  updateCategory(id: string, request: LedgerCategoryUpsertRequest): Observable<LedgerCategory> {
    return this.http.put<LedgerCategory>(`${API_BASE_URL}/finance/categories/${id}`, request);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/finance/categories/${id}`);
  }
}
