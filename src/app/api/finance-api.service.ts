import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  FinanceAdminBuilding,
  FinanceBalances,
  FinanceBudget,
  FinanceBudgetCell,
  FinanceBudgetVsActual,
  FinanceBuildingAccess,
  FinanceCashFlow,
  FinanceDashboard,
  FinanceMovementFilters,
  FinanceMovementsPage,
  FinanceReserveFund,
  FinanceSettings,
  FinanceSettingsUpdateRequest,
  FinancialAccount,
  FinancialAccountUpsertRequest,
  LedgerCategory,
  LedgerCategoryCopyRequest,
  LedgerCategoryCopyResult,
  LedgerCategoryUpsertRequest
} from './models';

export type FinanceExportKind = 'movements' | 'cash-flow' | 'budget' | 'budget-vs-actual' | 'reserve-fund' | 'chart' | 'accountant-pack';

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

  // ── Presupuesto, presupuesto vs. real y fondo de reserva ──

  getBudget(buildingId: string, fiscalYear?: number): Observable<FinanceBudget> {
    let params = this.params(buildingId);
    if (fiscalYear) params = params.set('fiscalYear', fiscalYear);
    return this.http.get<FinanceBudget>(`${API_BASE_URL}/finance/budget`, { params });
  }

  updateBudget(buildingId: string, fiscalYear: number, cells: FinanceBudgetCell[]): Observable<FinanceBudget> {
    const params = this.params(buildingId).set('fiscalYear', fiscalYear);
    return this.http.put<FinanceBudget>(`${API_BASE_URL}/finance/budget`, { cells }, { params });
  }

  copyPreviousBudget(buildingId: string, fiscalYear: number, overwrite: boolean): Observable<FinanceBudget> {
    const params = this.params(buildingId).set('fiscalYear', fiscalYear).set('overwrite', overwrite);
    return this.http.post<FinanceBudget>(`${API_BASE_URL}/finance/budget/copy-previous`, {}, { params });
  }

  fillBudgetFromAverage(buildingId: string, fiscalYear: number, months: number, overwrite: boolean): Observable<FinanceBudget> {
    const params = this.params(buildingId).set('fiscalYear', fiscalYear).set('months', months).set('overwrite', overwrite);
    return this.http.post<FinanceBudget>(`${API_BASE_URL}/finance/budget/fill-from-average`, {}, { params });
  }

  getBudgetVsActual(buildingId: string, year?: number, month?: number): Observable<FinanceBudgetVsActual> {
    let params = this.params(buildingId);
    if (year) params = params.set('year', year);
    if (month) params = params.set('month', month);
    return this.http.get<FinanceBudgetVsActual>(`${API_BASE_URL}/finance/budget-vs-actual`, { params });
  }

  getReserveFund(buildingId: string, from?: string, to?: string): Observable<FinanceReserveFund> {
    let params = this.params(buildingId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<FinanceReserveFund>(`${API_BASE_URL}/finance/reserve-fund`, { params });
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


  // ── Exportación a Excel (para el contador): el mismo contenido que las pantallas, con el código de cada rubro y el del contador ──

  downloadExport(kind: FinanceExportKind, buildingId: string, params: Record<string, string | number | boolean> = {}): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/finance/export/${kind}`, {
      params: new HttpParams({ fromObject: { buildingId, ...params } }),
      responseType: 'blob'
    });
  }
  // Copia el plan de cuentas de otro edificio (nombres, códigos del contador, rubros activos y rubros propios) sin tocar movimientos ni presupuesto.
  copyCategories(request: LedgerCategoryCopyRequest): Observable<LedgerCategoryCopyResult> {
    return this.http.post<LedgerCategoryCopyResult>(`${API_BASE_URL}/finance/categories/copy-from`, request);
  }
}
